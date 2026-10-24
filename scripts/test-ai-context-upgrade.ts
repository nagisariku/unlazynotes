import { db } from '../src/db';
import { users, notes } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import { getOrFetchUserTags, invalidateUserTagsCache } from '../src/lib/cache';
import fs from 'node:fs';

async function runTests() {
  console.log('================================================================');
  console.log('🧪 TESTING AI CONTEXT UPGRADE, TAG FREQUENCY MEMORY & WEB LIMITS');
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

  // 1. Verify /ask Retention Window and Notes Limit in src/lib/ask.ts
  console.log('--- 1. Testing /ask 180-Day Retention & 300 Notes Limit ---');
  const askCode = fs.readFileSync('src/lib/ask.ts', 'utf8');
  assert(askCode.includes('subDays(now, 180)'), 'ask.ts uses subDays(now, 180) for 180-day retention');
  assert(!askCode.includes('subDays(now, 90)'), 'ask.ts does not use old 90-day retention');
  assert(askCode.includes('.limit(300)'), 'ask.ts limits query to 300 notes');
  assert(!askCode.includes('.limit(100)'), 'ask.ts does not use old 100 notes limit');
  assert(
    askCode.includes('Belum ada catatan yang tersimpan dalam 180 hari terakhir untuk dianalisis oleh AI.'),
    'ask.ts contains 180-day empty notification'
  );
  assert(
    askCode.includes('Catatan pengguna yang tersimpan (hingga 180 hari terakhir):'),
    'ask.ts prompt specifies 180-day note context'
  );

  // 2. Testing Existing Tags Memory Frequency Ranking (Top 60)
  console.log('\n--- 2. Testing Tag Frequency Ranking in getOrFetchUserTags ---');
  const testUserId = 'test_user_tag_rank_' + Date.now();
  await db.insert(users).values({
    id: testUserId,
    email: `${testUserId}@example.com`,
    name: 'Tag Rank User',
  });

  // Seed notes with varying tag frequencies:
  // "tech": 4 times
  // "ai": 3 times
  // "food": 2 times
  // "travel": 1 time
  await db.insert(notes).values([
    { id: crypto.randomUUID(), userId: testUserId, content: 'Note 1', specificTags: ['tech', 'ai'] },
    { id: crypto.randomUUID(), userId: testUserId, content: 'Note 2', specificTags: ['tech', 'ai', 'food'] },
    { id: crypto.randomUUID(), userId: testUserId, content: 'Note 3', specificTags: ['tech', 'ai'] },
    { id: crypto.randomUUID(), userId: testUserId, content: 'Note 4', specificTags: ['tech', 'food', 'travel'] },
  ]);

  invalidateUserTagsCache(testUserId);
  const fetchedTags = await getOrFetchUserTags(testUserId);
  console.log('Fetched tags ranked by frequency:', fetchedTags);

  assert(Array.isArray(fetchedTags), 'getOrFetchUserTags returns an array');
  assert(fetchedTags.length === 4, 'Returns all 4 unique tags');
  assert(fetchedTags[0] === 'tech', 'Rank 1 is "tech" (frequency 4)');
  assert(fetchedTags[1] === 'ai', 'Rank 2 is "ai" (frequency 3)');
  assert(fetchedTags[2] === 'food', 'Rank 3 is "food" (frequency 2)');
  assert(fetchedTags[3] === 'travel', 'Rank 4 is "travel" (frequency 1)');

  // 3. Testing Prompt Slices in Modules
  console.log('\n--- 3. Testing Top 60 Tags Slice in general.ts & batch-organizer.ts ---');
  const generalCode = fs.readFileSync('src/lib/ai/modules/general.ts', 'utf8');
  assert(generalCode.includes('existingUserTags.slice(0, 60)'), 'general.ts injects top 60 tags into prompt');
  assert(!generalCode.includes('existingUserTags.slice(0, 30)'), 'general.ts no longer limits tags to 30');

  const batchCode = fs.readFileSync('src/lib/ai/batch-organizer.ts', 'utf8');
  assert(batchCode.includes('existingUserTags.slice(0, 60)'), 'batch-organizer.ts injects top 60 tags into prompt');
  assert(!batchCode.includes('existingUserTags.slice(0, 30)'), 'batch-organizer.ts no longer limits tags to 30');

  const apiIndexCode = fs.readFileSync('src/pages/api/notes/index.ts', 'utf8');
  assert(
    apiIndexCode.includes('existingUserTags = await getOrFetchUserTags(user.id);'),
    'api/notes/index.ts uses cached frequency-ranked tags'
  );
  assert(
    apiIndexCode.includes('invalidateUserTagsCache(user.id);'),
    'api/notes/index.ts invalidates cache on note creation'
  );

  // 4. Testing Web Dashboard Safe Query Limits (100 Notes Limit)
  console.log('\n--- 4. Testing Web Dashboard Safe Query Limits ---');
  const dashboardPages = [
    'src/pages/dashboard/index.astro',
    'src/pages/dashboard/bookmarks.astro',
    'src/pages/dashboard/schedule.astro',
    'src/pages/dashboard/todo.astro',
    'src/pages/dashboard/finance.astro',
    'src/pages/dashboard/vault.astro',
  ];

  for (const pagePath of dashboardPages) {
    const pageCode = fs.readFileSync(pagePath, 'utf8');
    assert(
      pageCode.includes('const DEFAULT_PAGE_LIMIT = 100;'),
      `${pagePath} defines DEFAULT_PAGE_LIMIT = 100`
    );
    assert(
      pageCode.includes('.limit(DEFAULT_PAGE_LIMIT)'),
      `${pagePath} applies .limit(DEFAULT_PAGE_LIMIT)`
    );
    assert(
      pageCode.includes('desc(notes.isPinned)'),
      `${pagePath} orders pinned notes first`
    );
  }

  // Cleanup test user
  await db.delete(notes).where(eq(notes.userId, testUserId));
  await db.delete(users).where(eq(users.id, testUserId));

  console.log('\n================================================================');
  console.log(`SUMMARY: ${passed}/${total} TESTS PASSED`);
  console.log('================================================================');

  if (passed === total) {
    console.log('🎉 ALL AI CONTEXT UPGRADE TESTS PASSED WITH 100% SUCCESS!');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
