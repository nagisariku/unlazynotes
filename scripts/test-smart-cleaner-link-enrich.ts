import { db } from '../src/db';
import { notes, users } from '../src/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { autoArchiveExpiredNotes } from '../src/lib/cleaner';
import { fetchLinkMetadata } from '../src/lib/link-enricher';
import { getTelegramMsg } from '../src/lib/i18n/telegram';
import { subDays, addDays } from 'date-fns';
import { nanoid } from 'nanoid';

async function runTests() {
  console.log('================================================================');
  console.log('🧪 TESTING SMART CLEANER & LINK METADATA ENRICHER');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  // --- 1. Test Link Enricher ---
  console.log('--- 1. Testing Link Metadata Enricher ---');
  try {
    const ytMeta = await fetchLinkMetadata('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    assert(Boolean(ytMeta), 'fetchLinkMetadata returns data for YouTube URL');
    assert(Boolean(ytMeta?.title), `YouTube title extracted: "${ytMeta?.title}"`);
    assert(Boolean(ytMeta?.author), `YouTube author extracted: "${ytMeta?.author}"`);
  } catch (err: any) {
    console.error('YouTube fetch error:', err.message);
    assert(false, 'YouTube oEmbed fetch threw error');
  }

  const nullMeta = await fetchLinkMetadata('not-a-valid-url');
  assert(nullMeta === null, 'Non-URL returns null cleanly');

  // --- 2. Test Telegram i18n for /temp ---
  console.log('\n--- 2. Testing Telegram i18n for /temp ---');
  const helpId = getTelegramMsg('help', 'id', { dashboardUrl: 'https://example.com' });
  const helpEn = getTelegramMsg('help', 'en', { dashboardUrl: 'https://example.com' });
  assert(helpId.includes('/temp <isi>'), 'help ID includes /temp <isi>');
  assert(helpEn.includes('/temp <content>'), 'help EN includes /temp <content>');

  // --- 3. Test Database Auto-Archive for Expired Notes ---
  console.log('\n--- 3. Testing autoArchiveExpiredNotes ---');
  const allUsers = await db.select().from(users).limit(1);
  if (allUsers.length === 0) {
    console.log('⚠️ No users in DB to test DB cleanup, skipping DB integration test');
  } else {
    const testUserId = allUsers[0].id;
    const now = new Date();

    // Insert 3 test notes
    const [expiredNote] = await db.insert(notes).values({
      id: nanoid(),
      userId: testUserId,
      content: 'TEST_EXPIRED_NOTE_AUTO_ARCHIVE',
      category: 'others',
      expiresAt: subDays(now, 2),
      isArchived: false,
    }).returning();

    const [futureNote] = await db.insert(notes).values({
      id: nanoid(),
      userId: testUserId,
      content: 'TEST_FUTURE_NOTE_AUTO_ARCHIVE',
      category: 'others',
      expiresAt: addDays(now, 5),
      isArchived: false,
    }).returning();

    const [normalNote] = await db.insert(notes).values({
      id: nanoid(),
      userId: testUserId,
      content: 'TEST_NORMAL_NOTE_AUTO_ARCHIVE',
      category: 'others',
      expiresAt: null,
      isArchived: false,
    }).returning();

    try {
      const archivedCount = await autoArchiveExpiredNotes();
      assert(archivedCount >= 1, `autoArchiveExpiredNotes archived ${archivedCount} note(s)`);

      const [checkExpired] = await db.select().from(notes).where(eq(notes.id, expiredNote.id));
      assert(checkExpired.isArchived === true, 'Expired note is now archived (isArchived = true)');

      const [checkFuture] = await db.select().from(notes).where(eq(notes.id, futureNote.id));
      assert(checkFuture.isArchived === false, 'Future note is NOT archived (isArchived = false)');

      const [checkNormal] = await db.select().from(notes).where(eq(notes.id, normalNote.id));
      assert(checkNormal.isArchived === false, 'Normal note without expiresAt is NOT archived');
    } finally {
      // Clean up test notes
      await db.delete(notes).where(inArray(notes.id, [expiredNote.id, futureNote.id, normalNote.id]));
    }
  }

  // --- 4. Test Bulk Operations Logic ---
  console.log('\n--- 4. Testing Bulk Actions (archive, restore, delete) ---');
  if (allUsers.length > 0) {
    const testUserId = allUsers[0].id;

    // Create 2 notes for bulk testing
    const [b1] = await db.insert(notes).values({
      id: nanoid(),
      userId: testUserId,
      content: 'TEST_BULK_NOTE_1',
      category: 'others',
      isArchived: false,
    }).returning();

    const [b2] = await db.insert(notes).values({
      id: nanoid(),
      userId: testUserId,
      content: 'TEST_BULK_NOTE_2',
      category: 'others',
      isArchived: false,
    }).returning();

    try {
      // Test bulk archive
      await db.update(notes).set({ isArchived: true }).where(inArray(notes.id, [b1.id, b2.id]));
      const archivedNotes = await db.select().from(notes).where(inArray(notes.id, [b1.id, b2.id]));
      assert(archivedNotes.every(n => n.isArchived === true), 'Bulk archive sets isArchived = true for all selected notes');

      // Test bulk restore
      await db.update(notes).set({ isArchived: false }).where(inArray(notes.id, [b1.id, b2.id]));
      const restoredNotes = await db.select().from(notes).where(inArray(notes.id, [b1.id, b2.id]));
      assert(restoredNotes.every(n => n.isArchived === false), 'Bulk restore sets isArchived = false for all selected notes');

      // Test bulk delete
      await db.delete(notes).where(inArray(notes.id, [b1.id, b2.id]));
      const remainingNotes = await db.select().from(notes).where(inArray(notes.id, [b1.id, b2.id]));
      assert(remainingNotes.length === 0, 'Bulk delete permanently removes notes');
    } catch (err: any) {
      console.error('Bulk test error:', err);
      assert(false, 'Bulk test threw error');
    }
  }

  console.log('\n================================================================');
  console.log(`SUMMARY: ${passed}/${passed + failed} TESTS PASSED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
