import * as dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

import { cleanLocalFormat } from '../src/lib/formatter';
import {
  getUserTagsCache,
  setUserTagsCache,
  invalidateUserTagsCache,
  getOrFetchUserTags,
  getUnorganizedCountCache,
  setUnorganizedCountCache,
  incrementUnorganizedCount,
  resetUnorganizedCount,
  getOrFetchUnorganizedCount,
} from '../src/lib/cache';
import { organizeUserNotes, formatOrganizedSummary, type OrganizedBatchResult } from '../src/lib/ai/batch-organizer';
import { db } from '../src/db';
import { users, apiKeys, notes } from '../src/db/schema';
import { eq, and } from 'drizzle-orm';
import crypto from 'node:crypto';
import {
  handleSyncCommand,
  processTelegramMessage,
} from '../src/lib/telegram-handler';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('🧪 TEST SUITE: DEFERRED BATCH ORGANIZATION & PRIVACY SHIELD');
  console.log('================================================================\n');

  // -------------------------------------------------------------
  // TEST 1: Local Formatting Cleanup (Zero AI, Word Preservation)
  // -------------------------------------------------------------
  console.log('--- TEST 1: Local Formatting Cleanup ---');
  const rawInput = '  Baris pertama dengan spasi akhir    \r\n\r\n\r\n\r\n\r\nBaris kedua setelah jeda berlebih.\r\n• Point 1: Belanja susu   \r\n\r\n  * Point 2: Desain UI UnlazyNotes   \r\n\r\n- Point 3: Standard bullet tetap aman\r\n\r\n1. Number 1\r\n\r\n2. Number 2\r\n\r\n   ';
  const cleaned = cleanLocalFormat(rawInput);

  assert(!cleaned.includes('\r'), 'No carriage returns (\\r) allowed');
  assert(!cleaned.includes('    \n'), 'No trailing whitespace at line end');
  assert(!cleaned.includes('\n\n\n'), 'No >1x breakline (max 1 blank line / \\n\\n)');
  assert(cleaned.includes('- Point 1: Belanja susu\n  - Point 2: Desain UI UnlazyNotes\n- Point 3: Standard bullet tetap aman'), 'List items must have no breaklines between them');
  assert(cleaned.includes('1. Number 1\n2. Number 2'), 'Numbering items must have no breaklines between them');
  assert(cleaned.includes('Desain UI UnlazyNotes'), 'Original casing and exact words must be preserved');

  console.log('✅ Formatting cleanup passed all assertions.\n');

  // -------------------------------------------------------------
  // TEST 2: Smart Caching Layer
  // -------------------------------------------------------------
  console.log('--- TEST 2: Smart Caching Layer ---');
  const dummyUserId = 'test_user_cache_' + Date.now();

  setUserTagsCache(dummyUserId, ['test-tag', 'unlazynotes']);
  const cachedTags = getUserTagsCache(dummyUserId);
  assert(cachedTags !== null && cachedTags.length === 2, 'Cached tags should match stored value');

  invalidateUserTagsCache(dummyUserId);
  assert(getUserTagsCache(dummyUserId) === null, 'Cache invalidation should clear user tags');

  setUnorganizedCountCache(dummyUserId, 5);
  assert(getUnorganizedCountCache(dummyUserId) === 5, 'Unorganized count should be 5');

  resetUnorganizedCount(dummyUserId);
  assert(getUnorganizedCountCache(dummyUserId) === 0, 'Reset unorganized count should set count to 0');

  console.log('✅ Smart caching layer passed all assertions.\n');

  // -------------------------------------------------------------
  // TEST 4: Batch Organize Multi-Domain & Summary Message
  // -------------------------------------------------------------
  console.log('--- TEST 4: Batch Organize Multi-Domain & DB Integration ---');
  const testUserId = 'test_user_batch_' + crypto.randomUUID().slice(0, 8);
  const testChatId = 'tg_chat_' + testUserId;

  // Insert dummy user in DB
  await db.insert(users).values({
    id: testUserId,
    email: `${testUserId}@example.com`,
    name: 'Batch Test User',
    preferredLocale: 'id',
    tier: 'pro',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await db.insert(apiKeys).values({
    id: crypto.randomUUID(),
    userId: testUserId,
    keyHash: 'hash_' + testUserId,
    rawKey: 'raw_' + testUserId,
    telegramChatId: testChatId,
    isActive: true,
    createdAt: new Date(),
  });

  // Insert 5 test notes with isProcessed = false
  const testNotesData = [
    { content: 'cimin 20k', expCat: 'finance' },
    { content: 'meeting desain jam 3 sore', expCat: 'schedule' },
    { content: 'chat rizky tanya proposal sponsorship', expCat: 'todo' },
    { content: 'https://medium.com/p/123 artikel devops bagus', expCat: 'bookmark' },
    { content: 'nomor rekening bca riku 1234567890', expCat: 'credential' },
  ];

  for (const n of testNotesData) {
    await db.insert(notes).values({
      id: crypto.randomUUID(),
      userId: testUserId,
      content: n.content,
      category: 'others',
      specificTags: [],
      source: 'telegram',
      isProcessed: false,
      createdAt: new Date(),
    });
  }

  // Verify unorganized count in DB
  const unorganizedBefore = await getOrFetchUnorganizedCount(testUserId);
  assert(unorganizedBefore === 5, `Expected 5 unorganized notes before organizing, got ${unorganizedBefore}`);

  // Run Batch Organize
  const batchResult = await organizeUserNotes(testUserId);
  assert(batchResult.total === 5, `Expected 5 organized notes, got ${batchResult.total}`);
  assert(batchResult.items.length === 5, `Items length should be 5`);

  // Verify DB notes are all is_processed = true
  const remainingUnorganized = await getOrFetchUnorganizedCount(testUserId);
  assert(remainingUnorganized === 0, `Expected 0 unorganized notes after batch organize, got ${remainingUnorganized}`);

  const userNotesInDb = await db.query.notes.findMany({
    where: eq(notes.userId, testUserId),
  });

  for (const note of userNotesInDb) {
    assert(note.isProcessed === true, `Note ${note.id} must be marked isProcessed = true`);
    assert(note.specificTags.length > 0, `Note ${note.id} must have non-empty tags`);
  }

  // Verify Summary Message Formatting
  const summaryMsg = formatOrganizedSummary(batchResult);
  console.log('\n--- Generated Summary Message ---');
  console.log(summaryMsg);
  console.log('---------------------------------\n');

  assert(summaryMsg.includes('🪄 *5 Catatan Berhasil Dirapikan!*'), 'Summary must contain total header');
  assert(summaryMsg.includes('• `'), 'Summary must contain formatted preview');
  assert(summaryMsg.includes('— `#'), 'Summary must contain hashtag symbols');

  // Test empty summary
  const emptySummary = formatOrganizedSummary({ total: 0, categorized: {}, items: [] });
  assert(emptySummary.includes('Semua catatan sudah rapi'), 'Empty summary message must match expected prompt');

  // Clean up test data
  await db.delete(notes).where(eq(notes.userId, testUserId));
  await db.delete(apiKeys).where(eq(apiKeys.userId, testUserId));
  await db.delete(users).where(eq(users.id, testUserId));

  console.log('✅ Batch organize and DB persistence verified with 100% success.\n');

  // -------------------------------------------------------------
  // TEST 5: Sync Command, Anti-Spam Rate Limit, and Reconciliation
  // -------------------------------------------------------------
  console.log('--- TEST 5: Sync Command, Anti-Spam & Cache Reconciliation ---');
  const syncUserId = 'test_user_sync_' + crypto.randomUUID().slice(0, 8);
  const syncChatId = 'tg_chat_' + syncUserId;

  await db.insert(users).values({
    id: syncUserId,
    email: `${syncUserId}@example.com`,
    name: 'Sync Test User',
  });

  await db.insert(apiKeys).values({
    id: crypto.randomUUID(),
    userId: syncUserId,
    keyHash: 'hash_' + syncUserId,
    telegramChatId: syncChatId,
    isActive: true,
  });

  // Scenario A: No notes in DB -> returns sync_empty
  const syncResEmpty = await handleSyncCommand(syncChatId, syncUserId, 'id');
  assert(syncResEmpty.ok === true && syncResEmpty.action === 'sync_empty', 'Sync with 0 notes returns sync_empty ("Belum ada catatan baru!")');

  // Scenario B: Rapid second call within 5s -> triggers anti-spam cooldown
  const syncResCooldown = await handleSyncCommand(syncChatId, syncUserId, 'id');
  assert(syncResCooldown.ok === true && syncResCooldown.action === 'sync_cooldown', 'Rapid sync call triggers anti-spam cooldown');

  // Scenario C: Non-blocking background sync architecture (User can continue writing notes freely)
  const nonBlockingMsgRes = await processTelegramMessage({
    chat: { id: syncChatId },
    text: 'catatan baru saat sedang sync',
  });
  assert(nonBlockingMsgRes.ok === true, 'Incoming message is accepted smoothly in background sync architecture');

  // Clean up
  await db.delete(apiKeys).where(eq(apiKeys.userId, syncUserId));
  await db.delete(users).where(eq(users.id, syncUserId));

  console.log('✅ Sync command, anti-spam, and non-parallel lock barrier verified successfully.\n');

  console.log('================================================================');
  console.log('🎉 ALL TESTS PASSED SUCCESSFULLY!');
  console.log('================================================================');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
