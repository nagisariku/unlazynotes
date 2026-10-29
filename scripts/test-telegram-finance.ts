import assert from 'node:assert';
import { db } from '../src/db';
import { users, apiKeys, notes } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import { processTelegramMessage, processTelegramCallbackQuery, handleFinanceCommand } from '../src/lib/telegram-handler';
import { subMonths, startOfMonth, startOfWeek, addDays } from 'date-fns';

async function run() {
  console.log('=== Testing Telegram /finance Report Command ===');

  const testChatId = 'test_finance_chat_999';
  const testUserId = 'test_finance_user_999';
  const testKeyId = 'test_finance_key_999';

  // 1. Cleanup old test data
  await db.delete(notes).where(eq(notes.userId, testUserId));
  await db.delete(apiKeys).where(eq(apiKeys.userId, testUserId));
  await db.delete(users).where(eq(users.id, testUserId));

  // 2. Setup test user & active api key
  await db.insert(users).values({
    id: testUserId,
    name: 'Finance Tester',
    email: 'finance_tester@example.com',
    emailVerified: true,
    tier: 'pro',
    preferredLocale: 'id',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await db.insert(apiKeys).values({
    id: testKeyId,
    userId: testUserId,
    keyHash: 'dummy_hash_finance',
    telegramChatId: testChatId,
    isActive: true,
    createdAt: new Date(),
  });

  const now = new Date();

  // 3. Seed notes with financial entries across different dates:
  // Note A: Today (Expense: 50.000, Income: 200.000, Debt payable: 25.000, Debt receivable: 10.000)
  const todayDate = now;

  // Note B: Last month (Expense: 100.000, Income: 500.000, Debt payable: 0, Debt receivable: 50.000)
  const lastMonthDate = addDays(startOfMonth(subMonths(now, 1)), 2);

  // Note C: 3 months ago (Should NOT be counted anywhere)
  const threeMonthsAgoDate = addDays(startOfMonth(subMonths(now, 3)), 2);

  await db.insert(notes).values([
    {
      id: 'note_fin_today',
      userId: testUserId,
      content: 'Beli makan siang 50rb, gaji freelance 200rb, utang ke budi 25rb, piutang andi 10rb',
      category: 'finance',
      expenses: [{ item: 'Makan siang', amount: 50000, currency: 'IDR' }],
      income: [{ source: 'Freelance', amount: 200000, currency: 'IDR' }],
      debt: [
        { type: 'payable', person: 'Budi', amount: 25000 },
        { type: 'receivable', person: 'Andi', amount: 10000 },
      ],
      createdAt: todayDate,
    },
    {
      id: 'note_fin_last_month',
      userId: testUserId,
      content: 'Belanja bulanan 100rb, bonus 500rb, piutang roni 50rb',
      category: 'finance',
      expenses: [{ item: 'Belanja bulanan', amount: 100000, currency: 'IDR' }],
      income: [{ source: 'Bonus', amount: 500000, currency: 'IDR' }],
      debt: [
        { type: 'receivable', person: 'Roni', amount: 50000 },
      ],
      createdAt: lastMonthDate,
    },
    {
      id: 'note_fin_old',
      userId: testUserId,
      content: 'Old expense 999rb',
      category: 'finance',
      expenses: [{ item: 'Old stuff', amount: 999000, currency: 'IDR' }],
      income: [],
      debt: [],
      createdAt: threeMonthsAgoDate,
    },
  ]);

  function makeMsg(text: string) {
    return {
      message_id: Math.floor(Math.random() * 100000),
      date: Math.floor(Date.now() / 1000),
      chat: { id: testChatId, type: 'private' as const },
      from: { id: 12345, is_bot: false, first_name: 'Tester' },
      text,
    };
  }

  // 4. Test direct command /finance
  console.log('Testing /finance ...');
  const resFinance = await processTelegramMessage(makeMsg('/finance') as any);
  assert.strictEqual(resFinance.ok, true, 'Expected /finance to return ok: true');
  assert.strictEqual(resFinance.action, 'finance_report', 'Expected action to be finance_report');
  console.log('✅ /finance passed:', resFinance.action);

  // 5. Test command shortcut /fn
  console.log('Testing /fn shortcut ...');
  const resFn = await processTelegramMessage(makeMsg('/fn') as any);
  assert.strictEqual(resFn.ok, true, 'Expected /fn to return ok: true');
  assert.strictEqual(resFn.action, 'finance_report', 'Expected action to be finance_report');
  console.log('✅ /fn shortcut passed:', resFn.action);

  // 6. Test direct handleFinanceCommand in Indonesian and English
  console.log('Testing handleFinanceCommand direct invocation (ID & EN) ...');
  const resDirectId = await handleFinanceCommand(testChatId, testUserId, 'id');
  assert.strictEqual(resDirectId.ok, true);
  assert.strictEqual(resDirectId.action, 'finance_report');

  const resDirectEn = await handleFinanceCommand(testChatId, testUserId, 'en');
  assert.strictEqual(resDirectEn.ok, true);
  assert.strictEqual(resDirectEn.action, 'finance_report');
  console.log('✅ handleFinanceCommand direct passed');

  // 8. Test callback query menu:finance
  console.log('Testing callback_query menu:finance ...');
  const resCallback = await processTelegramCallbackQuery({
    id: 'cb_test_fin_1',
    data: 'menu:finance',
    message: { chat: { id: testChatId }, message_id: 100 },
    from: { id: 12345 },
  });
  assert.strictEqual(resCallback.ok, true);
  assert.strictEqual(resCallback.action, 'finance_report');
  console.log('✅ callback_query menu:finance passed');

  // 9. Cleanup test data
  await db.delete(notes).where(eq(notes.userId, testUserId));
  await db.delete(apiKeys).where(eq(apiKeys.userId, testUserId));
  await db.delete(users).where(eq(users.id, testUserId));

  console.log('🎉 All Telegram /finance tests PASSED successfully!');
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
