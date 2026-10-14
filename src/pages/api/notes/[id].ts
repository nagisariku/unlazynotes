import type { APIRoute } from 'astro';
import { db } from '@/db';
import { notes } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getSessionUser } from '@/lib/session';

export const prerender = false;

export const DELETE: APIRoute = async ({ params, request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { id } = params;
  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing note ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const [existing] = await db
    .select()
    .from(notes)
    .where(and(eq(notes.id, id), eq(notes.userId, user.id)))
    .limit(1);

  if (!existing) {
    return new Response(JSON.stringify({ error: 'Note not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  await db.delete(notes).where(eq(notes.id, id));

  return new Response(JSON.stringify({ success: true, deletedId: id }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
