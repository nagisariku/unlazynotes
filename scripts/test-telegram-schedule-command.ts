import assert from 'node:assert';
import { db } from '../src/db';
import { users, apiKeys, notes } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import {
  processTelegramMessage,
  processTelegramCallbackQuery,
  handleScheduleCommand,
} from '../src/lib/telegram-handler';
import { addDays, subDays, format, parseISO } from 'date-fns';
import { formatInUserTz } from '../src/lib/timezone';

async function run() {
  console.log('=== Testing Telegram /schedule Command ===');

  const testChatId = 'test_schedule_chat_999';
  const testUserId = 'test_schedule_user_999';
  const testKeyId = 'test_schedule_key_999';

  // 1. Cleanup old test data
  await db.delete(notes).where(eq(notes.userId, testUserId));
  await db.delete(apiKeys).where(eq(apiKeys.userId, testUserId));
  await db.delete(users).where(eq(users.id, testUserId));

  // 2. Setup test user & active api key with Asia/Jakarta timezone
  await db.insert(users).values({
    id: testUserId,
    name: 'Schedule Tester',
    email: 'schedule_tester@example.com',
    emailVerified: true,
    tier: 'pro',
    timezone: 'Asia/Jakarta',
    preferredLocale: 'id',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await db.insert(apiKeys).values({
    id: testKeyId,
    userId: testUserId,
    keyHash: 'dummy_hash_schedule',
    telegramChatId: testChatId,
    isActive: true,
    createdAt: new Date(),
  });

  const now = new Date();
  const todayStr = formatInUserTz(now, 'Asia/Jakarta').dateStr;
  const todayDt = parseISO(todayStr);

  const twoDaysAgoStr = format(subDays(todayDt, 2), 'yyyy-MM-dd');
  const fiveDaysAgoStr = format(subDays(todayDt, 5), 'yyyy-MM-dd');
  const tenDaysAgoStr = format(subDays(todayDt, 10), 'yyyy-MM-dd'); // Beyond 7 days back

  const tomorrowStr = format(addDays(todayDt, 1), 'yyyy-MM-dd');
  const sevenDaysAheadStr = format(addDays(todayDt, 7), 'yyyy-MM-dd');
  const twentyDaysAheadStr = format(addDays(todayDt, 20), 'yyyy-MM-dd'); // Beyond 14 days forward

  // 3. Seed notes with various schedules
  await db.insert(notes).values([
    // Note 1: Past 2 days ago (in past 7d window)
    {
      id: 'note_sch_past_2d',
      userId: testUserId,
      content: 'Evaluasi sprint mingguan',
      category: 'schedule',
      targetDate: new Date(`${twoDaysAgoStr}T10:00:00+07:00`),
      createdAt: new Date(`${twoDaysAgoStr}T09:00:00+07:00`),
    },
    // Note 2: Past 5 days ago (in past 7d window)
    {
      id: 'note_sch_past_5d',
      userId: testUserId,
      content: 'Konsul dokter gigi',
      category: 'schedule',
      scheduleDates: [fiveDaysAgoStr],
      createdAt: new Date(`${fiveDaysAgoStr}T08:00:00+07:00`),
    },
    // Note 3: Past 10 days ago (OUTSIDE 7d window)
    {
      id: 'note_sch_past_10d',
      userId: testUserId,
      content: 'Workshop kuno',
      category: 'schedule',
      scheduleDates: [tenDaysAgoStr],
      createdAt: new Date(`${tenDaysAgoStr}T08:00:00+07:00`),
    },
    // Note 4: Today (in upcoming window) with time
    {
      id: 'note_sch_today',
      userId: testUserId,
      content: 'Meeting klien penting',
      category: 'schedule',
      targetDate: new Date(`${todayStr}T14:30:00+07:00`),
      isPinned: true,
      createdAt: now,
    },
    // Note 5: Tomorrow (in upcoming window)
    {
      id: 'note_sch_tomorrow',
      userId: testUserId,
      content: 'Pengambilan visa travel',
      category: 'schedule',
      scheduleDates: [tomorrowStr],
      createdAt: now,
    },
    // Note 6: In 7 days (in upcoming window)
    {
      id: 'note_sch_upcoming_7d',
      userId: testUserId,
      content: 'Demo produk ke investor',
      category: 'schedule',
      scheduleDates: [sevenDaysAheadStr],
      createdAt: now,
    },
    // Note 7: In 20 days (OUTSIDE 14d window)
    {
      id: 'note_sch_upcoming_20d',
      userId: testUserId,
      content: 'Liburan akhir tahun jauh',
      category: 'schedule',
      scheduleDates: [twentyDaysAheadStr],
      createdAt: now,
    },
    // Note 8: Recurring weekly on today's day of week
    {
      id: 'note_sch_recurring_weekly',
      userId: testUserId,
      content: 'Sync mingguan core tim',
      category: 'schedule',
      schedule: {
        dates: [],
        isRecurring: true,
        recurrenceRule: {
          frequency: 'weekly',
          daysOfWeek: [todayDt.getDay()],
          timeString: '09:00',
        },
      },
      createdAt: subDays(todayDt, 14),
    },
    // Note 9: Archived schedule (should be excluded)
    {
      id: 'note_sch_archived',
      userId: testUserId,
      content: 'Jadwal yang sudah diarsip',
      category: 'schedule',
      scheduleDates: [todayStr],
      isArchived: true,
      createdAt: now,
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

  // 4. Test direct command /schedule
  console.log('Testing /schedule ...');
  const resSchedule = await processTelegramMessage(makeMsg('/schedule') as any);
  assert.strictEqual(resSchedule.ok, true, 'Expected /schedule to return ok: true');
  assert.strictEqual(resSchedule.action, 'schedule_list', 'Expected action to be schedule_list');
  console.log('✅ /schedule passed:', resSchedule.action);

  // 5. Test command alias /jadwal
  console.log('Testing /jadwal alias ...');
  const resJadwal = await processTelegramMessage(makeMsg('/jadwal') as any);
  assert.strictEqual(resJadwal.ok, true, 'Expected /jadwal to return ok: true');
  assert.strictEqual(resJadwal.action, 'schedule_list', 'Expected action to be schedule_list');
  console.log('✅ /jadwal alias passed:', resJadwal.action);

  // 6. Test command shortcut /sch
  console.log('Testing /sch shortcut ...');
  const resSch = await processTelegramMessage(makeMsg('/sch') as any);
  assert.strictEqual(resSch.ok, true, 'Expected /sch to return ok: true');
  assert.strictEqual(resSch.action, 'schedule_list', 'Expected action to be schedule_list');
  console.log('✅ /sch shortcut passed:', resSch.action);

  // 7. Test direct handleScheduleCommand in Indonesian and English
  console.log('Testing handleScheduleCommand direct invocation (ID & EN) ...');
  const resDirectId = await handleScheduleCommand(testChatId, testUserId, 'id');
  assert.strictEqual(resDirectId.ok, true);
  assert.strictEqual(resDirectId.action, 'schedule_list');

  const resDirectEn = await handleScheduleCommand(testChatId, testUserId, 'en');
  assert.strictEqual(resDirectEn.ok, true);
  assert.strictEqual(resDirectEn.action, 'schedule_list');
  console.log('✅ handleScheduleCommand direct passed');

  // 8. Test callback query menu:schedule
  console.log('Testing callback_query menu:schedule ...');
  const resCallback = await processTelegramCallbackQuery({
    id: 'cb_test_sch_1',
    data: 'menu:schedule',
    message: { chat: { id: testChatId }, message_id: 101 },
    from: { id: 12345 },
  });
  assert.strictEqual(resCallback.ok, true);
  assert.strictEqual(resCallback.action, 'schedule_list');
  console.log('✅ callback_query menu:schedule passed');

  // 9. Test empty state handling (when no notes exist)
  console.log('Testing empty schedule state ...');
  await db.delete(notes).where(eq(notes.userId, testUserId));
  const resEmpty = await handleScheduleCommand(testChatId, testUserId, 'id');
  assert.strictEqual(resEmpty.ok, true);
  assert.strictEqual(resEmpty.action, 'schedule_list');
  console.log('✅ empty schedule state passed');

  // 10. Cleanup test data
  await db.delete(apiKeys).where(eq(apiKeys.userId, testUserId));
  await db.delete(users).where(eq(users.id, testUserId));

  console.log('🎉 All Telegram /schedule tests PASSED successfully!');
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
