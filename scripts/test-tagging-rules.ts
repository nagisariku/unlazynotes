import * as dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

import { generateNoteTags } from '../src/lib/ai';

const TEST_CASES = [
  // --- INDONESIAN TEST CASES ---
  {
    input: 'https://github.com/dietrichgebert/ponytail',
    description: '[ID] GitHub Repo 1 (Must NOT have ponytail or read-later)',
    expectedCat: 'bookmark',
    expectedTags: ['github'],
  },
  {
    input: 'https://github.com/morluto/rea',
    description: '[ID] GitHub Repo 2 (Must NOT have rea or read-later)',
    expectedCat: 'bookmark',
    expectedTags: ['github'],
  },
  {
    input: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    description: '[ID] YouTube Video (Must have youtube, NOT read-later)',
    expectedCat: 'bookmark',
    expectedTags: ['youtube'],
  },
  {
    input: 'https://www.payermax.com/',
    description: '[EN] PayerMax Website (Must have fintech, NOT twitter/read-later)',
    expectedCat: 'bookmark',
    expectedTags: ['fintech'],
  },
  {
    input: 'https://dev.to/someuser/guide',
    description: '[EN] Dev.to Link (Must have dev)',
    expectedCat: 'bookmark',
    expectedTags: ['dev'],
  },
  {
    input: 'https://figma.com/file/123/design',
    description: '[EN] Figma Link (Must have design)',
    expectedCat: 'bookmark',
    expectedTags: ['design'],
  },
  {
    input: 'https://x.com/jack/status/123456',
    description: '[EN] X / Twitter Link (Must have twitter)',
    expectedCat: 'bookmark',
    expectedTags: ['twitter'],
  },
  {
    input: 'kodepos rumah baru 15000',
    description: '[ID] Postal Code (Must NOT be finance)',
    expectedNotCat: 'finance',
    expectedTags: [],
  },
  {
    input: 'harus pelajari materi rekursif ini buat ujian: https://example.com/math',
    description: '[ID] Action Task with URL (Must be todo, NOT bookmark)',
    expectedCat: 'todo',
    expectedTags: ['study', 'exam'],
  },
  {
    input: 'kopi 12k bensin 20k',
    description: '[ID] Finance Spending (Must have expenses, NOT daily-spending/money)',
    expectedCat: 'finance',
    expectedTags: ['expenses', 'food'],
  },
  {
    input: 'traktir righty 100k',
    description: '[ID] Finance Treat (Must have expenses, NEVER debt/payment)',
    expectedCat: 'finance',
    expectedTags: ['expenses'],
  },
  {
    input: 'seblak 15k',
    description: '[ID] Finance Food (Must have expenses & food, NEVER 15k or food-price)',
    expectedCat: 'finance',
    expectedTags: ['expenses', 'food'],
  },
  {
    input: 'seblak prasmanan 20k',
    description: '[ID] Finance Food 2 (Must be finance, expenses, food, NEVER random-yap)',
    expectedCat: 'finance',
    expectedTags: ['expenses', 'food'],
  },
  {
    input: 'ciken 4 50k',
    description: '[ID] Finance Chicken (Must be finance, expenses, food, NEVER random-yap)',
    expectedCat: 'finance',
    expectedTags: ['expenses', 'food'],
  },
  {
    input: 'nongkrong 15k',
    description: '[ID] Finance Hangout (Must be finance, expenses, hangout)',
    expectedCat: 'finance',
    expectedTags: ['expenses', 'hangout'],
  },
  {
    input: 'satpam ubed 30k',
    description: '[ID] Finance Satpam (Must be finance, expenses, NEVER cash-expense)',
    expectedCat: 'finance',
    expectedTags: ['expenses'],
  },
  {
    input: 'indihome 60k',
    description: '[ID] Finance Bill (Must have indihome, NEVER 60k)',
    expectedCat: 'finance',
    expectedTags: ['indihome'],
  },
  {
    input: 'londry 30k mang ato 10k',
    description: '[ID] Finance Laundry (Must have expenses & laundry)',
    expectedCat: 'finance',
    expectedTags: ['expenses', 'laundry'],
  },
  {
    input: 'terima transfer gaji bulan ini 15jt dari kantor',
    description: '[ID] Finance Income (Must have income, NOT money)',
    expectedCat: 'finance',
    expectedTags: ['income'],
  },
  {
    input: 'password wifi kantor: KopiSenja2026!',
    description: '[ID] Credential Wifi (Must have wifi, NOT password)',
    expectedCat: 'credential',
    expectedTags: ['wifi'],
  },
  {
    input: 'belajar rekursif, ujian minggu depan',
    description: '[ID] Study / Exam (Must have study and/or exam, NOT rekursif/minggu-depan)',
    expectedCat: 'todo',
    expectedTags: ['study', 'exam'],
  },
  {
    input: 'meeting sprint planning tim backend besok jam 14.00',
    description: '[ID] Schedule Meeting (Must have meeting)',
    expectedCat: 'schedule',
    expectedTags: ['meeting'],
  },

  // --- ENGLISH / GLOBAL TEST CASES ---
  {
    input: 'coffee $5 uber $25',
    description: '[EN] Finance Coffee & Transit (Must have expenses & food)',
    expectedCat: 'finance',
    expectedTags: ['expenses', 'food'],
  },
  {
    input: 'dinner with client $85',
    description: '[EN] Finance Dinner (Must have expenses & food)',
    expectedCat: 'finance',
    expectedTags: ['expenses', 'food'],
  },
  {
    input: 'pay electric bill $120',
    description: '[EN] Finance Utility Bill (Must have bill)',
    expectedCat: 'finance',
    expectedTags: ['bill'],
  },
  {
    input: 'monthly salary received $4500',
    description: '[EN] Finance Income (Must have income)',
    expectedCat: 'finance',
    expectedTags: ['income'],
  },
  {
    input: 'midterm exam next week, review chapter 4',
    description: '[EN] Academic Exam (Must have exam)',
    expectedCat: 'todo',
    expectedCats: ['todo', 'schedule'],
    expectedTags: ['exam'],
  },
  {
    input: 'wifi password coffee shop: Latte2026!',
    description: '[EN] Credential Wifi (Must have wifi)',
    expectedCat: 'credential',
    expectedTags: ['wifi'],
  },

  // --- MULTI-LINK BOOKMARK CASES ---
  {
    input: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ https://youtu.be/abc12345678',
    description: '[MULTI] 2 YouTube links (Same platform: source youtube, tag youtube)',
    expectedCat: 'bookmark',
    expectedTags: ['youtube'],
    expectedSource: 'youtube',
  },
  {
    input: 'https://github.com/astral-sh/uv\nhttps://www.netflix.com/title/12345\nhttps://www.instagram.com/p/67890',
    description: '[MULTI] GitHub + Netflix + IG (Mixed platforms: source null, NO multi tag)',
    expectedCat: 'bookmark',
    expectedTags: ['github', 'netflix', 'instagram'],
    expectedSource: null,
  },
  {
    input: 'koleksi materi belajar dan tutorial koding:\nhttps://github.com/torvalds/linux\nhttps://www.youtube.com/watch?v=123',
    description: '[MULTI] Multi-link with contextual caption (Tags study, dev, github, youtube)',
    expectedCat: 'bookmark',
    expectedTags: ['github', 'youtube', 'study', 'dev'],
    expectedSource: null,
  },
];

