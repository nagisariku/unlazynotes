import type { APIRoute } from 'astro';
import { db } from '@/db';
import { notes } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getSessionUser } from '@/lib/session';
import { decryptSecret } from '@/lib/crypto';

export const prerender = false;

export const GET: APIRoute = async ({ params, request }) => {
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

  const [note] = await db
    .select()
    .from(notes)
    .where(and(eq(notes.id, id), eq(notes.userId, user.id)))
    .limit(1);

  if (!note) {
    return new Response(JSON.stringify({ error: 'Note not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!note.isEncrypted) {
    return new Response(
      JSON.stringify({
        content: note.content,
        isEncrypted: false,
        vaultKey: null,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    const plainContent = decryptSecret(note.content, user.id);
    return new Response(
      JSON.stringify({
        content: plainContent,
        isEncrypted: true,
        vaultKey: note.vaultKey,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    console.error(`[Decrypt API] Failed to decrypt note ${id}:`, err);
    return new Response(
      JSON.stringify({ error: 'Failed to decrypt vault content' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
