import { recordAiUsage } from '../ai-usage';
import { db } from '../../db';
import { notes, type NoteCategory, type BookmarkType, type CredentialType } from '../../db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateText } from 'ai';
import { sanitizeTags } from './sanitizer';
import { getOrFetchUserTags, invalidateUserTagsCache, resetUnorganizedCount } from '../cache';
import { extractEarliestScheduleDate } from '../date-extractor';
import { heuristicExtractFinance } from './modules/finance';
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
 * Petakan sinonim AI ke 9 kategori kanonik UnlazyNotes
 */
/**
 * Petakan sinonim AI ke 9 kategori kanonik UnlazyNotes (Pure-LLM Authority)
 */
export function normalizeCategory(raw: string, _content?: string): NoteCategory {
  const c = String(raw || '').toLowerCase().trim();

  // Pemetaan sinonim LLM
  if (['todo', 'task', 'tasks', 'action', 'actions', 'checklist', 'backlog', 'chores', 'job', 'shopping_list', 'shopping'].includes(c)) {
    return 'todo';
  }
  if (['finance', 'expense', 'expenses', 'spending', 'income', 'money', 'bill', 'bills', 'payment', 'transaksi', 'loan', 'debt'].includes(c)) {
    return 'finance';
  }
  if (['schedule', 'event', 'events', 'appointment', 'calendar', 'meeting', 'jadwal'].includes(c)) {
    return 'schedule';
  }
  if (['random-yap', 'thought', 'thoughts', 'curhat', 'rant', 'rants', 'yap', 'shower-thought', 'uneg-uneg', 'opini', 'symptom', 'symptoms', 'feeling', 'mood', 'reflection', 'health-log'].includes(c)) {
    return 'random-yap';
  }
  if (['bookmark', 'link', 'url', 'web', 'site', 'reading'].includes(c)) {
    return 'bookmark';
  }
  if (['credential', 'credentials', 'password', 'passwords', 'secret', 'secrets', 'auth', 'token', 'token-key', 'wifi'].includes(c)) {
    return 'credential';
  }
  if (['draft', 'writing', 'article', 'doc', 'docs', 'spec', 'specification', 'document'].includes(c)) {
    return 'draft';
  }
  if (['reference', 'recipe', 'quote', 'quotes', 'snippet', 'documentation', 'scripture'].includes(c)) {
    return 'reference';
  }
  if (['others', 'other', 'idea', 'ideas', 'konsep', 'log', 'fitness', 'workout'].includes(c)) {
    return 'others';
  }

  if (VALID_CATEGORIES.includes(c as NoteCategory)) {
    return c as NoteCategory;
  }

  return 'others';
}

