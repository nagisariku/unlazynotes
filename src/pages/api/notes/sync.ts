import type { APIRoute } from 'astro';
import { getSessionUser } from '@/lib/session';
import { organizeUserNotes } from '@/lib/ai/batch-organizer';

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
    let targetNoteId: string | undefined = undefined;
    if (request.headers.get('content-type')?.includes('application/json')) {
      const body = await request.json().catch(() => ({}));
      if (body && typeof body.noteId === 'string' && body.noteId.trim()) {
        targetNoteId = body.noteId.trim();
      }
    }

    const clientTimezone = request.headers.get('x-user-timezone') || user.timezone;
    const result = await organizeUserNotes(user.id, targetNoteId, clientTimezone);

    const formattedNotes = result.items.map((item: any) => ({
      id: item.id,
      content: item.content,
      category: item.category,
      specificTags: item.specificTags,
      source: item.source || null,
      isEncrypted: Boolean(item.isEncrypted),
      vaultKey: item.vaultKey || null,
      isPinned: Boolean(item.isPinned),
      isProcessed: Boolean(item.isProcessed),
      targetDate: item.targetDate instanceof Date && !isNaN(item.targetDate.getTime())
        ? item.targetDate.toISOString()
        : (typeof item.targetDate === 'string' ? item.targetDate : null),
      attachments: item.attachments || [],
      createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : String(item.createdAt),
      expenses: item.expenses || [],
      income: item.income || [],
      debt: item.debt || [],
      todos: item.todos || [],
      schedule: item.schedule || null,
      scheduleDates: item.scheduleDates || [],
      bookmarkType: item.bookmarkType || null,
      credentialType: item.credentialType || null,
    }));

    return new Response(
      JSON.stringify({
        success: true,
        updatedCount: result.total,
        updatedNotes: formattedNotes,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    console.error(`[API Notes Sync Error] User ${user.id}:`, err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err?.message || 'Gagal sinkronisasi catatan dengan AI. Silakan coba lagi nanti.',
      }),
      {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
