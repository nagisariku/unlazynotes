import type { APIRoute } from 'astro';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { ensureUserInitialResources } from '@/lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  let email = 'user@unlazynotes.local';
  let name = 'Unlazy Explorer';

  try {
    const body = await request.json();
    if (body.email) email = body.email.trim();
    if (body.name) name = body.name.trim();
  } catch {}

  let [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  let userId = existing?.id;
  if (!existing) {
    userId = `usr_${Date.now()}`;
    await db.insert(users).values({
      id: userId,
      name,
      email,
      role: 'user',
      preferredLocale: 'id',
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // Ensure subscription and API key exist
  await ensureUserInitialResources(userId!);

  const headers = new Headers();
  headers.append('Content-Type', 'application/json');
  headers.append(
    'Set-Cookie',
    `dev_user_id=${userId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`
  );

  return new Response(
    JSON.stringify({
      success: true,
      userId,
      email,
      redirect: '/dashboard',
    }),
    { status: 200, headers }
  );
};
