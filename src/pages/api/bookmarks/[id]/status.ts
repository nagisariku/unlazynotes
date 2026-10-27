import type { APIRoute } from 'astro';
import { db } from '@/db';
import { notes, type BookmarkMeta } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getSessionUser } from '@/lib/session';

export const prerender = false;

export const PATCH: APIRoute = async ({ request, params }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const noteId = params.id;
  if (!noteId) {
    return new Response(JSON.stringify({ error: 'ID catatan diperlukan' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const targetStatus = body?.status; // 'unread' | 'reading' | 'read'

    if (!targetStatus || !['unread', 'reading', 'read'].includes(targetStatus)) {
      return new Response(JSON.stringify({ error: 'Status tidak valid' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const [note] = await db
      .select()
      .from(notes)
      .where(and(eq(notes.id, noteId), eq(notes.userId, user.id)))
      .limit(1);

  if (!note) {
    return new Response(JSON.stringify({ error: 'Catatan tidak ditemukan' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

    const currentMeta: BookmarkMeta = note.bookmarkMeta || {
      primaryUrl: '',
      domain: '',
    };

    const updatedMeta: BookmarkMeta = {
      ...currentMeta,
      readingStatus: targetStatus,
      readAt: targetStatus === 'read' ? new Date().toISOString() : undefined,
    };

    await db
      .update(notes)
      .set({
        bookmarkMeta: updatedMeta,
      })
      .where(eq(notes.id, noteId));

    return new Response(
      JSON.stringify({
        success: true,
        readingStatus: targetStatus,
        bookmarkMeta: updatedMeta,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    console.error('[API PATCH /api/bookmarks/[id]/status Error]:', err);
    return new Response(
      JSON.stringify({ error: 'Terjadi kesalahan internal saat memperbarui status baca' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
