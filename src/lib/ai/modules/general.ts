import { generateText } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { VALID_SOURCES, CATEGORIES, type Source } from '../../constants';
import { sanitizeTags, normalizeTag, BANNED_TAGS } from '../sanitizer';
import { type NoteTagResult } from '../types';
import type { NoteCategory } from '@/db/schema';

/**
 * Normalizes raw category string from LLM into one of the 9 strict NoteCategory enum values.
 */
export function normalizeCategory(rawCat: string | undefined, content: string): NoteCategory {
  const lower = content.toLowerCase().trim();
  const hasPrice = /\b\d+(\.\d+)?\s*(k|rb|jt|ribu|juta)?\b/i.test(lower) || /(\$|rp|idr)\s*\d+/i.test(lower);

  // If there is an explicit price/currency and it's not a password/credential, it's ALWAYS finance
  if (hasPrice && !lower.includes('pin:') && !lower.includes('password') && !lower.includes('pass ')) {
    return 'finance';
  }

  if (!rawCat) return 'others';
  const c = rawCat.toLowerCase().trim();

  // If directly in valid CATEGORIES
  if (CATEGORIES.includes(c as NoteCategory)) {
    return c as NoteCategory;
  }

  // Finance synonyms
  if (['food', 'expense', 'expenses', 'spending', 'purchase', 'bill', 'income', 'money', 'payment', 'transaksi'].includes(c)) {
    return 'finance';
  }

  // Todo / Activity synonyms
  if (['task', 'todo', 'checklist', 'action', 'plan', 'wishlist', 'shopping', 'travel', 'fashion', 'activity'].includes(c)) {
    return 'todo';
  }

  if (/\b(hiling|healing|dieng|trip|liburan|pantai|gunung|jalan-jalan|wisata)\b/i.test(lower)) {
    return 'todo';
  }

  // Schedule synonyms
  if (['calendar', 'meeting', 'event', 'appointment', 'deadline', 'jadwal'].includes(c)) {
    return 'schedule';
  }

  // Bookmark synonyms
  if (['link', 'url', 'web', 'site'].includes(c)) {
    return 'bookmark';
  }

  // Credential synonyms
  if (['password', 'pin', 'secret', 'auth', 'token', 'credential'].includes(c)) {
    return 'credential';
  }

  // Draft synonyms
  if (['draft', 'writing', 'article', 'document'].includes(c)) {
    return 'draft';
  }

  // Reference synonyms
  if (['recipe', 'quote', 'snippet', 'documentation'].includes(c)) {
    return 'reference';
  }

  // Random-yap synonyms
  if (['idea', 'rant', 'thought', 'yap', 'shower-thought'].includes(c)) {
    return 'random-yap';
  }

  return 'others';
}

/**
 * Ensures universal Dual-Layer Tagging: [Specific Entity] + [Broad Concept/Domain].
 */
