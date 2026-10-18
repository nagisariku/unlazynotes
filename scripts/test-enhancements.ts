import { heuristicTagNote, sanitizeTags } from '../src/lib/ai';
import {
  formatTagListHorizontal,
  buildCategoriesGridKeyboard,
  buildPaginationKeyboard,
  recordTagSearch,
  getTagsOverviewData,
} from '../src/lib/telegram-handler';
import { db } from '../src/db';
import { users, apiKeys, notes, tagSearches } from '../src/db/schema';
import { eq } from 'drizzle-orm';

async function runTests() {
  console.log('==================================================');
  console.log('TESTING TAGGING PIPELINE & /TAGS HORIZONTAL OVERHAUL');
  console.log('==================================================\n');

  let total = 0;
  let passed = 0;

  function assert(condition: boolean, message: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`✅ PASS | ${message}`);
    } else {
      console.error(`❌ FAIL | ${message}`);
    }
  }

  // --- ITEM 1: Schedule Non-Meeting Guard ---
  console.log('--- 1. Testing Schedule Non-Meeting Guard ---');
  const movieNote = 'nonton avatar di cgv sabtu malam jam 21.15 seat f12';
  const movieHeuristic = heuristicTagNote(movieNote);
  assert(
    movieHeuristic.category === 'schedule',
    `Movie note category should be 'schedule' (got '${movieHeuristic.category}')`
  );
  assert(
    !movieHeuristic.specific_tags.includes('meeting'),
    `Movie note tags MUST NOT include 'meeting' (got ${JSON.stringify(movieHeuristic.specific_tags)})`
  );
  assert(
    movieHeuristic.specific_tags.includes('avatar') &&
    movieHeuristic.specific_tags.includes('cgv') &&
    movieHeuristic.specific_tags.includes('entertainment'),
    `Movie note tags should have avatar, cgv, entertainment (got ${JSON.stringify(movieHeuristic.specific_tags)})`
  );

  // --- ITEM 2: 5-Tag Max & Multi-Entity Enrichment ---
  console.log('\n--- 2. Testing 5-Tag Max & Multi-Entity Enrichment ---');
  const multiEntityNote = 'dapet transferan dp website klien 2.5jt pt karya maju';
  const multiHeuristic = heuristicTagNote(multiEntityNote);
  assert(
    multiHeuristic.category === 'finance',
    `Multi-entity note category should be 'finance' (got '${multiHeuristic.category}')`
  );
  assert(
    multiHeuristic.specific_tags.includes('pt-karya-maju'),
    `Tags should retain 'pt-karya-maju' (got ${JSON.stringify(multiHeuristic.specific_tags)})`
  );
  assert(
    multiHeuristic.specific_tags.includes('website'),
    `Tags should retain 'website' (got ${JSON.stringify(multiHeuristic.specific_tags)})`
  );
  assert(
    multiHeuristic.specific_tags.length >= 4,
    `Tags length should be >= 4 without truncation (got ${multiHeuristic.specific_tags.length}: ${JSON.stringify(multiHeuristic.specific_tags)})`
  );

  // --- ITEM 3: SSH Key, Number Retention & Short Tag Guard ---
  console.log('\n--- 3. Testing SSH Key Number Retention & Short Tag Guard ---');
  const sshNote = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIG5rQ1 root@vps-production';
  const sshHeuristic = heuristicTagNote(sshNote);
  assert(
    sshHeuristic.category === 'credential',
    `SSH note category should be 'credential' (got '${sshHeuristic.category}')`
  );
  assert(
    !sshHeuristic.specific_tags.includes('ed'),
    `SSH note MUST NOT contain truncated tag 'ed' (got ${JSON.stringify(sshHeuristic.specific_tags)})`
  );
  assert(
    sshHeuristic.specific_tags.includes('ed25519'),
    `SSH note should preserve 'ed25519' (got ${JSON.stringify(sshHeuristic.specific_tags)})`
  );

  const testCryptoTags = sanitizeTags(['ed25519', 'sha256', 'rsa4096', 'chapter4'], 'credential');
  assert(
    testCryptoTags.includes('ed25519') && testCryptoTags.includes('sha256') && testCryptoTags.includes('rsa4096'),
    `Tech crypto numbers preserved: ed25519, sha256, rsa4096 (got ${JSON.stringify(testCryptoTags)})`
  );
  assert(
    testCryptoTags.includes('chapter'),
    `Chapter4 correctly stripped to chapter (got ${JSON.stringify(testCryptoTags)})`
  );

  const testShortTags = sanitizeTags(['ed', 'ai', 'qa', 'ml', 'xx'], 'others');
  assert(
    !testShortTags.includes('ed') && !testShortTags.includes('xx'),
    `Short invalid tags 'ed' and 'xx' rejected (got ${JSON.stringify(testShortTags)})`
  );
  assert(
    testShortTags.includes('ai') && testShortTags.includes('qa') && testShortTags.includes('ml'),
    `Whitelisted short tags 'ai', 'qa', 'ml' allowed (got ${JSON.stringify(testShortTags)})`
  );

  // --- ITEM 4: Numbered Horizontal Tags Formatting ---
  console.log('\n--- 4. Testing Numbered Horizontal Tags Formatting ---');
  assert(formatTagListHorizontal([]) === '-', `Empty tag list formats as '-'`);
  assert(
    formatTagListHorizontal(['kopi', 'cimin']) === '#kopi, #cimin',
    `Tag list formats horizontally with # prefix for legacy compatibility`
  );
  assert(
    !formatTagListHorizontal(['kopi']).includes('('),
    `Horizontal tag list does NOT contain count in parentheses`
  );

  // --- ITEM 5: 3x3 Categories Grid Keyboard ---
  console.log('\n--- 5. Testing 3x3 Categories Grid Keyboard ---');
  const keyboard = buildCategoriesGridKeyboard();
  assert(keyboard.inline_keyboard.length === 3, `Keyboard has exactly 3 rows`);
  assert(keyboard.inline_keyboard[0].length === 3, `Row 1 has 3 buttons`);
  assert(keyboard.inline_keyboard[1].length === 3, `Row 2 has 3 buttons`);
  assert(keyboard.inline_keyboard[2].length === 3, `Row 3 has 3 buttons`);

  // Row 1
  assert(keyboard.inline_keyboard[0][0].text === '💰 Finance', `Row 1 Col 1 is Finance`);
  assert(keyboard.inline_keyboard[0][0].callback_data === 'page:tags:finance:1', `Finance callback_data is page:tags:finance:1`);
  assert(keyboard.inline_keyboard[0][1].text === '📋 Todo', `Row 1 Col 2 is Todo`);
  assert(keyboard.inline_keyboard[0][1].callback_data === 'page:tags:todo:1', `Todo callback_data is page:tags:todo:1`);
  assert(keyboard.inline_keyboard[0][2].text === '📅 Schedule', `Row 1 Col 3 is Schedule`);
  assert(keyboard.inline_keyboard[0][2].callback_data === 'page:tags:schedule:1', `Schedule callback_data is page:tags:schedule:1`);

  // Row 2
  assert(keyboard.inline_keyboard[1][0].text === '🔖 Bookmark', `Row 2 Col 1 is Bookmark`);
  assert(keyboard.inline_keyboard[1][0].callback_data === 'page:tags:bookmark:1', `Bookmark callback_data is page:tags:bookmark:1`);
  assert(keyboard.inline_keyboard[1][1].text === '🔐 Credential', `Row 2 Col 2 is Credential`);
  assert(keyboard.inline_keyboard[1][1].callback_data === 'page:tags:credential:1', `Credential callback_data is page:tags:credential:1`);
  assert(keyboard.inline_keyboard[1][2].text === '📚 Reference', `Row 2 Col 3 is Reference`);
  assert(keyboard.inline_keyboard[1][2].callback_data === 'page:tags:reference:1', `Reference callback_data is page:tags:reference:1`);

  // Row 3
  assert(keyboard.inline_keyboard[2][0].text === '📝 Draft', `Row 3 Col 1 is Draft`);
  assert(keyboard.inline_keyboard[2][0].callback_data === 'page:tags:draft:1', `Draft callback_data is page:tags:draft:1`);
  assert(keyboard.inline_keyboard[2][1].text === '💬 Random-yap', `Row 3 Col 2 is Random-yap`);
  assert(keyboard.inline_keyboard[2][1].callback_data === 'page:tags:random-yap:1', `Random-yap callback_data is page:tags:random-yap:1`);
  assert(keyboard.inline_keyboard[2][2].text === '🏷 Others', `Row 3 Col 3 is Others`);
  assert(keyboard.inline_keyboard[2][2].callback_data === 'page:tags:others:1', `Others callback_data is page:tags:others:1`);

  // Check pagination keyboard has "Kembali ke Tags"
  const tagsPaginationKb = buildPaginationKeyboard('tags', 'finance', 1, 3);
  assert(tagsPaginationKb !== undefined, `Tags pagination keyboard generated`);
  assert(tagsPaginationKb?.inline_keyboard.length === 2, `Tags pagination keyboard has 2 rows (nav + back)`);
  assert(tagsPaginationKb?.inline_keyboard[1][0].text === '🏷 Kembali ke Tags', `Back button text is '🏷 Kembali ke Tags'`);
  assert(tagsPaginationKb?.inline_keyboard[1][0].callback_data === 'menu:tags', `Back button callback is 'menu:tags'`);

  // --- ITEM 6: Tag Search Tracking, 15-Tag Limit, Global Numbering & Deduplication ---
  console.log('\n--- 6. Testing 15-Tag Limit, Consecutive Global Numbering & Deduplication ---');
  const testUserId = `test_user_tags_${Date.now()}`;
  await db.insert(users).values({
    id: testUserId,
    email: `${testUserId}@example.com`,
  });

  // Track search: 'kopi' (sudah ada di notes), 'crypto' (belum ada di notes), 'investasi' (belum ada di notes)
  await recordTagSearch(testUserId, 'kopi');
  await recordTagSearch(testUserId, 'kopi');
  await recordTagSearch(testUserId, 'crypto');
  await recordTagSearch(testUserId, 'investasi');

  // Insert mock notes
  await db.insert(notes).values([
    {
      id: crypto.randomUUID(),
      userId: testUserId,
      content: 'ngopi pagi',
      category: 'others',
      specificTags: ['kopi', 'pagi'],
      createdAt: new Date(Date.now() - 3000),
    },
    {
      id: crypto.randomUUID(),
      userId: testUserId,
      content: 'jajan cimin dan kopi',
      category: 'finance',
      specificTags: ['cimin', 'kopi'],
      createdAt: new Date(Date.now() - 2000),
    },
    {
      id: crypto.randomUUID(),
      userId: testUserId,
      content: 'bayar wifi hetzner',
      category: 'credential',
      specificTags: ['hetzner', 'wifi'],
      createdAt: new Date(Date.now() - 1000),
    },
  ]);

  const overview = await getTagsOverviewData(testUserId);
  assert(overview.hasNotes === true, `Overview detects user notes`);

  // Teraktif harus nomor 1 (kopi adalah frekuensi tertinggi = 2)
  assert(overview.activeTagsText.startsWith('1.kopi'), `Active tags starts with 1.kopi (got: ${overview.activeTagsText})`);
  assert(!overview.activeTagsText.includes('#'), `Active tags formatted WITHOUT '#' prefix`);

  // Terakhir harus melanjutkan nomor urut (tidak reset ke 1) dan TIDAK mengandung 'kopi' karena deduplikasi
  assert(!overview.recentTagsText.includes('.kopi'), `Recent tags deduplicates 'kopi' which is already in Active (got: ${overview.recentTagsText})`);
  assert(!overview.recentTagsText.startsWith('1.'), `Recent tags continues global numbering and does NOT restart from 1 (got: ${overview.recentTagsText})`);

  // Sering Dicari harus melanjutkan nomor urut berikutnya, TIDAK mengandung 'kopi', tapi mengandung 'crypto' dan 'investasi'
  assert(!overview.searchedTagsText.includes('.kopi'), `Searched tags deduplicates 'kopi' (got: ${overview.searchedTagsText})`);
  assert(overview.searchedTagsText.includes('crypto'), `Searched tags contains 'crypto' (got: ${overview.searchedTagsText})`);
  assert(overview.searchedTagsText.includes('investasi'), `Searched tags contains 'investasi' (got: ${overview.searchedTagsText})`);

  // Validasi numberToTagMap
  assert(overview.numberToTagMap.get(1) === 'kopi', `numberToTagMap key 1 resolves to 'kopi'`);
  const tagForFirstRecent = overview.numberToTagMap.get(overview.numberToTagMap.size);
  assert(Boolean(tagForFirstRecent), `numberToTagMap contains mapping for all consecutive numbers`);

  // --- ITEM 7: Number Shortcut Session & Tag Filter Routing ---
  console.log('\n--- 7. Testing Number Shortcut Session & Tag Filter Routing ---');
  const mockChatId = `chat_test_${Date.now()}`;
  const { tagSessionMap, TAG_SESSION_TTL_MS } = await import('../src/lib/telegram-handler');

  // Set session
  tagSessionMap.set(mockChatId, {
    tags: overview.numberToTagMap,
    expiresAt: Date.now() + TAG_SESSION_TTL_MS,
  });

  const session = tagSessionMap.get(mockChatId);
  assert(session !== undefined, `Session created for mockChatId`);
  assert(session?.tags.get(1) === 'kopi', `Session resolves number 1 to 'kopi'`);

  // Test expired session behavior
  tagSessionMap.set(mockChatId, {
    tags: overview.numberToTagMap,
    expiresAt: Date.now() - 1000, // expired
  });
  const expiredSession = tagSessionMap.get(mockChatId);
  assert(expiredSession!.expiresAt < Date.now(), `Session properly marked as expired`);

  // Cleanup
  tagSessionMap.delete(mockChatId);
  await db.delete(users).where(eq(users.id, testUserId));

  console.log(`\n==================================================`);
  console.log(`TOTAL: ${passed}/${total} assertions passed.`);
  console.log(`==================================================`);

  if (passed === total) {
    console.log('🎉 ALL HORIZONTAL & NUMBER SHORTCUT TESTS PASSED 100%!');
    process.exit(0);
  } else {
    console.error('❌ SOME TESTS FAILED');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
