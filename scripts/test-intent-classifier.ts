import * as dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

import { generateNoteTags, heuristicTagNote } from '../src/lib/ai';

interface TestCase {
  input: string;
  expectedCat: string;
  expectedTags: string[];
  forbiddenTags?: string[];
  description: string;
}

const TEST_MATRIX: TestCase[] = [
  // --- 8 Core User Specification Test Cases ---
  {
    input: 'cimin 20k',
    expectedCat: 'finance',
    expectedTags: ['cimin', 'food'],
    description: '1. Food / Snack with nominal price (umbrella: food)',
  },
  {
    input: 'ubed minjem 100k',
    expectedCat: 'finance',
    expectedTags: ['ubed', 'piutang'],
    description: '2. Money lent to someone (piutang)',
  },
  {
    input: 'chat rizky tanya proposal',
    expectedCat: 'todo',
    expectedTags: ['rizky', 'proposal'],
    forbiddenTags: ['chat', 'tanya'],
    description: '3. Communication task (person + topic, NO action verbs)',
  },
  {
    input: 'meeting desain jam 3 sore',
    expectedCat: 'schedule',
    expectedTags: ['desain', 'meeting'],
    description: '4. Schedule with specific hour marker (jam 3 sore)',
  },
  {
    input: 'https://medium.com/p/123 bacaan devops bagus',
    expectedCat: 'bookmark',
    expectedTags: ['medium', 'devops'],
    description: '5. URL with commentary caption (platform + topic)',
  },
  {
    input: 'nomor rekening bca riku 1234567890',
    expectedCat: 'credential',
    expectedTags: ['bca', 'rekening'],
    description: '6. Bank account credential (bca + rekening)',
  },
  {
    input: 'migrain minum paracetamol',
    expectedCat: 'others',
    expectedTags: ['health', 'migrain', 'paracetamol'],
    forbiddenTags: ['minum'],
    description: '7. Health symptom and medication log (umbrella: health, NO verb)',
  },
  {
    input: 'ide konten tiktok soal app fatigue',
    expectedCat: 'others',
    expectedTags: ['idea', 'tiktok', 'app-fatigue'],
    description: '8. Creative idea (umbrella: idea + platform + topic)',
  },

  // --- Extended Domain Edge Cases ---
  {
    input: 'kopi kenangan 22k',
    expectedCat: 'finance',
    expectedTags: ['kopi-kenangan', 'kopi'],
    description: 'Edge 1: Beverage brand with price',
  },
  {
    input: 'aku minjem 50k ke fajar',
    expectedCat: 'finance',
    expectedTags: ['fajar', 'utang'],
    description: 'Edge 2: Money borrowed by us (utang)',
  },
  {
    input: 'https://youtu.be/xyz referensi animasi web',
    expectedCat: 'bookmark',
    expectedTags: ['youtube', 'animasi', 'referensi'],
    description: 'Edge 3: Video URL with multi-topic caption',
  },
  {
    input: 'leg day 4 set squat 60kg',
    expectedCat: 'others',
    expectedTags: ['workout', 'gym', 'squat'],
    description: 'Edge 4: Workout session log (non-finance despite numbers)',
  },
  {
    input: 'ide fitur: voice note transcription',
    expectedCat: 'others',
    expectedTags: ['idea', 'fitur', 'voice-note'],
    description: 'Edge 5: Feature idea without empty tags (umbrella: idea)',
  },

  // --- Dynamic Taxonomy & Anti-Flood Test Cases (Prompt Enhancements) ---
  {
    input: 'pesen martabak manis gojek',
    expectedCat: 'todo',
    expectedTags: ['martabak', 'food', 'gojek'],
    forbiddenTags: ['pesen', 'pesan'],
    description: 'Taxonomy 1: Food order task (entity: martabak, umbrella: food, brand: gojek)',
  },
  {
    input: 'demo produk client selasa jam 10 pagi',
    expectedCat: 'schedule',
    expectedTags: ['demo', 'meeting', 'client'],
    forbiddenTags: ['product-demonstratio'],
    description: 'Taxonomy 2: Product demo schedule (entity: demo, umbrella: meeting, person: client)',
  },
  {
    input: 'subscription cursor 20 usd kena tax 20 dollar',
    expectedCat: 'finance',
    expectedTags: ['cursor', 'subscription', 'tech'],
    forbiddenTags: ['usd', 'dollar', 'tax', 'pajak'],
    description: 'Taxonomy 3: Tech subscription with currency/tax stripped (cursor + subscription + tech)',
  },
  {
    input: 'coffee break with client discuss Q4 roadmap jam 4 sore',
    expectedCat: 'schedule',
    expectedTags: ['q4-roadmap', 'meeting', 'client'],
    forbiddenTags: ['discuss'],
    description: 'Taxonomy 4: Meeting schedule with topic entity (q4-roadmap + meeting + client)',
  },
  {
    input: 'nasgor mawut 18rb es teh 4k',
    expectedCat: 'finance',
    expectedTags: ['nasgor', 'food', 'drink'],
    description: 'Taxonomy 5: Multi-dish finance transaction (nasgor + food + drink)',
  },
  {
    input: 'jajan cilok depan indomaret 5rb',
    expectedCat: 'finance',
    expectedTags: ['cilok', 'food'],
    description: 'Taxonomy 6: Street snack finance (cilok + food)',
  },
  {
    input: 'jajan tahu gejrot 10rebu',
    expectedCat: 'finance',
    expectedTags: ['tahu-gejrot', 'food'],
    description: 'Taxonomy 7: Local snack finance with Indonesian currency slang (tahu-gejrot + food)',
  },

  // --- 4 Critical Audit Edge Cases ---
  {
    input: 'login dashboard admin pake email admin@shirobit.com passwordnya RahasiaBanget#2026!',
    expectedCat: 'credential',
    expectedTags: ['admin', 'dashboard'],
    forbiddenTags: ['todo', 'task'],
    description: 'Audit 1: Credential priority over action verb login',
  },
  {
    input: 'Maka sesungguhnya bersama kesulitan ada kemudahan. (QS. Asy-Syarh: 5-6)',
    expectedCat: 'reference',
    expectedTags: ['surah-asy-syarh', 'quran'],
    forbiddenTags: ['todo', 'task'],
    description: 'Audit 2: Religious scripture quote -> reference (NEVER todo)',
  },
  {
    input: 'beli kemeja putih uniqlo \n stok sabun biore \n obat tetes mata rohto',
    expectedCat: 'todo',
    expectedTags: ['shopping', 'uniqlo'],
    forbiddenTags: ['food', 'makanan'],
    description: 'Audit 3: Multi-line shopping list -> todo (NO hallucinated food tag)',
  },
  {
    input: 'martabak telur 45k via qris bca',
    expectedCat: 'finance',
    expectedTags: ['martabak', 'food', 'qris'],
    description: 'Audit 4: Always retain primary food entity + qris context',
  },
  {
    input: 'cimin 12k',
    expectedCat: 'finance',
    expectedTags: ['cimin', 'food'],
    description: 'Audit 4b: Retain primary food entity cimin',
  },
  {
    input: 'jajan cilok 5rebu',
    expectedCat: 'finance',
    expectedTags: ['cilok', 'food'],
    description: 'Audit 4c: Retain primary food entity cilok',
  },

  // --- 4 Micro-Tuning Edge Cases ---
  {
    input: 'perpanjang sim a ke polres bawa fotokopi ktp dan surat dokter',
    expectedCat: 'todo',
    expectedTags: ['sim', 'ktp'],
    forbiddenTags: ['credential', 'perpanjang'],
    description: 'Tuning 1: Bureaucracy task with KTP/SIM without digits MUST be todo (NOT credential)',
  },
  {
    input: 'nik ktp riku 3201234567890123',
    expectedCat: 'credential',
    expectedTags: ['ktp'],
    description: 'Tuning 1b: ID document WITH numbers is credential',
  },
  {
    input: 'kadang mikir kenapa orang rela macet-macetan tiap hari demi kerja',
    expectedCat: 'random-yap',
    expectedTags: ['macet'],
    forbiddenTags: ['others', 'todo'],
    description: 'Tuning 2: Curhat / shower thought WAJIB random-yap (NOT others)',
  },
  {
    input: 'cari info biaya kuliah s2 itb tahun ini',
    expectedCat: 'todo',
    expectedTags: ['kuliah'],
    forbiddenTags: ['others', 'cari'],
    description: 'Tuning 3: Research task is TODO (NOT others)',
  },
  {
    input: 'bandingin harga macbook m3 vs m4 sebelum beli',
    expectedCat: 'todo',
    expectedTags: ['macbook'],
    forbiddenTags: ['others', 'bandingin', 'bandingkan', 'finance'],
    description: 'Tuning 4: Comparison task without specific amount is TODO (NOT finance/others)',
  },
];

