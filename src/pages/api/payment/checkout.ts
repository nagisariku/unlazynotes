import type { APIRoute } from 'astro';
import { db } from '@/db';
import { paymentLogs } from '@/db/schema';
import { getSessionUser } from '@/lib/session';
import { createDokuCheckout } from '@/lib/doku';
import crypto from 'node:crypto';

export const prerender = false;

const PRICING = {
  IDR: {
    standard: { monthly: 15000, yearly: 150000 },
    pro: { monthly: 15000, yearly: 150000 },
  },
  USD: {
    standard: { monthly: 1, yearly: 10 },
    pro: { monthly: 1, yearly: 10 },
  },
};

export const POST: APIRoute = async ({ request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {}

  const plan: 'standard' | 'pro' = body.plan === 'standard' ? 'standard' : 'pro';
  const period: 'monthly' | 'yearly' = body.period === 'yearly' ? 'yearly' : 'monthly';
  const currency: 'IDR' | 'USD' = body.currency === 'USD' ? 'USD' : 'IDR';

  const amount = PRICING[currency][plan][period];
  const orderId = `ORD-UNLAZY-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

  // Simpan initial log transaksi
  await db.insert(paymentLogs).values({
    id: `pay_${crypto.randomUUID()}`,
    userId: user.id,
    orderId,
    provider: 'doku',
    amount,
    currency,
    plan,
    period,
    status: 'pending',
    payloadRaw: { userEmail: user.email, plan, period, currency },
    createdAt: new Date(),
  });

  const checkoutResult = await createDokuCheckout({
    orderId,
    amount,
    currency,
    plan,
    period,
    customer: {
      id: user.id,
      name: user.name || 'Unlazy User',
      email: user.email,
    },
  });

  return new Response(
    JSON.stringify({
      success: true,
      orderId,
      amount,
      currency,
      paymentUrl: checkoutResult.paymentUrl,
      mode: checkoutResult.mode,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
};
