import { generateText } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { VALID_SOURCES, CATEGORIES, type Source } from '../../constants';
import { sanitizeTags, normalizeTag, BANNED_TAGS } from '../sanitizer';
import { type NoteTagResult } from '../types';
import type { NoteCategory } from '@/db/schema';

/**
 * Normalizes raw category string from LLM into one of the 9 strict NoteCategory enum values.
 * Enforces the 6 Primary Intent rules:
 * 1. BOOKMARK: Any note with HTTP/HTTPS link(s) (unless explicit checkbox task).
 * 2. CREDENTIAL: Passwords, ATM PINs, Bank Account Numbers, NIK KTP, Tokens/API Keys.
 * 3. SCHEDULE: Notes with explicit time/clock or calendar date markers.
 * 4. FINANCE: Financial transactions, spending, purchases, or debt/loans WITH nominal price/amount.
 * 5. TODO: Actions, tasks, commands, or communications without specific calendar/clock times.
 * 6. OTHERS / RANDOM-YAP: Non-action thoughts, opinions, raw ideas, health symptoms, and rants.
 */
export function normalizeCategory(rawCat: string | undefined, content: string): NoteCategory {
  const lower = content.toLowerCase().trim();

  // 1. Explicit Todo Checkbox Prefix or strong task override (e.g. "- [ ] review: https://..." or "harus ... buat ujian: https://...")
  if (
    lower.startsWith('- [ ]') ||
    lower.startsWith('[ ]') ||
    lower.startsWith('todo:') ||
    ((lower.startsWith('harus ') || lower.startsWith('jangan lupa ')) && /\b(ujian|exam|tugas|pr)\b/i.test(lower))
  ) {
    return 'todo';
  }

  // 2. URL -> Bookmark
  const hasUrl = /(https?:\/\/[^\s]+)/i.test(content);
  if (hasUrl) {
    return 'bookmark';
  }

  // 3. Sensitive Credentials (Password, ATM PIN, Bank Account Number, NIK, Token, API Key)
  const isCredential =
    /\b(password|pass|pin\s*atm|pin|no\s*rek|nomor\s*rekening|rekening|nik\s*ktp|nik|ktp|token|api_key|apikey|secret|sandi|ssid|wlan)\b/i.test(lower) ||
    lower.startsWith('pass:') ||
    lower.startsWith('pin:') ||
    lower.startsWith('token:') ||
    lower.startsWith('secret:') ||
    lower.startsWith('sandi:');

  if (isCredential) {
    return 'credential';
  }

  // 4. Schedule (Specific date, hour, clock, or appointment)
  const isSchedulePattern =
    /\b(jam|pukul)\s*\d+([.:]\d+)?(\s*(pagi|siang|sore|malam|wib|wita|wit|am|pm))?\b/i.test(lower) ||
    /\b\d+([.:]\d+)\s*(am|pm|wib|wita|wit)\b/i.test(lower) ||
    /\b(besok|lusa|kemarin)\s+(pagi|siang|sore|malam|jam|pukul)\b/i.test(lower) ||
    /\b(senin|selasa|rabu|kamis|jumat|sabtu|minggu)\s+\d{1,2}\s+(jan|feb|mar|apr|mei|jun|jul|agu|sep|okt|nov|des)\b/i.test(lower) ||
    (/\b(flight|terbang|berangkat)\s+(senin|selasa|rabu|kamis|jumat|sabtu|minggu|\d{1,2}\s+[a-z]+)\b/i.test(lower)) ||
    (/\b(meeting|rapat|sync|call)\b/i.test(lower) && /\b(jam|pukul|\d+[:.]\d+|\d+\s*sore|\d+\s*pagi|\d+\s*siang|\d+\s*malam)\b/i.test(lower));

  const hasCurrencySuffix = /\b\d+(\.\d+)?\s*(k|rb|jt|ribu|juta|perak)\b/i.test(lower);
  const hasCurrencyPrefix = /(\$|rp\.?|idr|usd|sgd|eur|gbp)\s*\d+/i.test(lower);

  if (isSchedulePattern && !hasCurrencySuffix && !hasCurrencyPrefix) {
    return 'schedule';
  }

  // 5. Finance: Actual financial transactions, purchases, spending, bills, income, or debt/loans WITH nominal price/amount
  const isHealthMetric = /\b\d+\s*(mg|ml|tablet|kapsul|gram)\b/i.test(lower);
  const isWorkoutMetric = /\b\d+\s*(kg|reps|set)\b/i.test(lower);
  const isPostalCode = /\b(kodepos|kode\s*pos|pos\s*code|zip\s*code)\s*\d+\b/i.test(lower);

  const hasDebtPattern =
    /\b(minjem|pinjam|ngutang|utang|piutang|talangin|talangan)\b/i.test(lower) &&
    (/\b\d+(\.\d+)?\s*(k|rb|jt|ribu|juta|perak)?\b/i.test(lower) || /(\$|rp\.?)\s*\d+/i.test(lower));

  const hasFinanceVerb = /\b(traktir|nraktir|bayar|beli|belanja|gaji|salary|pemasukan|transfer masuk|transfer|invoice|tagihan|londry|laundry|spent|spend|bought|paid|paycheck|dividend|harga|cost|fee)\b/i.test(lower);
  const hasItemWithNumber = /\b(cimin|seblak|ciken|chicken|ayam|bensin|kopi|coffee|pulsa|parkir|indihome|nongkrong|satpam|burger|uber|lyft|groceries|hosting)\s+(\$|rp)?\d+/i.test(lower);

  const isFinance =
    !isHealthMetric &&
    !isWorkoutMetric &&
    !isPostalCode &&
    (
      hasCurrencySuffix ||
      hasCurrencyPrefix ||
      hasDebtPattern ||
      hasItemWithNumber ||
      (hasFinanceVerb && /\b\d+\b/.test(lower))
    );

  if (isFinance) {
    return 'finance';
  }

  // 6. Non-Action Health, Workout, and Raw Idea Guards -> others (NOT todo!)
  const isHealthLog = /\b(migrain|pusing|demam|flu|batuk|pilek|maag|mual|paracetamol|panadol|bodrex|tolak\s*angin|obat|vitamin|apotek)\b/i.test(lower);
  const isWorkoutLog = /\b(squat|bench-press|deadlift|workout|gym|leg\s*day|pushup|pullup)\b/i.test(lower);
  const isRawIdea = /\b(ide\s+konten|ide\s+fitur|ide\s+aplikasi|ide\s+bisnis|ide\s+video|ide\s+tulisan|kepikiran)\b/i.test(lower) || lower.startsWith('ide: ') || lower.startsWith('ide :') || lower.startsWith('ide ');

  if ((isHealthLog || isWorkoutLog || isRawIdea) && !lower.startsWith('- [ ]') && !lower.startsWith('todo:') && !/\b(harus|wajib|jangan lupa)\b/i.test(lower)) {
    return 'others';
  }

  // 7. Todo Intent: Actions, tasks, commands, or communications without specific calendar/clock times
  const isCommunicationTask = /\b(chat|telepon|telpon|wa|whatsapp|tanya|hubungi|dm|email|follow up|call)\s+[a-z0-9_-]+/i.test(lower);
  const isActionTask =
    lower.startsWith('todo') ||
    lower.startsWith('task') ||
    /\b(harus|wajib|jangan lupa|ingat|kerjakan|tugas|pr|deadline|homework|chores|beli|cek|revisi|kirim|bereskan|pelajari|siapkan)\b/i.test(lower) ||
    (/\b(belajar|study|kuliah|review|prepare)\b/i.test(lower) && /\b(ujian|exam|uts|uas|kuis|quiz|tes|besok|minggu depan|midterm|finals)\b/i.test(lower));

  if (isCommunicationTask || isActionTask) {
    return 'todo';
  }

  // If rawCat from LLM was provided, map synonyms or use it
  if (rawCat) {
    const c = rawCat.toLowerCase().trim();
    if (c === 'bookmark' && !hasUrl) {
      return lower.includes('kodepos') ? 'reference' : 'others';
    }
    if (CATEGORIES.includes(c as NoteCategory)) {
      return c as NoteCategory;
    }
    if (['food', 'expense', 'expenses', 'spending', 'purchase', 'bill', 'income', 'money', 'payment', 'transaksi'].includes(c)) {
      return 'finance';
    }
    if (['task', 'todo', 'checklist', 'action', 'plan', 'wishlist', 'shopping', 'activity'].includes(c)) {
      return 'todo';
    }
    if (['calendar', 'meeting', 'event', 'appointment', 'deadline', 'jadwal'].includes(c)) {
      return 'schedule';
    }
    if (['link', 'url', 'web', 'site'].includes(c)) {
      return 'bookmark';
    }
    if (['password', 'pin', 'secret', 'auth', 'token', 'credential'].includes(c)) {
      return 'credential';
    }
    if (['draft', 'writing', 'article', 'document'].includes(c)) {
      return 'draft';
    }
    if (['recipe', 'quote', 'snippet', 'documentation'].includes(c)) {
      return 'reference';
    }
    if (['idea', 'rant', 'thought', 'yap', 'shower-thought'].includes(c)) {
      return 'others';
    }
  }

  return 'others';
}

