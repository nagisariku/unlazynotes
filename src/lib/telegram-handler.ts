import { db } from '@/db';
import { users, apiKeys, notes, tagSearches } from '@/db/schema';
import { eq, and, desc, sql, ilike } from 'drizzle-orm';
import crypto from 'node:crypto';
import { format } from 'date-fns';
import { encryptSecret, decryptSecret } from '@/lib/crypto';
import {
  hashApiKey,
  sendTelegramMessage,
  editTelegramMessage,
  editTelegramReplyMarkup,
  answerTelegramCallbackQuery,
} from '@/lib/telegram';
import { normalizeTag } from '@/lib/ai';
import { answerNoteQuestion } from '@/lib/ask';
import { buildFlexibleSearchCondition, buildSearchRelevanceOrder } from '@/lib/search';
import {
  checkUserQuotaAndTier,
  incrementUserMonthlyNotes,
  getTelegramQuotaExceededMessage,
  getTelegramProGatedMessage,
} from '@/lib/quota-service';
import { taggingQueue } from '@/lib/tagging-queue';
import { getTelegramMsg, detectTelegramLocale, type SupportedLocale } from '@/lib/i18n/telegram';

export const PAGE_SIZE = 9;
export const DEBOUNCE_DELAY_MS = 3000;

export interface TelegramProcessResult {
  ok: boolean;
  action?: string;
  error?: string;
  noteId?: string;
  status?: string;
  ignored?: string;
  httpStatus?: number;
  bufferedCount?: number;
  totalCount?: number;
  page?: number;
  cluster?: string;
  count?: number;
  tag?: string;
}

interface DebounceBufferItem {
  timer: NodeJS.Timeout;
  messages: string[];
  activeKey: typeof apiKeys.$inferSelect;
  chatId: string;
  noteId: string;
  createdAt: Date;
  tier: 'free' | 'pro';
  locale: SupportedLocale;
}

// In-memory buffer map indexed by chatId
const debounceMap = new Map<string, DebounceBufferItem>();

/**
 * Persists all accumulated messages for a chatId into a single note and triggers AI tagging.
 */
export async function flushDebounceBuffer(chatId: string): Promise<string | null> {
  const item = debounceMap.get(chatId);
  if (!item) return null;

  clearTimeout(item.timer);
  debounceMap.delete(chatId);

  const mergedText = item.messages.join('\n\n');
  const noteId = item.noteId;

  try {
    // 1. Simpan satu catatan utuh ke database
    await db.insert(notes).values({
      id: noteId,
      userId: item.activeKey.userId,
      content: mergedText,
      category: 'others',
      specificTags: [],
      source: 'telegram',
      createdAt: item.createdAt,
    });

    // 2. Update monthly notes usage (+1)
    const newCount = await incrementUserMonthlyNotes(item.activeKey.userId);

    // Peringatan Mendekati Limit (Note ke-25 s.d. ke-29 untuk Free Tier)
    if (item.tier === 'free' && newCount >= 25 && newCount < 30) {
      const remaining = 30 - newCount;
      await sendTelegramMessage(
        chatId,
        getTelegramMsg('quota_warning_footer', item.locale, { remaining }),
        { parse_mode: 'Markdown' }
      );
    }

    // 3. Smart Credential Warning Guardrail
    const hasCredentialKeyword =
      /\b(password|passwd|kata\s*sandi|pin(\s*atm)?|token|api[_-]?key|secret|kredensial|credential|cvv|otp)\b/i.test(
        mergedText
      );
    if (hasCredentialKeyword) {
      await sendTelegramMessage(
        chatId,
        getTelegramMsg('security_tip', item.locale),
        { parse_mode: 'Markdown' }
      );
    }

    // 4. Background AI Categorization & Tagging via Priority Queue (Fast-lane Pro)
    taggingQueue.enqueue({
      noteId,
      userId: item.activeKey.userId,
      content: mergedText,
      tier: item.tier,
    });

    return noteId;
  } catch (err) {
    console.error(`[Debounce Flush Error] Chat ${chatId} note ${noteId}:`, err);
    return null;
  }
}

/**
 * Flush all active buffers (useful on server shutdown).
 */
export async function flushAllDebounceBuffers(): Promise<void> {
  const chatIds = Array.from(debounceMap.keys());
  for (const cid of chatIds) {
    await flushDebounceBuffer(cid);
  }
}

export function getActiveDebounceCount(chatId: string): number {
  return debounceMap.get(chatId)?.messages.length || 0;
}

/**
 * Format notes snippet page for Telegram message grouped by day (Timeline Grouping).
 * - Timeline header: 📅 EEE dd/MM/yy • Tags: tag1, tag2, ...
 * - Clean pin list: 📌 Content (truncated up to 140 chars)
 */
export function formatSnippetPage(
  items: Array<{ content: string; createdAt: Date; category: string; specificTags?: string[] | null; isPinned?: boolean }>,
  totalCount: number,
  page: number,
  pageSize: number,
  headerTitle: string,
  locale: SupportedLocale = 'id'
): string {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const pageInfo = getTelegramMsg('snippet_page_info', locale, { page, totalPages, totalCount });
  let text = `${headerTitle} ${pageInfo}\n\n`;

  if (items.length === 0) {
    text += locale === 'en' ? '_No notes found in this category or tag._' : '_Belum ada catatan pada kategori atau tag ini._';
    return text.trim();
  }

  const defaultTitle = getTelegramMsg('default_note_title', locale);

  interface DateGroup {
    date: Date;
    snippets: string[];
  }

  const groupsMap = new Map<string, DateGroup>();

  let noteIndex = 1;
  for (const n of items) {
    const itemDate = new Date(n.createdAt);
    const dateKey = format(itemDate, 'yyyy-MM-dd');

    let group = groupsMap.get(dateKey);
    if (!group) {
      group = {
        date: itemDate,
        snippets: [],
      };
      groupsMap.set(dateKey, group);
    }

    const rawClean = n.content.replace(/\s+/g, ' ').trim();
    const clean = rawClean || defaultTitle;
    const snippet = clean.length > 140 ? `${clean.slice(0, 140)}...` : clean;
    const pinIcon = n.isPinned ? '📌⭐️' : '📌';
    group.snippets.push(`(${noteIndex}) ${pinIcon} ${snippet}`);
    noteIndex++;
  }

  const groupBlocks: string[] = [];
  for (const [, group] of groupsMap) {
    const dateStr = format(group.date, 'EEE, dd/MM/yyyy');
    const headerLine = `📅 ${dateStr}`;
    const itemsLines = group.snippets.join('\n');
    groupBlocks.push(`${headerLine}\n${itemsLines}`);
  }

  text += groupBlocks.join('\n\n');
  return text.trim();
}

/**
 * Builds Telegram Inline Keyboard for 9 main categories (Grid 3x3).
 */
export function buildCategoriesGridKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '💰 Finance', callback_data: 'page:tags:finance:1' },
        { text: '📋 Todo', callback_data: 'page:tags:todo:1' },
        { text: '📅 Schedule', callback_data: 'page:tags:schedule:1' },
      ],
      [
        { text: '🔖 Bookmark', callback_data: 'page:tags:bookmark:1' },
        { text: '🔐 Credential', callback_data: 'page:tags:credential:1' },
        { text: '📚 Reference', callback_data: 'page:tags:reference:1' },
      ],
      [
        { text: '📝 Draft', callback_data: 'page:tags:draft:1' },
        { text: '💬 Random-yap', callback_data: 'page:tags:random-yap:1' },
        { text: '🏷 Others', callback_data: 'page:tags:others:1' },
      ],
    ],
  };
}

