import { db } from '../src/db';
import { apiKeys, users, notes } from '../src/db/schema';
import { eq, and } from 'drizzle-orm';
import { processTelegramMessage } from '../src/lib/telegram-handler';

async function runTest() {
  console.log('=== Test Telegram Account Switching & Isolation ===\n');

  const CHAT_ID = '1038677085';
  const KEY_A_RAW = 'unz_3e8fe6a07d2433a733b5b3ed500b9083d499c1c14760ff6e'; // User A: riku@unlazynotes.local
  const KEY_B_RAW = 'unz_085cd4a83e67fc90c9886bc89ad3d58dd1002674ba5f5cc8'; // User B: riku.test@unlazynotes.local

  // Step 1: User A logs in
  console.log('[Step 1] User A logs in with /login KEY_A...');
  const resLoginA = await processTelegramMessage({
    chat: { id: CHAT_ID },
    text: `/login ${KEY_A_RAW}`,
  });
  console.log('Login A result:', resLoginA.action);

  const [dbKeyA1] = await db.select().from(apiKeys).where(eq(apiKeys.rawKey, KEY_A_RAW));
  const [dbKeyB1] = await db.select().from(apiKeys).where(eq(apiKeys.rawKey, KEY_B_RAW));
  console.log(`DB state -> User A: ${dbKeyA1.telegramChatId}, User B: ${dbKeyB1.telegramChatId}`);
  if (dbKeyA1.telegramChatId !== CHAT_ID || dbKeyB1.telegramChatId !== null) {
    throw new Error('Assertion failed: User A should be connected, User B should be null');
  }

  // Step 2: User B logs in with /login KEY_B on the SAME chatId
  console.log('\n[Step 2] User B logs in with /login KEY_B on SAME chatId...');
  const resLoginB = await processTelegramMessage({
    chat: { id: CHAT_ID },
    text: `/login ${KEY_B_RAW}`,
  });
  console.log('Login B result:', resLoginB.action);

  const [dbKeyA2] = await db.select().from(apiKeys).where(eq(apiKeys.rawKey, KEY_A_RAW));
  const [dbKeyB2] = await db.select().from(apiKeys).where(eq(apiKeys.rawKey, KEY_B_RAW));
  console.log(`DB state -> User A: ${dbKeyA2.telegramChatId}, User B: ${dbKeyB2.telegramChatId}`);
  if (dbKeyA2.telegramChatId !== null || dbKeyB2.telegramChatId !== CHAT_ID) {
    throw new Error('Assertion failed: User A should have been disconnected (null), User B should be connected');
  }

  // Step 3: Run /read on chatId
  console.log('\n[Step 3] Executing /read on chatId...');
  const resRead = await processTelegramMessage({
    chat: { id: CHAT_ID },
    text: '/read',
  });
  console.log('Read result action:', resRead.action, 'totalCount:', resRead.totalCount);

  // Verify that activeKey returned for chatId is User B (usr_test_riku_01)
  const [activeKey] = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.telegramChatId, CHAT_ID), eq(apiKeys.isActive, true)))
    .limit(1);

  console.log('Active key for chatId is userId:', activeKey?.userId);
  if (activeKey?.userId !== 'usr_test_riku_01') {
    throw new Error(`Assertion failed: expected usr_test_riku_01, got ${activeKey?.userId}`);
  }

  // Step 4: Verify notes for active user
  const userNotes = await db
    .select()
    .from(notes)
    .where(eq(notes.userId, activeKey.userId));
  console.log(`Notes count for User B: ${userNotes.length}`);
  console.log(`Note content: "${userNotes[0]?.content.slice(0, 50)}..."`);

  console.log('\n✅ ALL VERIFICATION CHECKS PASSED SUCCESSFULLY!');
  process.exit(0);
}

runTest().catch((e) => {
  console.error('❌ Test failed:', e);
  process.exit(1);
});
