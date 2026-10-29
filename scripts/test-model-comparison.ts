import * as dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

import { generateText } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { normalizeCategory } from '../src/lib/ai/modules/general';

interface TestCase {
  id: string;
  name: string;
  pillar: string;
  note: string;
  expectedCategory: string;
  trickiness: string;
}

const TEST_CASES: TestCase[] = [
  // 1. BOOKMARK vs REFERENCE
  {
    id: 'BM-1',
    name: 'Tech Documentation Link with explanation',
    pillar: 'bookmark',
    note: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/418 - dokumentasi status code HTTP 418 I am a teapot',
    expectedCategory: 'bookmark',
    trickiness: 'Contains technical documentation facts, but primary subject is external URL',
  },
  {
    id: 'BM-2',
    name: 'Promo Link with bank & food keywords',
    pillar: 'bookmark',
    note: 'https://bca.co.id/promo-kuliner diskon 50% di marugame udon',
    expectedCategory: 'bookmark',
    trickiness: 'Mentions bank and discount percentage, but primary subject is external promo link',
  },

  // 2. FINANCE vs TODO vs DEBT
  {
    id: 'FN-1',
    name: 'Debt receivable with person name',
    pillar: 'finance',
    note: 'talangin tiket bioskop caca 65rb dulu, ntar dia transfer balik',
    expectedCategory: 'finance',
    trickiness: 'Mentions talangin & transfer balik (debt receivable), not pure expense',
  },
  {
    id: 'FN-2',
    name: 'Shopping list with prices (estimated, not spent)',
    pillar: 'todo',
    note: 'estimasi belanja bulanan: beras 75k, minyak 35k, telur 30k',
    expectedCategory: 'todo',
    trickiness: 'Has monetary values, but represents future planning shopping list, not money spent',
  },

  // 3. CREDENTIAL vs FINANCE
  {
    id: 'CR-1',
    name: 'Bank Account Number without transaction',
    pillar: 'credential',
    note: 'BCA 8271928371 a.n. Riku Shiro',
    expectedCategory: 'credential',
    trickiness: 'Mentions bank name (BCA) and digits, zero financial flow/spending occurred',
  },
  {
    id: 'CR-2',
    name: 'Prepaid Electricity Token',
    pillar: 'credential',
    note: 'Token listrik kontrakan: 4829-1029-4820-1928-4920',
    expectedCategory: 'credential',
    trickiness: 'Mentions utility bill topic, but is a static 20-digit access key/voucher',
  },

  // 4. SCHEDULE vs TODO
  {
    id: 'SC-1',
    name: 'Meeting with clock time anchor',
    pillar: 'schedule',
    note: 'besok jam 14.30 meeting evaluasi sprint bareng tim produk',
    expectedCategory: 'schedule',
    trickiness: 'Has specific day and clock time anchor (besok jam 14.30)',
  },
  {
    id: 'SC-2',
    name: 'Vague task without calendar anchor',
    pillar: 'todo',
    note: 'minggu ini harus selesai riset benchmark kompetitor kalau sempat',
    expectedCategory: 'todo',
    trickiness: 'Mentions "minggu ini", but has no specific clock or calendar date anchor',
  },

  // 5. DRAFT vs RANDOM-YAP / SCHEDULE
  {
    id: 'DR-1',
    name: 'Community announcement message',
    pillar: 'draft',
    note: 'Pesan broadcast warga: Yth. Bapak/Ibu warga RT 05, dimohon kehadirannya dalam kerja bakti hari Minggu pagi di balai RT. Terima kasih.',
    expectedCategory: 'draft',
    trickiness: 'Mentions Sunday morning & community work, but core intent is a drafted message for others',
  },

  // 6. REFERENCE vs TODO / RANDOM-YAP
  {
    id: 'RF-1',
    name: 'Technical hardware specification',
    pillar: 'reference',
    note: 'Ukuran baut bracket TV Samsung: M8 x 45mm pitch 1.25',
    expectedCategory: 'reference',
    trickiness: 'Hardware dimensions and technical static facts, no actionable directive',
  },
  {
    id: 'RF-2',
    name: 'Cooking Recipe with ingredients and measurements',
    pillar: 'reference',
    note: 'Resep sambal matah: bawang merah 10 siung, cabe rawit 15 buah, serai 2 batang, terasi 1/2 sdt, minyak kelapa panas 3 sdm',
    expectedCategory: 'reference',
    trickiness: 'Has ingredients list (looks like grocery shopping), but is a static culinary recipe',
  },

  // 7. RANDOM-YAP vs REFERENCE / TODO
  {
    id: 'RY-1',
    name: 'Raw SaaS Brainstorming Dump (User Test Case)',
    pillar: 'random-yap',
    note: `ide saas:
- telegram bot maker (for personal shop)
- telegram ai companion (like light vela)
- telegram journaling (unlazynotes)`,
    expectedCategory: 'random-yap',
    trickiness: 'Bulleted list of tech concepts, but represents raw subjective ideas without execution action',
  },
  {
    id: 'RY-2',
    name: 'Shower thought / philosophical musing',
    pillar: 'random-yap',
    note: 'kadang mikir kenapa ya orang lebih milih gengsi naik mobil walau macet 2 jam daripada naik KRL',
    expectedCategory: 'random-yap',
    trickiness: 'Social commentary / rhetorical thought, no action or facts',
  },

  // 8. OTHERS vs CREDENTIAL / FINANCE
  {
    id: 'OT-1',
    name: 'SMS OTP Security Alert (transitory noise)',
    pillar: 'others',
    note: '[BCA] JANGAN BERIKAN KODE OTP 581942 ke siapa pun termasuk petugas bank. Waspada penipuan!',
    expectedCategory: 'others',
    trickiness: 'Mentions bank and OTP digits, but is a temporary machine security SMS with no persistent note value',
  },
];

