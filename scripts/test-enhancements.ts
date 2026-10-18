import { heuristicTagNote, sanitizeTags } from '../src/lib/ai';
import {
  clusterTags,
  getTopTags,
  formatTopTagsMarkdown,
  formatClustersSummaryMarkdown,
  findClusterByKeyOrAlias,
  matchTagToCluster,
  TAG_CLUSTERS,
} from '../src/lib/ai/taxonomy';

async function runTests() {
  console.log('==================================================');
  console.log('TESTING TAGGING PIPELINE & /TAGS ENHANCEMENTS');
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

  // --- ITEM 4: 9 Complete Domain Clusters & Reduced False-Others ---
  console.log('\n--- 4. Testing 9 Complete Domain Clusters Mapping ---');
  const testSampleTags = [
    // culinary
    'cimin', 'seblak', 'kopi', 'martabak', 'cilok', 'nasgor', 'tequila',
    // work
    'work', 'client', 'meeting', 'project', 'proposal', 'shirobit', 'demo', 'q4-roadmap', 'deploy', 'hotfix', 'bug', 'evaluasi-sprint', 'follow-up', 'admin',
    // finance
    'finance', 'bca', 'rekening', 'qris', 'cash', 'iuran', 'kas-rt', 'crypto-wallet', 'metamask', 'seed-phrase', 'utang', 'piutang', 'fee', 'tax',
    // tech
    'tech', 'server', 'vps', 'hetzner', 'ssh-key', 'wifi', 'ssid', 'database', 'drizzle-orm', 'cursor', 'subscription', 'dashboard', 'login', 'user-id',
    // shopping
    'shopping', 'shopee', 'uniqlo', 'biore', 'laundry', 'cod', 'jnt', 'delivery', 'paket',
    // mobility
    'travel', 'gojek', 'grab', 'motorcycle', 'tire-replacement', 'tubeless', 'sim', 'driver-license', 'ktp', 'parkir', 'bensin',
    // education
    'study', 'kuliah', 'itb', 'bimbingan', 'bab', 'skripsi', 'ujian', 'exam', 'tugas', 'materi',
    // lifestyle
    'entertainment', 'avatar', 'movie', 'bioskop', 'music', 'spotify', 'sound', 'lofi', 'instagram', 'tiktok', 'post', 'article', 'documentation', 'cats', 'sleep', 'keyboard', 'lube', 'switch',
    // thoughts
    'idea', 'quote', 'renungan', 'philosophy', 'nietzsche', 'astronomy',
    // others (only genuine unmapped unique entities)
    'pt-karya-maju',
  ];

  const clusters = clusterTags(testSampleTags);
  const clusterKeyMap = new Map(clusters.map(c => [c.cluster.key, c.tags]));

  assert(clusterKeyMap.has('culinary'), 'Culinary cluster is present');
  assert(clusterKeyMap.has('work'), 'Work cluster is present');
  assert(clusterKeyMap.has('finance'), 'Finance cluster is present');
  assert(clusterKeyMap.has('tech'), 'Tech cluster is present');
  assert(clusterKeyMap.has('shopping'), 'Shopping cluster is present');
  assert(clusterKeyMap.has('mobility'), 'Mobility cluster is present');
  assert(clusterKeyMap.has('education'), 'Education cluster is present');
  assert(clusterKeyMap.has('lifestyle'), 'Lifestyle cluster is present');
  assert(clusterKeyMap.has('thoughts'), 'Thoughts cluster is present');
  assert(clusterKeyMap.has('others'), 'Others cluster is present for pt-karya-maju');

  // Verify specific mappings requested by user
  assert(matchTagToCluster('crypto-wallet') === 'finance', 'crypto-wallet mapped to finance');
  assert(matchTagToCluster('seed-phrase') === 'finance', 'seed-phrase mapped to finance');
  assert(matchTagToCluster('kas-rt') === 'finance', 'kas-rt mapped to finance');
  assert(matchTagToCluster('tire-replacement') === 'mobility', 'tire-replacement mapped to mobility');
  assert(matchTagToCluster('driver-license') === 'mobility', 'driver-license mapped to mobility');
  assert(matchTagToCluster('evaluasi-sprint') === 'work', 'evaluasi-sprint mapped to work');
  assert(matchTagToCluster('q4-roadmap') === 'work', 'q4-roadmap mapped to work');
  assert(matchTagToCluster('drizzle-orm') === 'tech', 'drizzle-orm mapped to tech');
  assert(matchTagToCluster('ssh-key') === 'tech', 'ssh-key mapped to tech');
  assert(matchTagToCluster('skripsi') === 'education', 'skripsi mapped to education');
  assert(matchTagToCluster('spotify') === 'lifestyle', 'spotify mapped to lifestyle');
  assert(matchTagToCluster('nietzsche') === 'thoughts', 'nietzsche mapped to thoughts');

  // Verify 'others' count is strictly minimal (< 5 tags)
  const othersTags = clusterKeyMap.get('others') || [];
  assert(
    othersTags.length < 5,
    `Others cluster has < 5 tags (got ${othersTags.length}: ${JSON.stringify(othersTags)})`
  );
  assert(
    othersTags.includes('pt-karya-maju'),
    `Others cluster contains genuine company entity 'pt-karya-maju'`
  );

  // --- ITEM 5: Compact & Elegant Layout Formatting ---
  console.log('\n--- 5. Testing Compact Telegram Layout Formatting ---');
  const rawHistoryTags = [
    'kopi', 'kopi', 'kopi', 'kopi',
    'cimin', 'cimin', 'cimin',
    'bca', 'bca',
    'cursor', 'cursor',
    'seblak',
    'vps',
    'itb',
    'avatar',
    'renungan',
    'pt-karya-maju',
  ];

  const top9 = getTopTags(rawHistoryTags, 9);
  assert(top9.length === 9, `Top 9 tags count should be 9 (got ${top9.length})`);
  assert(top9[0].tag === 'kopi' && top9[0].count === 4, `Top #1 tag is kopi with 4 count`);
  assert(top9[1].tag === 'cimin' && top9[1].count === 3, `Top #2 tag is cimin with 3 count`);

  const topMarkdown = formatTopTagsMarkdown(top9, 'id');
  assert(topMarkdown.includes('• #kopi (4)'), `Top tags markdown includes • #kopi (4)`);
  assert(topMarkdown.includes('• #cimin (3)'), `Top tags markdown includes • #cimin (3)`);

  const clustersFromHistory = clusterTags(rawHistoryTags);
  const summaryMarkdown = formatClustersSummaryMarkdown(clustersFromHistory, 'id');
  assert(summaryMarkdown.includes('• 🍔 Kuliner (3 tag)'), `Summary includes • 🍔 Kuliner (3 tag) (got: \n${summaryMarkdown})`);
  assert(summaryMarkdown.includes('• 💳 Keuangan & Akun (1 tag)'), `Summary includes • 💳 Keuangan & Akun (1 tag)`);
  assert(summaryMarkdown.includes('Teknologi & Server (2 tag)'), `Summary includes Teknologi & Server (2 tag)`);

  // --- ITEM 6: Sub-Command Exploration Resolver ---
  console.log('\n--- 6. Testing Sub-Command Exploration Resolver ---');
  const financeCluster = findClusterByKeyOrAlias('finance');
  assert(financeCluster !== null && financeCluster.key === 'finance', `findClusterByKeyOrAlias('finance') finds finance cluster`);

  const kulinerCluster = findClusterByKeyOrAlias('kuliner');
  assert(kulinerCluster !== null && kulinerCluster.key === 'culinary', `findClusterByKeyOrAlias('kuliner') maps to culinary cluster`);

  const techCluster = findClusterByKeyOrAlias('teknologi');
  assert(techCluster !== null && techCluster.key === 'tech', `findClusterByKeyOrAlias('teknologi') maps to tech cluster`);

  const regularTag = findClusterByKeyOrAlias('cimin');
  assert(regularTag === null, `findClusterByKeyOrAlias('cimin') returns null (falls back to note filter)`);

  console.log(`\n==================================================`);
  console.log(`TOTAL: ${passed}/${total} assertions passed.`);
  console.log(`==================================================`);

  if (passed === total) {
    console.log('🎉 ALL REVISED /TAGS TESTS PASSED 100%!');
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
