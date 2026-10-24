/**
 * Automated Test Suite: Web UI Alignment, TargetDate Schema,
 * Human Intent Lock, and Multi-Schedule Calendar Logic.
 *
 * Usage: npx tsx scripts/test-web-sync-alignment.ts
 */

import { db } from '../src/db';
import { users, notes, apiKeys, subscriptions } from '../src/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { extractEarliestScheduleDate, extractAllDates } from '../src/lib/date-extractor';
import { processBookmarkNote } from '../src/lib/ai/modules/bookmark';
import { organizeUserNotes } from '../src/lib/ai/batch-organizer';
import crypto from 'node:crypto';

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`✅ PASS | ${message}`);
  } else {
    console.error(`❌ FAIL | ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('TESTING WEB UI ALIGNMENT, INTENT LOCK & CALENDAR');
  console.log('====================================================\n');

  const testUserId = `test-user-align-${Date.now()}`;
  const testEmail = `user-align-${Date.now()}@test.com`;

  try {
    // Setup test user
    await db.insert(users).values({
      id: testUserId,
      email: testEmail,
      name: 'Alignment Test User',
      tier: 'pro',
      preferredLocale: 'id',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // -------------------------------------------------------------
    // MODULE 1: Multi-Schedule Calendar Date Extraction
    // -------------------------------------------------------------
    console.log('--- MODULE 1: Multi-Schedule Earliest Anchor Date ---');

    const multiScheduleText = 'Senin 24 Okt meeting, Rabu 26 Okt flight, Jumat 28 Okt demo';
    const refAnchorDate = new Date('2026-10-20T00:00:00Z');

    const allDates = extractAllDates(multiScheduleText, refAnchorDate);
    assert(allDates.length === 3, 'Multi-schedule extracts exactly 3 mentioned dates');
    assert(allDates[0].date.getDate() === 24, 'First date matches 24 Okt');
    assert(allDates[1].date.getDate() === 26, 'Second date matches 26 Okt');
    assert(allDates[2].date.getDate() === 28, 'Third date matches 28 Okt');

    const earliestDate = extractEarliestScheduleDate(multiScheduleText, refAnchorDate);
    assert(earliestDate !== null, 'Earliest schedule date is not null');
    assert(earliestDate?.getDate() === 24, 'Earliest anchor date resolves to 24 Okt (Earliest Upcoming)');

    // Single date with time
    const singleSchedule = 'Meeting client tgl 25 okt jam 14:00 di kafe';
    const extractedSingle = extractEarliestScheduleDate(singleSchedule, refAnchorDate);
    assert(extractedSingle !== null && extractedSingle.getDate() === 25, 'Single schedule date resolves to 25 Okt');
    assert(extractedSingle?.getHours() === 14, 'Schedule time resolves to 14:00');

    // Relative date "besok"
    const relSchedule = 'besok ada evaluasi sprint jam 10 pagi';
    const extractedRel = extractEarliestScheduleDate(relSchedule, refAnchorDate);
    assert(extractedRel !== null && extractedRel.getDate() === 21, 'Relative date "besok" resolves to refDate + 1 day (21 Okt)');
    assert(extractedRel?.getHours() === 10, 'Relative date time resolves to 10:00');

    // -------------------------------------------------------------
    // MODULE 2: Multi-Link Bookmark Platform Tag Capping
    // -------------------------------------------------------------
    console.log('\n--- MODULE 2: Multi-Link Bookmark Tag Capping ---');

    const multiLinkText = `
      Referensi arsitektur & video:
      https://youtube.com/watch?v=12345
      https://github.com/org/repo
      https://twitter.com/user/status/987
      https://instagram.com/p/abc
      https://tiktok.com/@creator/video/111
      Koleksi materi animasi dan devops
    `;

    const bmResult = processBookmarkNote(multiLinkText);
    assert(bmResult.category === 'bookmark', 'Multi-link note correctly categorized as bookmark');
    assert(Array.isArray(bmResult.specific_tags), 'specific_tags is an array');

    // Platform tags should be capped to max 3 dominant platforms
    const platformKeywords = ['youtube', 'github', 'twitter', 'instagram', 'tiktok'];
    const presentPlatformTags = bmResult.specific_tags.filter((t) => platformKeywords.includes(t));
    assert(presentPlatformTags.length <= 3, `Platform tags capped to max 3 (got ${presentPlatformTags.length}: ${presentPlatformTags.join(', ')})`);
    assert(bmResult.specific_tags.length <= 5, 'Total bookmark tags capped within bounds (max 5)');

    // -------------------------------------------------------------
    // MODULE 3: Database targetDate & Attachments Preservation
    // -------------------------------------------------------------
    console.log('\n--- MODULE 3: Schema targetDate & Attachments ---');

    const noteScheduleId = `note-sch-${Date.now()}`;
    const scheduleDate = new Date('2026-10-24T09:00:00Z');

    await db.insert(notes).values({
      id: noteScheduleId,
      userId: testUserId,
      content: multiScheduleText,
      category: 'schedule',
      specificTags: ['schedule', 'meeting'],
      targetDate: scheduleDate,
      attachments: [
        {
          fileId: 'mock-att-1',
          type: 'image',
          fileName: 'rundown.webp',
          sizeBytes: 45000,
        },
      ],
      isProcessed: true,
      createdAt: new Date(),
    });

    const [savedSchedule] = await db
      .select()
      .from(notes)
      .where(eq(notes.id, noteScheduleId))
      .limit(1);

    assert(savedSchedule !== undefined, 'Schedule note persisted in DB');
    assert(savedSchedule.targetDate !== null, 'targetDate column stores timestamp with timezone');
    assert(new Date(savedSchedule.targetDate!).getDate() === 24, 'targetDate day matches 24');
    assert(Array.isArray(savedSchedule.attachments) && savedSchedule.attachments.length === 1, 'attachments jsonb persisted');
    assert(savedSchedule.attachments[0].fileName === 'rundown.webp', 'attachment fileName preserved');

    // -------------------------------------------------------------
    // MODULE 4: Human Intent Lock (Web Edit Protects from AI Overwrite)
    // -------------------------------------------------------------
    console.log('\n--- MODULE 4: Human Intent Lock & AI Invariant ---');

    // 4a. Note created with isProcessed = false (unorganized from Telegram/General)
    const rawNoteId = `note-raw-${Date.now()}`;
    await db.insert(notes).values({
      id: rawNoteId,
      userId: testUserId,
      content: 'beli susu ultra dan telur ayam',
      category: 'others',
      specificTags: [],
      isProcessed: false,
      createdAt: new Date(),
    });

    // 4b. User edits deliberately via Web -> isProcessed locks to true
    await db
      .update(notes)
      .set({
        category: 'todo',
        specificTags: ['belanja', 'supermarket'],
        isProcessed: true, // Human Intent Lock
      })
      .where(eq(notes.id, rawNoteId));

    const [lockedNote] = await db
      .select()
      .from(notes)
      .where(eq(notes.id, rawNoteId))
      .limit(1);

    assert(lockedNote.isProcessed === true, 'deliberate web edit marks note isProcessed = true');
    assert(lockedNote.category === 'todo', 'Category set to todo');

    // 4c. Run batch organizer: AI DILARANG KERAS menyentuh note yang sudah isProcessed = true!
    const batchRes = await organizeUserNotes(testUserId);
    assert(batchRes.total === 0, 'Batch organizer finds 0 unorganized notes (locked note not touched)');

    const [verifiedNote] = await db
      .select()
      .from(notes)
      .where(eq(notes.id, rawNoteId))
      .limit(1);

    assert(verifiedNote.category === 'todo', 'Locked note category untouched by batch organizer');
    assert(verifiedNote.specificTags.includes('belanja'), 'Locked note specificTags untouched');

    // 4d. Create actual unorganized schedule note and verify batch sync assigns targetDate
    const unorgScheduleId = `note-unorg-sch-${Date.now()}`;
    await db.insert(notes).values({
      id: unorgScheduleId,
      userId: testUserId,
      content: 'flight garuda indonesia ke bali 29 okt jam 15:00',
      category: 'others',
      specificTags: [],
      isProcessed: false,
      createdAt: new Date('2026-10-20T00:00:00Z'),
    });

    const batchRes2 = await organizeUserNotes(testUserId);
    assert(batchRes2.total === 1, 'Batch organizer picked up exactly 1 unorganized note');

    const [organizedSchNote] = await db
      .select()
      .from(notes)
      .where(eq(notes.id, unorgScheduleId))
      .limit(1);

    assert(organizedSchNote.isProcessed === true, 'Organized note marked isProcessed = true');
    assert(organizedSchNote.category === 'schedule', 'Organized note classified as schedule');
    assert(organizedSchNote.targetDate !== null, 'Organized schedule note has targetDate populated');
    assert(new Date(organizedSchNote.targetDate!).getDate() === 29, 'targetDate day matches 29');

    // -------------------------------------------------------------
    // MODULE 5: Attachment Removal (Web Edit)
    // -------------------------------------------------------------
    console.log('\n--- MODULE 5: Attachment Removal in Web Edit ---');

    const multiAttNoteId = `note-multi-att-${Date.now()}`;
    await db.insert(notes).values({
      id: multiAttNoteId,
      userId: testUserId,
      content: 'Kwitansi renovasi kantor',
      category: 'finance',
      specificTags: ['renovasi', 'kantor'],
      attachments: [
        { fileId: 'att-1', type: 'image', fileName: 'nota1.webp' },
        { fileId: 'att-2', type: 'file', fileName: 'surat.pdf' },
      ],
      isProcessed: true,
      createdAt: new Date(),
    });

    // Simulate user removing att-2 via Web Edit
    const updatedAttachments = [{ fileId: 'att-1', type: 'image' as const, fileName: 'nota1.webp' }];
    await db
      .update(notes)
      .set({
        attachments: updatedAttachments,
        isProcessed: true,
      })
      .where(eq(notes.id, multiAttNoteId));

    const [afterDeleteAtt] = await db
      .select()
      .from(notes)
      .where(eq(notes.id, multiAttNoteId))
      .limit(1);

    assert(afterDeleteAtt.attachments.length === 1, 'Attachment array successfully updated to length 1');
    assert(afterDeleteAtt.attachments[0].fileName === 'nota1.webp', 'Remaining attachment is nota1.webp');

    // Cleanup
    console.log('\n--- Cleaning up test data ---');
    await db.delete(notes).where(eq(notes.userId, testUserId));
    await db.delete(users).where(eq(users.id, testUserId));
    console.log('Cleanup complete.');

    console.log('\n====================================================');
    console.log(`TEST RESULTS: ${passedTests} / ${totalTests} assertions passed`);
    console.log('====================================================');
    console.log('🎉 ALL TESTS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('Test execution failed:', err);
    try {
      await db.delete(notes).where(eq(notes.userId, testUserId));
      await db.delete(users).where(eq(users.id, testUserId));
    } catch {}
    process.exit(1);
  }
}

runTests().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
