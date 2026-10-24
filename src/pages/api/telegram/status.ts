import type { APIRoute } from 'astro';
import { getSessionUser } from '@/lib/session';
import { db } from '@/db';
import { apiKeys } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const [apiKeyRecord] = await db
    .select({
      telegramChatId: apiKeys.telegramChatId,
    })
    .from(apiKeys)
    .where(eq(apiKeys.userId, user.id))
    .limit(1);

  const connected = Boolean(apiKeyRecord?.telegramChatId);

  return new Response(
    JSON.stringify({
      ok: true,
      connected,
      telegramChatId: apiKeyRecord?.telegramChatId || null,
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    }
  );
};
