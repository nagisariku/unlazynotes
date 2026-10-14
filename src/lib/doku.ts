import crypto from 'node:crypto';
import * as dotenv from 'dotenv';

dotenv.config();

export interface CreatePaymentParams {
  orderId: string;
  amount: number;
  currency: 'IDR' | 'USD';
  plan: 'standard' | 'pro';
  period: 'monthly' | 'yearly';
  customer: {
    id: string;
    name: string;
    email: string;
  };
}

export interface PaymentInitiationResult {
  orderId: string;
  paymentUrl: string;
  mode: 'real' | 'simulator';
}

/**
 * Generate HMAC-SHA256 Signature according to DOKU API specs.
 */
export function generateDokuSignature({
  clientId,
  requestId,
  requestTimestamp,
  requestTarget,
  rawBody,
  sharedKey,
}: {
  clientId: string;
  requestId: string;
  requestTimestamp: string;
  requestTarget: string;
  rawBody: string;
  sharedKey: string;
}): string {
  // 1. Calculate SHA-256 Digest of the body
  const digest = crypto.createHash('sha256').update(rawBody).digest('base64');

  // 2. Component signature string
  const componentString = `Client-Id:${clientId}\nRequest-Id:${requestId}\nRequest-Timestamp:${requestTimestamp}\nRequest-Target:${requestTarget}\nDigest:${digest}`;

  // 3. Compute HMAC-SHA256 with sharedKey
  const hmac = crypto
    .createHmac('sha256', sharedKey)
    .update(componentString)
    .digest('base64');

  return `HMACSHA256=${hmac}`;
}

/**
 * Verify incoming webhook signature from DOKU.
 */
export function verifyDokuWebhookSignature(
  headers: Headers,
  rawBody: string
): boolean {
  const sharedKey = process.env.DOKU_SHARED_KEY || 'default_shared_key_123';
  const incomingSignature =
    headers.get('Signature') || headers.get('signature');
  const clientId = headers.get('Client-Id') || headers.get('client-id') || '';
  const requestId = headers.get('Request-Id') || headers.get('request-id') || '';
  const requestTimestamp =
    headers.get('Request-Timestamp') || headers.get('request-timestamp') || '';
  const requestTarget = '/api/payment/webhook';

  if (!incomingSignature) return false;

  const expectedSignature = generateDokuSignature({
    clientId,
    requestId,
    requestTimestamp,
    requestTarget,
    rawBody,
    sharedKey,
  });

  return incomingSignature === expectedSignature;
}

/**
 * Initiate DOKU Checkout payment.
 * Returns either real DOKU Hosted Checkout URL or local simulator URL.
 */
export async function createDokuCheckout(
  params: CreatePaymentParams
): Promise<PaymentInitiationResult> {
  const clientId = process.env.DOKU_CLIENT_ID;
  const sharedKey = process.env.DOKU_SHARED_KEY;
  const apiBaseUrl =
    process.env.DOKU_API_BASE_URL || 'https://api-sandbox.doku.com';

  const isRealCredentials =
    Boolean(clientId) &&
    Boolean(sharedKey) &&
    !clientId?.startsWith('MCH-xxxx') &&
    !clientId?.startsWith('mock-');

  // If real credentials are provided, call official DOKU Checkout API
  if (isRealCredentials && clientId && sharedKey) {
    const requestId = crypto.randomUUID();
    const requestTimestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const requestTarget = '/checkout/v1/payment';

    const payload = {
      order: {
        invoice_number: params.orderId,
        amount: params.amount,
        currency: params.currency,
        callback_url: `${process.env.BETTER_AUTH_URL || 'http://localhost:4321'}/dashboard/settings?payment=success`,
      },
      payment: {
        payment_due_date: 60, // 60 minutes
      },
      customer: {
        id: params.customer.id,
        name: params.customer.name,
        email: params.customer.email,
      },
    };

    const rawBody = JSON.stringify(payload);
    const signature = generateDokuSignature({
      clientId,
      requestId,
      requestTimestamp,
      requestTarget,
      rawBody,
      sharedKey,
    });

    try {
      const response = await fetch(`${apiBaseUrl}${requestTarget}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Id': clientId,
          'Request-Id': requestId,
          'Request-Timestamp': requestTimestamp,
          Signature: signature,
        },
        body: rawBody,
      });

      const resJson = await response.json();
      if (resJson.response?.payment?.url) {
        return {
          orderId: params.orderId,
          paymentUrl: resJson.response.payment.url,
          mode: 'real',
        };
      }
    } catch (err) {
      console.warn('[DOKU] Failed to call live DOKU API, using simulator:', err);
    }
  }

  // Interactive Simulator URL for seamless testing
  const simulatorUrl = `/checkout/simulator?order_id=${encodeURIComponent(
    params.orderId
  )}&amount=${params.amount}&currency=${params.currency}&plan=${params.plan}&period=${params.period}`;

  return {
    orderId: params.orderId,
    paymentUrl: simulatorUrl,
    mode: 'simulator',
  };
}
