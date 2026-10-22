import type { APIRoute } from 'astro';
import { db } from '@/db';
import { notes, type NoteCategory } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getSessionUser } from '@/lib/session';
import { CATEGORIES } from '@/lib/constants';
import { encryptSecret, decryptSecret } from '@/lib/crypto';

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

export const PATCH: APIRoute = async ({ params, request }) => {
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

  try {
    const body = await request.json();
    const { content, category, specificTags, isPinned, isProcessed, vaultKey } = body;

    const updates: Partial<{
      content: string;
      category: NoteCategory;
      specificTags: string[];
      isPinned: boolean;
      isProcessed: boolean;
      vaultKey: string | null;
    }> = {};

    if (vaultKey !== undefined) {
      updates.vaultKey = vaultKey ? String(vaultKey).trim() : null;
    }

    if (isPinned !== undefined) {
      updates.isPinned = Boolean(isPinned);
    }

    if (isProcessed !== undefined) {
      updates.isProcessed = Boolean(isProcessed);
    }

    if (content !== undefined) {
      if (typeof content !== 'string' || !content.trim()) {
        return new Response(JSON.stringify({ error: 'Konten tidak boleh kosong' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      updates.content = existing.isEncrypted
        ? encryptSecret(content.trim(), user.id)
        : content.trim();
    }

    if (category !== undefined) {
      if (!CATEGORIES.includes(category as NoteCategory)) {
        return new Response(JSON.stringify({ error: 'Kategori tidak valid' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      updates.category = category as NoteCategory;
    }

    if (specificTags !== undefined) {
      if (!Array.isArray(specificTags)) {
        return new Response(JSON.stringify({ error: 'specificTags harus berupa array string' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const sanitized = specificTags
        .filter((t) => typeof t === 'string' && t.trim().length > 0)
        .map((t) => t.trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 20))
        .filter(Boolean);
      updates.specificTags = Array.from(new Set(sanitized));
    }

    if (Object.keys(updates).length === 0) {
      return new Response(JSON.stringify({ error: 'Tidak ada perubahan yang diberikan' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const [updated] = await db
      .update(notes)
      .set(updates)
      .where(eq(notes.id, id))
      .returning();

    return new Response(
      JSON.stringify({
        success: true,
        note: {
          id: updated.id,
          content: content !== undefined ? content.trim() : (existing.isEncrypted ? decryptSecret(updated.content, user.id) : updated.content),
          vaultKey: updated.vaultKey,
          isPinned: updated.isPinned,
          category: updated.category,
          specificTags: updated.specificTags,
          source: updated.source,
          createdAt: updated.createdAt.toISOString(),
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    console.error('[PATCH /api/notes/:id] Error updating note:', err);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

