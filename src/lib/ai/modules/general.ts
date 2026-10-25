import { recordAiUsage } from '@/lib/ai-usage';
import { generateText } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { format } from 'date-fns';
import { VALID_SOURCES, CATEGORIES, type Source } from '../../constants';
import { sanitizeTags, normalizeTag, BANNED_TAGS } from '../sanitizer';
import { type NoteTagResult } from '../types';
import type { NoteCategory, ScheduleMetadata, ExpenseEntry, IncomeEntry, DebtEntry, BookmarkType, CredentialType } from '@/db/schema';

export function normalizeBookmarkType(raw: any): BookmarkType {
  const val = String(raw || '').toLowerCase().trim();
  if (['tech_dev', 'tech', 'dev', 'programming', 'code', 'github', 'coding'].includes(val)) return 'tech_dev';
  if (['media_social', 'media', 'social', 'video', 'youtube', 'sosmed', 'music', 'audio'].includes(val)) return 'media_social';
  if (['work_docs', 'work', 'docs', 'doc', 'document', 'drive', 'figma', 'notion'].includes(val)) return 'work_docs';
  if (['places', 'place', 'location', 'maps', 'map', 'lokasi', 'wisata'].includes(val)) return 'places';
  if (['shopping', 'shop', 'ecommerce', 'marketplace', 'wishlist', 'product', 'tokopedia', 'shopee'].includes(val)) return 'shopping';
  return 'reading_other';
}

export function normalizeCredentialType(raw: any): CredentialType {
  const val = String(raw || '').toLowerCase().trim();
  if (['account', 'akun', 'login', 'user', 'password'].includes(val)) return 'account';
  if (['network', 'jaringan', 'wifi', 'router', 'iot'].includes(val)) return 'network';
  if (['identity_finance', 'identity', 'finance', 'identitas', 'finansial', 'bank', 'ktp', 'sim', 'rekening'].includes(val)) return 'identity_finance';
  if (['license', 'lisensi', 'token', 'key', 'api', 'voucher'].includes(val)) return 'license';
  return 'other';
}

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
/**
 * Normalizes raw category string from LLM into one of the 9 strict NoteCategory enum values.
 * Strictly uses Universal Modal Mapping with Pure-LLM Authority (Zero regex keyword overrides).
 */
export function normalizeCategory(rawCat: string | undefined, _content?: string): NoteCategory {
  if (!rawCat) return 'others';
  const c = rawCat.toLowerCase().trim();

  // 0. Direct canonical match
  if (CATEGORIES.includes(c as NoteCategory)) {
    return c as NoteCategory;
  }

  // 1. TODO: Kehendak aksi, tugas, perbaikan, rencana, persiapan, dan backlog lintas bidang apa pun
  if ([
    'todo', 'task', 'tasks', 'action', 'actions', 'checklist', 'backlog', 'chores', 'job',
    'shopping_list', 'shopping', 'feature', 'features', 'software-development', 'development',
    'dev', 'engineering', 'improvement', 'enhancement', 'idea', 'ideas', 'konsep', 'plan',
    'planning', 'prep', 'preparation', 'assignment', 'tugas', 'pekerjaan', 'rencana',
    'proyek', 'project', 'work', 'fix', 'bug', 'revisi', 'agenda_kerja'
  ].includes(c)) {
    return 'todo';
  }

  // 2. REFERENCE: Fakta objektif, data lookup, takaran, resep, pasal, dosis, spek teknis, rumus
  if ([
    'reference', 'recipe', 'resep', 'quote', 'quotes', 'snippet', 'documentation', 'scripture',
    'knowledge', 'data', 'fact', 'facts', 'formula', 'rumus', 'dosage', 'dosis', 'specification',
    'spec', 'spek', 'info', 'informasi', 'guideline', 'aturan', 'pasal', 'law', 'code',
    'cheatsheet', 'rekam-medis', 'medical-record', 'manual', 'panduan'
  ].includes(c)) {
    return 'reference';
  }

  // 3. DRAFT: Materi komunikasi luar, draf surat, artikel, proposal, pesan formal
  if ([
    'draft', 'writing', 'article', 'doc', 'docs', 'document', 'letter', 'surat', 'email',
    'proposal', 'somasi', 'rujukan', 'caption', 'konten', 'content', 'script', 'naskah',
    'notulensi', 'minutes', 'memo'
  ].includes(c)) {
    return 'draft';
  }

  // 4. SCHEDULE: Dimensi waktu, janji temu, acara kalender, rutinitas, tenggat
  if ([
    'schedule', 'event', 'events', 'appointment', 'calendar', 'meeting', 'jadwal', 'sidang',
    'shift', 'jaga', 'deadline', 'tenggat', 'rutinitas', 'routine'
  ].includes(c)) {
    return 'schedule';
  }

  // 5. FINANCE: Nilai ekonomi riil, pengeluaran, pemasukan, utang/piutang, anggaran
  if ([
    'finance', 'expense', 'expenses', 'spending', 'income', 'money', 'bill', 'bills',
    'payment', 'transaksi', 'loan', 'debt', 'keuangan', 'gaji', 'honor', 'upah', 'fee',
    'budget', 'kas', 'anggaran'
  ].includes(c)) {
    return 'finance';
  }

  // 6. RANDOM-YAP: Refleksi subjektif internal, sensasi fisik/gejala tubuh, mood, review bebas
  if ([
    'random-yap', 'thought', 'thoughts', 'curhat', 'rant', 'rants', 'yap', 'shower-thought',
    'uneg-uneg', 'opini', 'symptom', 'symptoms', 'feeling', 'mood', 'reflection', 'health-log',
    'gejala', 'keluhan', 'review', 'diary', 'catatan-hati'
  ].includes(c)) {
    return 'random-yap';
  }

  // 7. BOOKMARK: Pointer tautan eksternal / URL web
  if ([
    'bookmark', 'link', 'url', 'web', 'site', 'reading', 'tautan', 'website'
  ].includes(c)) {
    return 'bookmark';
  }

  // 8. CREDENTIAL: Sandi, PIN, Wi-Fi, kunci akses, nomor identitas resmi
  if ([
    'credential', 'credentials', 'password', 'passwords', 'secret', 'secrets', 'auth',
    'token', 'token-key', 'wifi', 'sandi', 'rekening', 'pin', 'kredensial'
  ].includes(c)) {
    return 'credential';
  }

  // 9. OTHERS: Noise acak, SMS OTP, teks rusak tanpa substansi
  if ([
    'others', 'other', 'noise', 'otp', 'corrupted', 'sampah', 'acak', 'unstructured'
  ].includes(c)) {
    return 'others';
  }

  // Fallback pengaman: Catatan riil dari profesi spesifik tidak boleh dibuang ke 'others'
  return 'todo';
}

