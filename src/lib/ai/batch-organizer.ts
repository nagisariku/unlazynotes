import { recordAiUsage } from '../ai-usage';
import { db } from '../../db';
import { notes, type NoteCategory, type BookmarkType, type CredentialType } from '../../db/schema';
import { eq, and, asc, or } from 'drizzle-orm';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateText } from 'ai';
import { sanitizeTags } from './sanitizer';
import { getOrFetchUserTags, invalidateUserTagsCache, resetUnorganizedCount } from '../cache';
import { extractEarliestScheduleDate } from '../date-extractor';
import { parseScheduleMetadata } from './modules/schedule';
import { normalizeBookmarkType, normalizeCredentialType } from './modules/general';
import { fetchLinkMetadata } from '../link-enricher';

export interface OrganizedNoteItem {
  id: string;
  content: string;
  category: NoteCategory;
  specificTags: string[];
  source?: string | null;
  isEncrypted?: boolean;
  vaultKey?: string | null;
  isPinned?: boolean;
  isProcessed?: boolean;
  targetDate?: string | Date | null;
  scheduleDates?: string[] | null;
  schedule?: any;
  expenses?: any;
  income?: any;
  debt?: any;
  attachments?: any;
  bookmarkType?: BookmarkType | null;
  credentialType?: CredentialType | null;
  createdAt?: string | Date;
}

export interface OrganizedBatchResult {
  total: number;
  categorized: Record<string, OrganizedNoteItem[]>;
  items: OrganizedNoteItem[];
}

export const VALID_CATEGORIES: NoteCategory[] = [
  'todo',
  'finance',
  'schedule',
  'draft',
  'reference',
  'bookmark',
  'random-yap',
  'credential',
  'others',
];

const CHUNK_SIZE = 12; // Safeguard chunking 10-12 catatan per panggilan API

/**
 * Ekstraksi substring JSON valid di antara kurung siku terluar
 */
export function extractJsonFromLlm(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  }
  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    return cleaned.slice(firstBracket, lastBracket + 1);
  }
  return cleaned;
}

/**
 * Standardisasi string nominal (e.g. "35k", "50rb", "3.5jt", "10rebu") ke integer number
 */
export function normalizeNominal(val: any): number {
  if (typeof val === 'number') return Math.round(val);
  if (!val) return 0;
  const str = String(val).toLowerCase().replace(/rp|\$|\s/g, '').replace(/,/g, '.');
  if (str.endsWith('jt') || str.endsWith('juta')) {
    const num = parseFloat(str.replace(/jt|juta/g, ''));
    return isNaN(num) ? 0 : Math.round(num * 1_000_000);
  }
  if (str.endsWith('k') || str.endsWith('rb') || str.endsWith('rebu') || str.endsWith('ribu')) {
    const num = parseFloat(str.replace(/k|rb|rebu|ribu/g, ''));
    return isNaN(num) ? 0 : Math.round(num * 1_000);
  }
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : Math.round(parsed);
}

/**
 * Petakan sinonim AI ke 9 kategori kanonik UnlazyNotes (Pure-LLM Authority).
 * Menggunakan Universal Modal Mapping lintas seluruh profesi/latar belakang pengguna.
 */
