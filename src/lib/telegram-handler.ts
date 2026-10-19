import { db } from '@/db';
import { users, apiKeys, notes } from '@/db/schema';
import { eq, and, desc, sql, ilike } from 'drizzle-orm';
import crypto from 'node:crypto';
import { format } from 'date-fns';
import { encryptSecret, decryptSecret } from '@/lib/crypto';
import {
  hashApiKey,
  bot,
  sendTelegramMessage,
  sendTelegramMessageWithId,
  sendTelegramPhoto,
  sendTelegramDocument,
  deleteTelegramMessage,
  editTelegramMessage,
  editTelegramReplyMarkup,
  answerTelegramCallbackQuery,
} from '@/lib/telegram';
import { processTelegramAttachment } from '@/lib/media-processor';
import type { NoteAttachment } from '@/db/schema';
import { normalizeTag } from '@/lib/ai';
import { answerNoteQuestion } from '@/lib/ask';
import { buildFlexibleSearchCondition, buildSearchRelevanceOrder } from '@/lib/search';
import {
  checkUserQuotaAndTier,
  incrementUserMonthlyNotes,
  getTelegramQuotaExceededMessage,
  getTelegramProGatedMessage,
} from '@/lib/quota-service';
import { getTelegramMsg, detectTelegramLocale, type SupportedLocale } from '@/lib/i18n/telegram';
import { cleanLocalFormat } from '@/lib/formatter';
import { detectLocalCredential } from '@/lib/ai/credential-detector';
import {
  getOrFetchUnorganizedCount,
  incrementUnorganizedCount,
  setUnorganizedCountCache,
  setUserTagsCache,
  resetUnorganizedCount,
  invalidateUserTagsCache,
} from '@/lib/cache';
import { organizeUserNotes } from '@/lib/ai/batch-organizer';

export const PAGE_SIZE = 9;
export const DEBOUNCE_DELAY_MS = 3000;

export const PERSISTENT_DOCK_KEYBOARD = {
  keyboard: [
    [{ text: '📖 Read' }, { text: '🔄 Sync' }],
    [{ text: '🏷 Tags' }, { text: '⭐️ Pin' }],
  ],
  resize_keyboard: true,
  is_persistent: true,
};

export function getDockKeyboard(_unorganizedCount: number = 0) {
  return PERSISTENT_DOCK_KEYBOARD;
}

export function getWebDashboardUrl(forInlineButton = false): string {
  const envUrl = process.env.BETTER_AUTH_URL;
  if (forInlineButton && (!envUrl || envUrl.includes('localhost') || envUrl.includes('127.0.0.1'))) {
    return 'https://unlazynotes.com/dashboard';
  }
  return (envUrl || 'https://unlazynotes.com').replace(/\/$/, '') + '/dashboard';
}

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

export interface RawAttachmentInput {
  fileId: string;
  type: 'image' | 'file';
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
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
  rawAttachments?: RawAttachmentInput[];
  mediaGroupId?: string;
  hasMedia?: boolean;
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

  // Jika buffer memiliki media, periksa apakah ada caption yang berhasil dikumpulkan
  if (item.hasMedia) {
    const rawMergedCheck = item.messages.join('\n\n').trim();
    if (!rawMergedCheck) {
      await sendTelegramMessage(chatId, getTelegramMsg('media_missing_caption', item.locale), {
        reply_markup: PERSISTENT_DOCK_KEYBOARD,
      });
      return null;
    }
  }

  const rawMergedText = item.messages.join('\n\n');
  // 1. Pembersihan format lokal (Zero AI)
  const mergedText = cleanLocalFormat(rawMergedText);
  const noteId = item.noteId;

