import { db } from '@/db';
import { notes } from '@/db/schema';
import { and, eq, lte, isNotNull } from 'drizzle-orm';

/**
 * Automatically archives expired ephemeral notes (expires_at <= now and is_archived = false).
 * Can be called silently on dashboard SSR or background sync cycles.
 * Returns the number of notes archived.
 */
export async function autoArchiveExpiredNotes(): Promise<number> {
  try {
    const now = new Date();
    const updated = await db
      .update(notes)
      .set({ isArchived: true })
      .where(
        and(
          eq(notes.isArchived, false),
          isNotNull(notes.expiresAt),
          lte(notes.expiresAt, now)
        )
      )
      .returning({ id: notes.id });

    return updated.length;
  } catch (err) {
    console.warn('[Auto-Cleaner] Failed to auto-archive expired notes:', err);
    return 0;
  }
}