/**
 * Ensures universal Dual-Layer Tagging: [Specific Entity] + [Broad Concept/Domain].
 * Strictly ensures: Dilarang menghasilkan tag kosong jika terdapat entitas nama orang, brand, tempat, gejala, atau subjek konkret!
 */
export function enrichDualLayerTags(tags: string[], category: NoteCategory, content: string, rawLlmCat?: string): string[] {
  const lower = content.toLowerCase();
  let baseTags = [...tags]
    .map(t => normalizeTag(t))
    .filter(t => t && !BANNED_TAGS.has(t));

  const domainUmbrellas: string[] = [];
  const domainEntities: string[] = [];

  // 1. Debt & Loans Domain (Utang vs Piutang)
  if (/\b(minjem|pinjam|ngutang|utang|piutang|talangin|talangan)\b/i.test(lower)) {
    const isOurDebt =
      /\b(aku|saya|gue|gua)\s+(minjem|pinjam|ngutang)\b/i.test(lower) ||
      /\b(minjem|pinjam|ngutang|utang)\s+(ke|sama|dari)\s+([a-z0-9_-]+)/i.test(lower);

    if (isOurDebt) {
      domainUmbrellas.push('utang');
      const targetMatch = lower.match(/\b(ke|sama|dari)\s+([a-z0-9_-]+)/i);
      if (targetMatch && targetMatch[2] && !['bank', 'atm', 'pinjol'].includes(targetMatch[2])) {
        domainEntities.push(targetMatch[2]);
      }
    } else {
      domainUmbrellas.push('piutang');
      const borrowerMatch = lower.match(/([a-z0-9_-]+)\s+(minjem|pinjam|ngutang)/i);
      const lentMatch = lower.match(/\b(pinjemin|talangin|kasih pinjam)\s+([a-z0-9_-]+)/i);
      if (borrowerMatch && borrowerMatch[1] && !['aku', 'saya', 'gue', 'gua'].includes(borrowerMatch[1])) {
        domainEntities.push(borrowerMatch[1]);
      } else if (lentMatch && lentMatch[2]) {
        domainEntities.push(lentMatch[2]);
      }
    }
  }

  // 2. Coffee & Beverage Domain
  if (/\b(kopi\s*kenangan|fore|janji\s*jiwa|starbucks|tomoro|kopi|coffee|ngopi)\b/i.test(lower)) {
    domainUmbrellas.push('kopi');
    if (/\bkopi\s*kenangan\b/i.test(lower)) domainEntities.push('kopi-kenangan');
    else if (/\bfore\b/i.test(lower)) domainEntities.push('fore');
    else if (/\bjanji\s*jiwa\b/i.test(lower)) domainEntities.push('janji-jiwa');
    else if (/\bstarbucks\b/i.test(lower)) domainEntities.push('starbucks');
    else if (/\btomoro\b/i.test(lower)) domainEntities.push('tomoro');
  } else if (/\b(tequila|matcha|beer|bir|boba|wine|jus|juice|teh|tea|latte|espresso|americano|cocktail|vodka|soju)\b/i.test(lower)) {
    domainUmbrellas.push('drink');
  }

  // 3. Food / Snack Domain
  const isFood =
    /\b(cimin|cireng|batagor|seblak|nasgor|nasi|ayam|ciken|chicken|bakso|mie|sate|martabak|siomay|pempek|soto|rawon|resto|cafe|kuliner|makanan|gorengan|burger|pizza|odol|sabun)\b/i.test(lower) ||
    (category === 'finance' && /\b(makan|jajan|lunch|dinner|snack)\b/i.test(lower));
  if (isFood && !domainUmbrellas.includes('kopi')) {
    domainUmbrellas.push('food');
  }

  // 4. Communication & Task Domain
  const commMatch = lower.match(/\b(chat|telepon|telpon|wa|whatsapp|hubungi|dm|email|call)\s+([a-z0-9_-]+)(.*)/i);
  if (commMatch) {
    const person = commMatch[2].trim();
    if (person && !['ke', 'sama', 'tentang', 'soal', 'ini', 'itu'].includes(person)) {
      domainEntities.push(person);
    }
    const topicMatch = commMatch[3].match(/\b(tanya|soal|tentang|minta|bahas|cek|mengenai)\s+([a-z0-9_-]+)/i);
    if (topicMatch && topicMatch[2]) {
      domainEntities.push(topicMatch[2]);
    }
  }

  // 5. Health & Wellness Domain (gejala, obat, workout)
  const isHealth =
    /\b(migrain|pusing|demam|flu|batuk|pilek|maag|mual|paracetamol|panadol|bodrex|obat|vitamin|apotek|dokter|klinik)\b/i.test(lower);
  if (isHealth) {
    domainUmbrellas.push('health');
    if (/\bmigrain\b/i.test(lower)) domainEntities.push('migrain');
    if (/\bpusing\b/i.test(lower)) domainEntities.push('pusing');
    if (/\bparacetamol\b/i.test(lower)) domainEntities.push('paracetamol');
    if (/\bpanadol\b/i.test(lower)) domainEntities.push('panadol');
    if (/\bbodrex\b/i.test(lower)) domainEntities.push('bodrex');
  }

  // Gym / Workout Domain
  if (/\b(squat|bench-press|deadlift|workout|gym|leg\s*day|pushup|pullup|cardio)\b/i.test(lower)) {
    domainUmbrellas.push('workout');
    domainUmbrellas.push('gym');
    if (/\bsquat\b/i.test(lower)) domainEntities.push('squat');
    if (/\bleg\s*day\b/i.test(lower)) domainEntities.push('leg-day');
  }

  // 6. Ideas & Creative Domain
  if (/\b(ide|idea|kepikiran|konsep)\b/i.test(lower)) {
    domainUmbrellas.push('idea');
    if (/\btiktok\b/i.test(lower)) domainEntities.push('tiktok');
    if (/\bapp\s*fatigue\b/i.test(lower)) domainEntities.push('app-fatigue');
    if (/\bvoice\s*note\b/i.test(lower)) domainEntities.push('voice-note');
    if (/\bfitur\b/i.test(lower)) domainEntities.push('fitur');
  }

  // 7. Credential Domain (Bank + Type)
  if (category === 'credential' || /\b(no\s*rek|nomor\s*rekening|rekening|pin\s*atm|pin|password|wifi)\b/i.test(lower)) {
    if (/\bbca\b/i.test(lower)) domainEntities.push('bca');
    if (/\b(rekening|no\s*rek|nomor\s*rekening)\b/i.test(lower)) domainEntities.push('rekening');
    if (/\batm\b/i.test(lower)) domainEntities.push('atm');
    if (/\bpin\b/i.test(lower)) domainEntities.push('pin');
    if (/\bwifi\b/i.test(lower)) domainEntities.push('wifi');
  }

  // 8. Schedule Domain
  if (category === 'schedule' || /\bmeeting\b/i.test(lower)) {
    if (/\bdesain\b/i.test(lower)) domainEntities.push('desain');
    if (/\bmeeting\b/i.test(lower)) domainEntities.push('meeting');
  }

  // Candidate dishes/snacks and transit
  const dishCandidates = [
    'cimin', 'seblak', 'cireng', 'batagor', 'rendang', 'nasgor', 'ayam', 'bakso', 'mie', 'sate',
    'bensin', 'pertalite', 'pertamax', 'parkir', 'tol', 'gojek', 'grab', 'ojol', 'indihome'
  ];
  for (const dish of dishCandidates) {
    if (lower.includes(dish) && !domainEntities.includes(dish)) {
      domainEntities.push(dish);
    }
  }

  // Combine entities and baseTags with strict domain priorities
  const combined: string[] = [];

  // Specialized Domain Priority 1: Debt & Loans (Utang vs Piutang)
  if (domainUmbrellas.includes('piutang') || domainUmbrellas.includes('utang')) {
    const direction = domainUmbrellas.includes('piutang') ? 'piutang' : 'utang';
    for (const ent of domainEntities) {
      if (!combined.includes(ent)) combined.push(ent);
    }
    if (!combined.includes(direction)) combined.push(direction);
    return combined.slice(0, 3);
  }

  // Specialized Domain Priority 2: Workout & Gym
  if (domainUmbrellas.includes('workout') || domainUmbrellas.includes('gym')) {
    if (!combined.includes('workout')) combined.push('workout');
    if (!combined.includes('gym')) combined.push('gym');
    for (const ent of domainEntities) {
      if (!combined.includes(ent)) combined.push(ent);
    }
    return combined.slice(0, 3);
  }

  // Specialized Domain Priority 3: Ideas & Concepts
  if (domainUmbrellas.includes('idea')) {
    if (!combined.includes('idea')) combined.push('idea');
    for (const ent of domainEntities) {
      if (!combined.includes(ent)) combined.push(ent);
    }
    for (const t of baseTags) {
      if (t !== 'ide' && t !== 'idea' && !combined.includes(t)) combined.push(t);
    }
    return combined.slice(0, 3);
  }

  // Specialized Domain Priority 4: Health & Wellness
  if (domainUmbrellas.includes('health')) {
    if (!combined.includes('health')) combined.push('health');
    for (const ent of domainEntities) {
      if (!combined.includes(ent)) combined.push(ent);
    }
    for (const t of baseTags) {
      if (t !== 'kesehatan' && t !== 'health' && !combined.includes(t)) combined.push(t);
    }
    return combined.slice(0, 3);
  }

  // General Domain Combination
  for (const ent of domainEntities) {
    if (!combined.includes(ent)) combined.push(ent);
  }

  for (const t of baseTags) {
    if (!domainUmbrellas.includes(t) && !combined.includes(t)) {
      combined.push(t);
    }
  }

  for (const umb of domainUmbrellas) {
    if (!combined.includes(umb)) {
      combined.push(umb);
    }
  }

  // Fallback if still empty
  if (combined.length === 0) {
    const cleanTokens = lower
      .replace(/(\$|rp)\s*\d+[a-z]*/gi, '')
      .replace(/\b\d+\s*(k|rb|jt|ribu|juta)?\b/gi, '')
      .replace(/\b(beli|bayar|tfr|transfer|kirim|buat|untuk|ke|di)\b/gi, '')
      .split(/[^a-z0-9-]+/)
      .map(t => normalizeTag(t))
      .filter(t => t.length >= 3 && !BANNED_TAGS.has(t));

    if (cleanTokens.length > 0) {
      combined.push(cleanTokens[0]);
    }
  }

  return combined.slice(0, 3);
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
      system: `You are an intelligent semantic classifier and tagging engine for UnlazyNotes.
Analyze the user's note and return a strict JSON object with:
1. "category": exactly 1 primary intent category.
2. "specific_tags": 1 to 3 domain-aware tags (lowercase-with-hyphens).
3. "source": detected platform source string or null.

PRIMARY INTENT CATEGORIES:
- bookmark: Any note containing HTTP/HTTPS link(s), whether pure URL or accompanied by commentary/caption.
- credential: Sensitive private credentials: Password, PIN ATM, Bank Account Number (no rek), NIK KTP, Token/API Key (whether formatted or free-text).
- finance: Actual financial transactions, purchases, spending, bills, income, or debt/loans WITH explicit nominal amount/price.
- schedule: Notes that WAJIB have a specific calendar date, time, or clock marker (e.g. "meeting jam 14.00", "besok jam 9 pagi ke dokter", "meeting desain jam 3 sore", "flight jumat 20 okt").
- todo: Action tasks, commands, chores, or communication requests (chat, call, wa, tanya, beli, cek, revisi) WITHOUT specific clock times.
- others: Non-action notes, feelings, opinions, raw ideas, health symptoms/logs, and rants without action and without nominal amounts.

TAGGING RULES (ENTITY + DOMAIN UMBRELLA):
Rule 1 (Standard English Umbrella Tags): Always use standard English for domain umbrella tags (e.g. use "food" NOT "makanan", "health" NOT "kesehatan", "idea" NOT "ide", "drink" NOT "minuman") to keep tag history unified.
Rule 2 (NO ACTION VERBS AS TAGS): NEVER extract action verbs as tags (e.g. NEVER tag 'chat', 'beli', 'tanya', 'minum', 'bayar', 'transfer', 'kirim', 'hubungi'). Only extract concrete nouns, subjects, topics, and person names!
Rule 3: NEVER leave specific entities empty! Always extract specific entities (names, brands, dishes, symptoms, topics) + domain umbrella:

Examples:
1. Food & Drinks (Finance):
   - "cimin 20k" -> ["cimin", "food"]
   - "kopi kenangan 22k" -> ["kopi-kenangan", "kopi"]
2. Debt & Loans (Finance): Strict direction of money:
   - "ubed minjem 100k" (our money borrowed by someone) -> ["ubed", "piutang"]
   - "aku minjem 50k ke fajar" (our debt/obligation to someone) -> ["fajar", "utang"]
3. Communication & Task (Todo): Person name + topic (NO VERBS like 'chat' or 'tanya'):
   - "chat rizky tanya proposal" -> ["rizky", "proposal"]
4. Schedule: Topic + event type:
   - "meeting desain jam 3 sore" -> ["desain", "meeting"]
5. Bookmarks: Platform name + caption topic:
   - "https://medium.com/p/123 bacaan devops bagus" -> ["medium", "devops"]
   - "https://youtu.be/xyz referensi animasi web" -> ["youtube", "animasi", "referensi"]
6. Credentials: Bank/entity + type:
   - "nomor rekening bca riku 1234567890" -> ["bca", "rekening"]
   - "pin atm 182930" -> ["atm", "pin"]
7. Health & Wellness (Others): Symptom, medicine, workout (umbrella: "health", NO verbs like 'minum'):
   - "migrain minum paracetamol" -> ["health", "migrain", "paracetamol"]
   - "leg day 4 set squat 60kg" -> ["workout", "gym", "squat"]
8. Ideas & Concepts (Others): Concept umbrella "idea" + platform + topic:
   - "ide konten tiktok soal app fatigue" -> ["idea", "tiktok", "app-fatigue"]
   - "ide fitur: voice note transcription" -> ["idea", "fitur", "voice-note"]

Formatting:
- Output JSON ONLY.
- lowercase-with-hyphens, max 20 chars per tag.
- Category must be one of: "bookmark" | "credential" | "finance" | "schedule" | "todo" | "others" | "draft" | "reference" | "random-yap".`,
      prompt: `Classify and extract tags as JSON {"category": "finance" | "todo" | "schedule" | "bookmark" | "credential" | "others", "specific_tags": [...], "source": null}:\n"""${content}"""`,
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
