import type { APIRoute } from 'astro';
import { getSessionUser } from '@/lib/session';
import { db } from '@/db';
import { notes, type NoteCategory } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { generateNoteTags } from '@/lib/ai';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 1. Fetch user's uncategorized notes (category: 'others')
  const uncategorizedList = await db
    .select()
    .from(notes)
    .where(and(eq(notes.userId, user.id), eq(notes.category, 'others')))
    .limit(20);

  if (uncategorizedList.length === 0) {
    return new Response(
      JSON.stringify({ success: true, updatedCount: 0, updatedNotes: [] }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // 2. Fetch existing tags for context
  let existingUserTags: string[] = [];
  try {
    const userNotes = await db.query.notes.findMany({
      where: eq(notes.userId, user.id),
      columns: { specificTags: true },
      limit: 50,
    });
    existingUserTags = Array.from(new Set(userNotes.flatMap((n) => n.specificTags || [])));
  } catch {
    // Non-fatal
  }

  const updatedNotes = [];

  // 3. Process each note with AI categorization
  for (const n of uncategorizedList) {
    try {
      const tagResult = await generateNoteTags(n.content, existingUserTags);
      const newCategory = (tagResult.category || 'others') as NoteCategory;
      const newTags = Array.from(
        new Set([...(n.specificTags || []), ...(tagResult.specific_tags || [])])
      );

      // Only update if category changed from 'others' or new tags were discovered
      if (newCategory !== 'others' || newTags.length > (n.specificTags || []).length) {
        const [updated] = await db
          .update(notes)
          .set({
            category: newCategory,
            specificTags: newTags,
            isProcessed: true,
          })
          .where(and(eq(notes.id, n.id), eq(notes.userId, user.id)))
          .returning();

        if (updated) {
          updatedNotes.push({
            id: updated.id,
            content: updated.content,
            category: updated.category,
            specificTags: updated.specificTags,
            source: updated.source,
            isEncrypted: updated.isEncrypted,
            vaultKey: updated.vaultKey,
            isPinned: updated.isPinned,
            attachments: updated.attachments,
            createdAt: updated.createdAt.toISOString(),
          });
        }
      }
    } catch (err) {
      console.error(`Failed to categorize note ${n.id} with AI:`, err);
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      updatedCount: updatedNotes.length,
      updatedNotes,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
};