async function runTests() {
  console.log('==================================================');
  console.log('TESTING BILINGUAL TAXONOMY ARCHITECTURE');
  console.log('==================================================');

  let passed = 0;
  for (const tc of TEST_CASES) {
    const res = await generateNoteTags(tc.input);
    const catMatch = tc.expectedNotCat
      ? res.category !== tc.expectedNotCat
      : (tc as any).expectedCats
      ? (tc as any).expectedCats.includes(res.category)
      : res.category === tc.expectedCat;
    const tagsMatch = tc.expectedTags.length === 0 || tc.expectedTags.every(t => res.specific_tags.includes(t));
    const singleWordPass = res.specific_tags.every(t => !t.includes('-') && !/\d/.test(t) && t !== 'multi');
    const sourceMatch = tc.expectedSource !== undefined ? res.source === tc.expectedSource : true;

    const status = catMatch && tagsMatch && singleWordPass && sourceMatch ? '✅ PASS' : '❌ FAIL';
    if (status === '✅ PASS') passed++;

    console.log(`${status} | "${tc.input}"`);
    console.log(`   -> Cat: ${res.category} | Tags: ${JSON.stringify(res.specific_tags)} | Source: ${res.source}`);
    if (status === '❌ FAIL') {
      console.log(`      Expected Cat: ${tc.expectedCat} | Expected Tags: ${JSON.stringify(tc.expectedTags)}`);
    }
  }

  console.log('==================================================');
  console.log(`Result: ${passed}/${TEST_CASES.length} tests passed.`);
  console.log('==================================================');
}

runTests().catch(console.error);
