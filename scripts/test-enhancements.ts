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
import { eq, and } from 'drizzle-orm';

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

  // --- ITEM 4: Numbered Capsule Tags Formatting ---
  console.log('\n--- 4. Testing Numbered Capsule Tags Formatting ---');
  const { formatTagNumberedHorizontal, escapeHtml } = await import('../src/lib/telegram-handler');
  assert(formatTagListHorizontal([]) === '-', `Empty legacy tag list formats as '-'`);
  assert(
    formatTagListHorizontal(['kopi', 'cimin']) === '#kopi, #cimin',
    `Tag list formats horizontally with # prefix for legacy compatibility`
  );
  assert(formatTagNumberedHorizontal([]) === '-', `Empty numbered tag list formats as '-'`);
  assert(
    formatTagNumberedHorizontal(['(1)food', '(2)meeting', '(3)renungan']) === '(1)food  (2)meeting  (3)renungan',
    `Tag list formats in capsule brackets separated by double space without comma`
  );
  assert(
    escapeHtml('c&k<test>') === 'c&amp;k&lt;test&gt;',
    `escapeHtml properly escapes HTML special characters`
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

  // --- ITEM 6: Tag Search Tracking, 15-Tag Limit, Capsule Numbering & Deduplication ---
  console.log('\n--- 6. Testing 15-Tag Limit, Capsule Numbering & Deduplication ---');
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

  // Teraktif harus nomor 1 (kopi adalah frekuensi tertinggi = 2) dengan format (1)kopi
  assert(overview.activeTagsText.startsWith('(1)kopi'), `Active tags starts with (1)kopi (got: ${overview.activeTagsText})`);
  assert(!overview.activeTagsText.includes('#'), `Active tags formatted WITHOUT '#' prefix`);
  assert(!overview.activeTagsText.includes(','), `Active tags formatted WITHOUT comma separator`);

  // Terakhir harus melanjutkan nomor urut (tidak reset ke 1) dan TIDAK mengandung 'kopi' karena deduplikasi
  assert(!overview.recentTagsText.includes(')kopi'), `Recent tags deduplicates 'kopi' which is already in Active (got: ${overview.recentTagsText})`);
  assert(!overview.recentTagsText.startsWith('(1)'), `Recent tags continues global numbering and does NOT restart from (1) (got: ${overview.recentTagsText})`);

  // Sering Dicari harus melanjutkan nomor urut berikutnya, TIDAK mengandung 'kopi', tapi mengandung 'crypto' dan 'investasi'
  assert(!overview.searchedTagsText.includes(')kopi'), `Searched tags deduplicates 'kopi' (got: ${overview.searchedTagsText})`);
  assert(overview.searchedTagsText.includes('(6)investasi'), `Searched tags contains (6)investasi (got: ${overview.searchedTagsText})`);
  assert(overview.searchedTagsText.includes('(7)crypto'), `Searched tags contains (7)crypto (got: ${overview.searchedTagsText})`);

  // Validasi numberToTagMap
  assert(overview.numberToTagMap.get(1) === 'kopi', `numberToTagMap key 1 resolves to 'kopi'`);
  const tagForFirstRecent = overview.numberToTagMap.get(overview.numberToTagMap.size);
  assert(Boolean(tagForFirstRecent), `numberToTagMap contains mapping for all consecutive numbers`);

  // --- ITEM 7: HTML i18n & Bracketed Number Shortcut Resolution ---
  console.log('\n--- 7. Testing HTML i18n & Bracketed Number Shortcut Resolution ---');
  const { getTelegramMsg } = await import('../src/lib/i18n/telegram');
  const htmlMsg = getTelegramMsg('tags_header', 'id', {
    activeTagsText: overview.activeTagsText,
    recentTagsText: overview.recentTagsText,
    searchedTagsText: overview.searchedTagsText,
  });

  assert(htmlMsg.includes('<b>Tags Anda</b>'), `i18n tags_header uses HTML <b> tags for title`);
  assert(htmlMsg.includes('<b>Teraktif:</b>'), `i18n tags_header uses HTML <b> tags for Teraktif`);
  assert(htmlMsg.includes('&lt;nama_tag&gt;'), `i18n tags_header escapes HTML brackets properly`);

  // Uji regex input shortcut: baik '1' maupun '(1)'
  const numRegex = /^\(?(\d+)\)?$/;
  const matchDirect = '1'.match(numRegex);
  const matchBracket = '(1)'.match(numRegex);
  const matchHighNum = '(16)'.match(numRegex);
  assert(matchDirect !== null && matchDirect[1] === '1', `Regex matches direct number '1'`);
  assert(matchBracket !== null && matchBracket[1] === '1', `Regex matches bracketed number '(1)'`);
  assert(matchHighNum !== null && matchHighNum[1] === '16', `Regex matches bracketed number '(16)'`);

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

  // --- ITEM 8: Timeline Grouping formatSnippetPage ---
  console.log('\n--- 8. Testing Timeline Grouping formatSnippetPage ---');
  const { formatSnippetPage } = await import('../src/lib/telegram-handler');
  const sampleTimelineNotes = [
    {
      content: 'dapet transferan dp website klien 2.5jt pt karya maju',
      category: 'finance',
      specificTags: ['client'],
      isPinned: true,
      createdAt: new Date('2026-10-17T15:00:00Z'),
    },
    {
      content: 'coffee break with client discuss Q4 roadmap jam 4 sore',
      category: 'schedule',
      specificTags: ['q4-roadmap', 'meeting', 'client'],
      isPinned: false,
      createdAt: new Date('2026-10-17T10:00:00Z'),
    },
    {
      content: 'demo produk client selasa jam 10 pagi',
      category: 'schedule',
      specificTags: ['demo', 'meeting', 'client'],
      isPinned: false,
      createdAt: new Date('2026-10-16T09:00:00Z'),
    },
  ];

  const timelineOutput = formatSnippetPage(sampleTimelineNotes, 3, 1, 5, '🏷 Catatan dengan label [client]', 'id');
  console.log('Sample Output:\n' + timelineOutput + '\n');

  assert(timelineOutput.includes('🏷 Catatan dengan label [client] (Hal. 1/1 • Total: 3)'), `Header includes title and pagination info`);
  assert(timelineOutput.includes('📅 Sat, 17/10/2026'), `Groups by date 'Sat, 17/10/2026'`);
  assert(!timelineOutput.includes('• Tags:'), `Date header does NOT contain '• Tags:'`);
  assert(timelineOutput.includes('📅 Fri, 16/10/2026'), `Groups by date 'Fri, 16/10/2026'`);
  assert(timelineOutput.includes('(1) 📌⭐️ dapet transferan dp website klien 2.5jt pt karya maju'), `Displays locally numbered note 1 with pin icon 📌⭐️`);
  assert(timelineOutput.includes('(2) 📌 coffee break with client discuss Q4 roadmap jam 4 sore'), `Displays locally numbered note 2 with pin icon 📌`);
  assert(timelineOutput.includes('(3) 📌 demo produk client selasa jam 10 pagi'), `Displays locally numbered note 3 with pin icon 📌`);
  assert(!timelineOutput.includes('*1.*'), `No obsolete item numbering (*1.*) in output`);
  assert(!timelineOutput.includes('*2.*'), `No obsolete item numbering (*2.*) in output`);

  // --- ITEM 9: Note Detail Inline Buttons (1-Tap Note Detail) ---
  console.log('\n--- 9. Testing Note Detail Buttons & displayNoteDetail ---');
  const mockItems = [
    { id: 'uuid-1' },
    { id: 'uuid-2' },
    { id: 'uuid-3' },
  ];
  const kbWithButtons = buildPaginationKeyboard('tags', 'client', 1, 1, mockItems);
  assert(kbWithButtons !== undefined, `Keyboard with note buttons generated`);
  assert(kbWithButtons?.inline_keyboard[0].length === 3, `Row 1 has 3 number buttons for 3 items`);
  assert(kbWithButtons?.inline_keyboard[0][0].text.trim() === '1', `Button 1 has text '1'`);
  assert(kbWithButtons?.inline_keyboard[0][0].callback_data === 'note:view:uuid-1:tags:client:1', `Button 1 callback is note:view:uuid-1:tags:client:1`);

  // Test 7 items (should break into 2 rows: 5 and 2)
  const mock7Items = Array.from({ length: 7 }, (_, i) => ({ id: `uuid-${i + 1}` }));
  const kb7 = buildPaginationKeyboard('tags', 'client', 1, 2, mock7Items);
  assert(kb7?.inline_keyboard[0].length === 5, `Row 1 has 5 buttons for 7 items`);
  assert(kb7?.inline_keyboard[1].length === 2, `Row 2 has 2 buttons for 7 items`);
  assert(kb7?.inline_keyboard[2].length === 2, `Row 3 is pagination nav [1/2] [Next] on page 1`);
  assert(kb7?.inline_keyboard[3][0].text === '🏷 Kembali ke Tags', `Row 4 is back button`);

  // --- ITEM 10: Testing Refined 1-Tag-per-Note Recent, Strict Global Deduplication, and Search Tracking ---
  console.log('\n--- 10. Testing 1-Tag Recent & Global Deduplication ---');
  const user10Id = `test_user_item10_${Date.now()}`;
  await db.insert(users).values({
    id: user10Id,
    email: `${user10Id}@example.com`,
  });

  // Insert notes to saturate Teraktif with 15 unique tags (tag-01 to tag-15) with frequency >= 2
  const baseTime = Date.now();
  const notesBatch = [];
  for (let i = 1; i <= 15; i++) {
    const pad = String(i).padStart(2, '0');
    notesBatch.push({
      id: crypto.randomUUID(),
      userId: user10Id,
      content: `Note content ${pad} A`,
      category: 'others' as const,
      specificTags: [`tag-${pad}`],
      createdAt: new Date(baseTime - 100000 + i * 1000),
    });
    notesBatch.push({
      id: crypto.randomUUID(),
      userId: user10Id,
      content: `Note content ${pad} B`,
      category: 'others' as const,
      specificTags: [`tag-${pad}`],
      createdAt: new Date(baseTime - 50000 + i * 1000),
    });
  }
  // Extra note with tag-01 to ensure frequency is 3 (top 1)
  notesBatch.push({
    id: crypto.randomUUID(),
    userId: user10Id,
    content: `Extra note tag-01`,
    category: 'others' as const,
    specificTags: ['tag-01'],
    createdAt: new Date(baseTime - 20000),
  });

  // Note A (newer): multiple tags ['recent-first', 'recent-second', 'recent-third']
  // Only 'recent-first' must be taken into Terakhir!
  notesBatch.push({
    id: crypto.randomUUID(),
    userId: user10Id,
    content: `Recent note with multiple tags`,
    category: 'others' as const,
    specificTags: ['recent-first', 'recent-second', 'recent-third'],
    createdAt: new Date(baseTime - 10000),
  });

  // Note B (even newer): fallback to category when specificTags is empty
  notesBatch.push({
    id: crypto.randomUUID(),
    userId: user10Id,
    content: `Note with empty specificTags fallback to category`,
    category: 'credential' as const,
    specificTags: [],
    createdAt: new Date(baseTime - 5000),
  });

  // Note C (newest!): first tag is 'tag-01' which is ALREADY in Teraktif!
  // It must be skipped, and MUST NOT pull in 'skip-me'
  notesBatch.push({
    id: crypto.randomUUID(),
    userId: user10Id,
    content: `Note whose first tag is already active`,
    category: 'others' as const,
    specificTags: ['tag-01', 'skip-me'],
    createdAt: new Date(baseTime - 1000),
  });

  await db.insert(notes).values(notesBatch);

  // Searches:
  // 1. 'tag-01' (already in Teraktif)
  // 2. 'recent-first' (already in Terakhir)
  // 3. 'searched-unique' (should appear in Sering Dicari)
  await recordTagSearch(user10Id, 'tag-01');
  await recordTagSearch(user10Id, 'recent-first');
  await recordTagSearch(user10Id, 'searched-unique');
  await recordTagSearch(user10Id, 'searched-unique'); // count 2

  const overview10 = await getTagsOverviewData(user10Id);

  // 1. Teraktif contains 15 tags: (1)tag-01 through (15)tag-15
  assert(overview10.activeTagsText.includes('(1)tag-01'), `Teraktif starts with (1)tag-01`);
  assert(overview10.activeTagsText.includes('(15)'), `Teraktif has 15 items ending with (15)`);

  // 2. Terakhir: Note C has 'tag-01' as first tag -> skipped! 'skip-me' is NOT taken.
  assert(!overview10.recentTagsText.includes('skip-me'), `Terakhir skips note when first tag is active and does NOT take 2nd tag`);
  // Note B is next newest: empty tags -> fallback 'credential'
  assert(overview10.recentTagsText.includes('credential'), `Terakhir falls back to category 'credential' when specificTags is empty`);
  // Note A is next: takes 'recent-first'
  assert(overview10.recentTagsText.includes('recent-first'), `Terakhir takes only first tag 'recent-first'`);
  assert(!overview10.recentTagsText.includes('recent-second'), `Terakhir does NOT take second tag 'recent-second'`);

  // 3. Numbering continues sequentially from 16
  assert(overview10.recentTagsText.includes('(16)'), `Terakhir starts numbering at (16)`);
  assert(overview10.recentTagsText.includes('(17)'), `Terakhir continues numbering at (17)`);

  // 4. Sering Dicari: 'tag-01' and 'recent-first' skipped because already in seenTags
  assert(!overview10.searchedTagsText.includes('tag-01'), `Sering Dicari skips tag-01 which is in Teraktif`);
  assert(!overview10.searchedTagsText.includes('recent-first'), `Sering Dicari skips recent-first which is in Terakhir`);
  assert(overview10.searchedTagsText.includes('(18)searched-unique'), `Sering Dicari includes searched-unique at (18)`);

  // 5. Test callback query tracks inline tag click
  const testChatId10 = `chat_btn_${Date.now()}`;
  await db.insert(apiKeys).values({
    id: crypto.randomUUID(),
    userId: user10Id,
    keyHash: `hash_${Date.now()}`,
    telegramChatId: testChatId10,
    isActive: true,
  });

  const { processTelegramCallbackQuery } = await import('../src/lib/telegram-handler');
  await processTelegramCallbackQuery({
    id: 'cb_test_btn',
    data: 'page:tags:clicked-category:1',
    from: { id: testChatId10 },
  });

  const [clickedSearch] = await db
    .select()
    .from(tagSearches)
    .where(and(eq(tagSearches.userId, user10Id), eq(tagSearches.tag, 'clicked-category')));
  assert(clickedSearch !== undefined && clickedSearch.count >= 1, `Inline tag click recorded in tag_searches table`);

  // --- ITEM 11: Testing Pin Feature, Note Actions (Copy & Delete), and /pin Command ---
  console.log('\n--- 11. Testing Pin, Copy, Delete, and /pin Command ---');
  const user11Id = `test_user_item11_${Date.now()}`;
  const testChatId11 = `chat_pin_${Date.now()}`;
  await db.insert(users).values({
    id: user11Id,
    email: `${user11Id}@example.com`,
  });
  await db.insert(apiKeys).values({
    id: crypto.randomUUID(),
    userId: user11Id,
    keyHash: `hash_pin_${Date.now()}`,
    telegramChatId: testChatId11,
    isActive: true,
  });

  const { formatNoteDateWib, handlePinList, displayNoteDetail } = await import('../src/lib/telegram-handler');

  // 1. Test formatNoteDateWib
  const testDate = new Date('2026-10-17T07:30:00Z');
  const wibFormatted = formatNoteDateWib(testDate);
  assert(wibFormatted === 'Sat, 17/10/2026 • 14:30 WIB', `formatNoteDateWib outputs 'Sat, 17/10/2026 • 14:30 WIB' (got: ${wibFormatted})`);

  // 2. Test handlePinList empty state
  const emptyPinRes = await handlePinList(testChatId11, user11Id, 1, 'id');
  assert(emptyPinRes.ok === true && emptyPinRes.action === 'pin_empty', `handlePinList returns pin_empty when no notes pinned`);

  // 3. Insert mock notes (1 pinned, 1 unpinned)
  const pinnedNoteId = crypto.randomUUID();
  const unpinnedNoteId = crypto.randomUUID();
  await db.insert(notes).values([
    {
      id: pinnedNoteId,
      userId: user11Id,
      content: 'laundry kiloan 4.5kg 32rb ambil besok lusa',
      category: 'reference',
      specificTags: ['laundry', 'laundry-kiloan'],
      isPinned: true,
      createdAt: testDate,
    },
    {
      id: unpinnedNoteId,
      userId: user11Id,
      content: 'beli susu uht 1 liter',
      category: 'finance',
      specificTags: ['groceries'],
      isPinned: false,
      createdAt: new Date('2026-10-16T08:00:00Z'),
    },
  ]);

  // 4. Test handlePinList with pinned note
  const populatedPinRes = await handlePinList(testChatId11, user11Id, 1, 'id');
  assert(populatedPinRes.ok === true && populatedPinRes.action === 'pin_list', `handlePinList returns pin_list when pinned notes exist`);
  assert(populatedPinRes.totalCount === 1, `handlePinList totalCount is 1`);

  // 5. Test displayNoteDetail for pinned note
  const pinnedDetailRes = await displayNoteDetail(testChatId11, undefined, pinnedNoteId, 'tags', 'laundry', 1);
  assert(pinnedDetailRes.ok === true && pinnedDetailRes.action === 'note_detail_view', `displayNoteDetail executed successfully for pinned note`);

  // 6. Test toggle pin via processTelegramCallbackQuery (note:pin:pinnedNoteId...)
  await processTelegramCallbackQuery({
    id: 'cb_pin_toggle',
    data: `note:pin:${pinnedNoteId}:tags:laundry:1`,
    from: { id: testChatId11 },
  });
  const [unpinnedAfter] = await db.select().from(notes).where(eq(notes.id, pinnedNoteId)).limit(1);
  assert(unpinnedAfter.isPinned === false, `note:pin successfully toggled isPinned from true to false`);

  // 7. Toggle back to pinned
  await processTelegramCallbackQuery({
    id: 'cb_pin_toggle_2',
    data: `note:pin:${pinnedNoteId}:tags:laundry:1`,
    from: { id: testChatId11 },
  });
  const [pinnedAgain] = await db.select().from(notes).where(eq(notes.id, pinnedNoteId)).limit(1);
  assert(pinnedAgain.isPinned === true, `note:pin successfully toggled isPinned from false to true`);

  // 8. Test delete confirmation step (note:delete_confirm)
  const delConfirmRes = await processTelegramCallbackQuery({
    id: 'cb_del_confirm',
    data: `note:delete_confirm:${unpinnedNoteId}:tags:groceries:1`,
    from: { id: testChatId11 },
  });
  assert(delConfirmRes.ok === true && delConfirmRes.action === 'note_delete_confirm', `note:delete_confirm returns note_delete_confirm action`);

  // 9. Test delete execution step (note:delete_exec)
  const delExecRes = await processTelegramCallbackQuery({
    id: 'cb_del_exec',
    data: `note:delete_exec:${unpinnedNoteId}:tags:groceries:1`,
    from: { id: testChatId11 },
  });
  assert(delExecRes.ok === true && delExecRes.action === 'note_deleted', `note:delete_exec returns note_deleted action`);

  const [deletedNoteCheck] = await db.select().from(notes).where(eq(notes.id, unpinnedNoteId)).limit(1);
  assert(deletedNoteCheck === undefined, `Note was permanently deleted from DB`);

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
