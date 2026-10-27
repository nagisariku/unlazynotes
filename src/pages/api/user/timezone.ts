import type { APIRoute } from 'astro';
import { getSessionUser } from '@/lib/session';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { isValidTimezone, resolveUserTimezone } from '@/lib/timezone';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const [row] = await db
    .select({ timezone: users.timezone })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  return new Response(
    JSON.stringify({
      timezone: resolveUserTimezone(row?.timezone || user.timezone),
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
};

export const POST: APIRoute = async ({ request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const rawTz = typeof body.timezone === 'string' ? body.timezone.trim() : '';

    if (!isValidTimezone(rawTz)) {
      return new Response(
        JSON.stringify({ error: 'Invalid IANA timezone identifier' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    await db
      .update(users)
      .set({ timezone: rawTz, updatedAt: new Date() })
      .where(eq(users.id, user.id));

    return new Response(
      JSON.stringify({
        success: true,
        timezone: rawTz,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    console.error('[API /api/user/timezone] Error updating timezone:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to update user timezone' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
