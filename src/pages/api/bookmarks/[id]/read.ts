import type { APIRoute } from 'astro';
import { getSessionUser } from '@/lib/session';
import { readAndSummarizeBookmark } from '@/lib/article-reader';

export const prerender = false;

export const POST: APIRoute = async ({ request, params }) => {
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
    const result = await readAndSummarizeBookmark(noteId, user.id);
    if (!result.success) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: 422,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        bookmarkMeta: result.bookmarkMeta,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    console.error('[API POST /api/bookmarks/[id]/read Error]:', err);
    return new Response(
      JSON.stringify({ error: 'Terjadi kesalahan sistem saat mengekstrak artikel' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
