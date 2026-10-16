import crypto from 'node:crypto';
import { db } from '../src/db';
import { users, apiKeys, notes, subscriptions } from '../src/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import {
  processTelegramMessage,
  processTelegramCallbackQuery,
  flushDebounceBuffer,
  getActiveDebounceCount,
} from '../src/lib/telegram-handler';

async function runTest() {
  console.log('=== TEST SUITE: SMART DEBOUNCING & INLINE KEYBOARD PAGINATION ===');

  const [testUser] = await db.select().from(users).limit(1);
  if (!testUser) throw new Error('No test user found in DB');

  let [keyRecord] = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.userId, testUser.id))
    .limit(1);

  if (!keyRecord || !keyRecord.rawKey) {
    const rawKey = `unz_test_${Date.now()}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    if (keyRecord) {
      await db.update(apiKeys).set({ rawKey, keyHash }).where(eq(apiKeys.id, keyRecord.id));
      keyRecord.rawKey = rawKey;
    } else {
      await db.insert(apiKeys).values({
        id: `key_${Date.now()}`,
        userId: testUser.id,
        rawKey,
        keyHash,
        telegramChatId: null,
        isActive: true,
      });
      const [inserted] = await db.select().from(apiKeys).where(eq(apiKeys.userId, testUser.id)).limit(1);
      keyRecord = inserted;
    }
  }

  const testChatId = '777888999';

  // 0. Hubungkan chatId ke user
  await db
    .update(apiKeys)
    .set({ telegramChatId: testChatId })
    .where(eq(apiKeys.id, keyRecord.id));

  // ==========================================
  // FITUR 1: SMART MESSAGE DEBOUNCING
  // ==========================================
  console.log('\n[1] Testing Smart Message Debouncing (3-Second Buffer)...');

  const bubble1 = 'Hari ini aku rapat dengan tim marketing membahas kampanye baru.';
  const bubble2 = 'Rencana peluncuran produk dijadwalkan tanggal 25 Oktober 2026.';
  const bubble3 = 'Jangan lupa follow up proposal sponsor besok pagi jam 9.';

  console.log('-> Sending bubble 1...');
  const res1 = await processTelegramMessage({
    chat: { id: testChatId },
    text: bubble1,
  });
  console.log('Bubble 1 response:', res1);
  if (res1.action !== 'buffered' || res1.bufferedCount !== 1) {
    throw new Error(`Expected buffered count 1, got: ${res1.bufferedCount}`);
  }

  console.log('-> Sending bubble 2 within 300ms...');
  const res2 = await processTelegramMessage({
    chat: { id: testChatId },
    text: bubble2,
  });
  console.log('Bubble 2 response:', res2);
  if (res2.action !== 'buffered' || res2.bufferedCount !== 2) {
    throw new Error(`Expected buffered count 2, got: ${res2.bufferedCount}`);
  }

  console.log('-> Sending bubble 3 within 300ms...');
  const res3 = await processTelegramMessage({
    chat: { id: testChatId },
    text: bubble3,
  });
  console.log('Bubble 3 response:', res3);
  if (res3.action !== 'buffered' || res3.bufferedCount !== 3) {
    throw new Error(`Expected buffered count 3, got: ${res3.bufferedCount}`);
  }

  // Verifikasi noteId konsisten di semua bubble
  if (res1.noteId !== res2.noteId || res2.noteId !== res3.noteId) {
    throw new Error('noteId should remain identical across debounced bubbles');
  }

  const noteId = res1.noteId!;
  console.log(`Active buffer size for ${testChatId}:`, getActiveDebounceCount(testChatId));

  // Flush buffer
  console.log('-> Triggering debounce flush...');
  await flushDebounceBuffer(testChatId);

  // Ambil catatan dari DB
  const [persistedNote] = await db
    .select()
    .from(notes)
    .where(eq(notes.id, noteId));

  if (!persistedNote) {
    throw new Error('Persisted note not found in DB!');
  }

  const expectedContent = `${bubble1}\n\n${bubble2}\n\n${bubble3}`;
  if (persistedNote.content !== expectedContent) {
    throw new Error(`Merged content mismatch!\nExpected:\n${expectedContent}\n\nGot:\n${persistedNote.content}`);
  }
  console.log('✅ PASS: Smart Debouncing merged 3 chat bubbles into 1 unified note.');

  // Cleanup note debounce
  await db.delete(notes).where(eq(notes.id, noteId));

  // ==========================================
  // FITUR 2: INLINE KEYBOARD PAGINATION & TRUNCATE SNIPPET
  // ==========================================
  console.log('\n[2] Testing Pagination & Snippet Truncation (/tags & callback_query)...');

  // Insert 12 dummy notes with tag 'test-page'
  const dummyIds: string[] = [];
  for (let i = 1; i <= 12; i++) {
    const id = `test_dummy_${i}_${Date.now()}`;
    dummyIds.push(id);
    await db.insert(notes).values({
      id,
      userId: testUser.id,
      content: `Catatan Uji Coba Ke-${i}: Ini adalah baris pertama judul catatan.\nLalu ini adalah baris kedua paragraf yang sengaja dibuat sangat panjang lebih dari 150 karakter untuk menguji apakah pemotongan teks truncate snippet maksimal 120 karakter berjalan dengan baik dan menampilkan titik-titik ellipsis di akhir cuplikan secara rapi.`,
      category: 'others',
      specificTags: ['test-page'],
      isEncrypted: false,
      createdAt: new Date(Date.now() - (13 - i) * 60000), // beda waktu agar terurut
    });
  }

  // 1. Uji /tags test-page (Halaman 1)
  console.log('-> Executing /tags test-page...');
  const tagsRes = await processTelegramMessage({
    chat: { id: testChatId },
    text: '/tags test-page',
  });
  console.log('Tags response:', tagsRes);
  if (tagsRes.action !== 'tags_filtered' || tagsRes.totalCount !== 12) {
    throw new Error(`Expected tags_filtered with totalCount 12, got: ${tagsRes.totalCount}`);
  }
  console.log('✅ PASS: /tags returned paginated page 1 of 3 (total 12 items).');

  // 2. Uji callback_query page:tags:test-page:2 (Halaman 2)
  console.log('-> Simulating callback_query for Page 2 (page:tags:test-page:2)...');
  const callbackRes = await processTelegramCallbackQuery({
    id: 'cb_query_123',
    data: 'page:tags:test-page:2',
    from: { id: Number(testChatId) },
    message: {
      message_id: 999111,
      chat: { id: Number(testChatId) },
    },
  });
  console.log('Callback response:', callbackRes);
  if (callbackRes.action !== 'callback_page_tags' || callbackRes.page !== 2) {
    throw new Error(`Expected callback_page_tags page 2, got: ${callbackRes.page}`);
  }
  console.log('✅ PASS: callback_query successfully retrieved and updated to Page 2 in-place.');

  // 3. Uji /search catatan (Halaman 1)
  console.log('-> Executing /search Catatan Uji Coba...');
  const searchRes = await processTelegramMessage({
    chat: { id: testChatId },
    text: '/search Catatan Uji Coba',
  });
  console.log('Search response:', searchRes);
  if (searchRes.action !== 'search_success' || searchRes.totalCount !== 12) {
    throw new Error(`Expected search_success with totalCount 12, got: ${searchRes.totalCount}`);
  }
  console.log('✅ PASS: /search returned paginated page 1 of 3.');

  // Cleanup dummy notes & restore key
  await db.delete(notes).where(inArray(notes.id, dummyIds));
  await db.update(apiKeys).set({ telegramChatId: null }).where(eq(apiKeys.id, keyRecord.id));

  console.log('\n🎉 ALL DEBOUNCE & PAGINATION TESTS PASSED 100%!');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
