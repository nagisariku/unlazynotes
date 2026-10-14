import type { APIRoute } from 'astro';
import { db } from '@/db';
import { notes } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getSessionUser } from '@/lib/session';
import { generateNetscapeBookmarksHtml } from '@/lib/export-bookmarks';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const bookmarkNotes = await db
    .select({
      id: notes.id,
      content: notes.content,
      specificTags: notes.specificTags,
      source: notes.source,
      createdAt: notes.createdAt,
    })
    .from(notes)
    .where(and(eq(notes.userId, user.id), eq(notes.category, 'bookmark')))
    .orderBy(desc(notes.createdAt));

  const htmlContent = generateNetscapeBookmarksHtml(bookmarkNotes);

  return new Response(htmlContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': 'attachment; filename="unlazynotes-bookmarks.html"',
      'Cache-Control': 'no-store',
    },
  });
};