async function runModelComparison() {
  const apiKey = process.env.AI_PROVIDER_API_KEY!;
  const baseURL = process.env.AI_BASE_URL || 'https://api.cosmoshub.tech/v1';

  const openaiCompatible = createOpenAICompatible({
    name: 'cosmoshub',
    baseURL,
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  const models = ['gemini-3.8-flash', 'claude-haiku-5.5'];

  const systemPrompt = `You are the core semantic intelligence engine for UnlazyNotes.
Anchor Date for relative times (User Timezone: Asia/Jakarta, +07:00): 2026-10-29 (Kamis), 21:55.
All relative terms like "hari ini", "besok", "lusa", "minggu depan" MUST be resolved strictly relative to this anchor date in Asia/Jakarta.
Analyze the user's raw note and return a strict JSON object:
{
"category": "bookmark" | "schedule" | "finance" | "credential" | "todo" | "draft" | "reference" | "random-yap" | "others",
"specific_tags": string[], // 2 to 4 high-value lowercase-with-hyphens tags
"source": string | null, // platform domain (maps, github, youtube, drive, etc.) or null
"bookmarkType": "tech_dev" | "media_social" | "work_docs" | "places" | "shopping" | "reading_other" | null,
"credentialType": "account" | "network" | "identity_finance" | "license" | "other" | null,
"schedule": { "dates": string[], "isRecurring": boolean, "recurrenceRule"?: object } | null,
"expenses": Array<{ "item": string, "amount": number, "currency": string }> | null,
"income": Array<{ "source": string, "amount": number, "currency": string }> | null,
"debt": Array<{ "type": "payable" | "receivable", "person": string, "amount": number, "notes"?: string }> | null
}

9 PRIMARY INTENT CATEGORIES (Classify strictly by user's core intent):
- bookmark: Pointer/URL to external internet/apps (maps, docs, articles, media, wishlist).
- schedule: Time-anchored events (dates, relative days, deadlines, routines, travel tickets).
- finance: Economic value & money flow (actual expenses, income, debt/loans, split bills).
- credential: Authentication keys, logins, wifi, serial keys, and official identity/bank numbers (pure text).
- todo: Actionable tasks, follow-ups, shopping lists (groceries), and packing errands.
- draft: Content drafted for external audiences (messages, emails, captions, meeting minutes).
- reference: Static factual data, verified lookup truths, sizes, recipes, tech configs, documentation, specifications, quotes, and tracking/policy numbers.
- random-yap: Internal world (raw ideas, conceptual brainstorming, shower thoughts, personal musings, emotions, physical/health logs, subjective reviews, reflections).
- others: Unstructured noise, SMS OTP, or corrupted text without discernible substance.

DISAMBIGUATION HEURISTICS:
- URL is primary subject -> bookmark
- Monetary transaction/debt -> finance
- Action/task to execute -> todo
- Time/date execution -> schedule
- Shopping lists with estimated prices (not yet spent) -> todo
- Raw brainstorming, concept dumps, or idea lists without action directives -> random-yap (ideas are creative thoughts, NOT static reference facts and NOT active todos)
- Bank account numbers, logins, wifi credentials without transaction verb -> credential (even if mentioning bank names like BCA/Mandiri, it is a credential, NOT finance)
- Quotes, recipes, formulas, specifications, postal codes -> reference (static lookup facts, NOT random-yap)
- Messages drafted for external recipients (surat, pesan WhatsApp/email, captions) -> draft (communication to others, NOT internal random-yap)
- Vague tasks without clock/calendar time (e.g. "minggu ini kalau sempat", "kapan-kapan") -> todo, NOT schedule
- Casual food/snack purchases (cimin, cilok, nasgor, martabak, kopi, etc.) -> finance expenses with [food] tag, NOT debt
- Money borrowed/lent with person names (minjem, pinjam, utang, talangin) -> finance debt with person name

TAGGING RULES:
- Exactly 2 to 4 tags: [1-2 specific entities/topics in note's language] + [1 high-level domain umbrella in standard English (e.g., tech, food, health, transport, work, education, personal, travel, home, shopping, entertainment, social, legal, creative, science, or any real-world domain)].
- NEVER output generic meta-tags (e.g. "ideas", "brainstorming", "notes", "yap", "random", "misc").
- Use lowercase-with-hyphens, max 20 chars per tag. Never repeat the category name (e.g. never tag as "finance", "todo", "schedule", "bookmark").`;

  interface ComparisonRow {
    id: string;
    expected: string;
    geminiCat: string;
    geminiTags: string[];
    geminiMatch: boolean;
    claudeCat: string;
    claudeTags: string[];
    claudeMatch: boolean;
  }

  const results: ComparisonRow[] = [];

  console.log(`\n======================================================`);
  console.log(`BENCHMARKING 13 TRICKY CASES: GEMINI-3.8-FLASH vs CLAUDE-HAIKU-5.5`);
  console.log(`======================================================\n`);

  for (const tc of TEST_CASES) {
    console.log(`Testing [${tc.id}] ${tc.name}...`);

    let geminiRes = { category: 'error', tags: [] as string[] };
    let claudeRes = { category: 'error', tags: [] as string[] };

    // 1. Run Gemini
    try {
      const gOut = await generateText({
        model: openaiCompatible('gemini-3.8-flash'),
        temperature: 0,
        system: systemPrompt,
        prompt: `Note text:\n"""${tc.note}"""`,
      });
      const gMatch = gOut.text.match(/\{[\s\S]*\}/);
      if (gMatch) {
        const parsed = JSON.parse(gMatch[0]);
        geminiRes = {
          category: normalizeCategory(parsed.category || parsed.type, tc.note),
          tags: parsed.specific_tags || [],
        };
      }
    } catch (e: any) {
      console.error(`  [Gemini Error]:`, e.message);
    }

    // 2. Run Claude
    try {
      const cOut = await generateText({
        model: openaiCompatible('claude-haiku-5.5'),
        temperature: 0,
        system: systemPrompt,
        prompt: `Note text:\n"""${tc.note}"""`,
      });
      const cMatch = cOut.text.match(/\{[\s\S]*\}/);
      if (cMatch) {
        const parsed = JSON.parse(cMatch[0]);
        claudeRes = {
          category: normalizeCategory(parsed.category || parsed.type, tc.note),
          tags: parsed.specific_tags || [],
        };
      }
    } catch (e: any) {
      console.error(`  [Claude Error]:`, e.message);
    }

    const gMatch = geminiRes.category === tc.expectedCategory;
    const cMatch = claudeRes.category === tc.expectedCategory;

    console.log(`  Expected: ${tc.expectedCategory} | Gemini: ${geminiRes.category} (${gMatch ? '✅' : '❌'}) | Claude: ${claudeRes.category} (${cMatch ? '✅' : '❌'})`);
    console.log(`  Tags -> Gemini: [${geminiRes.tags.join(', ')}] | Claude: [${claudeRes.tags.join(', ')}]`);

    results.push({
      id: tc.id,
      expected: tc.expectedCategory,
      geminiCat: geminiRes.category,
      geminiTags: geminiRes.tags,
      geminiMatch: gMatch,
      claudeCat: claudeRes.category,
      claudeTags: claudeRes.tags,
      claudeMatch: cMatch,
    });
  }

  console.log(`\n======================================================`);
  console.log(`SUMMARY RESULTS:`);
  console.log(`======================================================`);
  const geminiScore = results.filter((r) => r.geminiMatch).length;
  const claudeScore = results.filter((r) => r.claudeMatch).length;
  console.log(`Gemini-3.8-Flash: ${geminiScore} / ${results.length} (${((geminiScore / results.length) * 100).toFixed(1)}%)`);
  console.log(`Claude-Haiku-5.5: ${claudeScore} / ${results.length} (${((claudeScore / results.length) * 100).toFixed(1)}%)`);
}

runModelComparison().catch(console.error);