export function normalizeCategory(raw: string | undefined, _content?: string): NoteCategory {
  if (!raw) return 'others';
  const c = String(raw).toLowerCase().trim();

  // 0. Kecocokan langsung dengan 9 pilar kanonik
  if (VALID_CATEGORIES.includes(c as NoteCategory)) {
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

export async function organizeUserNotes(userId: string): Promise<OrganizedBatchResult> {
  // 1. Ambil seluruh catatan unorganized user terurut kronologis (isProcessed false atau category others)
  const unorganizedNotes = await db.query.notes.findMany({
    where: and(
      eq(notes.userId, userId),
      eq(notes.isArchived, false),
      or(eq(notes.isProcessed, false), eq(notes.category, 'others'))
    ),
    orderBy: [asc(notes.createdAt)],
  });

  if (!unorganizedNotes || unorganizedNotes.length === 0) {
    resetUnorganizedCount(userId);
    return {
      total: 0,
      categorized: {},
      items: [],
    };
  }

  const existingUserTags = await getOrFetchUserTags(userId);
  const apiKey = process.env.AI_PROVIDER_API_KEY;
  const modelName = process.env.AI_MODEL_NAME || 'claude-haiku-5.5';
  const baseURL = process.env.AI_BASE_URL || 'https://api.cosmoshub.tech/v1';

  // Strict Fail-Fast: API key wajib ada dan valid
  if (!apiKey || apiKey === 'sk-xxxx' || apiKey.startsWith('mock-')) {
    throw new Error('AI Provider API key is missing or invalid. Batch sync aborted.');
  }

  const openaiCompatible = createOpenAICompatible({
    name: 'cosmoshub',
    baseURL,
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  const userTagContext =
    existingUserTags && existingUserTags.length > 0
      ? `\nEXISTING USER TAGS (Reuse when relevant):\n${JSON.stringify(existingUserTags.slice(0, 40))}\n`
      : '';

  const systemPrompt = `You are the core semantic intelligence engine for UnlazyNotes.
Analyze the array of raw notes and return a strict JSON array:
[
  {
    "id": string,
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
]

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
- Use lowercase-with-hyphens, max 20 chars per tag. Never repeat the category name.${userTagContext}`;

  // FASE 1: Proses seluruh chunk di memori (Strict Fail-Fast)
  // Jika salah satu chunk gagal (AI error / parse error), proses langsung berhenti dan lempar exception
  const parsedUpdates: Array<{
    id: string;
    content: string;
    category: NoteCategory;
    specificTags: string[];
    source: string | null;
    targetDate: Date | null;
    expenses?: any[];
    income?: any[];
    debt?: any[];
    schedule?: any;
    scheduleDates?: string[];
    bookmarkType?: BookmarkType | null;
    credentialType?: CredentialType | null;
  }> = [];

  for (let i = 0; i < unorganizedNotes.length; i += CHUNK_SIZE) {
    const chunk = unorganizedNotes.slice(i, i + CHUNK_SIZE);

    const payload = await Promise.all(
      chunk.map(async (n) => {
        let contentText = n.content;
        const urlMatch = contentText.match(/(https?:\/\/[^\s]+)/i);
        if (urlMatch && urlMatch[1] && contentText.length < 150) {
          try {
            const meta = await fetchLinkMetadata(urlMatch[1]);
            if (meta?.title) {
              contentText = `${contentText}\nLink Content: Title: "${meta.title}", Summary: "${meta.description || ''}"`;
            }
          } catch {
            // Non-fatal
          }
        }
        const hasAttachments = n.attachments && Array.isArray(n.attachments) && n.attachments.length > 0;
        if (hasAttachments) {
          contentText = `[Catatan ini memiliki lampiran gambar/file]\n${contentText}`;
        }
        return {
          id: n.id,
          content: contentText,
          created_at: n.createdAt ? n.createdAt.toISOString() : new Date().toISOString(),
        };
      })
    );

        const prompt = `Classify this array of notes into a JSON array:\n${JSON.stringify(payload)}`;

    let responseText = '';
    try {
      const res = await generateText({
        model: openaiCompatible(modelName),
        temperature: 0,
        maxTokens: 3500,
        abortSignal: AbortSignal.timeout(25000),
        system: systemPrompt,
        prompt,
      });
      responseText = res.text;
      await recordAiUsage({
        userId,
        feature: 'batch_sync',
        model: modelName,
        usage: res.usage,
      });
    } catch (err: any) {
      console.error('[Batch AI Gateway Error]:', err);
      throw new Error(`AI Gateway failed to respond: ${err?.message || 'Network timeout'}`);
    }

    const cleanedJson = extractJsonFromLlm(responseText);
    let parsedList: any[] = [];
    try {
      parsedList = JSON.parse(cleanedJson);
      if (!Array.isArray(parsedList)) {
        throw new Error('LLM response is not a valid JSON Array');
      }
    } catch (parseErr: any) {
      console.error('[Batch AI JSON Parse Error]:', cleanedJson);
      throw new Error(`Failed to parse AI output as JSON: ${parseErr?.message || 'Invalid syntax'}`);
    }

    const parsedMap = new Map<string, any>();
    for (const item of parsedList) {
      if (item && item.id) parsedMap.set(item.id, item);
    }

    for (const note of chunk) {
      const aiItem = parsedMap.get(note.id) || {};
      const cat = normalizeCategory(aiItem.category || '', note.content);

      // Clean & sanitize tags
      const rawTags = Array.isArray(aiItem.specific_tags)
        ? aiItem.specific_tags
        : Array.isArray(aiItem.tags)
        ? aiItem.tags
        : [];
      const cleanTags = sanitizeTags(rawTags, cat, note.content, 4, existingUserTags);

      // Extract finance structures
      let cleanExpenses: any[] | undefined = undefined;
      let cleanIncome: any[] | undefined = undefined;
      let cleanDebt: any[] | undefined = undefined;

      if (cat === 'finance') {
        if (Array.isArray(aiItem.expenses) && aiItem.expenses.length > 0) {
          cleanExpenses = aiItem.expenses
            .filter((e: any) => e && (e.item || e.description))
            .map((e: any) => ({
              item: String(e.item || e.description || '').trim(),
              amount: normalizeNominal(e.amount),
              currency: String(e.currency || 'IDR').toUpperCase(),
            }))
            .filter((e: any) => e.amount > 0);
        }

        if (Array.isArray(aiItem.income) && aiItem.income.length > 0) {
          cleanIncome = aiItem.income
            .filter((inc: any) => inc && (inc.source || inc.description || inc.item))
            .map((inc: any) => ({
              source: String(inc.source || inc.description || inc.item || '').trim(),
              amount: normalizeNominal(inc.amount),
              currency: String(inc.currency || 'IDR').toUpperCase(),
            }))
            .filter((inc: any) => inc.amount > 0);
        }

        if (Array.isArray(aiItem.debt) && aiItem.debt.length > 0) {
          cleanDebt = aiItem.debt
            .filter((d: any) => d && (d.person || d.name || d.debtor || d.creditor || d.item))
            .map((d: any) => {
              const rawType = String(d.type || d.direction || '').toLowerCase();
              const type: 'payable' | 'receivable' =
                rawType.includes('pay') || rawType.includes('borrow') || rawType.includes('utang')
                  ? 'payable'
                  : 'receivable';
              return {
                type,
                person: String(d.person || d.name || d.debtor || d.creditor || d.item || '').trim(),
                amount: normalizeNominal(d.amount),
                notes: d.notes ? String(d.notes).trim() : undefined,
                isSettled: Boolean(d.isSettled || false),
              };
            })
            .filter((d: any) => d.amount > 0);
        }

        // Deduplicate debt from expenses to prevent double-counting
        if (cleanDebt && cleanDebt.length > 0 && cleanExpenses && cleanExpenses.length > 0) {
          cleanExpenses = cleanExpenses.filter(
            (e: any) =>
              !cleanDebt?.some(
                (d: any) =>
                  d.amount === e.amount ||
                  (d.person && e.item.toLowerCase().includes(d.person.toLowerCase()))
              )
          );
          if (cleanExpenses.length === 0) cleanExpenses = undefined;
        }

        // Ensure debt notes have person tag
        if (cleanDebt && cleanDebt.length > 0) {
          if (!cleanTags.includes('debt')) cleanTags.unshift('debt');
          for (const d of cleanDebt) {
            const personTag = d.person.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
            if (personTag && !cleanTags.includes(personTag)) {
              cleanTags.push(personTag);
            }
          }
        }
      }

      // Extract schedule structures
      let cleanSchedule = aiItem.schedule;
      let cleanScheduleDates: string[] | undefined = undefined;
      if (cat === 'schedule') {
        if (!cleanSchedule || !cleanSchedule.dates || cleanSchedule.dates.length === 0) {
          cleanSchedule = parseScheduleMetadata(note.content, note.createdAt || new Date());
        }
        if (cleanSchedule && Array.isArray(cleanSchedule.dates)) {
          cleanScheduleDates = cleanSchedule.dates;
        }
      }

      const targetDate =
        cat === 'schedule'
          ? (cleanScheduleDates && cleanScheduleDates.length > 0
              ? new Date(`${cleanScheduleDates[0]}T00:00:00Z`)
              : extractEarliestScheduleDate(note.content, note.createdAt || new Date()))
          : null;

      // Extract source
      let cleanSource = aiItem.source ? String(aiItem.source).trim() : null;
      if (cat === 'bookmark' && !cleanSource) {
        const urlMatch = note.content.match(/https?:\/\/([^\/\s]+)/i);
        if (urlMatch) {
          cleanSource = urlMatch[1].replace(/^www\./i, '');
        }
      }

      const bookmarkType = cat === 'bookmark' ? normalizeBookmarkType(aiItem.bookmark_type || aiItem.bookmarkType) : null;
      const credentialType = cat === 'credential' ? normalizeCredentialType(aiItem.credential_type || aiItem.credentialType) : null;

      parsedUpdates.push({
        id: note.id,
        content: note.content,
        category: cat,
        specificTags: cleanTags,
        source: cleanSource,
        targetDate,
        expenses: cleanExpenses,
        income: cleanIncome,
        debt: cleanDebt,
        schedule: cleanSchedule,
        scheduleDates: cleanScheduleDates,
        bookmarkType,
        credentialType,
      });
    }
  }

  // FASE 2: Mutasi Database (Hanya terjadi jika SEMUA chunk sukses 100%)
  const organizedItems: OrganizedNoteItem[] = [];

  for (const item of parsedUpdates) {
    const [updatedRow] = await db
      .update(notes)
      .set({
        isProcessed: true,
        category: item.category,
        specificTags: item.specificTags,
        source: item.source || undefined,
        targetDate: item.targetDate || undefined,
        expenses: item.expenses && item.expenses.length > 0 ? item.expenses : [],
        income: item.income && item.income.length > 0 ? item.income : [],
        debt: item.debt && item.debt.length > 0 ? item.debt : [],
        schedule: item.schedule || undefined,
        scheduleDates: item.scheduleDates && item.scheduleDates.length > 0 ? item.scheduleDates : undefined,
        bookmarkType: item.bookmarkType || undefined,
        credentialType: item.credentialType || undefined,
      })
      .where(eq(notes.id, item.id))
      .returning();

    if (updatedRow) {
      organizedItems.push(updatedRow as unknown as OrganizedNoteItem);
    }
  }

  // 5. Invalidasi cache tag user dan reset unorganized counter ke 0
  invalidateUserTagsCache(userId);
  resetUnorganizedCount(userId);

  // 6. Kelompokkan per kategori untuk ringkasan
  const categorized: Record<string, OrganizedNoteItem[]> = {};
  for (const item of organizedItems) {
    if (!categorized[item.category]) {
      categorized[item.category] = [];
    }
    categorized[item.category].push(item);
  }

  return {
    total: organizedItems.length,
    categorized,
    items: organizedItems,
  };
}

/**
 * Format ringkasan estetik Telegram (Single Recapitulation Message)
 */
export function formatOrganizedSummary(result: OrganizedBatchResult): string {
  if (result.total === 0) {
    return 'Semua catatan sudah rapi! Belum ada catatan baru untuk dirapikan.';
  }

  const categoryMeta: Record<string, { emoji: string; title: string }> = {
    todo: { emoji: '📁', title: 'Todo' },
    finance: { emoji: '💰', title: 'Finance' },
    schedule: { emoji: '📅', title: 'Schedule' },
    draft: { emoji: '📝', title: 'Draft' },
    bookmark: { emoji: '🔖', title: 'Bookmark' },
    credential: { emoji: '🔐', title: 'Credential' },
    reference: { emoji: '📚', title: 'Reference' },
    'random-yap': { emoji: '💭', title: 'Random Yap' },
    others: { emoji: '📦', title: 'Others' },
  };

  const lines: string[] = [];
  lines.push(`🪄 *${result.total} Catatan Berhasil Dirapikan!*\n`);

  for (const [catKey, meta] of Object.entries(categoryMeta)) {
    const items = result.categorized[catKey];
    if (!items || items.length === 0) continue;

    lines.push(`${meta.emoji} *${meta.title} (${items.length})*`);
    for (const item of items) {
      const cleanContent = item.content.replace(/[\r\n\t]+/g, ' ').replace(/`/g, "'").trim();
      const preview = cleanContent.length > 36 ? cleanContent.slice(0, 36) + '...' : cleanContent;

      const tagsStr =
        item.specificTags && item.specificTags.length > 0
          ? ' — ' + item.specificTags.map((t) => `\`#${t}\``).join(' ')
          : '';

      lines.push(`• \`${preview}\`${tagsStr}`);
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}