/**
 * In-memory session state for /tags numbered shortcuts.
 * Key: chatId, Value: mapping of number -> tag and expiry timestamp.
 */
export const tagSessionMap = new Map<string, { tags: Map<number, string>; expiresAt: number }>();
export const TAG_SESSION_TTL_MS = 5 * 60 * 1000; // 5 menit

/**
 * Format tag list horizontally separated by commas (#tag1, #tag2, ...).
 * If empty, returns '-'.
 */
export function formatTagListHorizontal(tags: string[]): string {
  if (tags.length === 0) return '-';
  const escapeMd = (str: string) => str.replace(/([_*`\[\]])/g, '\\$1');
  return tags.map((t) => (t.startsWith('#') ? escapeMd(t) : `#${escapeMd(t)}`)).join(', ');
}

/**
 * Escape HTML special characters for Telegram HTML mode.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Format numbered tag list horizontally separated by spaces in capsule brackets:
 * (1)food (2)meeting (3)renungan ...
 * If empty, returns '-'.
 */
export function formatTagNumberedHorizontal(items: string[]): string {
  if (items.length === 0) return '-';
  return items.join('  ');
}

/**
 * Upsert increment search counter for a tag in tag_searches table.
 */
export async function recordTagSearch(userId: string, tag: string): Promise<void> {
  const normTag = tag.trim().toLowerCase();
  if (!normTag) return;

  try {
    const [existing] = await db
      .select({ id: tagSearches.id, count: tagSearches.count })
      .from(tagSearches)
      .where(and(eq(tagSearches.userId, userId), eq(tagSearches.tag, normTag)))
      .limit(1);

    if (existing) {
      await db
        .update(tagSearches)
        .set({
          count: sql`${tagSearches.count} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(tagSearches.id, existing.id));
    } else {
      try {
        await db.insert(tagSearches).values({
          id: crypto.randomUUID(),
          userId,
          tag: normTag,
          count: 1,
          updatedAt: new Date(),
        });
      } catch {
        await db
          .update(tagSearches)
          .set({
            count: sql`${tagSearches.count} + 1`,
            updatedAt: new Date(),
          })
          .where(and(eq(tagSearches.userId, userId), eq(tagSearches.tag, normTag)));
      }
    }
  } catch (err) {
    console.error('[recordTagSearch] Failed to track tag search:', err);
  }
}

/**
 * Fetches data for the 3 horizontal lines of /tags:
 * 1. Top 15 Active Tags (highest frequency across all user active notes)
 * 2. Top 15 Recent Tags (1st tag per newest note, deduplicated against Active and prior Recent)
 * 3. Top 15 Most Searched Tags (from tag_searches, deduplicated against Active and Recent)
 * Numbers are globally consecutive without collision across groups.
 */
export async function getTagsOverviewData(userId: string) {
  const userNotes = await db
    .select({
      specificTags: notes.specificTags,
      category: notes.category,
      createdAt: notes.createdAt,
    })
    .from(notes)
    .where(
      and(
        eq(notes.userId, userId),
        eq(notes.isEncrypted, false)
      )
    )
    .orderBy(desc(notes.createdAt));

  const tagFreq = new Map<string, number>();

  for (const n of userNotes) {
    if (Array.isArray(n.specificTags) && n.specificTags.length > 0) {
      for (const rawTag of n.specificTags) {
        if (rawTag && typeof rawTag === 'string' && rawTag.trim()) {
          const t = rawTag.trim().toLowerCase();
          tagFreq.set(t, (tagFreq.get(t) || 0) + 1);
        }
      }
    } else if (n.category && typeof n.category === 'string' && n.category.trim()) {
      const cat = n.category.trim().toLowerCase();
      tagFreq.set(cat, (tagFreq.get(cat) || 0) + 1);
    }
  }

  const activeTagsSlice = Array.from(tagFreq.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 15)
    .map(([t]) => t);

  const seenTags = new Set<string>();
  const numberToTagMap = new Map<number, string>();
  let currentNumber = 1;

  // 1. Teraktif: Kumpulkan top 15 tag dengan frekuensi kemunculan terbanyak di DB. Simpan ke seenTags.
  const activeNumbered: string[] = [];
  for (const t of activeTagsSlice) {
    seenTags.add(t);
    const num = currentNumber++;
    numberToTagMap.set(num, t);
    activeNumbered.push(`(${num})${escapeHtml(t)}`);
  }

  // 2. Terakhir: Loop catatan terbaru (ambil HANYA 1 tag pertama per catatan, specificTags[0] atau fallback category).
  // Lewati jika tag SUDAH ada di seenTags. Ambil hingga maksimal 15 tag unik.
  const recentNumbered: string[] = [];
  for (const n of userNotes) {
    let firstTag: string | null = null;
    if (Array.isArray(n.specificTags) && n.specificTags.length > 0) {
      for (const st of n.specificTags) {
        if (st && typeof st === 'string' && st.trim()) {
          firstTag = st.trim().toLowerCase();
          break;
        }
      }
    }
    if (!firstTag && n.category && typeof n.category === 'string' && n.category.trim()) {
      firstTag = n.category.trim().toLowerCase();
    }

    if (firstTag && !seenTags.has(firstTag)) {
      seenTags.add(firstTag);
      const num = currentNumber++;
      numberToTagMap.set(num, firstTag);
      recentNumbered.push(`(${num})${escapeHtml(firstTag)}`);
      if (recentNumbered.length >= 15) {
        break;
      }
    }
  }

  // 3. Sering Dicari: Ambil tag-tag yang paling sering dibuka/direquest. Lewati jika SUDAH ada di seenTags.
  // Ambil hanya yang belum pernah muncul di Teraktif maupun Terakhir hingga maksimal 15 tag.
  const searchedRows = await db
    .select({ tag: tagSearches.tag, count: tagSearches.count })
    .from(tagSearches)
    .where(eq(tagSearches.userId, userId))
    .orderBy(desc(tagSearches.count), desc(tagSearches.updatedAt))
    .limit(50);

  const searchedNumbered: string[] = [];
  for (const r of searchedRows) {
    const t = r.tag?.trim().toLowerCase();
    if (t && !seenTags.has(t)) {
      seenTags.add(t);
      const num = currentNumber++;
      numberToTagMap.set(num, t);
      searchedNumbered.push(`(${num})${escapeHtml(t)}`);
      if (searchedNumbered.length >= 15) {
        break;
      }
    }
  }

  return {
    hasNotes: userNotes.length > 0,
    activeTagsText: formatTagNumberedHorizontal(activeNumbered),
    recentTagsText: formatTagNumberedHorizontal(recentNumbered),
    searchedTagsText: formatTagNumberedHorizontal(searchedNumbered),
    numberToTagMap,
  };
}

/**
 * Executes note filtering for a tag or category, sends snippets with pagination keyboard.
 */
export async function handleTagFilter(
  chatId: string,
  userId: string,
  targetTag: string,
  activeLocale: SupportedLocale
): Promise<TelegramProcessResult> {
  // Increment counter riwayat pencarian tag user di tag_searches
  await recordTagSearch(userId, targetTag);

  // Hitung total catatan yang cocok
  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(notes)
    .where(
      and(
        eq(notes.userId, userId),
        eq(notes.isEncrypted, false),
        sql`(${notes.category}::text = ${targetTag} OR ${notes.specificTags} @> ${JSON.stringify([targetTag])}::jsonb)`
      )
    );
  const totalCount = Number(countResult?.count || 0);

  if (totalCount === 0) {
    await sendTelegramMessage(chatId, getTelegramMsg('tags_none_found', activeLocale, { tag: targetTag }), {
      parse_mode: 'Markdown',
    });
    return { ok: true, action: 'tags_none_found', tag: targetTag };
  }

  const matchedNotes = await db
    .select()
    .from(notes)
    .where(
      and(
        eq(notes.userId, userId),
        eq(notes.isEncrypted, false),
        sql`(${notes.category}::text = ${targetTag} OR ${notes.specificTags} @> ${JSON.stringify([targetTag])}::jsonb)`
      )
    )
    .orderBy(desc(notes.createdAt))
    .limit(PAGE_SIZE)
    .offset(0);

  const headerTitle = getTelegramMsg('tags_snippet_header', activeLocale, { tag: targetTag });
  const reply = formatSnippetPage(matchedNotes, totalCount, 1, PAGE_SIZE, headerTitle, activeLocale);
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const keyboard = buildPaginationKeyboard('tags', targetTag, 1, totalPages, matchedNotes);

  noteListSessionMap.set(chatId, {
    items: matchedNotes.map((n) => ({ id: n.id, content: n.content })),
    type: 'tags',
    queryVal: targetTag,
    page: 1,
    expiresAt: Date.now() + TAG_SESSION_TTL_MS,
  });

  await sendTelegramMessage(chatId, reply, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });

  return { ok: true, action: 'tags_filtered', totalCount, tag: targetTag };
}

/**
 * In-memory map to store navigation context for note detail view when callback_data is long.
 */
export const noteNavMap = new Map<string, { type: 'tags' | 'search' | 'pin'; queryVal: string; page: number }>();

/**
 * In-memory session state for active note snippets list on a chat.
 * Used for direct number input shortcut to open note detail.
 */
export const noteListSessionMap = new Map<
  string,
  {
    items: Array<{ id: string; content: string }>;
    type: 'tags' | 'search' | 'pin';
    queryVal: string;
    page: number;
    expiresAt: number;
  }
>();

/**
 * Formats note date and time to WIB (Asia/Jakarta): "EEE, dd/MM/yyyy • HH:mm WIB"
 */
export function formatNoteDateWib(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return `${p.weekday}, ${p.day}/${p.month}/${p.year} • ${p.hour}:${p.minute} WIB`;
}

/**
 * Renders full note content detail with metadata (WIB date, tags) and action buttons:
 * - Row 1: [ 📌 Pin ] / [ ⭐️ Lepas Pin ], [ 📋 Salin ], [ 🗑 Hapus ]
 * - Row 2: [ ⬅️ Kembali ke Daftar ], [ 🏷 Menu Tags ]
 */
export async function displayNoteDetail(
  chatId: string,
  messageId: number | undefined,
  noteId: string,
  type: 'tags' | 'search' | 'pin',
  queryVal: string,
  currentPage: number
): Promise<TelegramProcessResult> {
  const [note] = await db
    .select()
    .from(notes)
    .where(eq(notes.id, noteId))
    .limit(1);

  if (!note) {
    return { ok: false, error: 'note_not_found' };
  }

  noteNavMap.set(note.id, { type, queryVal, page: currentPage });

  const pinIcon = note.isPinned ? '📌⭐️' : '📌';
  const dateTimeStr = formatNoteDateWib(new Date(note.createdAt));

  const tagsSet = new Set<string>();
  if (note.category && typeof note.category === 'string' && note.category.trim()) {
    tagsSet.add(note.category.trim());
  }
  if (Array.isArray(note.specificTags)) {
    for (const t of note.specificTags) {
      if (t && typeof t === 'string' && t.trim()) {
        tagsSet.add(t.trim());
      }
    }
  }
  const tagsStr = tagsSet.size > 0 ? Array.from(tagsSet).join(', ') : '-';

  const detailText = `${pinIcon} ${note.content.trim()}\n\n${dateTimeStr}\nTags: ${tagsStr}`;

  // Action Buttons
  const pinText = note.isPinned ? '⭐️ Lepas Pin' : '📌 Pin';
  const rawPinCb = `note:pin:${note.id}:${type}:${queryVal}:${currentPage}`;
  const pinCb = rawPinCb.length <= 64 ? rawPinCb : `note:pin:${note.id}`;

  const rawDelCb = `note:delete_confirm:${note.id}:${type}:${queryVal}:${currentPage}`;
  const delCb = rawDelCb.length <= 64 ? rawDelCb : `note:delete_confirm:${note.id}`;

  const detailKeyboard = {
    inline_keyboard: [
      [
        {
          text: pinText,
          callback_data: pinCb,
        },
        {
          text: '📋 Salin',
          copy_text: { text: note.content.slice(0, 4096) },
        },
        {
          text: '🗑 Hapus',
          callback_data: delCb,
        },
      ],
      [
        {
          text: '⬅️ Kembali ke Daftar',
          callback_data: `page:${type}:${queryVal}:${currentPage}`,
        },
        {
          text: '🏷 Menu Tags',
          callback_data: 'menu:tags',
        },
      ],
    ],
  };

  if (messageId) {
    await editTelegramMessage(chatId, messageId, detailText, {
      reply_markup: detailKeyboard,
    });
  } else {
    await sendTelegramMessage(chatId, detailText, {
      reply_markup: detailKeyboard,
    });
  }

  return { ok: true, action: 'note_detail_view', noteId };
}

/**
 * Builds Telegram Inline Keyboard for pagination and note detail numbers:
 * - Number buttons: [ 1 ], [ 2 ], ... (max 5 per row, up to 9 notes)
 * - Pagination row: [ ◀️ Prev ] [ 1 / N ] [ Next ▶️ ]
 * - Menu row: [ 🏷 Kembali ke Tags ]
 */
export function buildPaginationKeyboard(
  type: 'tags' | 'search' | 'pin',
  queryVal: string,
  currentPage: number,
  totalPages: number,
  items?: Array<{ id: string }>
) {
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];

  // 1. Deretan Tombol Angka Murni Tanpa Emoji (1-Tap Note Detail)
  if (items && items.length > 0) {
    const numButtons: Array<{ text: string; callback_data: string }> = items.map((it, idx) => {
      noteNavMap.set(it.id, { type, queryVal, page: currentPage });

      const rawCb = `note:view:${it.id}:${type}:${queryVal}:${currentPage}`;
      // Fallback jika panjang melebihi batas 64 byte Telegram callback_data
      const callback_data = rawCb.length <= 64 ? rawCb : `note:view:${it.id}:${type}::${currentPage}`;

      return {
        text: ` ${idx + 1} `,
        callback_data,
      };
    });

    if (numButtons.length <= 5) {
      rows.push(numButtons);
    } else {
      rows.push(numButtons.slice(0, 5));
      rows.push(numButtons.slice(5));
    }
  }

  // 2. Baris Pagination (jika totalPages > 1)
  if (totalPages > 1) {
    const navButtons: Array<{ text: string; callback_data: string }> = [];
    if (currentPage > 1) {
      navButtons.push({
        text: '◀️ Prev',
        callback_data: `page:${type}:${queryVal}:${currentPage - 1}`,
      });
    }

    if (currentPage < totalPages) {
      navButtons.push({
        text: 'Next ▶️',
        callback_data: `page:${type}:${queryVal}:${currentPage + 1}`,
      });
    }

    if (navButtons.length > 0) {
      rows.push(navButtons);
    }
  }

  // 3. Baris Menu
  if (type === 'tags' || type === 'pin') {
    rows.push([
      {
        text: '🏷 Kembali ke Tags',
        callback_data: 'menu:tags',
      },
    ]);
  }

  if (rows.length === 0) return undefined;

  return {
    inline_keyboard: rows,
  };
}

/**
 * Handles /pin command and page:pin pagination: retrieves all pinned notes.
 */
export async function handlePinList(
  chatId: string,
  userId: string,
  page: number,
  activeLocale: SupportedLocale,
  messageId?: number
): Promise<TelegramProcessResult> {
  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(notes)
    .where(
      and(
        eq(notes.userId, userId),
        eq(notes.isPinned, true),
        eq(notes.isEncrypted, false)
      )
    );
  const totalCount = Number(countResult?.count || 0);

  if (totalCount === 0) {
    const emptyMsg = '📌 Anda belum memiliki catatan yang dipin. Buka detail catatan dan tekan tombol "📌 Pin" untuk menandainya.';
    if (messageId) {
      await editTelegramMessage(chatId, messageId, emptyMsg, { parse_mode: 'Markdown' });
    } else {
      await sendTelegramMessage(chatId, emptyMsg, { parse_mode: 'Markdown' });
    }
    return { ok: true, action: 'pin_empty' };
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const validPage = Math.min(Math.max(1, page), totalPages);
  const offset = (validPage - 1) * PAGE_SIZE;

  const pinnedNotes = await db
    .select()
    .from(notes)
    .where(
      and(
        eq(notes.userId, userId),
        eq(notes.isPinned, true),
        eq(notes.isEncrypted, false)
      )
    )
    .orderBy(desc(notes.createdAt))
    .limit(PAGE_SIZE)
    .offset(offset);

  const headerTitle = '⭐️ *Catatan yang Dipin*';
  const reply = formatSnippetPage(pinnedNotes, totalCount, validPage, PAGE_SIZE, headerTitle, activeLocale);
  const keyboard = buildPaginationKeyboard('pin', 'all', validPage, totalPages, pinnedNotes);

  noteListSessionMap.set(chatId, {
    items: pinnedNotes.map((n) => ({ id: n.id, content: n.content })),
    type: 'pin',
    queryVal: 'all',
    page: validPage,
    expiresAt: Date.now() + TAG_SESSION_TTL_MS,
  });

  if (messageId) {
    await editTelegramMessage(chatId, messageId, reply, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  } else {
    await sendTelegramMessage(chatId, reply, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  }

  return { ok: true, action: 'pin_list', page: validPage, totalCount };
}

/**
 * Core Telegram Message Processor.
 * Shared between Webhook handler and direct VPS Long Polling worker.
 */
export async function processTelegramMessage(message: any): Promise<TelegramProcessResult> {
  // 0. Delegasi jika payload berupa callback_query dari inline keyboard
  if (message && message.data) {
    return await processTelegramCallbackQuery(message);
  }

  if (!message || !message.chat) {
    return { ok: true, ignored: 'no_message' };
  }

  const chatId = String(message.chat.id);

  // 1. Deteksi file / media (foto, dokumen, video, audio, voice, sticker, dsb.)
  const isMedia = Boolean(
    (message.photo && message.photo.length > 0) ||
    message.document ||
    message.video ||
    message.voice ||
    message.audio ||
    message.video_note ||
    message.sticker ||
    message.animation
  );

  if (isMedia) {
    const [existingKey] = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.telegramChatId, chatId), eq(apiKeys.isActive, true)))
      .limit(1);

    let activeLocale = detectTelegramLocale(message, null);
    if (existingKey) {
      const [u] = await db.select({ preferredLocale: users.preferredLocale }).from(users).where(eq(users.id, existingKey.userId)).limit(1);
      activeLocale = detectTelegramLocale(message, u?.preferredLocale);
    }

    await sendTelegramMessage(
      chatId,
      getTelegramMsg('unsupported_media', activeLocale)
    );
    return { ok: true, action: 'unsupported_media' };
  }

  const rawText: string | undefined = message.text || message.caption;

  if (!rawText || !rawText.trim()) {
    return { ok: true, ignored: 'empty_text' };
  }

  const text = rawText.trim();

  // Jika input adalah command bot ('/'), pastikan catatan di debounce buffer disimpan terlebih dahulu
  if (text.startsWith('/')) {
    if (debounceMap.has(chatId)) {
      await flushDebounceBuffer(chatId);
    }
  }

  // 1. /start atau /help
  if (text.startsWith('/start') || text.startsWith('/help')) {
    const startPayload = text.replace(/^\/start\s*/, '').trim();

    // 1-Click Connect Onboarding jika user datang dari link: https://t.me/unlazynotes_bot?start=<token>
    if (text.startsWith('/start') && startPayload && startPayload !== '/start') {
      const keyHash = hashApiKey(startPayload);
      const [matchedKey] = await db
        .select()
        .from(apiKeys)
        .where(
          and(
            sql`(${apiKeys.keyHash} = ${keyHash} OR ${apiKeys.rawKey} = ${startPayload})`,
            eq(apiKeys.isActive, true)
          )
        )
        .limit(1);

      if (matchedKey) {
        await db
          .update(apiKeys)
          .set({ telegramChatId: chatId })
          .where(eq(apiKeys.id, matchedKey.id));

        const [matchedUser] = await db
          .select()
          .from(users)
          .where(eq(users.id, matchedKey.userId))
          .limit(1);

        const senderLocale = detectTelegramLocale(message, null);
        // Sinkronkan preferredLocale jika user baru menautkan akun
        if (matchedUser && (!matchedUser.preferredLocale || (matchedUser.preferredLocale === 'id' && senderLocale === 'en'))) {
          await db
            .update(users)
            .set({ preferredLocale: senderLocale })
            .where(eq(users.id, matchedUser.id));
          matchedUser.preferredLocale = senderLocale;
        }

        const activeLocale = detectTelegramLocale(message, matchedUser?.preferredLocale);
        const userName = matchedUser?.name || (activeLocale === 'id' ? 'Teman' : 'Friend');
        const welcomeMsg = getTelegramMsg('welcome_connected_brief', activeLocale, { userName });
        await sendTelegramMessage(chatId, welcomeMsg, { parse_mode: 'Markdown' });
        return { ok: true, action: 'start_auto_connected' };
      }
    }

    const [existingKey] = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.telegramChatId, chatId), eq(apiKeys.isActive, true)))
      .limit(1);

    let activeLocale = detectTelegramLocale(message, null);
    if (existingKey) {
      const [u] = await db.select({ preferredLocale: users.preferredLocale }).from(users).where(eq(users.id, existingKey.userId)).limit(1);
      activeLocale = detectTelegramLocale(message, u?.preferredLocale);
    }

    const secDisc = getTelegramMsg('security_disclaimer', activeLocale);
    const helpMsg = getTelegramMsg('help', activeLocale, { securityDisclaimer: secDisc });
    await sendTelegramMessage(chatId, helpMsg, { parse_mode: 'Markdown' });
    return { ok: true, action: 'help' };
  }

  // 2. /login <api_key>
  if (text.startsWith('/login')) {
    const parts = text.split(/\s+/);
    const rawApiKey = parts[1];
    const senderLocale = detectTelegramLocale(message, null);

    if (!rawApiKey) {
      await sendTelegramMessage(
        chatId,
        getTelegramMsg('login_missing_key', senderLocale),
        { parse_mode: 'Markdown' }
      );
      return { ok: true, action: 'login_missing_key' };
    }

    const keyHash = hashApiKey(rawApiKey);
    const [matchedKey] = await db
      .select()
      .from(apiKeys)
      .where(
        and(
          sql`(${apiKeys.keyHash} = ${keyHash} OR ${apiKeys.rawKey} = ${rawApiKey})`,
          eq(apiKeys.isActive, true)
        )
      )
      .limit(1);

    if (!matchedKey) {
      await sendTelegramMessage(
        chatId,
        getTelegramMsg('login_invalid_key', senderLocale),
        { parse_mode: 'Markdown' }
      );
      return { ok: true, action: 'login_invalid_key' };
    }

    await db
      .update(apiKeys)
      .set({ telegramChatId: chatId })
      .where(eq(apiKeys.id, matchedKey.id));

    const [matchedUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, matchedKey.userId))
      .limit(1);

    // Sinkronkan preferredLocale jika user baru menautkan akun
    if (matchedUser && (!matchedUser.preferredLocale || (matchedUser.preferredLocale === 'id' && senderLocale === 'en'))) {
      await db
        .update(users)
        .set({ preferredLocale: senderLocale })
        .where(eq(users.id, matchedUser.id));
      matchedUser.preferredLocale = senderLocale;
    }

    const activeLocale = detectTelegramLocale(message, matchedUser?.preferredLocale);
    const userName = matchedUser?.name || (activeLocale === 'id' ? 'Teman' : 'Friend');
    const secDisc = getTelegramMsg('security_disclaimer', activeLocale);
    await sendTelegramMessage(
      chatId,
      getTelegramMsg('welcome_connected', activeLocale, { userName, securityDisclaimer: secDisc }),
      { parse_mode: 'Markdown' }
    );

    return { ok: true, action: 'login_success' };
  }

  // 3. /logout
  if (text.startsWith('/logout')) {
    const [existingKey] = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.telegramChatId, chatId), eq(apiKeys.isActive, true)))
      .limit(1);

    let activeLocale = detectTelegramLocale(message, null);
    if (existingKey) {
      const [u] = await db.select({ preferredLocale: users.preferredLocale }).from(users).where(eq(users.id, existingKey.userId)).limit(1);
      activeLocale = detectTelegramLocale(message, u?.preferredLocale);
    }

    await db
      .update(apiKeys)
      .set({ telegramChatId: null })
      .where(eq(apiKeys.telegramChatId, chatId));

    await sendTelegramMessage(
      chatId,
      getTelegramMsg('logout_success', activeLocale),
      { parse_mode: 'Markdown' }
    );

    return { ok: true, action: 'logout_success' };
  }

  // 4. Validasi Autentikasi Pengguna
  const [activeKey] = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.telegramChatId, chatId), eq(apiKeys.isActive, true)))
    .limit(1);

  if (!activeKey) {
    const activeLocale = detectTelegramLocale(message, null);
    await sendTelegramMessage(
      chatId,
      getTelegramMsg('unauthenticated', activeLocale),
      { parse_mode: 'Markdown' }
    );
    return { ok: true, action: 'unauthenticated' };
  }

  const [matchedUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, activeKey.userId))
    .limit(1);

  const activeLocale = detectTelegramLocale(message, matchedUser?.preferredLocale);

  const quotaInfo = await checkUserQuotaAndTier(activeKey.userId);

  // 4b. Shortcut Penomoran: Jika pesan berupa angka langsung atau berkurung (misal: 1 atau (1))
  const numMatch = text.match(/^\(?(\d+)\)?$/);
  if (numMatch) {
    const digit = parseInt(numMatch[1], 10);

    // Prioritas 1: Jika user sedang melihat list catatan aktif dan digit cocok (1..items.length)
    const listSession = noteListSessionMap.get(chatId);
    if (listSession && listSession.expiresAt > Date.now()) {
      if (digit >= 1 && digit <= listSession.items.length) {
        if (debounceMap.has(chatId)) {
          await flushDebounceBuffer(chatId);
        }
        const selectedNote = listSession.items[digit - 1];
        return await displayNoteDetail(
          chatId,
          undefined,
          selectedNote.id,
          listSession.type,
          listSession.queryVal,
          listSession.page
        );
      }
    }

    // Prioritas 2: Jika ada sesi menu /tags global (shortcut filter tag)
    const session = tagSessionMap.get(chatId);
    if (session && session.expiresAt > Date.now()) {
      const targetTag = session.tags.get(digit);
      if (targetTag) {
        if (debounceMap.has(chatId)) {
          await flushDebounceBuffer(chatId);
        }
        return await handleTagFilter(chatId, activeKey.userId, targetTag, activeLocale);
      }
    }
  }

  // 5. /tags (tanpa argumen)
  if (text === '/tags' || /^(\/tags)(@[a-zA-Z0-9_]+)?$/.test(text)) {
    const overview = await getTagsOverviewData(activeKey.userId);

    if (!overview.hasNotes) {
      await sendTelegramMessage(chatId, getTelegramMsg('tags_empty', activeLocale));
      return { ok: true, action: 'tags_empty' };
    }

    // Simpan session mapping nomor tag untuk chatId ini
    tagSessionMap.set(chatId, {
      tags: overview.numberToTagMap,
      expiresAt: Date.now() + TAG_SESSION_TTL_MS,
    });

    const msg = getTelegramMsg('tags_header', activeLocale, {
      activeTagsText: overview.activeTagsText,
      recentTagsText: overview.recentTagsText,
      searchedTagsText: overview.searchedTagsText,
    });

    const keyboard = buildCategoriesGridKeyboard();

    await sendTelegramMessage(chatId, msg, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });

    return { ok: true, action: 'tags_list' };
  }

  // 6. /tags <nama_tag>
  if (text.startsWith('/tags ')) {
    const rawArg = text.substring(6).trim();
    let targetTag = normalizeTag(rawArg);

    // Jika argumen berupa angka (misal: /tags 1 atau /tags (1)), cek sesi aktif nomor tag
    const numMatch = rawArg.match(/^\(?(\d+)\)?$/);
    if (numMatch) {
      const digit = parseInt(numMatch[1], 10);
      const session = tagSessionMap.get(chatId);
      if (session && session.expiresAt > Date.now()) {
        const resolved = session.tags.get(digit);
        if (resolved) {
          targetTag = resolved;
        }
      }
    }

    if (!targetTag) {
      await sendTelegramMessage(chatId, getTelegramMsg('tags_filter_missing', activeLocale), { parse_mode: 'Markdown' });
      return { ok: true, action: 'tags_filter_missing' };
    }

    return await handleTagFilter(chatId, activeKey.userId, targetTag, activeLocale);
  }

  // 6b. /pin
  if (text === '/pin' || /^(\/pin)(@[a-zA-Z0-9_]+)?$/.test(text)) {
    return await handlePinList(chatId, activeKey.userId, 1, activeLocale);
  }

  // 7. /search <kata_kunci>
  if (text.startsWith('/search')) {
    const keyword = text.replace(/^\/search\s*/, '').trim();

    if (!keyword) {
      await sendTelegramMessage(chatId, getTelegramMsg('search_missing_keyword', activeLocale), {
        parse_mode: 'Markdown',
      });
      return { ok: true, action: 'search_missing_keyword' };
    }

    const searchCondition = buildFlexibleSearchCondition(keyword);
    const orderConditions = buildSearchRelevanceOrder(keyword);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(notes)
      .where(
        and(
          eq(notes.userId, activeKey.userId),
          eq(notes.isEncrypted, false),
          searchCondition
        )
      );
    const totalCount = Number(countResult?.count || 0);

    if (totalCount === 0) {
      await sendTelegramMessage(
        chatId,
        getTelegramMsg('search_empty', activeLocale, { keyword }),
        { parse_mode: 'Markdown' }
      );
      return { ok: true, action: 'search_empty' };
    }

    const searchResults = await db
      .select()
      .from(notes)
      .where(
        and(
          eq(notes.userId, activeKey.userId),
          eq(notes.isEncrypted, false),
          searchCondition
        )
      )
      .orderBy(...orderConditions)
      .limit(PAGE_SIZE)
      .offset(0);

    const headerTitle = getTelegramMsg('search_header', activeLocale, { keyword });
    const searchReply = formatSnippetPage(searchResults, totalCount, 1, PAGE_SIZE, headerTitle, activeLocale);
    const totalPages = Math.ceil(totalCount / PAGE_SIZE);
    const keyboard = buildPaginationKeyboard('search', keyword, 1, totalPages, searchResults);

    noteListSessionMap.set(chatId, {
      items: searchResults.map((n) => ({ id: n.id, content: n.content })),
      type: 'search',
      queryVal: keyword,
      page: 1,
      expiresAt: Date.now() + TAG_SESSION_TTL_MS,
    });

    await sendTelegramMessage(chatId, searchReply, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });

    return { ok: true, action: 'search_success', totalCount };
  }

  // 8. /ask <pertanyaan> (AI Pro Q&A)
  if (text.startsWith('/ask')) {
    const question = text.replace(/^\/ask\s*/, '').trim();

    if (!question) {
      await sendTelegramMessage(
        chatId,
        getTelegramMsg('ask_missing_question', activeLocale),
        { parse_mode: 'Markdown' }
      );
      return { ok: true, action: 'ask_missing_question' };
    }

    if (!quotaInfo.isPro) {
      const gated = getTelegramProGatedMessage(process.env.BETTER_AUTH_URL, activeLocale);
      await sendTelegramMessage(chatId, gated.text, {
        parse_mode: 'Markdown',
        reply_markup: gated.replyMarkup,
      });
      return { ok: true, action: 'ask_requires_pro' };
    }

    await sendTelegramMessage(chatId, getTelegramMsg('ask_analyzing', activeLocale));

    (async () => {
      try {
        const answer = await answerNoteQuestion(activeKey.userId, question);
        await sendTelegramMessage(chatId, getTelegramMsg('ask_answer_header', activeLocale, { answer }), {
          parse_mode: 'Markdown',
        });
      } catch (err) {
        console.error('[Telegram /ask Background] Error answering question:', err);
      }
    })();

    return { ok: true, action: 'ask_processing' };
  }

  // 9. /secure <kunci> <isi_rahasia> (AES-256-GCM Private Vault - Bypass AI)
  if (text.startsWith('/secure')) {
    if (!quotaInfo.isPro) {
      const gated = getTelegramProGatedMessage(process.env.BETTER_AUTH_URL, activeLocale);
      await sendTelegramMessage(chatId, gated.text, {
        parse_mode: 'Markdown',
        reply_markup: gated.replyMarkup,
      });
      return { ok: true, action: 'secure_requires_pro' };
    }

    const secureMatch = text.match(/^\/secure\s+(\S+)\s+([\s\S]+)$/);

    if (!secureMatch) {
      await sendTelegramMessage(
        chatId,
        getTelegramMsg('secure_missing_params', activeLocale),
        { parse_mode: 'Markdown' }
      );
      return { ok: true, action: 'secure_missing_params' };
    }

    const [, vaultKey, secretContent] = secureMatch;

    const encryptedData = encryptSecret(secretContent.trim(), activeKey.userId);
    const noteId = crypto.randomUUID();

    await db.insert(notes).values({
      id: noteId,
      userId: activeKey.userId,
      content: encryptedData,
      category: 'credential',
      specificTags: ['vault', 'encrypted'],
      isEncrypted: true,
      vaultKey: vaultKey.trim(),
      source: 'telegram',
      createdAt: new Date(),
    });

    await incrementUserMonthlyNotes(activeKey.userId);

    const reply = getTelegramMsg('secure_saved', activeLocale, { vaultKey: vaultKey.trim() });
    await sendTelegramMessage(chatId, reply, { parse_mode: 'Markdown' });

    return { ok: true, action: 'secure_saved', noteId };
  }

  // 10. /vault [kunci] (Buka rahasia atau list kunci Private Vault)
  if (text.startsWith('/vault')) {
    if (!quotaInfo.isPro) {
      const gated = getTelegramProGatedMessage(process.env.BETTER_AUTH_URL, activeLocale);
      await sendTelegramMessage(chatId, gated.text, {
        parse_mode: 'Markdown',
        reply_markup: gated.replyMarkup,
      });
      return { ok: true, action: 'vault_requires_pro' };
    }

    const vaultParam = text.replace(/^\/vault\s*/, '').trim();

    if (!vaultParam) {
      const vaultNotes = await db
        .select({
          vaultKey: notes.vaultKey,
          createdAt: notes.createdAt,
        })
        .from(notes)
        .where(
          and(
            eq(notes.userId, activeKey.userId),
            eq(notes.isEncrypted, true)
          )
        )
        .orderBy(desc(notes.createdAt));

      if (vaultNotes.length === 0) {
        await sendTelegramMessage(
          chatId,
          getTelegramMsg('vault_empty', activeLocale),
          { parse_mode: 'Markdown' }
        );
        return { ok: true, action: 'vault_empty' };
      }

      const noKeyLabel = activeLocale === 'id' ? 'tanpa-kunci' : 'no-key';
      const keysList = Array.from(
        new Set(vaultNotes.map((v) => v.vaultKey || noKeyLabel))
      )
        .map((k) => `• \`${k}\``)
        .join('\n');

      const msg = getTelegramMsg('vault_list', activeLocale, {
        totalCount: vaultNotes.length,
        keysList,
      });
      await sendTelegramMessage(chatId, msg, { parse_mode: 'Markdown' });
      return { ok: true, action: 'vault_list' };
    }

    const cleanQuery = vaultParam.trim();
    const matchedVaults = await db
      .select()
      .from(notes)
      .where(
        and(
          eq(notes.userId, activeKey.userId),
          eq(notes.isEncrypted, true),
          ilike(notes.vaultKey, `%${cleanQuery}%`)
        )
      )
      .orderBy(desc(notes.createdAt))
      .limit(5);

    if (matchedVaults.length === 0) {
      await sendTelegramMessage(
        chatId,
        getTelegramMsg('vault_not_found', activeLocale, { keyword: cleanQuery }),
        { parse_mode: 'Markdown' }
      );
      return { ok: true, action: 'vault_not_found' };
    }

    if (matchedVaults.length === 1) {
      const matchedVault = matchedVaults[0];
      try {
        const decrypted = decryptSecret(matchedVault.content, activeKey.userId);
        const dateStr = format(new Date(matchedVault.createdAt), 'dd MMM yyyy, HH:mm');
        const reply = getTelegramMsg('vault_revealed', activeLocale, {
          vaultKey: matchedVault.vaultKey || '',
          dateStr,
          decrypted,
        });
        await sendTelegramMessage(chatId, reply, { parse_mode: 'Markdown' });
        return { ok: true, action: 'vault_revealed' };
      } catch (decErr) {
        console.error('[Private Vault] Decryption error:', decErr);
        await sendTelegramMessage(
          chatId,
          getTelegramMsg('vault_decryption_failed', activeLocale)
        );
        return { ok: false, error: 'vault_decryption_failed' };
      }
    }

    // Jika ditemukan lebih dari 1 catatan yang cocok
    let reply = getTelegramMsg('vault_revealed_multiple_header', activeLocale, {
      totalCount: matchedVaults.length,
      keyword: cleanQuery,
    });
    for (let i = 0; i < matchedVaults.length; i++) {
      const item = matchedVaults[i];
      const dateStr = format(new Date(item.createdAt), 'dd MMM yyyy, HH:mm');
      let decrypted = '';
      try {
        decrypted = decryptSecret(item.content, activeKey.userId);
      } catch (err) {
        decrypted = activeLocale === 'id' ? '[Gagal mendekripsi data vault]' : '[Failed to decrypt vault data]';
      }
      reply += `*${i + 1}. 🔑 ${item.vaultKey}* (📅 _${dateStr}_)\n\`\`\`\n${decrypted}\n\`\`\`\n\n`;
    }

    await sendTelegramMessage(chatId, reply, { parse_mode: 'Markdown' });
    return { ok: true, action: 'vault_revealed_multiple' };
  }

  // 11. Core Note Capture Quota Enforcement
  if (!quotaInfo.allowed) {
    const quotaMsg = getTelegramQuotaExceededMessage(process.env.BETTER_AUTH_URL, activeLocale);
    await sendTelegramMessage(
      chatId,
      quotaMsg.text,
      {
        parse_mode: 'Markdown',
        reply_markup: quotaMsg.replyMarkup,
      }
    );
    return { ok: false, error: 'monthly_quota_exceeded' };
  }

  // Jika buffer untuk chatId ini sudah ada, tampung pesan baru dan reset timer 3.0 detik
  if (debounceMap.has(chatId)) {
    const existing = debounceMap.get(chatId)!;
    clearTimeout(existing.timer);
    existing.messages.push(text);
    existing.locale = activeLocale;
    existing.timer = setTimeout(() => {
      flushDebounceBuffer(chatId).catch((err) =>
        console.error('[Debounce Auto Flush Error]:', err)
      );
    }, DEBOUNCE_DELAY_MS);

    return {
      ok: true,
      action: 'buffered',
      noteId: existing.noteId,
      bufferedCount: existing.messages.length,
      status: 'debouncing',
    };
  }

  // Jika buffer belum ada, alokasikan noteId dan mulai timer 3.0 detik
  const noteId = crypto.randomUUID();
  const item: DebounceBufferItem = {
    timer: setTimeout(() => {
      flushDebounceBuffer(chatId).catch((err) =>
        console.error('[Debounce Auto Flush Error]:', err)
      );
    }, DEBOUNCE_DELAY_MS),
    messages: [text],
    activeKey,
    chatId,
    noteId,
    createdAt: new Date(),
    tier: quotaInfo.tier,
    locale: activeLocale,
  };
  debounceMap.set(chatId, item);

  return {
    ok: true,
    action: 'buffered',
    noteId,
    bufferedCount: 1,
    status: 'debouncing',
  };
}

/**
 * Handles Telegram callback_query events for Inline Keyboard pagination.
 */
export async function processTelegramCallbackQuery(callbackQuery: any): Promise<TelegramProcessResult> {
  if (!callbackQuery) {
    return { ok: true, ignored: 'no_callback_query' };
  }

  const callbackId = callbackQuery.id;
  const data: string = callbackQuery.data || '';
  const chatId = String(callbackQuery.message?.chat?.id || callbackQuery.from?.id);
  const messageId = callbackQuery.message?.message_id;

  if (data === 'noop') {
    await answerTelegramCallbackQuery(callbackId);
    return { ok: true, action: 'callback_noop' };
  }

  // 1. Pagination untuk /tags: page:tags:<tag>:<page_num>
  if (data.startsWith('page:tags:')) {
    const parts = data.split(':');
    const targetTag = parts[2];
    const pageNum = parseInt(parts[3] || '1', 10) || 1;

    // Validasi otentikasi
    const [activeKey] = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.telegramChatId, chatId), eq(apiKeys.isActive, true)))
      .limit(1);

    if (!activeKey) {
      const activeLocale = detectTelegramLocale(callbackQuery, null);
      await answerTelegramCallbackQuery(callbackId, {
        text: getTelegramMsg('callback_unauthenticated', activeLocale),
      });
      return { ok: false, error: 'unauthenticated' };
    }

    const [matchedUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, activeKey.userId))
      .limit(1);

    const activeLocale = detectTelegramLocale(callbackQuery, matchedUser?.preferredLocale);

    // Increment counter riwayat pencarian/pembukaan tag user di tag_searches
    await recordTagSearch(activeKey.userId, targetTag);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(notes)
      .where(
        and(
          eq(notes.userId, activeKey.userId),
          eq(notes.isEncrypted, false),
          sql`(${notes.category}::text = ${targetTag} OR ${notes.specificTags} @> ${JSON.stringify([targetTag])}::jsonb)`
        )
      );
    const totalCount = Number(countResult?.count || 0);
    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
    const validPage = Math.min(Math.max(1, pageNum), totalPages);
    const offset = (validPage - 1) * PAGE_SIZE;

    const matchedNotes = await db
      .select()
      .from(notes)
      .where(
        and(
          eq(notes.userId, activeKey.userId),
          eq(notes.isEncrypted, false),
          sql`(${notes.category}::text = ${targetTag} OR ${notes.specificTags} @> ${JSON.stringify([targetTag])}::jsonb)`
        )
      )
      .orderBy(desc(notes.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset);

    const headerTitle = getTelegramMsg('tags_snippet_header', activeLocale, { tag: targetTag });
    const newText = formatSnippetPage(matchedNotes, totalCount, validPage, PAGE_SIZE, headerTitle, activeLocale);
    const keyboard = buildPaginationKeyboard('tags', targetTag, validPage, totalPages, matchedNotes);

    noteListSessionMap.set(chatId, {
      items: matchedNotes.map((n) => ({ id: n.id, content: n.content })),
      type: 'tags',
      queryVal: targetTag,
      page: validPage,
      expiresAt: Date.now() + TAG_SESSION_TTL_MS,
    });

    if (messageId) {
      await editTelegramMessage(chatId, messageId, newText, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    }

    await answerTelegramCallbackQuery(callbackId);
    return { ok: true, action: 'callback_page_tags', page: validPage, totalCount };
  }

  // 1c. Tampilan Detail Catatan: note:view:<noteId>:<type>:<queryVal>:<page>
  if (data.startsWith('note:view:')) {
    const parts = data.split(':');
    const noteId = parts[2];
    const nav = noteNavMap.get(noteId);
    const type = (parts[3] as 'tags' | 'search' | 'pin') || nav?.type || 'tags';
    const pageNum = parseInt(parts[parts.length - 1], 10) || nav?.page || 1;
    let queryVal = parts.length > 5 ? parts.slice(4, parts.length - 1).join(':') : (nav?.queryVal || '');

    const res = await displayNoteDetail(chatId, messageId, noteId, type, queryVal, pageNum);
    await answerTelegramCallbackQuery(callbackId);
    return res;
  }

  // 1d. Toggle Pin Catatan: note:pin:<noteId>:<type>:<queryVal>:<page>
  if (data.startsWith('note:pin:')) {
    const parts = data.split(':');
    const noteId = parts[2];
    const nav = noteNavMap.get(noteId);
    const type = (parts[3] as 'tags' | 'search' | 'pin') || nav?.type || 'tags';
    const pageNum = parseInt(parts[parts.length - 1], 10) || nav?.page || 1;
    let queryVal = parts.length > 5 ? parts.slice(4, parts.length - 1).join(':') : (nav?.queryVal || '');

    const [note] = await db
      .select()
      .from(notes)
      .where(eq(notes.id, noteId))
      .limit(1);

    if (!note) {
      await answerTelegramCallbackQuery(callbackId, { text: 'Catatan tidak ditemukan' });
      return { ok: false, error: 'note_not_found' };
    }

    const newPinned = !note.isPinned;
    await db
      .update(notes)
      .set({ isPinned: newPinned })
      .where(eq(notes.id, noteId));

    await answerTelegramCallbackQuery(callbackId, {
      text: newPinned ? '📌 Catatan berhasil dipin!' : '⭐️ Pin catatan dilepas!',
    });

    return await displayNoteDetail(chatId, messageId, noteId, type, queryVal, pageNum);
  }

  // 1e. Konfirmasi Hapus Catatan: note:delete_confirm:<noteId>:<type>:<queryVal>:<page>
  if (data.startsWith('note:delete_confirm:')) {
    const parts = data.split(':');
    const noteId = parts[2];
    const nav = noteNavMap.get(noteId);
    const type = (parts[3] as 'tags' | 'search' | 'pin') || nav?.type || 'tags';
    const pageNum = parseInt(parts[parts.length - 1], 10) || nav?.page || 1;
    let queryVal = parts.length > 5 ? parts.slice(4, parts.length - 1).join(':') : (nav?.queryVal || '');

    const rawExecCb = `note:delete_exec:${noteId}:${type}:${queryVal}:${pageNum}`;
    const execCb = rawExecCb.length <= 64 ? rawExecCb : `note:delete_exec:${noteId}`;

    const rawCancelCb = `note:view:${noteId}:${type}:${queryVal}:${pageNum}`;
    const cancelCb = rawCancelCb.length <= 64 ? rawCancelCb : `note:view:${noteId}`;

    const confirmKeyboard = {
      inline_keyboard: [
        [
          { text: '⚠️ Yakin Hapus?', callback_data: execCb },
          { text: '❌ Batal', callback_data: cancelCb },
        ],
      ],
    };

    if (messageId) {
      await editTelegramReplyMarkup(chatId, messageId, confirmKeyboard);
    }

    await answerTelegramCallbackQuery(callbackId);
    return { ok: true, action: 'note_delete_confirm', noteId };
  }

  // 1f. Eksekusi Hapus Catatan: note:delete_exec:<noteId>:<type>:<queryVal>:<page>
  if (data.startsWith('note:delete_exec:')) {
    const parts = data.split(':');
    const noteId = parts[2];
    const nav = noteNavMap.get(noteId);
    const type = (parts[3] as 'tags' | 'search' | 'pin') || nav?.type || 'tags';
    const pageNum = parseInt(parts[parts.length - 1], 10) || nav?.page || 1;
    let queryVal = parts.length > 5 ? parts.slice(4, parts.length - 1).join(':') : (nav?.queryVal || '');

    await db.delete(notes).where(eq(notes.id, noteId));
    noteNavMap.delete(noteId);

    const deletedText = '🗑 Catatan telah berhasil dihapus!';
    const backKeyboard = {
      inline_keyboard: [
        [
          {
            text: '⬅️ Kembali ke Daftar',
            callback_data: `page:${type}:${queryVal}:${pageNum}`,
          },
        ],
      ],
    };

    if (messageId) {
      await editTelegramMessage(chatId, messageId, deletedText, {
        reply_markup: backKeyboard,
      });
    } else {
      await sendTelegramMessage(chatId, deletedText, {
        reply_markup: backKeyboard,
      });
    }

    await answerTelegramCallbackQuery(callbackId, { text: '🗑 Catatan dihapus' });
    return { ok: true, action: 'note_deleted', noteId };
  }

  // 1g. Pagination untuk /pin: page:pin:<queryVal>:<page_num>
  if (data.startsWith('page:pin:')) {
    const parts = data.split(':');
    const pageNum = parseInt(parts[3] || '1', 10) || 1;

    const [activeKey] = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.telegramChatId, chatId), eq(apiKeys.isActive, true)))
      .limit(1);

    if (!activeKey) {
      const activeLocale = detectTelegramLocale(callbackQuery, null);
      await answerTelegramCallbackQuery(callbackId, {
        text: getTelegramMsg('callback_unauthenticated', activeLocale),
      });
      return { ok: false, error: 'unauthenticated' };
    }

    const [matchedUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, activeKey.userId))
      .limit(1);

    const activeLocale = detectTelegramLocale(callbackQuery, matchedUser?.preferredLocale);

    const res = await handlePinList(chatId, activeKey.userId, pageNum, activeLocale, messageId);
    await answerTelegramCallbackQuery(callbackId);
    return res;
  }

  // 1b. Kembali ke Menu /tags: menu:tags
  if (data === 'menu:tags') {
    const [activeKey] = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.telegramChatId, chatId), eq(apiKeys.isActive, true)))
      .limit(1);

    if (!activeKey) {
      await answerTelegramCallbackQuery(callbackId, {
        text: getTelegramMsg('callback_unauthenticated', 'id'),
      });
      return { ok: false, error: 'unauthenticated' };
    }

    const [matchedUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, activeKey.userId))
      .limit(1);

    const activeLocale = detectTelegramLocale(callbackQuery, matchedUser?.preferredLocale);
    const overview = await getTagsOverviewData(activeKey.userId);

    // Perbarui session state nomor tag untuk chatId ini
    tagSessionMap.set(chatId, {
      tags: overview.numberToTagMap,
      expiresAt: Date.now() + TAG_SESSION_TTL_MS,
    });

    const msg = getTelegramMsg('tags_header', activeLocale, {
      activeTagsText: overview.activeTagsText,
      recentTagsText: overview.recentTagsText,
      searchedTagsText: overview.searchedTagsText,
    });

    const keyboard = buildCategoriesGridKeyboard();

    if (messageId) {
      await editTelegramMessage(chatId, messageId, msg, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
    }

    await answerTelegramCallbackQuery(callbackId);
    return { ok: true, action: 'callback_menu_tags' };
  }

  // 2. Pagination untuk /search: page:search:<query>:<page_num>
  if (data.startsWith('page:search:')) {
    const parts = data.split(':');
    const pageNumStr = parts[parts.length - 1];
    const pageNum = parseInt(pageNumStr, 10) || 1;
    const query = parts.slice(2, parts.length - 1).join(':');

    // Validasi otentikasi
    const [activeKey] = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.telegramChatId, chatId), eq(apiKeys.isActive, true)))
      .limit(1);

    if (!activeKey) {
      const activeLocale = detectTelegramLocale(callbackQuery, null);
      await answerTelegramCallbackQuery(callbackId, {
        text: getTelegramMsg('callback_unauthenticated', activeLocale),
      });
      return { ok: false, error: 'unauthenticated' };
    }

    const [matchedUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, activeKey.userId))
      .limit(1);

    const activeLocale = detectTelegramLocale(callbackQuery, matchedUser?.preferredLocale);

    const searchCondition = buildFlexibleSearchCondition(query);
    const orderConditions = buildSearchRelevanceOrder(query);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(notes)
      .where(
        and(
          eq(notes.userId, activeKey.userId),
          eq(notes.isEncrypted, false),
          searchCondition
        )
      );
    const totalCount = Number(countResult?.count || 0);
    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
    const validPage = Math.min(Math.max(1, pageNum), totalPages);
    const offset = (validPage - 1) * PAGE_SIZE;

    const searchResults = await db
      .select()
      .from(notes)
      .where(
        and(
          eq(notes.userId, activeKey.userId),
          eq(notes.isEncrypted, false),
          searchCondition
        )
      )
      .orderBy(...orderConditions)
      .limit(PAGE_SIZE)
      .offset(offset);

    const headerTitle = getTelegramMsg('search_header', activeLocale, { keyword: query });
    const newText = formatSnippetPage(searchResults, totalCount, validPage, PAGE_SIZE, headerTitle, activeLocale);
    const keyboard = buildPaginationKeyboard('search', query, validPage, totalPages, searchResults);

    noteListSessionMap.set(chatId, {
      items: searchResults.map((n) => ({ id: n.id, content: n.content })),
      type: 'search',
      queryVal: query,
      page: validPage,
      expiresAt: Date.now() + TAG_SESSION_TTL_MS,
    });

    if (messageId) {
      await editTelegramMessage(chatId, messageId, newText, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    }

    await answerTelegramCallbackQuery(callbackId);
    return { ok: true, action: 'callback_page_search', page: validPage, totalCount };
  }

  await answerTelegramCallbackQuery(callbackId);
  return { ok: true, action: 'callback_unhandled' };
}