  try {
    // Proses dan kompres lampiran jika ada
    let processedAttachments: NoteAttachment[] = [];
    if (item.rawAttachments && item.rawAttachments.length > 0) {
      for (const rawAtt of item.rawAttachments) {
        const processed = await processTelegramAttachment(
          rawAtt.fileId,
          rawAtt.type,
          item.activeKey.userId,
          rawAtt.fileName,
          rawAtt.mimeType,
          rawAtt.sizeBytes
        );
        processedAttachments.push(processed);
      }
    }

    // 2. Deteksi kredensial lokal (Local Privacy Shield)
    const credCheck = detectLocalCredential(mergedText);

    if (credCheck.isCredential) {
      // Alur Khusus Kredensial:
      // Simpan dengan category = 'credential', isProcessed = true, ZERO AI eksternal
      await db.insert(notes).values({
        id: noteId,
        userId: item.activeKey.userId,
        content: mergedText,
        category: 'credential',
        specificTags: credCheck.tags,
        attachments: processedAttachments,
        source: 'telegram',
        isProcessed: true,
        createdAt: item.createdAt,
      });

      // Update monthly notes usage (+1)
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

      // Kirim notifikasi tips keamanan Telegram (security_tip)
      await sendTelegramMessage(
        chatId,
        getTelegramMsg('security_tip', item.locale),
        { parse_mode: 'Markdown' }
      );
    } else {
      // Alur Catatan Umum (Deferred Batch Organization):
      // Simpan dengan status isProcessed = false, category = 'others', specificTags = []
      await db.insert(notes).values({
        id: noteId,
        userId: item.activeKey.userId,
        content: mergedText,
        category: 'others',
        specificTags: [],
        attachments: processedAttachments,
        source: 'telegram',
        isProcessed: false,
        createdAt: item.createdAt,
      });

      // Update monthly notes usage (+1)
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

      // Update cache counter catatan unorganized pengguna (unorganized_count:{userId} += 1)
      await incrementUnorganizedCount(item.activeKey.userId, 1);

      // SILENT CAPTURE (NO SPAM): Tetap hening tanpa respon teks chat
    }

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
  items: Array<{
    content: string;
    createdAt: Date;
    category: string;
    specificTags?: string[] | null;
    isPinned?: boolean;
    isProcessed?: boolean;
    attachments?: Array<{ type: 'image' | 'file'; [key: string]: any }> | null;
  }>,
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
    text += locale === 'en' ? '_No notes found._' : '_Belum ada catatan._';
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

    let attachIcon = '';
    if (n.attachments && Array.isArray(n.attachments) && n.attachments.length > 0) {
      const hasImg = n.attachments.some((a) => a.type === 'image');
      attachIcon = hasImg ? ' 🖼️' : ' 📎';
    }

    const unorgBadge = n.isProcessed === false ? ' [unorganized]' : '';

    group.snippets.push(`(${noteIndex}) ${pinIcon}${attachIcon} ${snippet}${unorgBadge}`);
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

export const ALL_CATEGORIES = [
  { key: 'finance', label: '💰 Finance' },
  { key: 'todo', label: '📋 Todo' },
  { key: 'schedule', label: '📅 Schedule' },
  { key: 'bookmark', label: '📎 Bookmark' },
  { key: 'credential', label: '🔐 Credential' },
  { key: 'reference', label: '📚 Reference' },
  { key: 'draft', label: '📝 Draft' },
  { key: 'random-yap', label: '💬 Random-yap' },
  { key: 'others', label: 'Others' },
];

/**
 * Builds Telegram Inline Keyboard for categories with at least 1 note.
 */
export function buildCategoriesGridKeyboard(availableCategories?: Set<string>, _unorganizedCount: number = 0) {
  const categoriesToDisplay = availableCategories
    ? ALL_CATEGORIES.filter((c) => availableCategories.has(c.key))
    : ALL_CATEGORIES;

  const rows: Array<Array<{ text: string; callback_data: string }>> = [];

  if (categoriesToDisplay.length > 0) {
    const chunkSize = categoriesToDisplay.length <= 4 ? 2 : 3;
    for (let i = 0; i < categoriesToDisplay.length; i += chunkSize) {
      rows.push(
        categoriesToDisplay.slice(i, i + chunkSize).map((cat) => ({
          text: cat.label,
          callback_data: `page:tags:${cat.key}:1`,
        }))
      );
    }
  }

  if (rows.length === 0) return undefined;

  return {
    inline_keyboard: rows,
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
 * Fetches data for the 2 horizontal lines of /tags (Teraktif & Terakhir)
 * and collects existing categories with >= 1 note.
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
  const existingCategories = new Set<string>();

  for (const n of userNotes) {
    if (n.category && typeof n.category === 'string' && n.category.trim()) {
      existingCategories.add(n.category.trim().toLowerCase());
    }

    // Hitung jumlah catatan unik per tag (1 catatan = 1 vote per tag)
    const noteTags = new Set<string>();
    if (Array.isArray(n.specificTags) && n.specificTags.length > 0) {
      for (const rawTag of n.specificTags) {
        if (rawTag && typeof rawTag === 'string' && rawTag.trim()) {
          noteTags.add(rawTag.trim().toLowerCase());
        }
      }
    } else if (n.category && typeof n.category === 'string' && n.category.trim()) {
      noteTags.add(n.category.trim().toLowerCase());
    }

    for (const t of noteTags) {
      tagFreq.set(t, (tagFreq.get(t) || 0) + 1);
    }
  }

  // 1. Teraktif: Top 15 tag dengan jumlah catatan terbanyak di database
  const activeTagsSlice = Array.from(tagFreq.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 15)
    .map(([t]) => t);

  const seenTags = new Set<string>();
  const numberToTagMap = new Map<number, string>();
  let currentNumber = 1;

  const activeNumbered: string[] = [];
  for (const t of activeTagsSlice) {
    seenTags.add(t);
    const num = currentNumber++;
    numberToTagMap.set(num, t);
    activeNumbered.push(`(${num})${escapeHtml(t)}`);
  }

  // 2. Terakhir: Main tag dari 15 catatan terakhir dikirim / dirapikan
  // Ambil hanya main tag (specificTags[0] atau fallback category) dari 15 catatan terbaru
  const recentNumbered: string[] = [];
  const recentNotesSlice = userNotes.slice(0, 15);

  for (const n of recentNotesSlice) {
    let mainTag: string | null = null;
    if (Array.isArray(n.specificTags) && n.specificTags.length > 0) {
      for (const st of n.specificTags) {
        if (st && typeof st === 'string' && st.trim()) {
          mainTag = st.trim().toLowerCase();
          break;
        }
      }
    }
    if (!mainTag && n.category && typeof n.category === 'string' && n.category.trim()) {
      mainTag = n.category.trim().toLowerCase();
    }

    if (mainTag && !seenTags.has(mainTag)) {
      seenTags.add(mainTag);
      const num = currentNumber++;
      numberToTagMap.set(num, mainTag);
      recentNumbered.push(`(${num})${escapeHtml(mainTag)}`);
    }
  }

  return {
    hasNotes: userNotes.length > 0,
    activeTagsText: formatTagNumberedHorizontal(activeNumbered),
    recentTagsText: formatTagNumberedHorizontal(recentNumbered),
    existingCategories,
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
export const noteNavMap = new Map<string, { type: 'tags' | 'search' | 'pin' | 'read'; queryVal: string; page: number }>();

/**
 * In-memory session state for active note snippets list on a chat.
 * Used for direct number input shortcut to open note detail.
 */
export const noteListSessionMap = new Map<
  string,
  {
    items: Array<{ id: string; content: string }>;
    type: 'tags' | 'search' | 'pin' | 'read';
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
  type: 'tags' | 'search' | 'pin' | 'read',
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

  // Kirim lampiran foto/file jika ada (sendPhoto / sendDocument)
  if (note.attachments && Array.isArray(note.attachments) && note.attachments.length > 0) {
    for (const att of note.attachments) {
      const fileTarget = att.fileId || att.localPath;
      if (fileTarget) {
        if (att.type === 'image') {
          await sendTelegramPhoto(chatId, fileTarget);
        } else {
          await sendTelegramDocument(chatId, fileTarget);
        }
      }
    }
  }

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

  const detailText = `${pinIcon}\n${note.content.trim()}\n\n\n${dateTimeStr}\nTags: ${tagsStr}`;

  // Action Buttons: pin (⭐), lepas pin (no emoji), salin (no emoji), hapus (no emoji)
  const pinText = note.isPinned ? 'Lepas Pin' : '⭐ Pin';
  const rawPinCb = `note:pin:${note.id}:${type}:${queryVal}:${currentPage}`;
  const pinCb = rawPinCb.length <= 64 ? rawPinCb : `note:pin:${note.id}`;

  const rawDelCb = `note:delete_confirm:${note.id}:${type}:${queryVal}:${currentPage}`;
  const delCb = rawDelCb.length <= 64 ? rawDelCb : `note:delete_confirm:${note.id}`;

  // Telegram copy_text is strictly limited to 1-256 characters. For longer notes, use callback_data fallback.
  const copyButton =
    note.content.length <= 256
      ? {
          text: 'Salin',
          copy_text: { text: note.content },
        }
      : {
          text: 'Salin',
          callback_data: `note:copy:${note.id}`,
        };

  const detailKeyboard = {
    inline_keyboard: [
      [
        {
          text: pinText,
          callback_data: pinCb,
        },
        copyButton,
        {
          text: 'Hapus',
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

  if (messageId && detailText.length <= 4000) {
    const edited = await editTelegramMessage(chatId, messageId, detailText, {
      reply_markup: detailKeyboard,
    });
    if (!edited) {
      await sendTelegramMessage(chatId, detailText, {
        reply_markup: detailKeyboard,
      });
    }
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
  type: 'tags' | 'search' | 'pin' | 'read',
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
  if (type === 'tags' || type === 'pin' || type === 'read') {
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
 * Handles /read command and dock menu '📖 Read':
 * Displays up to 27 latest notes across all categories using pagination (PAGE_SIZE = 9, up to 3 pages).
 */
export async function handleReadCommand(
  chatId: string,
  userId: string,
  page: number = 1,
  activeLocale: SupportedLocale = 'id',
  messageId?: number
): Promise<TelegramProcessResult> {
  const MAX_READ_NOTES = 27;

  // Query total non-encrypted notes count for this user
  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notes)
    .where(and(eq(notes.userId, userId), eq(notes.isEncrypted, false)));

  const totalInDb = Number(countResult?.count || 0);
  const totalCount = Math.min(totalInDb, MAX_READ_NOTES);

  if (totalCount === 0) {
    const emptyMsg = getTelegramMsg('read_empty', activeLocale);
    if (messageId) {
      await editTelegramMessage(chatId, messageId, emptyMsg);
    } else {
      await sendTelegramMessage(chatId, emptyMsg, { reply_markup: PERSISTENT_DOCK_KEYBOARD });
    }
    return { ok: true, action: 'read_empty' };
  }

  const totalPages = Math.min(3, Math.max(1, Math.ceil(totalCount / PAGE_SIZE)));
  const validPage = Math.min(Math.max(1, page), totalPages);
  const offset = (validPage - 1) * PAGE_SIZE;
  const limitForPage = Math.min(PAGE_SIZE, totalCount - offset);

  const pageNotes = await db
    .select()
    .from(notes)
    .where(and(eq(notes.userId, userId), eq(notes.isEncrypted, false)))
    .orderBy(desc(notes.createdAt))
    .limit(limitForPage)
    .offset(offset);

  const headerTitle = getTelegramMsg('read_header', activeLocale);
  const reply = formatSnippetPage(pageNotes, totalCount, validPage, PAGE_SIZE, headerTitle, activeLocale);
  const keyboard = buildPaginationKeyboard('read', 'all', validPage, totalPages, pageNotes);

  noteListSessionMap.set(chatId, {
    items: pageNotes.map((n) => ({ id: n.id, content: n.content })),
    type: 'read',
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

  return { ok: true, action: 'read_list', page: validPage, totalCount };
}

/**
 * Handles /dashboard command and dock menu '🌐 Dashboard': sends prompt with web link.
 */
export async function handleDashboardCommand(
  chatId: string,
  activeLocale: SupportedLocale = 'id'
): Promise<TelegramProcessResult> {
  const dashboardUrl = getWebDashboardUrl(true);
  const msg = getTelegramMsg('dashboard_prompt', activeLocale);
  const buttonText = activeLocale === 'id' ? '🚀 Buka Web Dashboard' : '🚀 Open Web Dashboard';
  const keyboard = {
    inline_keyboard: [
      [{ text: buttonText, url: dashboardUrl }]
    ]
  };

  await sendTelegramMessage(chatId, msg, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });

  return { ok: true, action: 'dashboard_opened' };
}

export const syncCooldownMap = new Map<string, number>();
export const syncInProgressSet = new Set<string>();
export const SYNC_COOLDOWN_MS = 10000;

/**
 * Handles /sync, /organize, /rapikan or dock menu '🔄 Sync' trigger
 */
export async function handleSyncCommand(
  chatId: string,
  userId: string,
  activeLocale: SupportedLocale = 'id'
): Promise<TelegramProcessResult> {
  // Anti-Spam: Cek cooldown 10 detik
  const lastSync = syncCooldownMap.get(userId) || 0;
  const elapsed = Date.now() - lastSync;
  if (elapsed < SYNC_COOLDOWN_MS) {
    const cooldownMsg = getTelegramMsg('sync_cooldown', activeLocale);

    await sendTelegramMessage(chatId, cooldownMsg, {
      parse_mode: 'Markdown',
      reply_markup: PERSISTENT_DOCK_KEYBOARD,
    });
    return { ok: true, action: 'sync_cooldown' };
  }

  // Anti-Spam: Cek apakah proses sinkronisasi sedang berjalan untuk user/chat ini
  if (syncInProgressSet.has(userId) || syncInProgressSet.has(chatId)) {
    const inProgressMsg = getTelegramMsg('sync_lock_active', activeLocale);

    await sendTelegramMessage(chatId, inProgressMsg, {
      parse_mode: 'Markdown',
      reply_markup: PERSISTENT_DOCK_KEYBOARD,
    });
    return { ok: true, action: 'sync_in_progress' };
  }

  try {
    // 1. Flush any pending debounced messages for this user first
    if (debounceMap.has(chatId)) {
      await flushDebounceBuffer(chatId);
    }

    // 2. Cek DB: apa ada catatan yang belum dirapikan (is_processed = false)
    const [dbResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notes)
      .where(and(eq(notes.userId, userId), eq(notes.isProcessed, false)));

    const dbUnorganizedCount = Number(dbResult?.count || 0);

    // 3. Rekonsiliasi Cache dengan DB (sinkronisasi cache agar tidak ada deviasi)
    setUnorganizedCountCache(userId, dbUnorganizedCount);

    // Refresh user tags cache dari DB
    const userNotes = await db.query.notes.findMany({
      where: eq(notes.userId, userId),
      columns: { specificTags: true },
    });
    const freshUserTags = Array.from(new Set(userNotes.flatMap((n) => n.specificTags || [])));
    setUserTagsCache(userId, freshUserTags);

    // 4. Jika tidak ada catatan baru: langsung respon instan "Belum ada catatan baru!"
    if (dbUnorganizedCount === 0) {
      syncCooldownMap.set(userId, Date.now());
      const emptyMsg = getTelegramMsg('sync_empty', activeLocale);

      await sendTelegramMessage(chatId, emptyMsg, {
        parse_mode: 'Markdown',
        reply_markup: PERSISTENT_DOCK_KEYBOARD,
      });

      return { ok: true, action: 'sync_empty', count: 0 };
    }

    // 5. Ada catatan baru: Jalankan Background Non-Blocking Sync!
    syncCooldownMap.set(userId, Date.now());
    syncInProgressSet.add(userId);
    syncInProgressSet.add(chatId);

    // Respons instan (<200ms) tanpa memblokir interaksi user
    const startedMsg = getTelegramMsg('sync_started', activeLocale, { count: dbUnorganizedCount });
    await sendTelegramMessage(chatId, startedMsg, {
      parse_mode: 'Markdown',
      reply_markup: PERSISTENT_DOCK_KEYBOARD,
    });

    // Tampilkan indikator native "typing" di header Telegram
    try {
      await bot.api.sendChatAction(chatId, 'typing');
    } catch {}

    // Jalankan proses AI di latar belakang secara asynchronous
    (async () => {
      try {
        await organizeUserNotes(userId);

        // Pastikan cache ter-update dan counter di-reset ke 0
        resetUnorganizedCount(userId);
        invalidateUserTagsCache(userId);

        // Kirim konfirmasi penyelesaian singkat
        const successMsg = getTelegramMsg('sync_completed', activeLocale);
        await sendTelegramMessage(chatId, successMsg, {
          parse_mode: 'Markdown',
          reply_markup: PERSISTENT_DOCK_KEYBOARD,
        });
      } catch (err) {
        console.error(`[Background Sync Error] User ${userId}:`, err);
        const failMsg = getTelegramMsg('sync_failed', activeLocale);
        await sendTelegramMessage(chatId, failMsg, {
          parse_mode: 'Markdown',
          reply_markup: PERSISTENT_DOCK_KEYBOARD,
        });
      } finally {
        syncInProgressSet.delete(userId);
        syncInProgressSet.delete(chatId);
      }
    })();

    return { ok: true, action: 'sync_started', count: dbUnorganizedCount };
  } catch (err) {
    console.error(`[Sync Trigger Error] User ${userId}:`, err);
    syncInProgressSet.delete(userId);
    syncInProgressSet.delete(chatId);
    const failMsg = getTelegramMsg('sync_failed', activeLocale);
    await sendTelegramMessage(chatId, failMsg, {
      parse_mode: 'Markdown',
      reply_markup: PERSISTENT_DOCK_KEYBOARD,
    });
    return { ok: false, error: 'sync_failed' };
  }
}

export const handleOrganizeCommand = handleSyncCommand;

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

  // 1a. Deteksi file media yang tidak didukung (video, voice, audio, video_note, sticker, animation)
  const isUnsupportedMedia = Boolean(
    message.video ||
    message.voice ||
    message.audio ||
    message.video_note ||
    message.sticker ||
    message.animation
  );

  if (isUnsupportedMedia) {
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

  // 1b. Deteksi lampiran multimedia yang didukung (foto dan dokumen)
  const isSupportedMedia = Boolean(
    (message.photo && message.photo.length > 0) ||
    message.document
  );

  if (isSupportedMedia) {
    const [existingKey] = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.telegramChatId, chatId), eq(apiKeys.isActive, true)))
      .limit(1);

    if (!existingKey) {
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
      .where(eq(users.id, existingKey.userId))
      .limit(1);

    const activeLocale = detectTelegramLocale(message, matchedUser?.preferredLocale);

    const quotaInfo = await checkUserQuotaAndTier(existingKey.userId);
    if (!quotaInfo.allowed) {
      const quotaMsg = getTelegramQuotaExceededMessage(process.env.BETTER_AUTH_URL, activeLocale);
      await sendTelegramMessage(chatId, quotaMsg.text, {
        parse_mode: 'Markdown',
        reply_markup: quotaMsg.replyMarkup,
      });
      return { ok: false, error: 'monthly_quota_exceeded' };
    }

    const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB limit
    let rawAtt: RawAttachmentInput;

    if (message.photo && message.photo.length > 0) {
      const photoItem = message.photo[message.photo.length - 1];
      const fileSize = photoItem.file_size || 0;
      if (fileSize > MAX_FILE_SIZE) {
        await sendTelegramMessage(chatId, getTelegramMsg('media_size_exceeded', activeLocale), {
          reply_markup: PERSISTENT_DOCK_KEYBOARD,
        });
        return { ok: false, error: 'media_size_exceeded' };
      }
      rawAtt = {
        fileId: photoItem.file_id,
        type: 'image',
        sizeBytes: fileSize,
      };
    } else {
      const doc = message.document;
      const fileSize = doc.file_size || 0;
      if (fileSize > MAX_FILE_SIZE) {
        await sendTelegramMessage(chatId, getTelegramMsg('media_size_exceeded', activeLocale), {
          reply_markup: PERSISTENT_DOCK_KEYBOARD,
        });
        return { ok: false, error: 'media_size_exceeded' };
      }
      const isImageMime = doc.mime_type?.startsWith('image/');
      rawAtt = {
        fileId: doc.file_id,
        type: isImageMime ? 'image' : 'file',
        fileName: doc.file_name,
        mimeType: doc.mime_type,
        sizeBytes: fileSize,
      };
    }

    const captionText = (message.caption || '').trim();
    // Jika pesan tunggal tanpa caption teks (dan bukan bagian media group album), tolak langsung
    if (!message.media_group_id && !captionText) {
      await sendTelegramMessage(chatId, getTelegramMsg('media_missing_caption', activeLocale), {
        reply_markup: PERSISTENT_DOCK_KEYBOARD,
      });
      return { ok: false, error: 'media_missing_caption' };
    }

    // Buffer ke debounceMap (mendukung album / multi-media grouping)
    if (debounceMap.has(chatId)) {
      const existing = debounceMap.get(chatId)!;
      clearTimeout(existing.timer);
      if (captionText) {
        existing.messages.push(captionText);
      }
      if (!existing.rawAttachments) {
        existing.rawAttachments = [];
      }
      existing.rawAttachments.push(rawAtt);
      existing.hasMedia = true;
      existing.locale = activeLocale;
      existing.timer = setTimeout(() => {
        flushDebounceBuffer(chatId).catch((err) =>
          console.error('[Debounce Auto Flush Error]:', err)
        );
      }, DEBOUNCE_DELAY_MS);

      return {
        ok: true,
        action: 'buffered_media',
        noteId: existing.noteId,
        bufferedCount: existing.messages.length,
      };
    }

    const noteId = crypto.randomUUID();
    const messages = captionText ? [captionText] : [];
    const timer = setTimeout(() => {
      flushDebounceBuffer(chatId).catch((err) =>
        console.error('[Debounce Auto Flush Error]:', err)
      );
    }, DEBOUNCE_DELAY_MS);

    debounceMap.set(chatId, {
      timer,
      messages,
      activeKey: existingKey,
      chatId,
      noteId,
      createdAt: new Date(),
      tier: quotaInfo.isPro ? 'pro' : 'free',
      locale: activeLocale,
      rawAttachments: [rawAtt],
      mediaGroupId: message.media_group_id,
      hasMedia: true,
    });

    return {
      ok: true,
      action: 'buffered_media',
      noteId,
      bufferedCount: messages.length,
    };
  }

  const rawText: string | undefined = message.text || message.caption;

  if (!rawText || !rawText.trim()) {
    return { ok: true, ignored: 'empty_text' };
  }

  const text = rawText.trim();

  // Jika input adalah command bot ('/') atau aksi tombol dock, pastikan catatan di debounce buffer disimpan terlebih dahulu
  const isDockAction = text === '📖 Read' || text === '🏷 Tags' || text === '⭐️ Pin' || text === '⭐ Pin' || text === '🔄 Sync' || text === 'Sync' || text === '❌ Tutup Menu';
  if (text.startsWith('/') || isDockAction) {
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
        const welcomeMsg = getTelegramMsg('welcome_connected_brief', activeLocale, {
          userName,
          dashboardUrl: getWebDashboardUrl(),
        });
        await sendTelegramMessage(chatId, welcomeMsg, {
          parse_mode: 'Markdown',
          reply_markup: PERSISTENT_DOCK_KEYBOARD,
        });
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

    const helpMsg = getTelegramMsg('help', activeLocale, {
      dashboardUrl: getWebDashboardUrl(),
    });
    await sendTelegramMessage(chatId, helpMsg, {
      parse_mode: 'Markdown',
      reply_markup: PERSISTENT_DOCK_KEYBOARD,
    });
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
    await sendTelegramMessage(
      chatId,
      getTelegramMsg('welcome_connected', activeLocale, {
        userName,
        dashboardUrl: getWebDashboardUrl(),
      }),
      {
        parse_mode: 'Markdown',
        reply_markup: PERSISTENT_DOCK_KEYBOARD,
      }
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

  // 3b. Tutup Keyboard Menu (/close, /hide, /reset, atau tombol '❌ Tutup Menu')
  if (
    text === '❌ Tutup Menu' ||
    text === '/close' ||
    text === '/hide' ||
    text === '/reset' ||
    /^(\/(close|hide|reset))(@[a-zA-Z0-9_]+)?$/.test(text)
  ) {
    await sendTelegramMessage(
      chatId,
      '👌 Menu dock ditutup. Ketik /help atau /start kapan saja untuk memunculkan kembali.',
      {
        reply_markup: {
          remove_keyboard: true,
        },
      }
    );
    return { ok: true, action: 'keyboard_closed' };
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

  // 5. /tags (tanpa argumen) atau tombol dock '🏷 Tags'
  if (text === '/tags' || /^(\/tags)(@[a-zA-Z0-9_]+)?$/.test(text) || text === '🏷 Tags') {
    const overview = await getTagsOverviewData(activeKey.userId);
    const unorganizedCount = await getOrFetchUnorganizedCount(activeKey.userId);

    if (!overview.hasNotes && unorganizedCount === 0) {
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
    });

    const keyboard = buildCategoriesGridKeyboard(overview.existingCategories, unorganizedCount);

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

  // 6b. /pin atau tombol dock '⭐️ Pin' / '⭐ Pin'
  if (text === '/pin' || /^(\/pin)(@[a-zA-Z0-9_]+)?$/.test(text) || text === '⭐️ Pin' || text === '⭐ Pin') {
    return await handlePinList(chatId, activeKey.userId, 1, activeLocale);
  }

  // 6b2. /read atau tombol dock '📖 Read'
  if (text === '/read' || /^(\/read)(@[a-zA-Z0-9_]+)?$/.test(text) || text === '📖 Read') {
    return await handleReadCommand(chatId, activeKey.userId, 1, activeLocale);
  }

  // 6c. /dashboard
  if (text === '/dashboard' || /^(\/dashboard)(@[a-zA-Z0-9_]+)?$/.test(text)) {
    return await handleDashboardCommand(chatId, activeLocale);
  }

  // 6d. /sync atau /organize atau /rapikan atau tombol dock '🔄 Sync' / 'Sync'
  if (
    text === '🔄 Sync' ||
    text === 'Sync' ||
    /^\/?(sync|organize|rapikan)\b/i.test(text) ||
    text.startsWith('🪄 Organize') ||
    text.startsWith('🪄 Rapikan')
  ) {
    return await handleSyncCommand(chatId, activeKey.userId, activeLocale);
  }

  // 6e. /dock atau /menu (Refresh dock keyboard)
  if (text === '/dock' || text === '/menu') {
    await sendTelegramMessage(chatId, activeLocale === 'id' ? 'Menu dock telah disegarkan.' : 'Dock menu refreshed.', {
      reply_markup: PERSISTENT_DOCK_KEYBOARD,
    });
    return { ok: true, action: 'dock_refreshed' };
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

    const loadingResult = await sendTelegramMessageWithId(chatId, getTelegramMsg('ask_analyzing', activeLocale));
    const loadingMsgId = loadingResult.messageId;

    (async () => {
      try {
        const answer = await answerNoteQuestion(activeKey.userId, question);
        await sendTelegramMessage(chatId, getTelegramMsg('ask_answer_header', activeLocale, { answer }), {
          parse_mode: 'Markdown',
        });
        if (loadingMsgId) {
          await deleteTelegramMessage(chatId, loadingMsgId);
        }
      } catch (err) {
        console.error('[Telegram /ask Background] Error answering question:', err);
        await sendTelegramMessage(chatId, getTelegramMsg('ask_failed', activeLocale), {
          parse_mode: 'Markdown',
        });
        if (loadingMsgId) {
          await deleteTelegramMessage(chatId, loadingMsgId);
        }
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
      isProcessed: true,
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

  // 10b. Invalid Command Guard (pesan berawalan '/' tanpa command yang cocok)
  if (text.startsWith('/')) {
    await sendTelegramMessage(chatId, getTelegramMsg('invalid_command', activeLocale), {
      reply_markup: PERSISTENT_DOCK_KEYBOARD,
    });
    return { ok: true, action: 'invalid_command' };
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
    const type = (parts[3] as 'tags' | 'search' | 'pin' | 'read') || nav?.type || 'tags';
    const pageNum = parseInt(parts[parts.length - 1], 10) || nav?.page || 1;
    let queryVal = parts.length > 5 ? parts.slice(4, parts.length - 1).join(':') : (nav?.queryVal || '');

    const res = await displayNoteDetail(chatId, messageId, noteId, type, queryVal, pageNum);
    await answerTelegramCallbackQuery(callbackId);
    return res;
  }

  // 1c2. Salin Teks Catatan Panjang: note:copy:<noteId>
  if (data.startsWith('note:copy:')) {
    const parts = data.split(':');
    const noteId = parts[2];
    const [note] = await db
      .select()
      .from(notes)
      .where(eq(notes.id, noteId))
      .limit(1);

    if (note) {
      await sendTelegramMessage(chatId, note.content);
      await answerTelegramCallbackQuery(callbackId, {
        text: 'Catatan dikirim ke chat agar bisa disalin.',
      });
    } else {
      await answerTelegramCallbackQuery(callbackId, {
        text: 'Catatan tidak ditemukan.',
      });
    }
    return { ok: true, action: 'note_copied', noteId };
  }

  // 1d. Toggle Pin Catatan: note:pin:<noteId>:<type>:<queryVal>:<page>
  if (data.startsWith('note:pin:')) {
    const parts = data.split(':');
    const noteId = parts[2];
    const nav = noteNavMap.get(noteId);
    const type = (parts[3] as 'tags' | 'search' | 'pin' | 'read') || nav?.type || 'tags';
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
    const type = (parts[3] as 'tags' | 'search' | 'pin' | 'read') || nav?.type || 'tags';
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
    const type = (parts[3] as 'tags' | 'search' | 'pin' | 'read') || nav?.type || 'tags';
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

  // 1h. Pagination untuk /read: page:read:<queryVal>:<page_num>
  if (data.startsWith('page:read:')) {
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

    const res = await handleReadCommand(chatId, activeKey.userId, pageNum, activeLocale, messageId);
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
    const unorganizedCount = await getOrFetchUnorganizedCount(activeKey.userId);

    // Perbarui session state nomor tag untuk chatId ini
    tagSessionMap.set(chatId, {
      tags: overview.numberToTagMap,
      expiresAt: Date.now() + TAG_SESSION_TTL_MS,
    });

    const msg = getTelegramMsg('tags_header', activeLocale, {
      activeTagsText: overview.activeTagsText,
      recentTagsText: overview.recentTagsText,
    });

    const keyboard = buildCategoriesGridKeyboard(overview.existingCategories, unorganizedCount);

    if (messageId) {
      await editTelegramMessage(chatId, messageId, msg, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
    }

    await answerTelegramCallbackQuery(callbackId);
    return { ok: true, action: 'callback_menu_tags' };
  }

  // 1c. Trigger Sync / Organize from Inline Keyboard: organize:run / sync:run
  if (data === 'organize:run' || data === 'sync:run') {
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

    await answerTelegramCallbackQuery(callbackId, {
      text: activeLocale === 'en' ? 'Syncing...' : 'Menyinkronkan...',
    });

    return await handleSyncCommand(chatId, activeKey.userId, activeLocale);
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
