import type { APIRoute } from 'astro';
import { getSessionUser } from '@/lib/session';
import { answerNoteQuestion } from '@/lib/ask';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: {
    question?: string;
    category?: string;
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const question = body.question ? String(body.question).trim() : '';
  if (!question) {
    return new Response(JSON.stringify({ error: 'Pertanyaan tidak boleh kosong' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const category = body.category ? String(body.category).trim() : undefined;

  try {
    const answer = await answerNoteQuestion(user.id, question, category, body.history);
    return new Response(JSON.stringify({ answer }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[API /api/ask] Error answering note question:', err);
    return new Response(
      JSON.stringify({ error: err?.message || 'Gagal memproses pertanyaan ke AI' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