export async function organizeUserNotes(userId: string): Promise<OrganizedBatchResult> {
  // 1. Ambil seluruh catatan unorganized user terurut kronologis
  const unorganizedNotes = await db.query.notes.findMany({
    where: and(eq(notes.userId, userId), eq(notes.isProcessed, false)),
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
  const modelName = process.env.AI_MODEL_NAME || 'deepseek-v4.1-flash';
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
      ? `\nUSER EXISTING TAG MEMORY (Prioritize reusing these tags over inventing new synonyms):\n${JSON.stringify(
          existingUserTags.slice(0, 60)
        )}\n`
      : '';

  const systemPrompt = `You are an automated backend JSON database structuring API for UnlazyNotes.
Respond ONLY with a valid JSON Array. Do not include markdown code block syntax (no \`\`\`json), no introduction, and no commentary.
Your entire response must be parseable with JSON.parse().

The "category" field MUST be EXACTLY ONE of these 9 canonical values (do NOT invent new categories):
1. "bookmark": Any note with web link / URL (Shopee, YouTube, Medium, Maps, GitHub). Source is the platform name.
2. "schedule": Calendar events, dates, specific clock times ("jam 3 sore"), recurring routines ("badminton tiap selasa"). Return "schedule": {"dates": ["YYYY-MM-DD"], "isRecurring": boolean, "recurrenceRule"?: {...}}.
3. "finance": Money, purchases, spending, food/drinks with prices, income, debt/loans.
   - Convert all nominals to integers (e.g. 20k -> 20000, 100k -> 100000, 5rb -> 5000, 3.5jt -> 3500000).
   - "expenses": array of {"item": string, "amount": number, "currency": "IDR"} for everyday spending/purchases.
   - "income": array of {"source": string, "amount": number, "currency": "IDR"} for salary, fees, payments received.
   - "debt": array of {"type": "payable"|"receivable", "person": string, "amount": number, "notes"?: string}.
     * type "receivable": when we lend money / pay for someone ("Talangin makan siang Rendy 45rb", "ubed minjem 100k").
     * type "payable": when we borrow money / owe someone ("Pinjem uang Doni 200rb buat servis motor").
     * CRITICAL: Debts MUST go into "debt", NEVER into "expenses"!
4. "credential": Passwords, Wi-Fi credentials (SSID & password), bank account numbers ("nomor rekening bca..."), NIK/KK, API keys. NOTE: Tasks to renew credentials without secret values (e.g. "perpanjang sim bawa ktp") are "todo"!
5. "todo": Actionable tasks, errands, food orders ("pesen martabak manis gojek"), follow-up messages ("chat rizky tanya proposal"), groceries shopping list.
6. "draft": Outgoing message drafts ("Draf chat izin sakit..."), email drafts, captions.
7. "reference": Static lookups, recipes, code snippets, holy scriptures/verses (Quran, hadith, quotes). Scriptures & quotes are ALWAYS "reference" (NEVER "todo")!
8. "random-yap": Internal reflections, personal thoughts, shower thoughts, moods, body & health sensations/symptoms ("asam lambung agak perih...", "migrain minum obat", "pinggang pegal kebanyakan duduk...", "burnout banget hari ini..."), honest subjective reviews ("resto X rating 6/10") WITHOUT monetary transactions and WITHOUT actionable tasks.
9. "others": Workout repetition logs ("10k langkah keliling komplek", "leg day 4 set squat"), raw creative ideas ("ide konten...", "ide fitur..."), OTP codes, mixed forwards without single focus, ambiguous text fragments.

Macro Types for Bookmarks & Credentials:
- If category is "bookmark", output "bookmark_type" (must be one of: "tech_dev" | "media_social" | "work_docs" | "places" | "shopping" | "reading_other").
- If category is "credential", output "credential_type" (must be one of: "account" | "network" | "identity_finance" | "license" | "other").

Tags ("specific_tags"): Array of 2 to 4 domain-aware tags (lowercase-with-hyphens).
- specific_tags[0]: High-level domain umbrella (e.g. food, drink, tech, work, finance, debt, meeting, shopping, health, travel, quran, quote, idea).
- specific_tags[1..]: Specific entities, brand, person name.
- For debts: ALWAYS include "debt" and person name!
- NO action verbs as tags (NO chat, beli, bayar, kirim, tanya, minum, pesen).
- NO currency codes as tags (NO idr, rp, usd, dollar, tax, pajak).
${userTagContext}`;

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

    const prompt = `Return a JSON array classifying each of these notes:
${JSON.stringify(payload)}

Format examples:
[
  {
    "id": "1",
    "category": "finance",
    "specific_tags": ["food", "nasi-padang", "bensin", "kopi"],
    "source": null,
    "expenses": [
      {"item": "nasi padang", "amount": 35000, "currency": "IDR"},
      {"item": "bensin shell", "amount": 50000, "currency": "IDR"},
      {"item": "kopi", "amount": 20000, "currency": "IDR"}
    ],
    "income": [],
    "debt": []
  },
  {
    "id": "2",
    "category": "finance",
    "specific_tags": ["freelance", "landing-page", "pak-budi"],
    "source": null,
    "expenses": [],
    "income": [{"source": "fee pembuatan landing page dari pak budi", "amount": 3500000, "currency": "IDR"}],
    "debt": []
  },
  {
    "id": "3",
    "category": "finance",
    "specific_tags": ["debt", "rendy", "food"],
    "source": null,
    "expenses": [],
    "income": [],
    "debt": [{"type": "receivable", "person": "Rendy", "amount": 45000, "notes": "Talangin makan siang Rendy"}]
  },
  {
    "id": "4",
    "category": "finance",
    "specific_tags": ["debt", "doni", "motorcycle"],
    "source": null,
    "expenses": [],
    "income": [],
    "debt": [{"type": "payable", "person": "Doni", "amount": 200000, "notes": "Pinjem uang Doni buat servis motor darurat"}]
  }
]`;

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

        // Safety net: jika finance terdeteksi tapi AI tidak mengekstrak nominal, gunakan modul heuristik
        if ((!cleanExpenses || cleanExpenses.length === 0) &&
            (!cleanIncome || cleanIncome.length === 0) &&
            (!cleanDebt || cleanDebt.length === 0)) {
          const fin = heuristicExtractFinance(note.content);
          cleanExpenses = fin.expenses && fin.expenses.length > 0 ? fin.expenses : undefined;
          cleanIncome = fin.income && fin.income.length > 0 ? fin.income : undefined;
          cleanDebt = fin.debt && fin.debt.length > 0 ? fin.debt : undefined;
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