/**
 * Lightweight tag normalizer for offline fallback compatibility.
 * In the AI flow, tags are generated directly by the LLM following prompt rules.
 */
export function enrichDualLayerTags(
  tags: string[],
  _category: NoteCategory,
  _content: string,
  _rawLlmCat?: string
): string[] {
  return [...tags]
    .map((t) => normalizeTag(t))
    .filter((t) => t && !BANNED_TAGS.has(t))
    .slice(0, 5);
}

/**
 * Specialized General AI Module.
 * Uses robust text generation with JSON extraction to prevent parser errors
 * caused by markdown code fences (```json ... ```) from models like DeepSeek.
 */
export async function processGeneralNote(
  content: string,
  existingUserTags?: string[],
  noteCreatedAt?: Date | string
): Promise<NoteTagResult> {
  const apiKey = process.env.AI_PROVIDER_API_KEY;
  const modelName = process.env.AI_MODEL_NAME || 'claude-haiku-5.5';

  if (!apiKey || apiKey === 'sk-xxxx' || apiKey.startsWith('mock-')) {
    throw new Error('[AI] AI Provider API key is not configured');
  }

  try {
    const openaiCompatible = createOpenAICompatible({
      name: 'cosmoshub',
      baseURL: process.env.AI_BASE_URL || 'https://api.cosmoshub.tech/v1',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const refDate = noteCreatedAt ? new Date(noteCreatedAt) : new Date();
    const formattedRefDate = format(refDate, 'yyyy-MM-dd (EEEE)');

    const userTagContext =
      existingUserTags && existingUserTags.length > 0
        ? `\nEXISTING USER TAGS (Reuse when relevant):\n${JSON.stringify(existingUserTags.slice(0, 40))}\n`
        : '';

    const result = await generateText({
      model: openaiCompatible(modelName),
      temperature: 0,
      system: `You are the core semantic intelligence engine for UnlazyNotes.
Anchor Date for relative times: ${formattedRefDate}.
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
- reference: Static factual data, sizes, recipes, tech configs, and tracking/policy numbers.
- random-yap: Internal world (emotions, physical/health logs, subjective reviews, reflections).
- others: Mixed, ambiguous, or multi-idea noise without a single clear focus.

DISAMBIGUATION HEURISTICS:
- URL is primary subject -> bookmark
- Monetary transaction/debt -> finance
- Action/task to execute -> todo
- Time/date execution -> schedule
- Shopping lists with estimated prices (not yet spent) -> todo
- Casual food/snack purchases (cimin, cilok, nasgor, martabak, kopi, etc.) -> finance expenses with [food] tag, NOT debt
- Money borrowed/lent with person names (minjem, pinjam, utang, talangin) -> finance debt with person name

TAGGING RULES:
- Exactly 2 to 4 tags: [1 specific entity/topic] + [1 high-level domain umbrella (tech, food, health, etc.)].
- Use lowercase-with-hyphens, max 20 chars per tag. Never repeat the category name.${userTagContext}`,
      prompt: `Note text:\n"""${content}"""`,
    });

    await recordAiUsage({
      feature: 'tagging',
      model: modelName,
      usage: result.usage,
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
      throw new Error(`[AI] Failed to parse JSON from LLM output: ${rawJson}`);
    }

    const rawCategory = parsed.category || parsed.type;
    const category = normalizeCategory(rawCategory, content);

    let rawTags: string[] = [];
    if (Array.isArray(parsed.specific_tags)) rawTags = parsed.specific_tags;
    else if (Array.isArray(parsed.tags)) rawTags = parsed.tags;
    else if (typeof parsed.item === 'string') rawTags = [parsed.item];

    const cleanTags = sanitizeTags(rawTags, category, content, 5, existingUserTags);

    let cleanSource: Source | null = null;
    if (parsed.source) {
      const s = String(parsed.source).toLowerCase().trim();
      cleanSource = s as Source;
    }

    let scheduleMetadata: ScheduleMetadata | undefined = undefined;
    let scheduleDates: string[] | undefined = undefined;
    if (category === 'schedule') {
      if (parsed.schedule && typeof parsed.schedule === 'object') {
        const rawDates = Array.isArray(parsed.schedule.dates)
          ? parsed.schedule.dates
          : Array.isArray(parsed.schedule_dates)
          ? parsed.schedule_dates
          : [];
        const validDates = rawDates.map(String).filter((d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d));
        if (validDates.length > 0 || parsed.schedule.isRecurring) {
          scheduleMetadata = {
            dates: validDates,
            isRecurring: Boolean(parsed.schedule.isRecurring),
            recurrenceRule: parsed.schedule.recurrenceRule,
          };
          scheduleDates = validDates;
        }
      } else if (Array.isArray(parsed.schedule_dates) && parsed.schedule_dates.length > 0) {
        const validDates = parsed.schedule_dates
          .map(String)
          .filter((d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d));
        scheduleMetadata = {
          dates: validDates,
          isRecurring: false,
        };
        scheduleDates = validDates;
      }
    }

    let expenses: ExpenseEntry[] | undefined = undefined;
    let income: IncomeEntry[] | undefined = undefined;
    let debt: DebtEntry[] | undefined = undefined;
    if (category === 'finance') {
      if (Array.isArray(parsed.expenses) && parsed.expenses.length > 0) {
        expenses = parsed.expenses
          .map((e: any) => ({
            item: String(e.item || 'Pengeluaran').trim(),
            amount: Number(e.amount) || 0,
            currency: e.currency || 'IDR',
          }))
          .filter((e: any) => e.amount > 0);
      }

      if (Array.isArray(parsed.income) && parsed.income.length > 0) {
        income = parsed.income
          .map((i: any) => ({
            source: String(i.source || 'Pemasukan').trim(),
            amount: Number(i.amount) || 0,
            currency: i.currency || 'IDR',
          }))
          .filter((i: any) => i.amount > 0);
      }

      if (Array.isArray(parsed.debt) && parsed.debt.length > 0) {
        debt = parsed.debt
          .map((d: any) => ({
            type: d.type === 'payable' ? 'payable' : 'receivable',
            person: String(d.person || 'Seseorang').trim(),
            amount: Number(d.amount) || 0,
            notes: d.notes ? String(d.notes) : undefined,
            isSettled: Boolean(d.isSettled || false),
          }))
          .filter((d: any) => d.amount > 0);
      }
    }

    let bookmarkType: BookmarkType | undefined = undefined;
    let credentialType: CredentialType | undefined = undefined;

    if (category === 'bookmark') {
      bookmarkType = normalizeBookmarkType(parsed.bookmark_type || parsed.bookmarkType);
    }
    if (category === 'credential') {
      credentialType = normalizeCredentialType(parsed.credential_type || parsed.credentialType);
    }

    return {
      category,
      specific_tags: cleanTags,
      source: cleanSource,
      schedule: scheduleMetadata,
      schedule_dates: scheduleDates,
      expenses,
      income,
      debt,
      bookmark_type: bookmarkType,
      credential_type: credentialType,
      bookmarkType,
      credentialType,
    };
  } catch (err) {
    console.error('[AI] Fatal error in processGeneralNote LLM:', err);
    throw err;
  }
}