async function runClassifierTests() {
  console.log('================================================================');
  console.log('🧪 TESTING SEMANTIC INTENT & DUAL-LAYER TAGGING CLASSIFIER');
  console.log('================================================================');

  let passedLive = 0;
  let passedHeuristic = 0;

  console.log('\n--- PHASE 1: Live AI Pipeline (generateNoteTags) ---');
  for (const tc of TEST_MATRIX) {
    const start = performance.now();
    const res = await generateNoteTags(tc.input);
    const dur = Math.round(performance.now() - start);

    const catPass = res.category === tc.expectedCat;
    const tagsPass = tc.expectedTags.every((t) => res.specific_tags.includes(t));
    const forbiddenPass = !tc.forbiddenTags || tc.forbiddenTags.every((ft) => !res.specific_tags.includes(ft));
    const countPass = res.specific_tags.length >= 1 && res.specific_tags.length <= 5;
    const hyphenPass = res.specific_tags.every((t) => !t.startsWith('-') && !t.endsWith('-'));
    const isPass = catPass && tagsPass && forbiddenPass && countPass && hyphenPass;

    if (isPass) passedLive++;

    const icon = isPass ? '✅ PASS' : '❌ FAIL';
    console.log(`${icon} [${dur}ms] "${tc.input}"`);
    console.log(`   -> Cat: ${res.category} (exp: ${tc.expectedCat}) | Tags: ${JSON.stringify(res.specific_tags)} (exp: ${JSON.stringify(tc.expectedTags)})`);

    if (!isPass) {
      if (!catPass) console.log(`      ⚠️ Category mismatch: got "${res.category}", expected "${tc.expectedCat}"`);
      if (!tagsPass) console.log(`      ⚠️ Tags mismatch: missing ${JSON.stringify(tc.expectedTags.filter((t) => !res.specific_tags.includes(t)))}`);
      if (!forbiddenPass) console.log(`      ⚠️ Forbidden verbs/currencies leaked: ${JSON.stringify(tc.forbiddenTags?.filter((ft) => res.specific_tags.includes(ft)))}`);
      if (!countPass) console.log(`      ⚠️ Tag count discipline violated: ${res.specific_tags.length} tags (expected max 5)`);
      if (!hyphenPass) console.log(`      ⚠️ Trailing/leading hyphens detected in tags: ${JSON.stringify(res.specific_tags.filter((t) => t.startsWith('-') || t.endsWith('-')))}`);
    }
  }

  console.log('\n--- PHASE 2: Deterministic Heuristic Fallback (heuristicTagNote) ---');
  for (const tc of TEST_MATRIX) {
    const res = heuristicTagNote(tc.input);

    const catPass = res.category === tc.expectedCat;
    const tagsPass = tc.expectedTags.every((t) => res.specific_tags.includes(t));
    const forbiddenPass = !tc.forbiddenTags || tc.forbiddenTags.every((ft) => !res.specific_tags.includes(ft));
    const countPass = res.specific_tags.length >= 1 && res.specific_tags.length <= 5;
    const hyphenPass = res.specific_tags.every((t) => !t.startsWith('-') && !t.endsWith('-'));
    const isPass = catPass && tagsPass && forbiddenPass && countPass && hyphenPass;

    if (isPass) passedHeuristic++;

    const icon = isPass ? '✅ PASS' : '❌ FAIL';
    console.log(`${icon} [Heuristic] "${tc.input}"`);
    console.log(`   -> Cat: ${res.category} | Tags: ${JSON.stringify(res.specific_tags)}`);

    if (!isPass) {
      if (!catPass) console.log(`      ⚠️ Category mismatch: got "${res.category}", expected "${tc.expectedCat}"`);
      if (!tagsPass) console.log(`      ⚠️ Tags mismatch: missing ${JSON.stringify(tc.expectedTags.filter((t) => !res.specific_tags.includes(t)))}`);
      if (!forbiddenPass) console.log(`      ⚠️ Forbidden verbs leaked into tags: ${JSON.stringify(tc.forbiddenTags?.filter((ft) => res.specific_tags.includes(ft)))}`);
    }
  }

  console.log('\n================================================================');
  console.log(`SUMMARY:`);
  console.log(`- Live AI Pipeline: ${passedLive}/${TEST_MATRIX.length} PASSED`);
  console.log(`- Heuristic Fallback: ${passedHeuristic}/${TEST_MATRIX.length} PASSED`);
  console.log('================================================================');

  if (passedLive === TEST_MATRIX.length && passedHeuristic === TEST_MATRIX.length) {
    console.log('🎉 ALL TEST CASES PASSED WITH 100% ACCURACY!');
    process.exit(0);
  } else {
    console.error('⚠️ Some test cases failed. Please review output above.');
    process.exit(1);
  }
}

runClassifierTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
