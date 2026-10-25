import { normalizeCategory, sanitizeTags } from '../src/lib/ai';
import {
  START_HELP_MENU_KEYBOARD,
  REMOVE_DOCK_KEYBOARD,
  buildCategoriesGridKeyboard,
  buildPaginationKeyboard,
  buildNoteDetailKeyboard,
  noteNavMap,
  processTelegramCallbackQuery,
} from '../src/lib/telegram-handler';

async function main() {
  console.log('================================================================');
  console.log('🧪 VERIFYING ANTI-OTHERS AI CLASSIFICATION & TELEGRAM NAVIGATION');
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

  // --- 1. Test AI Tag Sanitizer & Category Normalizer ---
  console.log('--- 1. Testing AI Tag Sanitizer & Category Normalizer ---');
  assert(normalizeCategory('todo') === 'todo', 'normalizeCategory("todo") -> "todo"');
  assert(normalizeCategory('task') === 'todo', 'normalizeCategory("task") -> "todo"');
  assert(normalizeCategory('draft') === 'draft', 'normalizeCategory("draft") -> "draft"');
  assert(normalizeCategory('others') === 'others', 'normalizeCategory("others") -> "others"');

  const sanitizedCase2 = sanitizeTags(['hapus', 'dock', 'command-list'], 'todo', 'unlazynotes', 5);
  const sanitizedCase3 = sanitizeTags(['remove', 'empty-state', 'back-button'], 'todo', 'unlazynotes', 5);

  assert(!sanitizedCase2.includes('hapus'), 'Case 2 does NOT have action verb "hapus" as tag');
  assert(!sanitizedCase3.includes('remove'), 'Case 3 does NOT have action verb "remove" as tag');
  assert(!sanitizedCase2.includes('exam'), 'Case 2 does NOT falsely have "exam" tag');

  // --- 2. Test Dock Removal & Start Keyboard ---
  console.log('\n--- 2. Testing Dock Removal & Start Keyboard ---');
  assert(REMOVE_DOCK_KEYBOARD.remove_keyboard === true, 'Dock removal flag is true');
  assert(START_HELP_MENU_KEYBOARD.inline_keyboard.length === 2, 'START_HELP_MENU_KEYBOARD has 2 rows');
  assert(START_HELP_MENU_KEYBOARD.inline_keyboard[0][0].callback_data === 'menu:read', 'Button 1 is menu:read');
  assert(START_HELP_MENU_KEYBOARD.inline_keyboard[0][1].callback_data === 'menu:review', 'Button 2 is menu:review');
  assert(START_HELP_MENU_KEYBOARD.inline_keyboard[1][0].callback_data === 'menu:tags', 'Button 3 is menu:tags');
  assert(START_HELP_MENU_KEYBOARD.inline_keyboard[1][1].callback_data === 'menu:pin', 'Button 4 is menu:pin');

  // --- 3. Test Navigation Back Button in List Keyboards ---
  console.log('\n--- 3. Testing Navigation Back Button in Keyboards ---');
  const readKb = buildPaginationKeyboard('read', 'all', 1, 1, [{ id: 'n1' }]);
  const readBackBtn = readKb?.inline_keyboard.flat().find((b) => b.text.includes('Kembali'));
  assert(readBackBtn?.callback_data === 'menu:start', '/read list back button points to menu:start');

  const pinKb = buildPaginationKeyboard('pin', 'all', 1, 1, [{ id: 'n1' }]);
  const pinBackBtn = pinKb?.inline_keyboard.flat().find((b) => b.text.includes('Kembali'));
  assert(pinBackBtn?.callback_data === 'menu:start', '/pin list back button points to menu:start');

  const reviewKb = buildPaginationKeyboard('review', 'all', 1, 1, [{ id: 'n1' }]);
  const reviewBackBtn = reviewKb?.inline_keyboard.flat().find((b) => b.text.includes('Kembali'));
  assert(reviewBackBtn?.callback_data === 'menu:start', '/review list back button points to menu:start');

  const tagListKb = buildPaginationKeyboard('tags', 'unlazynotes', 1, 1, [{ id: 'n1' }]);
  const tagListBackBtn = tagListKb?.inline_keyboard.flat().find((b) => b.text.includes('Kembali'));
  assert(tagListBackBtn?.callback_data === 'menu:tags', '/tags <tag> list back button points to menu:tags');

  const catGridKb = buildCategoriesGridKeyboard(new Set(['todo']), false);
  const catGridBackBtn = catGridKb?.inline_keyboard.flat().find((b) => b.text.includes('Kembali'));
  assert(catGridBackBtn?.callback_data === 'menu:start', '/tags categories grid back button points to menu:start');

  // --- 4. Test Bug Fix: Query Value Preservation on Note Detail Back Button ---
  console.log('\n--- 4. Testing Query Value Preservation in Note Detail View ---');
  const sampleNote = {
    id: 'note_uuid_1234567890_abcdefghij',
    content: 'Test content for detail note',
    category: 'todo',
    isProcessed: true,
  };

  // Build detail keyboard with queryVal = 'unlazynotes'
  const detailKb = buildNoteDetailKeyboard(sampleNote, 'tags', 'unlazynotes', 1);
  const backToDaftarBtn = detailKb.inline_keyboard.flat().find((b) => b.text.includes('Kembali ke Daftar'));
  assert(
    backToDaftarBtn?.callback_data === 'page:tags:unlazynotes:1',
    `Detail back button properly preserves tag name "unlazynotes": ${backToDaftarBtn?.callback_data}`
  );

  // Test fallback if queryVal was empty: it safely points to menu:tags instead of breaking with page:tags::1
  const detailKbEmpty = buildNoteDetailKeyboard(sampleNote, 'tags', '', 1);
  const backBtnEmpty = detailKbEmpty.inline_keyboard.flat().find((b) => b.text.includes('Kembali ke Daftar'));
  assert(
    backBtnEmpty?.callback_data === 'menu:tags',
    `Detail back button falls back safely to menu:tags when query is empty: ${backBtnEmpty?.callback_data}`
  );

  console.log('\n================================================================');
  console.log(`SUMMARY: ${passed}/${total} TESTS PASSED`);
  console.log('================================================================');

  if (passed === total) {
    console.log('🎉 ALL NAV AND ANTI-OTHERS TESTS PASSED WITH 100% SUCCESS!');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
