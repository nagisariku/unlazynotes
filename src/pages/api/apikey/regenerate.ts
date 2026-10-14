import type { APIRoute } from 'astro';
import { db } from '@/db';
import { apiKeys } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getSessionUser } from '@/lib/session';
import { generateApiKey } from '@/lib/telegram';
import crypto from 'node:crypto';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { rawKey, keyHash } = generateApiKey();

  const [existingKey] = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.userId, user.id))
    .limit(1);

  if (existingKey) {
    await db
      .update(apiKeys)
      .set({
        keyHash,
        telegramChatId: null, // Reset koneksi bot sebelumnya demi keamanan
        isActive: true,
      })
      .where(eq(apiKeys.id, existingKey.id));
  } else {
    await db.insert(apiKeys).values({
      id: `key_${crypto.randomUUID()}`,
      userId: user.id,
      keyHash,
      telegramChatId: null,
      isActive: true,
      createdAt: new Date(),
    });
  }

  return new Response(JSON.stringify({ success: true, apiKey: rawKey }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