export function enrichDualLayerTags(tags: string[], category: NoteCategory, content: string, rawLlmCat?: string): string[] {
  const lower = content.toLowerCase();
  let baseTags = [...tags]
    .map(t => normalizeTag(t))
    .filter(t => t && !BANNED_TAGS.has(t));

  const umbrellaDomains: string[] = [];

  // 1. Food Domain
  const isFood =
    rawLlmCat === 'food' ||
    /\b(rendang|cireng|batagor|seblak|nasgor|nasi|ayam|bakso|mie|sate|makan|snack|kopi|coffee|roti|martabak|siomay|pempek|soto|rawon|resto|cafe|kuliner|minum|makanan|minuman|jus|boba|gorengan)\b/i.test(lower);
  if (isFood) umbrellaDomains.push('food');

  // 2. Transport Domain
  const isTransport =
    /\b(bensin|pertalite|pertamax|bbm|solar|gojek|grab|maxim|ojol|tol|parkir|kereta|krl|mrt|busway|bus|angkot|tiket|ongkir|flight|pesawat)\b/i.test(lower);
  if (isTransport) umbrellaDomains.push('transport');

  // 3. Health Domain
  const isHealth =
    /\b(panadol|paracetamol|obat|bodrex|tolak\s*angin|vitamin|apotek|dokter|klinik|puskesmas|hospital|dentist|gigi|medis|salep|betadine)\b/i.test(lower);
  if (isHealth) umbrellaDomains.push('health');

  // 4. Internet Domain
  const isInternet =
    /\b(indihome|wifi|biznet|myrepublic|firstmedia|kuota|pulsa|telkomsel|xl|indosat|tri|smartfren|modem|router|hotspot)\b/i.test(lower);
  if (isInternet) umbrellaDomains.push('internet');

  // 5. Fashion Domain
  const isFashion =
    rawLlmCat === 'fashion' ||
    /\b(uniqlo|zara|h&m|erigo|kemeja|baju|celana|kaos|jaket|sepatu|sandal|tas|outfit|hoodie|rok|dress)\b/i.test(lower);
  if (isFashion) umbrellaDomains.push('fashion');

  // 6. Travel Domain
  const isTravel =
    /\b(dieng|bali|jogja|bandung|bromo|labuan\s*bajo|hiling|healing|liburan|trip|wisata|pantai|gunung|hotel|villa|resort|tour)\b/i.test(lower);
  if (isTravel) umbrellaDomains.push('travel');

  // 7. Gaming Domain
  const isGaming =
    /\b(steam|topup|diamond|mlbb|valorant|genshin|playstation|ps5|game|gaming|skin)\b/i.test(lower);
  if (isGaming) umbrellaDomains.push('gaming');

  // Extract specific entity candidates
  const entityCandidateWords = [
    'rendang', 'cireng', 'batagor', 'seblak', 'nasgor', 'ayam', 'bakso', 'mie', 'sate', 'kopi',
    'bensin', 'pertalite', 'pertamax', 'gojek', 'grab', 'ojol', 'parkir', 'tol',
    'panadol', 'paracetamol', 'bodrex', 'obat', 'vitamin',
    'indihome', 'biznet', 'myrepublic', 'firstmedia', 'wifi', 'kuota', 'pulsa',
    'uniqlo', 'zara', 'erigo', 'kemeja', 'sepatu', 'tas',
    'dieng', 'bali', 'jogja', 'bromo'
  ];

  const detectedEntities: string[] = [];
  for (const cand of entityCandidateWords) {
    if (lower.includes(cand)) {
      detectedEntities.push(cand);
    }
  }

  // Combine entities from LLM baseTags and detectedEntities
  const combinedEntities: string[] = [];
  for (const t of [...detectedEntities, ...baseTags]) {
    if (!umbrellaDomains.includes(t) && !combinedEntities.includes(t)) {
      // Don't include multi-word phrases if entity is already included (e.g. drop 'hiling-dieng' if 'dieng' is present)
      const isRedundant = combinedEntities.some(e => t.includes(e) && t !== e);
      if (!isRedundant) {
        combinedEntities.push(t);
      }
    }
  }

  // Build final dual-layer list: [Specific Entity, Umbrella Concept]
  const finalTags: string[] = [];

  // Add up to 2 entities
  for (const ent of combinedEntities) {
    if (finalTags.length >= 2) break;
    finalTags.push(ent);
  }

  // Add umbrella concept(s)
  for (const umb of umbrellaDomains) {
    if (finalTags.length >= 3) break;
    if (!finalTags.includes(umb)) {
      finalTags.push(umb);
    }
  }

  // Fallback if still empty
  if (finalTags.length === 0) {
    const cleanTokens = lower
      .replace(/(\$|rp)\s*\d+[a-z]*/gi, '')
      .replace(/\b\d+\s*(k|rb|jt|ribu|juta)?\b/gi, '')
      .replace(/\b(beli|bayar|tfr|transfer|kirim|buat|untuk|ke|di|hiling|healing|putih)\b/gi, '')
      .split(/[^a-z0-9-]+/)
      .map(t => normalizeTag(t))
      .filter(t => t.length >= 3 && !BANNED_TAGS.has(t));

    if (cleanTokens.length > 0) {
      finalTags.push(cleanTokens[0]);
    }
  }

  return finalTags;
}

/**
 * Specialized General AI Module.
 * Uses robust text generation with JSON extraction to prevent parser errors
 * caused by markdown code fences (```json ... ```) from models like DeepSeek.
 */
