import { heuristicTagNote, generateNoteTags, sanitizeTags, SHORT_TAG_WHITELIST } from '../src/lib/ai';
import { clusterTags, formatTagClustersMarkdown } from '../src/lib/ai/taxonomy';

async function runTests() {
  console.log('==================================================');
  console.log('TESTING TAGGING PIPELINE & /TAGS ENHANCEMENTS');
  console.log('==================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, desc: string, details?: any) {
    total++;
    if (condition) {
      console.log(`✅ PASS | ${desc}`);
      passed++;
    } else {
      console.error(`❌ FAIL | ${desc}`);
      if (details) console.error('   Details:', details);
    }
  }

  // --- ITEM 1: Schedule non-meeting (Cinema/Movie) ---
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

  // --- ITEM 2: Max Specific Tags 5 (Multi-Entity Enrichment) ---
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

  // Test sanitizer directly
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

  // --- ITEM 4: /tags Dynamic Categorized Clusters ---
  console.log('\n--- 4. Testing Dynamic Categorized Clusters ---');
  const sampleTags = [
    'seblak',
    'cimin',
    'kopi',
    'q4-roadmap',
    'desain',
    'vps',
    'cursor',
    'bensin',
    'pt-karya-maju',
    'squat',
    'paracetamol',
    'ide-fitur',
  ];

  const clusters = clusterTags(sampleTags);
  const clusterKeys = clusters.map(c => c.cluster.key);

  assert(
    clusterKeys.includes('culinary'),
    `Culinary cluster present (clusters: ${JSON.stringify(clusterKeys)})`
  );
  assert(
    clusterKeys.includes('work'),
    `Work cluster present (clusters: ${JSON.stringify(clusterKeys)})`
  );
  assert(
    clusterKeys.includes('tech'),
    `Tech cluster present (clusters: ${JSON.stringify(clusterKeys)})`
  );
  assert(
    clusterKeys.includes('mobility'),
    `Mobility cluster present (clusters: ${JSON.stringify(clusterKeys)})`
  );
  assert(
    clusterKeys.includes('wellness'),
    `Wellness cluster present (clusters: ${JSON.stringify(clusterKeys)})`
  );
  assert(
    clusterKeys.includes('others'),
    `Others cluster present for pt-karya-maju (clusters: ${JSON.stringify(clusterKeys)})`
  );

  // Check alphabetical sorting inside culinary cluster
  const culinaryCluster = clusters.find(c => c.cluster.key === 'culinary');
  assert(
    culinaryCluster !== undefined &&
    culinaryCluster.tags.length === 3 &&
    culinaryCluster.tags[0] === 'cimin' &&
    culinaryCluster.tags[1] === 'kopi' &&
    culinaryCluster.tags[2] === 'seblak',
    `Culinary tags sorted alphabetically: ['cimin', 'kopi', 'seblak'] (got ${JSON.stringify(culinaryCluster?.tags)})`
  );

  // Check others cluster has pt-karya-maju
  const othersCluster = clusters.find(c => c.cluster.key === 'others');
  assert(
    othersCluster !== undefined && othersCluster.tags.includes('pt-karya-maju'),
    `Others cluster contains 'pt-karya-maju' (got ${JSON.stringify(othersCluster?.tags)})`
  );

  // Check markdown rendering format
  const md = formatTagClustersMarkdown(clusters, 'id');
  console.log('\nSample Clustered Markdown Output:\n---------------------------------');
  console.log(md);
  console.log('---------------------------------');

  assert(
    md.includes('🍽️ *Kuliner & Minuman:*') && md.includes('#cimin, #kopi, #seblak'),
    `Markdown output format matches specification`
  );

  console.log(`\n==================================================`);
  console.log(`TOTAL: ${passed}/${total} assertions passed.`);
  console.log(`==================================================`);

  if (passed === total) {
    console.log('🎉 ALL ENHANCEMENT TESTS PASSED 100%!');
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
