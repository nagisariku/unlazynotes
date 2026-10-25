import assert from 'node:assert';
import { db } from '../src/db';
import { users, apiKeys, notes } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import { processTelegramMessage } from '../src/lib/telegram-handler';

async function run() {
  console.log('=== Testing Telegram Command Shortcuts ===');

  const testChatId = 'test_shortcuts_chat_123';
  const testUserId = 'test_shortcuts_user_123';
  const testKeyId = 'test_shortcuts_key_123';

  // Cleanup old test data
  await db.delete(notes).where(eq(notes.userId, testUserId));
  await db.delete(apiKeys).where(eq(apiKeys.userId, testUserId));
  await db.delete(users).where(eq(users.id, testUserId));

  // Create test user and api key
  await db.insert(users).values({
    id: testUserId,
    name: 'Shortcut Tester',
    email: 'tester@example.com',
    emailVerified: true,
    tier: 'pro',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await db.insert(apiKeys).values({
    id: testKeyId,
    userId: testUserId,
    keyHash: 'dummy_hash',
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

  // 1. /rd (shortcut /read)
  const resRd = await processTelegramMessage(makeMsg('/rd') as any);
  console.log('/rd result:', resRd.action);
  assert(resRd.action === 'read_empty' || resRd.action === 'read_list', 'Expected /rd to trigger read');

  // 2. /rv (shortcut /review)
  const resRv = await processTelegramMessage(makeMsg('/rv') as any);
  console.log('/rv result:', resRv.action);
  assert(resRv.action === 'review_empty' || resRv.action === 'review_list', 'Expected /rv to trigger review');

  // 3. /tg (shortcut /tags)
  const resTg = await processTelegramMessage(makeMsg('/tg') as any);
  console.log('/tg result:', resTg.action);
  assert(resTg.action === 'tags_empty' || resTg.action === 'tags_list', 'Expected /tg to trigger tags');

  // 4. /src (shortcut /search)
  const resSrcMissing = await processTelegramMessage(makeMsg('/src') as any);
  console.log('/src missing keyword:', resSrcMissing.action);
  assert(resSrcMissing.action === 'search_missing_keyword', 'Expected /src to trigger search missing keyword');

  const resSrc = await processTelegramMessage(makeMsg('/src belanja') as any);
  console.log('/src with keyword:', resSrc.action);
  assert(resSrc.action === 'search_empty' || resSrc.action === 'search_list', 'Expected /src to trigger search');

  // 5. /sc (shortcut /secure)
  const resScMissing = await processTelegramMessage(makeMsg('/sc') as any);
  console.log('/sc missing params:', resScMissing.action);
  assert(resScMissing.action === 'secure_missing_params', 'Expected /sc to trigger secure missing params');

  const resSc = await processTelegramMessage(makeMsg('/sc pin_atm 123456') as any);
  console.log('/sc saved:', resSc.action);
  assert(resSc.action === 'secure_saved', 'Expected /sc to save secure secret');

  // 6. /vl (shortcut /vault)
  const resVl = await processTelegramMessage(makeMsg('/vl') as any);
  console.log('/vl result:', resVl.action);
  assert(resVl.action === 'vault_list' || resVl.action === 'vault_revealed_multiple' || resVl.action === 'vault_empty', 'Expected /vl to trigger vault');

  // 7. /tp (shortcut /temporary)
  const resTpMissing = await processTelegramMessage(makeMsg('/tp') as any);
  console.log('/tp missing content:', resTpMissing.action);
  assert(resTpMissing.action === 'temp_missing_content', 'Expected /tp to trigger temp missing content');

  const resTp = await processTelegramMessage(makeMsg('/tp Catatan sementara test') as any);
  console.log('/tp saved:', resTp.action);
  assert(resTp.action === 'temp_saved', 'Expected /tp to save temporary note');

  // Cleanup
  await db.delete(notes).where(eq(notes.userId, testUserId));
  await db.delete(apiKeys).where(eq(apiKeys.userId, testUserId));
  await db.delete(users).where(eq(users.id, testUserId));

  console.log('✅ ALL 7 COMMAND SHORTCUTS PASSED PERFECTLY!');
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
