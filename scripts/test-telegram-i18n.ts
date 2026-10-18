import * as dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

import {
  getTelegramMsg,
  detectTelegramLocale,
  TELEGRAM_MESSAGES,
  type TelegramMessageKey,
  type SupportedLocale,
} from '../src/lib/i18n/telegram';
import {
  getTelegramQuotaExceededMessage,
  getTelegramProGatedMessage,
} from '../src/lib/quota-service';
import { formatSnippetPage } from '../src/lib/telegram-handler';

async function runTests() {
  console.log('================================================================');
  console.log('🧪 TESTING TELEGRAM I18N SYSTEM (BILINGUAL ID / EN)');
  console.log('================================================================');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`✅ PASS: ${testName}`);
    } else {
      console.error(`❌ FAIL: ${testName}`);
      if (detail) console.error(`   Details: ${detail}`);
    }
  }

  // --- TEST SUITE 1: Dictionary & Parameter Interpolation ---
  console.log('\n--- 1. Testing Dictionary Keys & Parameter Interpolation ---');
  const requiredKeys: TelegramMessageKey[] = [
    'help',
    'welcome_connected',
    'security_tip',
    'unauthenticated',
    'inactive_sub',
    'tags_empty',
    'tags_header',
    'search_empty',
    'search_header',
    'quota_exceeded',
    'logout_success',
    'secure_saved',
    'vault_list',
  ];

  for (const k of requiredKeys) {
    const hasId = Boolean(TELEGRAM_MESSAGES[k]?.id);
    const hasEn = Boolean(TELEGRAM_MESSAGES[k]?.en);
    assert(hasId && hasEn, `Key "${k}" exists in both ID and EN dictionaries`);
  }

  // Parameter replacement check
  const welcomeId = getTelegramMsg('welcome_connected', 'id', {
    userName: 'Riku',
    securityDisclaimer: 'DISCLAIMER_TEST',
  });
  assert(
    welcomeId.includes('Halo Riku!') && welcomeId.includes('DISCLAIMER_TEST'),
    'Interpolation in ID welcome_connected'
  );

  const welcomeEn = getTelegramMsg('welcome_connected', 'en', {
    userName: 'Riku',
    securityDisclaimer: 'DISCLAIMER_TEST',
  });
  assert(
    welcomeEn.includes('Hello Riku!') && welcomeEn.includes('DISCLAIMER_TEST'),
    'Interpolation in EN welcome_connected'
  );

  const quotaFooterId = getTelegramMsg('quota_warning_footer', 'id', { remaining: 5 });
  assert(quotaFooterId.includes('5/30'), 'Quota footer ID has remaining count');

  const quotaFooterEn = getTelegramMsg('quota_warning_footer', 'en', { remaining: 5 });
  assert(
    quotaFooterEn.includes('Remaining Free quota this month: 5/30'),
    'Quota footer EN has localized text'
  );

  // --- TEST SUITE 2: Language Detection Logic ---
  console.log('\n--- 2. Testing Language Detection Helper (detectTelegramLocale) ---');
  // Authenticated user with preferredLocale overrides telegram client language
  assert(
    detectTelegramLocale({ from: { language_code: 'en-US' } }, 'id') === 'id',
    'User preferredLocale "id" takes precedence over sender "en-US"'
  );
  assert(
    detectTelegramLocale({ from: { language_code: 'id' } }, 'en') === 'en',
    'User preferredLocale "en" takes precedence over sender "id"'
  );

  // Unauthenticated / initial request detects from Telegram language_code
  assert(
    detectTelegramLocale({ from: { language_code: 'id' } }, null) === 'id',
    'Unauthenticated sender "id" detected as "id"'
  );
  assert(
    detectTelegramLocale({ from: { language_code: 'id-ID' } }, null) === 'id',
    'Unauthenticated sender "id-ID" detected as "id"'
  );
  assert(
    detectTelegramLocale({ from: { language_code: 'en' } }, null) === 'en',
    'Unauthenticated sender "en" detected as "en"'
  );
  assert(
    detectTelegramLocale({ from: { language_code: 'en-US' } }, null) === 'en',
    'Unauthenticated sender "en-US" detected as "en"'
  );
  assert(
    detectTelegramLocale({ from: { language_code: 'ru' } }, null) === 'en',
    'Unauthenticated non-ID ("ru") falls back to "en"'
  );
  assert(
    detectTelegramLocale({}, null) === 'en',
    'Empty message object falls back to "en"'
  );

  // --- TEST SUITE 3: Quota Service Localized Messages ---
  console.log('\n--- 3. Testing Quota Service Localized Messages ---');
  const quotaMsgId = getTelegramQuotaExceededMessage('http://localhost:4321', 'id');
  assert(
    quotaMsgId.text.includes('jatah 30 catatan Free kamu bulan ini sudah terpakai') &&
    quotaMsgId.replyMarkup.inline_keyboard[0][0].text.includes('Upgrade ke Pro'),
    'Quota Exceeded message in ID has Indonesian copy and button'
  );

  const quotaMsgEn = getTelegramQuotaExceededMessage('http://localhost:4321', 'en');
  assert(
    quotaMsgEn.text.includes("You've reached your 30 Free notes limit for this month") &&
    quotaMsgEn.replyMarkup.inline_keyboard[0][0].text.includes('Upgrade to Pro'),
    'Quota Exceeded message in EN has English copy and button'
  );

  const gatedMsgId = getTelegramProGatedMessage('http://localhost:4321', 'id');
  assert(
    gatedMsgId.text.includes('Fitur ini khusus untuk pengguna UnlazyNotes Pro') &&
    gatedMsgId.replyMarkup.inline_keyboard[0][0].text.includes('Upgrade ke Pro'),
    'Pro Gated message in ID has Indonesian copy and button'
  );

  const gatedMsgEn = getTelegramProGatedMessage('http://localhost:4321', 'en');
  assert(
    gatedMsgEn.text.includes('This feature is exclusive to UnlazyNotes Pro users') &&
    gatedMsgEn.replyMarkup.inline_keyboard[0][0].text.includes('Upgrade to Pro'),
    'Pro Gated message in EN has English copy and button'
  );

  // --- TEST SUITE 4: Snippet Page Formatting Localization ---
  console.log('\n--- 4. Testing Snippet Page Formatting Localization ---');
  const sampleItems = [
    {
      content: 'Hello World Note\nThis is a sample description.',
      createdAt: new Date('2026-10-17T12:00:00Z'),
      category: 'others',
      specificTags: ['test'],
    },
  ];

  const snippetId = formatSnippetPage(sampleItems, 1, 1, 5, '🏷️ Catatan', 'id');
  assert(
    snippetId.includes('(Hal. 1/1 • Total: 1)'),
    'Snippet pagination footer in ID has "(Hal. 1/1 • Total: 1)"'
  );

  const snippetEn = formatSnippetPage(sampleItems, 1, 1, 5, '🏷️ Notes', 'en');
  assert(
    snippetEn.includes('(Page 1/1 • Total: 1)'),
    'Snippet pagination footer in EN has "(Page 1/1 • Total: 1)"'
  );

  // Fallback default note title if first line is empty
  const emptyNoteItem = [
    {
      content: '\n',
      createdAt: new Date(),
      category: 'others',
      specificTags: [],
    },
  ];
  const emptySnippetId = formatSnippetPage(emptyNoteItem, 1, 1, 5, 'Header', 'id');
  assert(emptySnippetId.includes('📌 Catatan'), 'Empty content title in ID defaults to "Catatan"');

  const emptySnippetEn = formatSnippetPage(emptyNoteItem, 1, 1, 5, 'Header', 'en');
  assert(emptySnippetEn.includes('📌 Note'), 'Empty content title in EN defaults to "Note"');

  console.log('\n================================================================');
  console.log(`SUMMARY: ${passed}/${total} TESTS PASSED`);
  console.log('================================================================');

  if (passed === total) {
    console.log('🎉 ALL I18N TESTS PASSED WITH 100% SUCCESS!');
    process.exit(0);
  } else {
    console.error('⚠️ Some tests failed.');
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