export async function processGeneralNote(
  content: string,
  heuristicFallback: (text: string) => NoteTagResult
): Promise<NoteTagResult> {
  const apiKey = process.env.AI_PROVIDER_API_KEY;
  const modelName = process.env.AI_MODEL_NAME || 'deepseek-v4.1-flash';

  if (!apiKey || apiKey === 'sk-xxxx' || apiKey.startsWith('mock-')) {
    return heuristicFallback(content);
  }

  try {
    const openaiCompatible = createOpenAICompatible({
      name: 'cosmoshub',
      baseURL: process.env.AI_BASE_URL || 'https://api.cosmoshub.tech/v1',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const result = await generateText({
      model: openaiCompatible(modelName),
      temperature: 0,
      system: `You are an intelligent tagging engine for UnlazyNotes.
Analyze the user's note and return a strict JSON object with:
1. "category": exactly 1 category.
2. "specific_tags": 1 to 3 meaningful keyword tags (lowercase-with-hyphens).

CATEGORIES & INTENT PRIORITY:
The "category" MUST be one of these 9 exact values:
- todo: Checklists, action items, tasks, wishlists, or plans WITHOUT prices/costs (e.g. "kemeja putih uniqlo" -> todo, "hiling dieng" -> todo).
- finance: ALL money transactions, purchases, food/item expenses, bills, income WITH price/amount or payment intent (e.g. "cireng 5k", "rendang 50k", "batagor 15k", "bensin 20k", "bayar wifi" -> finance).
- schedule: Specific dates, meetings, appointments, deadlines with temporal markers (e.g. "meeting bsk jam 2", "deadline tugas 18 okt").
- bookmark: URLs / links.
- credential: Passwords, tokens, pins, wifi keys.
- draft: Long structured text, minutes of meeting (>150 chars).
- reference: Snippets, recipes, quotes, documentation.
- random-yap: Spontaneous shower thoughts, rants, musings.
- others: Miscellaneous.

DO NOT output 'food', 'expense', 'expenses', 'task', 'money', or 'shopping' as "category"! Always use "finance" or "todo".

SPECIFIC TAG RULES (Extract 1 to 3 tags per note):
1. Always strive to combine [Specific Entity] + [Broad Concept/Domain] whenever applicable:
   - Specific Entity: brand, store, item, dish, person, place, or tool (e.g. 'rendang', 'batagor', 'cireng', 'uniqlo', 'indihome', 'panadol', 'dieng').
   - Broad Concept: the underlying semantic domain (e.g. 'food', 'fashion', 'internet', 'health', 'travel', 'transport', 'gaming').
   - Examples of ideal pairing:
     • "rendang 30k" -> ["rendang", "food"]
     • "batagor 15k" -> ["batagor", "food"]
     • "bensin 20k" -> ["bensin", "transport"]
     • "beli panadol 10k" -> ["panadol", "health"]
     • "bayar wifi indihome 300k" -> ["indihome", "internet"]
     • "kemeja putih uniqlo" -> ["uniqlo", "fashion"]
     • "hiling dieng" -> ["dieng", "travel"]
2. DO NOT output tags that merely repeat the category name (NEVER output 'todo', 'finance', 'expenses', 'task', 'money', 'schedule', 'note').
3. Keep tags lowercase, single-word or hyphenated, max 20 chars.

JSON FORMAT:
{"category": "finance", "specific_tags": ["rendang", "food"], "source": null}`,
      prompt: `Classify and extract 1-3 tags as JSON {"category": "finance" | "todo" | ..., "specific_tags": ["entity", "umbrella"], "source": null}:\n"""${content}"""`,
    });

    // Extract JSON block even if model wraps in markdown code fences (```json ... ```)
    let rawJson = result.text.trim();
    const match = rawJson.match(/\{[\s\S]*\}/);
    if (match) {
      rawJson = match[0];
    }

    let parsed: any = {};
    try {
      parsed = JSON.parse(rawJson);
    } catch {
      console.warn('[AI] Failed to parse JSON from LLM output, falling back to heuristic:', rawJson);
      return heuristicFallback(content);
    }

    const rawCategory = parsed.category || parsed.type;
    const category = normalizeCategory(rawCategory, content);

    let rawTags: string[] = [];
    if (Array.isArray(parsed.specific_tags)) rawTags = parsed.specific_tags;
    else if (Array.isArray(parsed.tags)) rawTags = parsed.tags;
    else if (typeof parsed.item === 'string') rawTags = [parsed.item];

    const enriched = enrichDualLayerTags(rawTags, category, content, rawCategory);
    const cleanTags = sanitizeTags(enriched, category, content, 3);

    let cleanSource: Source | null = null;
    if (parsed.source) {
      const s = String(parsed.source).toLowerCase().trim();
      if (VALID_SOURCES.includes(s as Source)) {
        cleanSource = s as Source;
      }
    }

    return {
      category,
      specific_tags: cleanTags,
      source: cleanSource,
    };
  } catch (err) {
    console.warn('[AI] Error in processGeneralNote LLM, using heuristic fallback:', err);
    return heuristicFallback(content);
  }
}
