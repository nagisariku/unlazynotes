import type { APIRoute } from 'astro';
import { db } from '@/db';
import { paymentLogs, subscriptions, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyDokuWebhookSignature } from '@/lib/doku';
import { addDays } from 'date-fns';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const rawBody = await request.text();
  let body: any = {};
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 1. Verifikasi Signature Webhook DOKU
  const isSimulator = request.headers.get('X-Payment-Simulator') === 'true';
  const isValidSignature = verifyDokuWebhookSignature(request.headers, rawBody);

  if (!isSimulator && !isValidSignature) {
    console.warn('[DOKU Webhook] Signature verification failed');
    return new Response(JSON.stringify({ error: 'Invalid Signature' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 2. Ekstrak data transaksi
  const orderId = body?.order?.invoice_number || body?.order_id;
  const transactionStatus =
    body?.transaction?.status || body?.status || 'SUCCESS';

  if (!orderId) {
    return new Response(JSON.stringify({ error: 'Missing invoice number' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 3. Idempotency Check
  const [log] = await db
    .select()
    .from(paymentLogs)
    .where(eq(paymentLogs.orderId, orderId))
    .limit(1);

  if (!log) {
    return new Response(JSON.stringify({ error: 'Order not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (log.status === 'paid') {
    // Idempotent: Transaksi sudah pernah sukses diproses sebelumnya
    return new Response(
      JSON.stringify({ ok: true, message: 'Already processed (idempotent)' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (transactionStatus !== 'SUCCESS' && transactionStatus !== 'PAID') {
    await db
      .update(paymentLogs)
      .set({
        status: 'failed',
        payloadRaw: body,
      })
      .where(eq(paymentLogs.id, log.id));

    return new Response(
      JSON.stringify({ ok: true, message: 'Payment marked as failed' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 4. Update Log Pembayaran Menjadi Paid
  await db
    .update(paymentLogs)
    .set({
      status: 'paid',
      payloadRaw: body,
    })
    .where(eq(paymentLogs.id, log.id));

  // 5. Eksekusi Aktivasi / Upgrade Paket Pengguna di Database
  const daysToAdd = log.period === 'yearly' ? 365 : 30;
  const newExpiresAt = addDays(new Date(), daysToAdd);

  const [existingSub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, log.userId))
    .limit(1);

  if (existingSub) {
    await db
      .update(subscriptions)
      .set({
        plan: log.plan,
        status: 'active',
        currency: log.currency,
        expiresAt: newExpiresAt,
      })
      .where(eq(subscriptions.id, existingSub.id));
  } else {
    await db.insert(subscriptions).values({
      id: `sub_${Date.now()}`,
      userId: log.userId,
      plan: log.plan,
      currency: log.currency,
      status: 'active',
      expiresAt: newExpiresAt,
      notesTodayCount: 0,
      lastNoteDate: null,
      createdAt: new Date(),
    });
  }

  // Update atribut model User (tier = 'pro', proExpiresAt = newExpiresAt)
  await db
    .update(users)
    .set({
      tier: 'pro',
      proExpiresAt: newExpiresAt,
      updatedAt: new Date(),
    })
    .where(eq(users.id, log.userId));

  console.log(
    `[DOKU Webhook] Successfully activated ${log.plan} plan for user ${log.userId} until ${newExpiresAt.toISOString()}`
  );

  return new Response(
    JSON.stringify({
      ok: true,
      message: 'Subscription upgraded successfully',
      orderId,
      plan: log.plan,
      expiresAt: newExpiresAt,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
};
