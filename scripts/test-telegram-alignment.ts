import { format } from 'date-fns';
import {
  REMOVE_DOCK_KEYBOARD,
  START_HELP_MENU_KEYBOARD,
  formatSnippetPage,
  formatNoteDateWib,
  buildCategoriesGridKeyboard,
  buildPaginationKeyboard,
  buildNoteDetailKeyboard,
  getTagsOverviewData,
  displayNoteDetail,
  handleReviewCommand,
  handleReadCommand,
  handlePinList,
  processTelegramCallbackQuery,
} from '../src/lib/telegram-handler';
import { getTelegramMsg } from '../src/lib/i18n/telegram';
import { db } from '../src/db';
import { users, apiKeys, notes } from '../src/db/schema';
import crypto from 'node:crypto';

async function runAlignmentTests() {
  console.log('================================================================');
  console.log('🧪 TESTING TELEGRAM BOT ALIGNMENT (DOCK, HELP, TAGS, REVIEW, FORMAT)');
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

  // 1. Dock Removal Keyboard
  console.log('--- 1. Testing Dock Removal ---');
  assert(REMOVE_DOCK_KEYBOARD.remove_keyboard === true, 'Dock is removed (remove_keyboard: true)');

  // 2. /help message content & hint commands
  console.log('\n--- 2. Testing /help message ---');
  const helpId = getTelegramMsg('help', 'id', { dashboardUrl: 'https://unlazynotes.com/dashboard' });
  const requiredCommands = [
    '/login <api_key>',
    '/logout',
    '/review',
    '/read',
    '/pin',
    '/tags',
    '/tags <nama_tag>',
    '/search <kata_kunci>',
    '/ask <pertanyaan>',
    '/secure <kunci> <isi>',
    '/vault',
  ];
  for (const cmd of requiredCommands) {
    assert(helpId.includes(cmd), `help ID includes command ${cmd}`);
  }
  assert(helpId.includes('https://unlazynotes.com/dashboard'), 'help ID includes website URL');

  // 2b. /start & /help inline button menu: read, review, tags, pin
  console.log('\n--- 2b. Testing /start & /help inline keyboard ---');
  assert(Array.isArray(START_HELP_MENU_KEYBOARD.inline_keyboard), 'START_HELP_MENU_KEYBOARD has inline_keyboard');
  assert(START_HELP_MENU_KEYBOARD.inline_keyboard.length === 2, 'START_HELP_MENU_KEYBOARD has 2 rows');
  const startRow1 = START_HELP_MENU_KEYBOARD.inline_keyboard[0];
  const startRow2 = START_HELP_MENU_KEYBOARD.inline_keyboard[1];
  assert(startRow1.length === 2, 'Row 1 has 2 buttons (Read & Review)');
  assert(startRow1[0].text === '📖 Read' && startRow1[0].callback_data === 'menu:read', 'Button 1 is 📖 Read -> menu:read');
  assert(startRow1[1].text === '📋 Review' && startRow1[1].callback_data === 'menu:review', 'Button 2 is 📋 Review -> menu:review');
  assert(startRow2.length === 2, 'Row 2 has 2 buttons (Tags & Pin)');
  assert(startRow2[0].text === '🏷 Tags' && startRow2[0].callback_data === 'menu:tags', 'Button 3 is 🏷 Tags -> menu:tags');
  assert(startRow2[1].text === '⭐️ Pin' && startRow2[1].callback_data === 'menu:pin', 'Button 4 is ⭐️ Pin -> menu:pin');

  // 2c. /tags header formatting
  console.log('\n--- 2c. Testing /tags header formatting ---');
  const tagsEmptyMsgId = getTelegramMsg('tags_header', 'id', { latestTagsText: '' });
  assert(!tagsEmptyMsgId.includes('Tags Terakhir:'), 'tags_header ID without tags does not contain "Tags Terakhir:"');
  assert(!tagsEmptyMsgId.includes('{latestTagsText}'), 'tags_header ID without tags does not leak {latestTagsText}');
  assert(tagsEmptyMsgId.includes('Perintah Cepat:'), 'tags_header ID without tags displays Perintah Cepat');

  const tagsEmptyMsgEn = getTelegramMsg('tags_header', 'en', { latestTagsText: '' });
  assert(!tagsEmptyMsgEn.includes('Latest Tags:'), 'tags_header EN without tags does not contain "Latest Tags:"');
  assert(!tagsEmptyMsgEn.includes('{latestTagsText}'), 'tags_header EN without tags does not leak {latestTagsText}');
  assert(tagsEmptyMsgEn.includes('Quick Commands:'), 'tags_header EN without tags displays Quick Commands');

  const tagsWithDataId = getTelegramMsg('tags_header', 'id', { latestTagsText: '(1)makan  (2)kuliah' });
  assert(tagsWithDataId.includes('Tags Terakhir:'), 'tags_header ID with tags contains "Tags Terakhir:"');
  assert(tagsWithDataId.includes('(1)makan  (2)kuliah'), 'tags_header ID with tags interpolates latestTagsText');

  const tagsWithDataEn = getTelegramMsg('tags_header', 'en', { latestTagsText: '(1)food  (2)lecture' });
  assert(tagsWithDataEn.includes('Latest Tags:'), 'tags_header EN with tags contains "Latest Tags:"');
  assert(tagsWithDataEn.includes('(1)food  (2)lecture'), 'tags_header EN with tags interpolates latestTagsText');

  // 3. Category Grid Keyboard: filters out categories with 0 notes
  console.log('\n--- 3. Testing Categories Grid Keyboard (Dynamic 0-notes filter) ---');
  // Fallback (no args)
  const catKb = buildCategoriesGridKeyboard();
  assert(catKb !== undefined, 'Categories keyboard generated fallback');
  const allButtons = catKb?.inline_keyboard.flat() || [];
  assert(allButtons.length === 10, 'Categories grid has 10 buttons (8 categories + vault + back)');
  assert(!allButtons.some((b) => b.text.toLowerCase().includes('others')), 'Categories grid does NOT include others');
  assert(allButtons.some((b) => b.text.includes('Kembali') && b.callback_data === 'menu:start'), 'Categories grid includes ◀️ Kembali button');

  // Dynamic filter: user only has notes in 'todo' and 'finance', no vault
  const filteredKb1 = buildCategoriesGridKeyboard(new Set(['todo', 'finance']), false);
  assert(filteredKb1 !== undefined, 'Filtered keyboard created');
  const buttons1 = filteredKb1?.inline_keyboard.flat() || [];
  assert(buttons1.length === 3, 'Filtered keyboard has 3 buttons (2 categories + back)');
  assert(buttons1.some((b) => b.text.includes('Finance')), 'Includes Finance');
  assert(buttons1.some((b) => b.text.includes('Todo')), 'Includes Todo');
  assert(!buttons1.some((b) => b.text.includes('Bookmark')), 'Does not include 0-note Bookmark');
  assert(!buttons1.some((b) => b.text.includes('Vault')), 'Does not include 0-note Vault');
  assert(buttons1.some((b) => b.text.includes('Kembali') && b.callback_data === 'menu:start'), 'Includes ◀️ Kembali button');

  // Dynamic filter: user has note in 'todo' and vault notes
  const filteredKb2 = buildCategoriesGridKeyboard(new Set(['todo']), true);
  const buttons2 = filteredKb2?.inline_keyboard.flat() || [];
  assert(buttons2.length === 3, 'Filtered keyboard has 3 buttons (Todo + Vault + back)');
  assert(buttons2.some((b) => b.text.includes('Vault')), 'Includes Vault when user has vault notes');
  assert(buttons2.some((b) => b.text.includes('Kembali') && b.callback_data === 'menu:start'), 'Includes ◀️ Kembali button');

  // Dynamic filter: user has 0 notes in all categories and 0 in vault
  const emptyKb = buildCategoriesGridKeyboard(new Set(), false);
  assert(emptyKb === undefined, 'Returns undefined when all categories have 0 notes');

  // 4. Output Formatting: /read & /pin format without dates, separated per 5 notes, 10 max
  console.log('\n--- 4. Testing Output Formatting (/read, /pin, /review) ---');
  const sampleItems = [
    { content: 'Note 1 task', createdAt: new Date('2026-10-22T10:00:00Z'), category: 'todo', isPinned: false },
    { content: 'Note 2 buy groceries', createdAt: new Date('2026-10-22T11:00:00Z'), category: 'todo', isPinned: true },
    { content: 'Note 3 lecture notes', createdAt: new Date('2026-10-22T12:00:00Z'), category: 'reference', isPinned: true },
    { content: 'Note 4 follow up', createdAt: new Date('2026-10-21T09:00:00Z'), category: 'todo', isPinned: false },
    { content: 'Note 5 dev url', createdAt: new Date('2026-10-21T10:00:00Z'), category: 'bookmark', isPinned: false },
    { content: 'Note 6 breakfast', createdAt: new Date('2026-10-21T11:00:00Z'), category: 'todo', isPinned: false },
    { content: 'Note 7 wireframe', createdAt: new Date('2026-10-20T08:00:00Z'), category: 'draft', isPinned: false, attachments: [{ type: 'image' as const }] },
    { content: 'Note 8 soto ayam', createdAt: new Date('2026-10-20T09:00:00Z'), category: 'random-yap', isPinned: true },
    { content: 'Note 9 unlazynotes pricing', createdAt: new Date('2026-10-20T10:00:00Z'), category: 'reference', isPinned: false },
    { content: 'Note 10 test note', createdAt: new Date('2026-10-20T11:00:00Z'), category: 'draft', isPinned: false },
  ];

  const formattedOutput = formatSnippetPage(
    sampleItems,
    sampleItems.length,
    1,
    10,
    '📖 Latest Notes',
    'en',
    { showDates: false }
  );

  console.log('Formatted snippet output (10 items):\n' + formattedOutput);
  assert(!formattedOutput.includes('📅'), 'Output without dates does NOT contain 📅');
  // Check that all 10 items are present without any missing notes
  for (let i = 1; i <= 10; i++) {
    assert(formattedOutput.includes(`(${i}) `), `Item (${i}) is present in snippet output`);
  }
  assert(formattedOutput.includes('(1) 📌 Note 1 task'), 'Item 1 formatted as (1) 📌');
  assert(formattedOutput.includes('(2) 📌⭐️ Note 2 buy groceries'), 'Item 2 pinned formatted as (2) 📌⭐️');
  assert(formattedOutput.includes('(3) 📌⭐️ Note 3 lecture notes'), 'Item 3 pinned formatted as (3) 📌⭐️');
  assert(formattedOutput.includes('(4) 📌 Note 4 follow up'), 'Item 4 formatted as (4) 📌');
  assert(formattedOutput.includes('(5) 📌 Note 5 dev url'), 'Item 5 formatted as (5) 📌');
  assert(formattedOutput.includes('(6) 📌 Note 6 breakfast'), 'Item 6 formatted as (6) 📌');
  assert(formattedOutput.includes('(7) 📌🖼️ Note 7 wireframe'), 'Item 7 with image attachment formatted as (7) 📌🖼️');
  assert(formattedOutput.includes('(8) 📌⭐️ Note 8 soto ayam'), 'Item 8 formatted as (8) 📌⭐️');
  assert(formattedOutput.includes('(9) 📌 Note 9 unlazynotes pricing'), 'Item 9 formatted as (9) 📌');
  assert(formattedOutput.includes('(10) 📌 Note 10 test note'), 'Item 10 formatted as (10) 📌');

  // Verify 5-notes group separation: items 1-5, blank line, items 6-10
  const doubleNewlineSplits = formattedOutput.split('\n\n');
  assert(doubleNewlineSplits.length >= 3, 'Output has empty line breaks separating header, group 1 (1-5), and group 2 (6-10)');
  assert(doubleNewlineSplits[1].includes('(1) ') && doubleNewlineSplits[1].includes('(5) '), 'Group 1 contains items (1) through (5)');
  assert(!doubleNewlineSplits[1].includes('(6) '), 'Group 1 does not contain item (6)');
  assert(doubleNewlineSplits[2].includes('(6) ') && doubleNewlineSplits[2].includes('(10) '), 'Group 2 contains items (6) through (10)');

  // 5. Date Formatting: '📅 Thu, 22/10'
  console.log('\n--- 5. Testing Date Formatting ---');
  const testDate = new Date('2026-10-22T12:00:00Z');
  const formattedDate = formatNoteDateWib(testDate);
  console.log('formatNoteDateWib output:', formattedDate);
  assert(formattedDate === '📅 Thu, 22/10', "formatNoteDateWib formats as '📅 Thu, 22/10'");

  // Date-grouped snippet output
  const dateGroupedOutput = formatSnippetPage(
    [sampleItems[0]],
    1,
    1,
    10,
    '🏷️ Catatan',
    'id',
    { showDates: true }
  );
  assert(dateGroupedOutput.includes('📅 Thu, 22/10'), "Date-grouped snippet header formatted as '📅 Thu, 22/10'");

  // 6. Pagination Keyboard for review
  console.log('\n--- 6. Testing Review Pagination Keyboard & Empty State ---');
  const reviewKb = buildPaginationKeyboard('review', 'all', 1, 2, [{ id: 'n1' }]);
  assert(reviewKb !== undefined, 'Review keyboard created');
  const reviewAllButtons = reviewKb?.inline_keyboard.flat() || [];
  assert(reviewAllButtons.some((b) => b.text.includes('Sync All') && b.callback_data === 'review:sync_all'), 'Review keyboard includes 🔄 Sync All button');
  assert(reviewAllButtons.some((b) => b.text.includes('Kembali') && b.callback_data === 'menu:start'), 'Review keyboard includes ◀️ Kembali button');

  // Test handleReviewCommand when count is 0 (empty review state includes button Kembali ke Tags)
  const emptyReviewRes = await handleReviewCommand('fake_chat_review_empty_99', 'non_existent_user_review_empty', 1, 'id', 999123);
  assert(emptyReviewRes.ok === true && emptyReviewRes.action === 'review_empty', 'handleReviewCommand handles 0 unorganized notes gracefully');

  // 7. Note Detail Keyboard: Sync AI button for unprocessed notes (isProcessed: false)
  console.log('\n--- 7. Testing Note Detail Keyboard (Sync AI button) ---');
  // Case A: Unprocessed note (isProcessed: false) -> has Sync AI button
  const unprocNote = {
    id: 'note_unproc_1',
    content: 'Unprocessed note content',
    category: 'others',
    isProcessed: false,
    isPinned: false,
  };
  const unprocDetailKb = buildNoteDetailKeyboard(unprocNote, 'review', 'all', 1);
  const unprocButtons = unprocDetailKb.inline_keyboard.flat();
  assert(
    unprocButtons.some((b) => b.text.includes('Sync AI') && b.callback_data === 'note:sync_ai:note_unproc_1'),
    'unprocessed note (isProcessed: false) includes ✨ Sync AI button'
  );

  // Case B: Processed note with category 'others' (isProcessed: true) -> does NOT have Sync AI button
  const othersProcessedNote = {
    id: 'note_others_processed_2',
    content: 'Processed note in others category',
    category: 'others',
    isProcessed: true,
  };
  const othersProcessedKb = buildNoteDetailKeyboard(othersProcessedNote, 'review', 'all', 1);
  const othersProcessedButtons = othersProcessedKb.inline_keyboard.flat();
  assert(
    !othersProcessedButtons.some((b) => b.text.includes('Sync AI')),
    'processed note in others category does NOT include ✨ Sync AI button'
  );

  // Case C: Processed note in another category (e.g. todo, isProcessed: true) -> does NOT have Sync AI button
  const organizedNote = {
    id: 'note_org_3',
    content: 'Organized todo note',
    category: 'todo',
    isProcessed: true,
  };
  const orgDetailKb = buildNoteDetailKeyboard(organizedNote, 'read', 'all', 1);
  const orgButtons = orgDetailKb.inline_keyboard.flat();
  assert(
    !orgButtons.some((b) => b.text.includes('Sync AI')),
    'organized note detail does NOT include ✨ Sync AI button'
  );

  // 8. Test Callback Query menu:read, menu:pin, menu:start dispatch
  console.log('\n--- 8. Testing Callback Query menu:read, menu:pin, menu:start dispatch ---');
  const cbRes = await processTelegramCallbackQuery({
    id: 'test_cb_1',
    from: { id: 99999999 },
    message: { message_id: 1, chat: { id: 99999999 } },
    data: 'menu:read',
  });
  assert(cbRes.error === 'unauthenticated', 'menu:read is routed to read handler (returns unauthenticated for unlinked chat)');

  const cbPinRes = await processTelegramCallbackQuery({
    id: 'test_cb_2',
    from: { id: 99999999 },
    message: { message_id: 1, chat: { id: 99999999 } },
    data: 'menu:pin',
  });
  assert(cbPinRes.error === 'unauthenticated', 'menu:pin is routed to pin handler (returns unauthenticated for unlinked chat)');

  const cbStartRes = await processTelegramCallbackQuery({
    id: 'test_cb_3',
    from: { id: 99999999 },
    message: { message_id: 1, chat: { id: 99999999 } },
    data: 'menu:start',
  });
  assert(cbStartRes.ok === true && cbStartRes.action === 'callback_menu_start', 'menu:start is routed to start/help callback handler');

  console.log('\n================================================================');
  console.log(`SUMMARY: ${passed}/${total} TESTS PASSED`);
  console.log('================================================================');

  if (passed === total) {
    console.log('🎉 ALL TELEGRAM BOT ALIGNMENT TESTS PASSED WITH 100% SUCCESS!');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runAlignmentTests().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
