import type { APIRoute } from 'astro';
import { db } from '@/db';
import { notes } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { getSessionUser } from '@/lib/session';
import { invalidateUserTagsCache, resetUnorganizedCount } from '@/lib/cache';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const { action, noteIds } = body || {};

    if (!action || !['archive', 'delete', 'restore'].includes(action)) {
      return new Response(
        JSON.stringify({ error: 'Aksi tidak valid. Pilihan: archive, delete, restore' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!Array.isArray(noteIds) || noteIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Daftar ID catatan (noteIds) tidak boleh kosong' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const cleanIds = noteIds.map(String).filter(Boolean);

    let affectedCount = 0;

    if (action === 'archive') {
      const updated = await db
        .update(notes)
        .set({ isArchived: true })
        .where(and(eq(notes.userId, user.id), inArray(notes.id, cleanIds)))
        .returning({ id: notes.id });
      affectedCount = updated.length;
    } else if (action === 'restore') {
      const updated = await db
        .update(notes)
        .set({ isArchived: false })
        .where(and(eq(notes.userId, user.id), inArray(notes.id, cleanIds)))
        .returning({ id: notes.id });
      affectedCount = updated.length;
    } else if (action === 'delete') {
      const deleted = await db
        .delete(notes)
        .where(and(eq(notes.userId, user.id), inArray(notes.id, cleanIds)))
        .returning({ id: notes.id });
      affectedCount = deleted.length;
    }

    // Invalidate caches
    invalidateUserTagsCache(user.id);
    resetUnorganizedCount(user.id);

    return new Response(
      JSON.stringify({
        success: true,
        action,
        count: affectedCount,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[API POST /api/notes/bulk] Error:', err);
    return new Response(
      JSON.stringify({ error: 'Terjadi kesalahan saat memproses bulk action' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
