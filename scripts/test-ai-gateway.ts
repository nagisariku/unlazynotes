/**
 * Benchmark script for Cosmoshub AI Gateway
 * Tests connectivity, latency, and structured JSON output for UnlazyNotes auto-tagging
 */

import * as dotenv from 'dotenv';
dotenv.config();

const BASE_URL = process.env.AI_BASE_URL || 'https://api.cosmoshub.tech/v1';
const API_KEY = process.env.AI_PROVIDER_API_KEY || '';

const MODELS = ['deepseek-v4.1-flash', 'gpt-6-luna'];

const TEST_CASES = [
  {
    name: 'Jadwal / Meeting',
    content: 'meeting dengan rina jam 2',
    expectedCategory: 'schedule',
  },
  {
    name: 'Bookmark URL',
    content: 'baca ini nanti https://youtube.com/watch?v=abc',
    expectedCategory: 'bookmark',
  },
  {
    name: 'Todo / Task',
    content: 'fix bug di form login website',
    expectedCategory: 'todo',
  },
  {
    name: 'Kredensial / Password',
    content: 'password wifi kantor: kopi-senja-123',
    expectedCategory: 'credential',
  },
  {
    name: 'Keuangan / Finance',
    content: 'bayar tagihan listrik 350rb via bca',
    expectedCategory: 'finance',
  },
];

const SYSTEM_PROMPT = `You are an automated categorization assistant for UnlazyNotes, a chat-first note taking app.
Your task is to analyze note text and categorize it into exactly ONE of the 9 mandatory categories, up to 2 specific tags, and a source (if URL is present).

Categories (Choose exactly 1):
- random-yap: Spontaneous ideas, opinions, random thoughts.
- draft: Long-form drafts, articles, meeting discussion summaries.
- bookmark: URLs, web references, read-later links.
- todo: Tasks, action items, to-do lists, follow-ups.
- schedule: Meetings, appointments, deadlines, dated agendas.
- finance: Payments, invoices, expenses, income, bills.
- credential: Passwords, accounts, login keys, Wi-Fi credentials.
- reference: Quotes, documentation, factual reference data.
- others: Miscellaneous notes not fitting above.

Specific Tags Rules:
- Maximum 2 tags.
- Lowercase only, use hyphens (-) instead of spaces (e.g. "meeting", "rina", "web-bug", "kopi-senja").
- Only include concrete, high-value filterable entities.

Source Rules:
- If note contains a URL, identify source platform (e.g. youtube, instagram, twitter, article).
- If no URL, source must be null.

Output Format:
Return ONLY valid JSON matching this schema, with no markdown code blocks:
{"category": "...", "specific_tags": ["..."], "source": "..." | null}`;

async function testPrompt(model: string, noteContent: string) {
  const start = performance.now();
  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Analyze and tag this note:\n"${noteContent}"` },
        ],
        temperature: 0.1,
      }),
    });

    const duration = performance.now() - start;

    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, duration, error: errText };
    }

    const data = await res.json();
    const rawContent = data.choices?.[0]?.message?.content || '';
    const cleaned = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
    let parsed: any = null;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // not strict json
    }

    return {
      ok: true,
      duration: Math.round(duration),
      serverLatency: data._wrapper?.latency_ms,
      parsed,
      raw: rawContent,
    };
  } catch (err: any) {
    return { ok: false, duration: Math.round(performance.now() - start), error: err.message };
  }
}

async function run() {
  console.log(`=== Benchmark Cosmoshub Models for UnlazyNotes ===\n`);

  for (const model of MODELS) {
    console.log(`\n--------------------------------------------------`);
    console.log(`Testing Model: ${model}`);
    console.log(`--------------------------------------------------`);

    let totalDuration = 0;
    let passedCount = 0;

    for (const testCase of TEST_CASES) {
      process.stdout.write(`• [${testCase.name}] "${testCase.content}" ... `);
      const res = await testPrompt(model, testCase.content);

      if (res.ok && res.parsed) {
        totalDuration += res.duration;
        const catMatch = res.parsed.category === testCase.expectedCategory;
        if (catMatch) passedCount++;
        console.log(`${res.duration}ms ${catMatch ? '✅' : '⚠️'}`);
        console.log(`  Output:`, JSON.stringify(res.parsed));
      } else if (res.ok) {
        console.log(`${res.duration}ms ❌ Invalid JSON`);
        console.log(`  Raw:`, res.raw);
      } else {
        console.log(`❌ Error:`, res.error);
      }
    }

    const avgDuration = Math.round(totalDuration / TEST_CASES.length);
    console.log(`\n📊 Hasil Evaluasi [${model}]:`);
    console.log(`- Akurasi Kategori: ${passedCount}/${TEST_CASES.length} (${(passedCount / TEST_CASES.length) * 100}%)`);
    console.log(`- Rata-rata Latensi: ${avgDuration}ms`);
  }
}

run();
