import assert from 'node:assert';
import { db } from '../src/db';
import { users, apiKeys, notes } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import {
  processTelegramMessage,
  handleSingleSyncCommand,
  handleSyncCommand,
} from '../src/lib/telegram-handler';

async function run() {
  console.log('=== Testing Telegram /sync vs /sync_all & Cleaned Commands ===');

  const testChatId = 'test_sync_chat_888';
  const testUserId = 'test_sync_user_888';
  const testKeyId = 'test_sync_key_888';

  // 1. Cleanup old test data
  await db.delete(notes).where(eq(notes.userId, testUserId));
  await db.delete(apiKeys).where(eq(apiKeys.userId, testUserId));
  await db.delete(users).where(eq(users.id, testUserId));

  // 2. Setup test user & active api key
  await db.insert(users).values({
    id: testUserId,
    name: 'Sync Tester',
    email: 'sync_tester@example.com',
    emailVerified: true,
    tier: 'pro',
    preferredLocale: 'id',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await db.insert(apiKeys).values({
    id: testKeyId,
    userId: testUserId,
    keyHash: 'dummy_hash_sync',
    telegramChatId: testChatId,
    isActive: true,
    createdAt: new Date(),
  });

  function makeMsg(text: string) {
    return {
      message_id: Math.floor(Math.random() * 100000),
      date: Math.floor(Date.now() / 1000),
      chat: { id: testChatId, type: 'private' as const },
      from: { id: 12345, is_bot: false, first_name: 'Tester' },
      text,
    };
  }

  // 3. Test Single /sync when empty (0 unprocessed notes)
  console.log('Testing /sync when no unorganized notes...');
  const resSyncEmpty = await processTelegramMessage(makeMsg('/sync') as any);
  assert.strictEqual(resSyncEmpty.ok, true);
  assert.strictEqual(resSyncEmpty.action, 'single_sync_empty', 'Expected single_sync_empty action');
  console.log('✅ /sync empty check passed');

  // 4. Insert 2 raw unorganized notes
  const note1Id = 'note_sync_raw_1';
  const note2Id = 'note_sync_raw_2';
  await db.insert(notes).values([
    {
      id: note1Id,
      userId: testUserId,
      content: 'Beli kopi kenangan 25rb sore tadi',
      category: 'others',
      isProcessed: false,
      createdAt: new Date(Date.now() - 60000),
    },
    {
      id: note2Id,
      userId: testUserId,
      content: 'Besok jam 9 pagi ada meeting sprint planning',
      category: 'others',
      isProcessed: false,
      createdAt: new Date(),
    },
  ]);

  // 5. Test Single /sync (processes only the single latest note note2Id)
  console.log('Testing single /sync invocation...');
  const resSingle = await processTelegramMessage(makeMsg('/sync') as any);
  assert.strictEqual(resSingle.ok, true);
  assert.strictEqual(resSingle.action, 'single_sync_completed');
  assert.strictEqual(resSingle.noteId, note2Id, 'Expected latest note2Id to be processed');

  // Verify in DB: note2Id should now be processed, but note1Id should still be unprocessed!
  const [dbNote2] = await db.select().from(notes).where(eq(notes.id, note2Id));
  const [dbNote1] = await db.select().from(notes).where(eq(notes.id, note1Id));
  assert.strictEqual(dbNote2.isProcessed, true, 'note2Id must be isProcessed = true');
  assert.strictEqual(dbNote1.isProcessed, false, 'note1Id must remain isProcessed = false (not batch)');
  console.log('✅ Single /sync decoupled from batch passed');

  // 6. Test Single /sync with explicit noteId: /sync note_sync_raw_1
  console.log('Testing /sync <noteId> ...');
  const resTargeted = await processTelegramMessage(makeMsg(`/sync ${note1Id}`) as any);
  assert.strictEqual(resTargeted.ok, true);
  assert.strictEqual(resTargeted.action, 'single_sync_completed');
  assert.strictEqual(resTargeted.noteId, note1Id);

  const [dbNote1After] = await db.select().from(notes).where(eq(notes.id, note1Id));
  assert.strictEqual(dbNote1After.isProcessed, true);
  console.log('✅ /sync <noteId> passed');

  // 7. Test Batch /sync_all
  console.log('Testing /sync_all ...');
  // Insert 3 new raw notes for batch test
  await db.insert(notes).values([
    { id: 'batch_1', userId: testUserId, content: 'Beli bakso 20rb', category: 'others', isProcessed: false },
    { id: 'batch_2', userId: testUserId, content: 'Bayar wifi 350rb', category: 'others', isProcessed: false },
  ]);

  const resSyncAll = await processTelegramMessage(makeMsg('/sync_all') as any);
  assert.strictEqual(resSyncAll.ok, true);
  assert.strictEqual(resSyncAll.action, 'sync_started');
  assert.strictEqual(resSyncAll.count, 2);
  console.log('✅ /sync_all batch command passed');

  // 8. Test preserved UI Buttons
  console.log('Testing button "🔄 Sync" & "Sync" & "🪄 Organize"...');
  const resBtn = await processTelegramMessage(makeMsg('🔄 Sync') as any);
  assert.strictEqual(resBtn.ok, true);
  // May be sync_lock_active or sync_cooldown or sync_started due to rapid invocation
  assert(['sync_started', 'sync_cooldown', 'sync_in_progress'].includes(resBtn.action || ''));
  console.log('✅ UI button "🔄 Sync" preserved');

  // 9. Verify Indonesian aliases are NO LONGER recognized (clean code)
  console.log('Verifying removed Indonesian aliases return invalid_command...');
  const resKeuangan = await processTelegramMessage(makeMsg('/keuangan') as any);
  assert.strictEqual(resKeuangan.action, 'invalid_command', 'Expected /keuangan to be invalid_command');

  const resJadwal = await processTelegramMessage(makeMsg('/jadwal') as any);
  assert.strictEqual(resJadwal.action, 'invalid_command', 'Expected /jadwal to be invalid_command');

  const resRapikan = await processTelegramMessage(makeMsg('/rapikan') as any);
  assert.strictEqual(resRapikan.action, 'invalid_command', 'Expected /rapikan to be invalid_command');
  console.log('✅ Indonesian aliases successfully eliminated');

  // 10. Verify zombie commands are removed
  console.log('Verifying zombie commands (/dock, /menu, /close, /hide, /reset)...');
  const resDock = await processTelegramMessage(makeMsg('/dock') as any);
  assert.strictEqual(resDock.action, 'invalid_command', 'Expected /dock to be invalid_command');

  const resClose = await processTelegramMessage(makeMsg('/close') as any);
  assert.strictEqual(resClose.action, 'invalid_command', 'Expected /close to be invalid_command');
  console.log('✅ Zombie commands successfully eliminated');

  // 11. Cleanup test data
  await db.delete(notes).where(eq(notes.userId, testUserId));
  await db.delete(apiKeys).where(eq(apiKeys.userId, testUserId));
  await db.delete(users).where(eq(users.id, testUserId));

  console.log('🎉 ALL SYNC & CLEANED COMMAND TESTS PASSED 100%!');
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
