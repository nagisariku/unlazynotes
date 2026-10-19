import { db } from '../src/db';
import { users, apiKeys, notes } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';
import {
  PERSISTENT_DOCK_KEYBOARD,
  ALL_CATEGORIES,
  buildCategoriesGridKeyboard,
  getTagsOverviewData,
  displayNoteDetail,
  processTelegramMessage,
  processTelegramCallbackQuery,
} from '../src/lib/telegram-handler';
import { getTelegramMsg } from '../src/lib/i18n/telegram';
import { answerNoteQuestion } from '../src/lib/ask';

async function runPolishesTestSuite() {
  console.log('================================================================');
  console.log('🧪 TESTING UNLAZYNOTES PHASE 4 UX & SYSTEM POLISHES');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, msg: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`✅ PASS: ${msg}`);
    } else {
      console.error(`❌ FAIL: ${msg}`);
      process.exitCode = 1;
    }
  }

  // --- 1. Dock Menu (Tags, Pin, dan Sync, Tanpa Tutup Menu) ---
  console.log('--- 1. Testing Persistent Dock Menu ---');
  assert(Array.isArray(PERSISTENT_DOCK_KEYBOARD.keyboard), 'keyboard is array');
  assert(PERSISTENT_DOCK_KEYBOARD.keyboard.length === 2, 'Dock menu has 2 rows');
  assert(PERSISTENT_DOCK_KEYBOARD.keyboard[0].length === 2, 'Row 1 has 2 buttons (Tags & Pin)');
  assert(PERSISTENT_DOCK_KEYBOARD.keyboard[0][0].text === '🏷 Tags', 'Button 1 is 🏷 Tags');
  assert(PERSISTENT_DOCK_KEYBOARD.keyboard[0][1].text === '⭐️ Pin', 'Button 2 is ⭐️ Pin');
  assert(PERSISTENT_DOCK_KEYBOARD.keyboard[1].length === 1, 'Row 2 has 1 button (Sync)');
  assert(PERSISTENT_DOCK_KEYBOARD.keyboard[1][0].text === '🔄 Sync', 'Button 3 is 🔄 Sync');
  const hasTutupMenu = PERSISTENT_DOCK_KEYBOARD.keyboard.some((r) =>
    r.some((b) => b.text.includes('Tutup Menu'))
  );
  assert(!hasTutupMenu, 'No "Tutup Menu" button in dock menu');

  // --- 2. Category Buttons in /tags (Minimal 1 Catatan & Emoji Updates) ---
  console.log('\n--- 2. Testing Category Buttons Filtering & Emoji Updates ---');
  const financeCat = ALL_CATEGORIES.find((c) => c.key === 'finance');
  const bookmarkCat = ALL_CATEGORIES.find((c) => c.key === 'bookmark');
  const othersCat = ALL_CATEGORIES.find((c) => c.key === 'others');

  assert(financeCat?.label === '💰 Finance', 'Finance uses 💰 emoji');
  assert(bookmarkCat?.label === '📎 Bookmark', 'Bookmark uses 📎 emoji');
  assert(othersCat?.label === 'Others', 'Others has NO emoji');

  // Test dynamic filter: only show categories with >= 1 note
  const activeSet = new Set(['finance', 'bookmark']);
  const filteredKb = buildCategoriesGridKeyboard(activeSet);
  assert(filteredKb !== undefined, 'Filtered keyboard is generated');
  assert(filteredKb?.inline_keyboard.length === 1, 'Only 1 row for 2 items');
  assert(filteredKb?.inline_keyboard[0].length === 2, 'Row has exactly 2 buttons');
  assert(filteredKb?.inline_keyboard[0][0].text === '💰 Finance', 'Shows 💰 Finance');
  assert(filteredKb?.inline_keyboard[0][1].text === '📎 Bookmark', 'Shows 📎 Bookmark');

  // Test empty set: when no categories exist
  const emptyKb = buildCategoriesGridKeyboard(new Set());
  assert(emptyKb === undefined, 'Returns undefined when 0 active categories exist');

  // --- 3. /tags Content (No Sering Dicari, Quick Commands Added) ---
  console.log('\n--- 3. Testing /tags Content & i18n ---');
  const tagsMsgId = getTelegramMsg('tags_header', 'id', {
    activeTagsText: '(1)kopi',
    recentTagsText: '(2)belanja',
  });
  assert(!tagsMsgId.includes('Sering Dicari'), 'tags_header ID has NO "Sering Dicari"');
  assert(tagsMsgId.includes('💡 <b>Perintah Cepat:</b>'), 'tags_header ID has Quick Commands header');
  assert(tagsMsgId.includes('/pin'), 'tags_header ID includes /pin info');
  assert(tagsMsgId.includes('/vault'), 'tags_header ID includes /vault info');
  assert(tagsMsgId.includes('/search'), 'tags_header ID includes /search info');
  assert(tagsMsgId.includes('/ask'), 'tags_header ID includes /ask info');

  const tagsMsgEn = getTelegramMsg('tags_header', 'en', {
    activeTagsText: '(1)coffee',
    recentTagsText: '(2)groceries',
  });
  assert(!tagsMsgEn.includes('Most Searched'), 'tags_header EN has NO "Most Searched"');
  assert(tagsMsgEn.includes('💡 <b>Quick Commands:</b>'), 'tags_header EN has Quick Commands header');

  // --- 4. /help /start Command Info for /vault (Tanpa Kunci) ---
  console.log('\n--- 4. Testing /help & /start info for /vault without key ---');
  const helpId = getTelegramMsg('help', 'id');
  const helpEn = getTelegramMsg('help', 'en');
  assert(helpId.includes('/vault') && helpId.includes('tanpa kunci'), 'help ID mentions /vault (tanpa kunci)');
  assert(helpEn.includes('/vault') && helpEn.includes('without key'), 'help EN mentions /vault (without key)');

  // --- 5. Invalid Command Guard ---
  console.log('\n--- 5. Testing Invalid Command Guard ---');
  const testUserId = `user_pol_${Date.now()}`;
  const testChatId = `chat_pol_${Date.now()}`;

  await db.insert(users).values({
    id: testUserId,
    email: `${testUserId}@example.com`,
  });

  await db.insert(apiKeys).values({
    id: crypto.randomUUID(),
    userId: testUserId,
    keyHash: `hash_pol_${Date.now()}`,
    telegramChatId: testChatId,
    isActive: true,
  });

  const invalidMsgRes = await processTelegramMessage({
    chat: { id: testChatId },
    text: '/randomcommandxyz',
  });
  assert(invalidMsgRes.ok === true && invalidMsgRes.action === 'invalid_command', 'Unrecognized slash command returns invalid_command');

  // Ensure it was NOT saved to DB as a note
  const [invalidNote] = await db.select().from(notes).where(eq(notes.userId, testUserId)).limit(1);
  assert(invalidNote === undefined, 'Invalid command was NOT saved to database as a note');

  // --- 6. Detail Notes: Formatting, Long Note Bug Fix & Action Buttons ---
  console.log('\n--- 6. Testing Detail Notes (Formatting, Long Notes Bug & Buttons) ---');
  const longText = 'Resep Nasi Kebuli Spesial '.repeat(25); // ~650 chars (> 256 chars)
  const longNoteId = crypto.randomUUID();
  await db.insert(notes).values({
    id: longNoteId,
    userId: testUserId,
    content: longText,
    category: 'reference',
    specificTags: ['resep', 'kuliner'],
    isPinned: false,
    createdAt: new Date('2026-10-19T04:45:00+07:00'),
  });

  const detailRes = await displayNoteDetail(testChatId, undefined, longNoteId, 'tags', 'resep', 1);
  assert(detailRes.ok === true && detailRes.action === 'note_detail_view', 'Long note detail opens successfully without BUTTON_COPY_TEXT_INVALID');

  // Test copy callback query for long note (> 256 chars)
  const copyCbRes = await processTelegramCallbackQuery({
    id: 'cb_copy_test',
    data: `note:copy:${longNoteId}`,
    from: { id: testChatId },
  });
  assert(copyCbRes.ok === true && copyCbRes.action === 'note_copied', 'note:copy callback query sends note content cleanly');

  // Test pin toggle and buttons
  const pinCbRes = await processTelegramCallbackQuery({
    id: 'cb_pin_test',
    data: `note:pin:${longNoteId}:tags:resep:1`,
    from: { id: testChatId },
  });
  assert(pinCbRes.ok === true && pinCbRes.action === 'note_detail_view', 'Toggling pin updates view');
  const [pinnedCheck] = await db.select().from(notes).where(eq(notes.id, longNoteId)).limit(1);
  assert(pinnedCheck.isPinned === true, 'Note is now pinned');

  // Verify displayNoteDetail for pinned note executes cleanly
  const pinnedViewRes = await displayNoteDetail(testChatId, undefined, longNoteId, 'tags', 'resep', 1);
  assert(pinnedViewRes.ok === true, 'Pinned note detail renders cleanly with Lepas Pin');

  // --- 7. /ask: AI Model Identity & Anti-Abuse Guardrail ---
  console.log('\n--- 7. Testing /ask Model Identity & Anti-Abuse ---');
  const modelAnswer = await answerNoteQuestion(testUserId, 'kamu pakai model apa?');
  assert(modelAnswer.includes('UnlazyNotesLLM-v1'), `Model inquiry answers "UnlazyNotesLLM-v1" (got: ${modelAnswer})`);

  console.log('\n================================================================');
  console.log(`SUMMARY: ${passed}/${total} TESTS PASSED`);
  console.log('================================================================\n');

  if (passed === total) {
    console.log('🎉 ALL PHASE 4 POLISHES VERIFIED 100% SUCCESSFULLY!');
  } else {
    process.exit(1);
  }
}

runPolishesTestSuite().then(() => process.exit(0)).catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
