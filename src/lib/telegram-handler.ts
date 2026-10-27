import { db } from '@/db';
import { users, apiKeys, notes } from '@/db/schema';
import { eq, ne, and, or, desc, sql, ilike } from 'drizzle-orm';
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
import { enrichNoteBookmarkAsync } from '@/lib/link-enricher';
import { normalizeTag, generateNoteTags } from '@/lib/ai';
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
import {
  getOrFetchUnorganizedCount,
  incrementUnorganizedCount,
  setUnorganizedCountCache,
  setUserTagsCache,
  resetUnorganizedCount,
  invalidateUserTagsCache,
} from '@/lib/cache';
import { organizeUserNotes } from '@/lib/ai/batch-organizer';

export const PAGE_SIZE = 10;
export const DEBOUNCE_DELAY_MS = 3000;

export const START_HELP_MENU_KEYBOARD = {
  inline_keyboard: [
    [
      { text: '📖 Read', callback_data: 'menu:read' },
      { text: '📋 Review', callback_data: 'menu:review' },
    ],
    [
      { text: '🏷 Tags', callback_data: 'menu:tags' },
      { text: '⭐️ Pin', callback_data: 'menu:pin' },
    ],
  ],
};

export const REMOVE_DOCK_KEYBOARD = {
  remove_keyboard: true as const,
};

export const PERSISTENT_DOCK_KEYBOARD = REMOVE_DOCK_KEYBOARD;

export function getDockKeyboard(_unorganizedCount: number = 0) {
  return REMOVE_DOCK_KEYBOARD;
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

    // 2. Alur Catatan (Deferred Batch Organization):
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

    // Background async link metadata enrichment (Fire & Forget, zero latency)
    enrichNoteBookmarkAsync(noteId, mergedText).catch((err) =>
      console.error('[Async Telegram Bookmark Enrichment Error]:', err)
    );

    // SILENT CAPTURE (NO SPAM): Tetap hening tanpa respon teks chat

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
    id?: string;
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
  locale: SupportedLocale = 'id',
  options: { showDates?: boolean } = {}
): string {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const pageInfo = getTelegramMsg('snippet_page_info', locale, { page, totalPages, totalCount });
  let text = `${headerTitle} ${pageInfo}\n\n`;

  if (items.length === 0) {
    text += locale === 'en' ? '_No notes found._' : '_Belum ada catatan._';
    return text.trim();
  }

  const defaultTitle = getTelegramMsg('default_note_title', locale);
  const showDates = options.showDates ?? false;

  if (!showDates) {
    const snippets: string[] = [];
    let noteIndex = 1;
    for (const n of items) {
      const rawClean = n.content.replace(/\s+/g, ' ').trim();
      const clean = rawClean || defaultTitle;
      const snippet = clean.length > 140 ? `${clean.slice(0, 140)}...` : clean;
      const pinIcon = n.isPinned ? '📌⭐️' : '📌';

      let attachIcon = '';
      if (n.attachments && Array.isArray(n.attachments) && n.attachments.length > 0) {
        const hasImg = n.attachments.some((a) => a.type === 'image');
        attachIcon = hasImg ? '🖼️' : '📎';
      }

      snippets.push(`(${noteIndex}) ${pinIcon}${attachIcon} ${snippet}`);
      noteIndex++;
    }

    const groups: string[][] = [];
    for (let i = 0; i < snippets.length; i += 5) {
      groups.push(snippets.slice(i, i + 5));
    }

    text += '\n' + groups.map((g) => g.join('\n')).join('\n\n');
    return text.trim();
  }

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
      attachIcon = hasImg ? '🖼️' : '📎';
    }

    group.snippets.push(`(${noteIndex}) ${pinIcon}${attachIcon} ${snippet}`);
    noteIndex++;
  }

  const groupBlocks: string[] = [];
  for (const [, group] of groupsMap) {
    const dateStr = format(group.date, 'EEE, dd/MM');
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
];

/**
 * Builds Telegram Inline Keyboard for categories with at least 1 note.
 */
export function buildCategoriesGridKeyboard(
  availableCategories?: Set<string>,
  hasVaultNotes: boolean = false
) {
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];

  if (availableCategories !== undefined) {
    const filtered = ALL_CATEGORIES.filter((c) => c.key !== 'others' && availableCategories.has(c.key));
    const buttons: Array<{ text: string; callback_data: string }> = filtered.map((cat) => ({
      text: cat.label,
      callback_data: `page:tags:${cat.key}:1`,
    }));

    if (hasVaultNotes) {
      buttons.push({ text: '🔑 Vault', callback_data: 'menu:vault' });
    }

    if (buttons.length === 0) return undefined;

    const chunkSize = buttons.length <= 4 ? 2 : 3;
    for (let i = 0; i < buttons.length; i += chunkSize) {
      rows.push(buttons.slice(i, i + chunkSize));
    }
  } else {
    // Fallback when called without arguments
    rows.push(
      [
        { text: '💰 Finance', callback_data: 'page:tags:finance:1' },
        { text: '📋 Todo', callback_data: 'page:tags:todo:1' },
        { text: '📅 Schedule', callback_data: 'page:tags:schedule:1' },
      ],
      [
        { text: '📎 Bookmark', callback_data: 'page:tags:bookmark:1' },
        { text: '🔐 Credential', callback_data: 'page:tags:credential:1' },
        { text: '📚 Reference', callback_data: 'page:tags:reference:1' },
      ],
      [
        { text: '📝 Draft', callback_data: 'page:tags:draft:1' },
        { text: '💬 Random-yap', callback_data: 'page:tags:random-yap:1' },
        { text: '🔑 Vault', callback_data: 'menu:vault' },
      ]
    );
  }

  // Tombol navigasi kembali ke Menu Start
  rows.push([{ text: '◀️ Kembali', callback_data: 'menu:start' }]);

  return { inline_keyboard: rows };
}


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
      id: notes.id,
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

  const existingCategories = new Set<string>();
  const seenTags = new Set<string>();
  const numberToTagMap = new Map<number, string>();
  const latestNumbered: string[] = [];
  let currentNumber = 1;

  for (const n of userNotes) {
    if (n.category && typeof n.category === 'string' && n.category.trim()) {
      const catLower = n.category.trim().toLowerCase();
      if (catLower !== 'others') {
        existingCategories.add(catLower);
      }
    }

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
      const catLower = n.category.trim().toLowerCase();
      if (catLower !== 'others') {
        mainTag = catLower;
      }
    }

    if (mainTag && !seenTags.has(mainTag)) {
      seenTags.add(mainTag);
      const num = currentNumber++;
      numberToTagMap.set(num, mainTag);
      latestNumbered.push(`(${num})${escapeHtml(mainTag)}`);
      if (latestNumbered.length >= 12) {
        // Collect up to 12 latest tags
      }
    }
  }

  const latestTagsText = latestNumbered.length > 0 ? formatTagNumberedHorizontal(latestNumbered.slice(0, 12)) : '';

  const [vaultCheck] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notes)
    .where(and(eq(notes.userId, userId), eq(notes.isEncrypted, true)))
    .limit(1);
  const hasVaultNotes = Number(vaultCheck?.count || 0) > 0;

  return {
    hasNotes: userNotes.length > 0 || hasVaultNotes,
    hasTags: latestNumbered.length > 0,
    hasVaultNotes,
    latestTagsText,
    activeTagsText: latestTagsText,
    recentTagsText: latestTagsText,
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
    const backMarkup = {
      inline_keyboard: [[{ text: '🏷 Kembali ke Tags', callback_data: 'menu:tags' }]],
    };
    await sendTelegramMessage(chatId, getTelegramMsg('tags_none_found', activeLocale, { tag: targetTag }), {
      parse_mode: 'Markdown',
      reply_markup: backMarkup,
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
  const reply = formatSnippetPage(matchedNotes, totalCount, 1, PAGE_SIZE, headerTitle, activeLocale, { showDates: true });
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
export type NoteViewType = 'tags' | 'search' | 'pin' | 'read' | 'review';

export const noteNavMap = new Map<string, { type: NoteViewType; queryVal: string; page: number }>();

/**
 * In-memory session state for active note snippets list on a chat.
 * Used for direct number input shortcut to open note detail.
 */
export const noteListSessionMap = new Map<
  string,
  {
    items: Array<{ id: string; content: string }>;
    type: NoteViewType;
    queryVal: string;
    page: number;
    expiresAt: number;
  }
>();

/**
 * Formats note date and time to WIB (Asia/Jakarta): "EEE, dd/MM/yyyy • HH:mm WIB"
 */
export function formatNoteDateWib(date: Date): string {
  return `📅 ${format(date, 'EEE, dd/MM')}`;
}

/**
 * Renders full note content detail with metadata (WIB date, tags) and action buttons:
 * - Row 1: [ 📌 Pin ] / [ ⭐️ Lepas Pin ], [ 📋 Salin ], [ 🗑 Hapus ]
 * - Row 2: [ ⬅️ Kembali ke Daftar ], [ 🏷 Menu Tags ]
 */
export function buildNoteDetailKeyboard(
  note: {
    id: string;
    content: string;
    category?: string | null;
    isProcessed?: boolean;
    isPinned?: boolean;
    attachments?: Array<{ type: 'image' | 'file'; [key: string]: any }> | null;
  },
  type: NoteViewType,
  queryVal: string,
  currentPage: number
) {
  const pinText = note.isPinned ? 'Lepas Pin' : '⭐ Pin';
  const rawPinCb = `note:pin:${note.id}:${type}:${queryVal}:${currentPage}`;
  const pinCb = rawPinCb.length <= 64 ? rawPinCb : `note:pin:${note.id}`;

  const rawDelCb = `note:delete_confirm:${note.id}:${type}:${queryVal}:${currentPage}`;
  const delCb = rawDelCb.length <= 64 ? rawDelCb : `note:delete_confirm:${note.id}`;

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

  const attachmentCount = Array.isArray(note.attachments) ? note.attachments.length : 0;
  const mediaButtonRow =
    attachmentCount > 0
      ? [
          {
            text: attachmentCount > 1 ? `📥 File/Media (${attachmentCount})` : '📥 File/Media',
            callback_data: `note:media:${note.id}`,
          },
        ]
      : null;

  const isUnprocessed = !note.isProcessed;
  const syncAiRow = isUnprocessed
    ? [
        {
          text: '✨ Sync AI',
          callback_data: `note:sync_ai:${note.id}`,
        },
      ]
    : null;

  return {
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
      ...(syncAiRow ? [syncAiRow] : []),
      ...(mediaButtonRow ? [mediaButtonRow] : []),
      [
        {
          text: '⬅️ Kembali ke Daftar',
          callback_data: queryVal
            ? `page:${type}:${queryVal}:${currentPage}`
            : (type === 'tags' ? 'menu:tags' : (type === 'read' || type === 'pin' || type === 'review' ? `menu:${type}` : 'menu:start')),
        },
        {
          text: '🏷 Menu Tags',
          callback_data: 'menu:tags',
        },
      ],
    ],
  };
}

export async function displayNoteDetail(
  chatId: string,
  messageId: number | undefined,
  noteId: string,
  type: NoteViewType,
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

  const detailText = `${pinIcon}\n${note.content.trim()}\n\n\n${dateTimeStr}\nTags: ${tagsStr}`;

  const detailKeyboard = buildNoteDetailKeyboard(note, type, queryVal, currentPage);

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
  type: NoteViewType,
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
  if (type === 'review') {
    rows.push([
      {
        text: '🔄 Sync All',
        callback_data: 'review:sync_all',
      },
      {
        text: '◀️ Kembali',
        callback_data: 'menu:start',
      },
    ]);
  } else if (type === 'tags') {
    rows.push([
      {
        text: '🏷 Kembali ke Tags',
        callback_data: 'menu:tags',
      },
    ]);
  } else if (type === 'pin' || type === 'read' || type === 'search') {
    rows.push([
      {
        text: '◀️ Kembali',
        callback_data: 'menu:start',
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
        eq(notes.isEncrypted, false),
        eq(notes.isArchived, false)
      )
    );
  const totalCount = Number(countResult?.count || 0);

  if (totalCount === 0) {
    const emptyMsg = '📌 Anda belum memiliki catatan yang dipin. Buka detail catatan dan tekan tombol "📌 Pin" untuk menandainya.';
    const backMarkup = {
      inline_keyboard: [[{ text: '◀️ Kembali', callback_data: 'menu:start' }]],
    };
    if (messageId) {
      await editTelegramMessage(chatId, messageId, emptyMsg, { parse_mode: 'Markdown', reply_markup: backMarkup });
    } else {
      await sendTelegramMessage(chatId, emptyMsg, { parse_mode: 'Markdown', reply_markup: backMarkup });
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
  const reply = formatSnippetPage(pinnedNotes, totalCount, validPage, PAGE_SIZE, headerTitle, activeLocale, { showDates: false });
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
  const MAX_READ_NOTES = 30;

  // Query total non-encrypted notes count for this user
  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notes)
    .where(and(eq(notes.userId, userId), eq(notes.isEncrypted, false), eq(notes.isArchived, false)));

  const totalInDb = Number(countResult?.count || 0);
  const totalCount = Math.min(totalInDb, MAX_READ_NOTES);

  if (totalCount === 0) {
    const emptyMsg = getTelegramMsg('read_empty', activeLocale);
    const backMarkup = {
      inline_keyboard: [[{ text: '◀️ Kembali', callback_data: 'menu:start' }]],
    };
    if (messageId) {
      await editTelegramMessage(chatId, messageId, emptyMsg, { reply_markup: backMarkup });
    } else {
      await sendTelegramMessage(chatId, emptyMsg, { reply_markup: backMarkup });
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
    .where(and(eq(notes.userId, userId), eq(notes.isEncrypted, false), eq(notes.isArchived, false)))
    .orderBy(desc(notes.createdAt))
    .limit(limitForPage)
    .offset(offset);

  const headerTitle = getTelegramMsg('read_header', activeLocale);
  const reply = formatSnippetPage(pageNotes, totalCount, validPage, PAGE_SIZE, headerTitle, activeLocale, { showDates: false });
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
 * Handles /review command and callback 'menu:review':
 * Displays unorganized / others notes using pagination, with a 'Sync All' button.
 */
/**
 * Handles /vault command and menu:vault: lists vault keys or reveals secret.
 */
export async function handleVaultCommand(
  chatId: string,
  activeKey: typeof apiKeys.$inferSelect,
  activeLocale: SupportedLocale,
  vaultParam: string = ''
): Promise<TelegramProcessResult> {
  const quotaInfo = await checkUserQuotaAndTier(activeKey.userId);
  if (!quotaInfo.isPro) {
    const gated = getTelegramProGatedMessage(process.env.BETTER_AUTH_URL, activeLocale);
    await sendTelegramMessage(chatId, gated.text, {
      reply_markup: gated.replyMarkup,
    });
    return { ok: true, action: 'vault_requires_pro' };
  }

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
      const backMarkup = {
        inline_keyboard: [[{ text: '◀️ Kembali', callback_data: 'menu:start' }]],
      };
      await sendTelegramMessage(
        chatId,
        getTelegramMsg('vault_empty', activeLocale),
        { parse_mode: 'Markdown', reply_markup: backMarkup }
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
    const backMarkup = {
      inline_keyboard: [[{ text: '◀️ Kembali', callback_data: 'menu:start' }]],
    };
    await sendTelegramMessage(chatId, msg, { parse_mode: 'Markdown', reply_markup: backMarkup });
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
    const backMarkup = {
      inline_keyboard: [[{ text: '◀️ Kembali', callback_data: 'menu:start' }]],
    };
    await sendTelegramMessage(
      chatId,
      getTelegramMsg('vault_not_found', activeLocale, { keyword: cleanQuery }),
      { parse_mode: 'Markdown', reply_markup: backMarkup }
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

export async function handleReviewCommand(
  chatId: string,
  userId: string,
  page: number = 1,
  activeLocale: SupportedLocale = 'id',
  messageId?: number
): Promise<TelegramProcessResult> {
  const reviewCondition = and(
    eq(notes.userId, userId),
    eq(notes.isEncrypted, false),
    eq(notes.isArchived, false),
    or(
      eq(notes.isProcessed, false),
      eq(notes.category, 'others')
    )
  );

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notes)
    .where(reviewCondition);

  const totalCount = Number(countResult?.count || 0);

  if (totalCount === 0) {
    const emptyMsg = getTelegramMsg('review_empty', activeLocale);
    const backKeyboard = {
      inline_keyboard: [
        [
          {
            text: '◀️ Kembali',
            callback_data: 'menu:start',
          },
        ],
      ],
    };
    if (messageId) {
      await editTelegramMessage(chatId, messageId, emptyMsg, { parse_mode: 'Markdown', reply_markup: backKeyboard });
    } else {
      await sendTelegramMessage(chatId, emptyMsg, { parse_mode: 'Markdown', reply_markup: backKeyboard });
    }
    return { ok: true, action: 'review_empty' };
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const validPage = Math.min(Math.max(1, page), totalPages);
  const offset = (validPage - 1) * PAGE_SIZE;

  const reviewNotes = await db
    .select()
    .from(notes)
    .where(reviewCondition)
    .orderBy(desc(notes.createdAt))
    .limit(PAGE_SIZE)
    .offset(offset);

  const headerTitle = getTelegramMsg('review_header', activeLocale);
  const reply = formatSnippetPage(reviewNotes, totalCount, validPage, PAGE_SIZE, headerTitle, activeLocale, { showDates: false });
  const keyboard = buildPaginationKeyboard('review', 'all', validPage, totalPages, reviewNotes);

  noteListSessionMap.set(chatId, {
    items: reviewNotes.map((n) => ({ id: n.id, content: n.content })),
    type: 'review',
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

  return { ok: true, action: 'review_list', page: validPage, totalCount };
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
        // Putuskan hubungan Telegram chatId ini dari API key akun lain yang sebelumnya terhubung
        await db
          .update(apiKeys)
          .set({ telegramChatId: null })
          .where(and(eq(apiKeys.telegramChatId, chatId), ne(apiKeys.id, matchedKey.id)));

        await db
          .update(apiKeys)
          .set({ telegramChatId: chatId })
          .where(eq(apiKeys.id, matchedKey.id));

        tagSessionMap.delete(chatId);
        noteNavMap.delete(chatId);
        const existingBuffer = debounceMap.get(chatId);
        if (existingBuffer) {
          clearTimeout(existingBuffer.timer);
          debounceMap.delete(chatId);
        }

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
          reply_markup: REMOVE_DOCK_KEYBOARD,
        });

        const helpMsg = getTelegramMsg('help', activeLocale, {
          dashboardUrl: getWebDashboardUrl(),
        });
        await sendTelegramMessage(chatId, helpMsg, {
          parse_mode: 'Markdown',
          reply_markup: START_HELP_MENU_KEYBOARD,
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

    if (text.startsWith('/start')) {
      const welcomeBackMsg = activeLocale === 'id' ? '⚡️ *UnlazyNotes* siap.' : '⚡️ *UnlazyNotes* ready.';
      await sendTelegramMessage(chatId, welcomeBackMsg, {
        parse_mode: 'Markdown',
        reply_markup: REMOVE_DOCK_KEYBOARD,
      });
    }

    const helpMsg = getTelegramMsg('help', activeLocale, {
      dashboardUrl: getWebDashboardUrl(),
    });
    await sendTelegramMessage(chatId, helpMsg, {
      parse_mode: 'Markdown',
      reply_markup: START_HELP_MENU_KEYBOARD,
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

    // Putuskan hubungan Telegram chatId ini dari API key akun lain yang sebelumnya terhubung
    await db
      .update(apiKeys)
      .set({ telegramChatId: null })
      .where(and(eq(apiKeys.telegramChatId, chatId), ne(apiKeys.id, matchedKey.id)));

    await db
      .update(apiKeys)
      .set({ telegramChatId: chatId })
      .where(eq(apiKeys.id, matchedKey.id));

    tagSessionMap.delete(chatId);
    noteNavMap.delete(chatId);
    const existingBuffer = debounceMap.get(chatId);
    if (existingBuffer) {
      clearTimeout(existingBuffer.timer);
      debounceMap.delete(chatId);
    }

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

    tagSessionMap.delete(chatId);
    noteNavMap.delete(chatId);
    const existingBuffer = debounceMap.get(chatId);
    if (existingBuffer) {
      clearTimeout(existingBuffer.timer);
      debounceMap.delete(chatId);
    }

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

  // 5. /tags (tanpa argumen) atau /tg atau tombol dock '🏷 Tags'
  if (
    text === '/tags' ||
    text === '/tg' ||
    /^(\/(tags|tg))(@[a-zA-Z0-9_]+)?$/.test(text) ||
    text === '🏷 Tags'
  ) {
    const overview = await getTagsOverviewData(activeKey.userId);
    const unorganizedCount = await getOrFetchUnorganizedCount(activeKey.userId);

    if (!overview.hasNotes && unorganizedCount === 0) {
      const backMarkup = {
        inline_keyboard: [[{ text: '◀️ Kembali', callback_data: 'menu:start' }]],
      };
      await sendTelegramMessage(chatId, getTelegramMsg('tags_empty', activeLocale), {
        reply_markup: backMarkup,
      });
      return { ok: true, action: 'tags_empty' };
    }

    // Simpan session mapping nomor tag untuk chatId ini
    tagSessionMap.set(chatId, {
      tags: overview.numberToTagMap,
      expiresAt: Date.now() + TAG_SESSION_TTL_MS,
    });

    const msg = getTelegramMsg('tags_header', activeLocale, {
      latestTagsText: overview.latestTagsText,
      activeTagsText: overview.activeTagsText,
      recentTagsText: overview.recentTagsText,
    });

    const keyboard = buildCategoriesGridKeyboard(overview.existingCategories, overview.hasVaultNotes);

    await sendTelegramMessage(chatId, msg, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });

    return { ok: true, action: 'tags_list' };
  }

  // 6. /tags <nama_tag> atau /tg <nama_tag>
  if (
    text.startsWith('/tags ') ||
    text.startsWith('/tg ') ||
    /^(\/(tags|tg))(@[a-zA-Z0-9_]+)?\s+/.test(text)
  ) {
    const rawArg = text.replace(/^\/(tags|tg)(@[a-zA-Z0-9_]+)?\s+/, '').trim();
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

  // 6b2. /read atau /rd atau tombol dock '📖 Read'
  if (
    text === '/read' ||
    text === '/rd' ||
    /^(\/(read|rd))(@[a-zA-Z0-9_]+)?$/.test(text) ||
    text === '📖 Read'
  ) {
    return await handleReadCommand(chatId, activeKey.userId, 1, activeLocale);
  }

  // 6b3. /review atau /rv atau tombol '📋 Review' / 'Review'
  if (
    text === '/review' ||
    text === '/rv' ||
    /^(\/(review|rv))(@[a-zA-Z0-9_]+)?$/.test(text) ||
    text === '📋 Review' ||
    text === 'Review'
  ) {
    return await handleReviewCommand(chatId, activeKey.userId, 1, activeLocale);
  }

  // 6c. /dashboard
  if (text === '/dashboard' || /^(\/dashboard)(@[a-zA-Z0-9_]+)?$/.test(text)) {
    return await handleDashboardCommand(chatId, activeLocale);
  }

  // 6d. /sync atau /sync_all atau /sync all atau /organize atau /rapikan
  if (
    text === '🔄 Sync' ||
    text === 'Sync' ||
    text === '/sync all' ||
    text === '/sync_all' ||
    /^\/?(sync|sync_all|organize|rapikan)\b/i.test(text) ||
    text.startsWith('🪄 Organize') ||
    text.startsWith('🪄 Rapikan')
  ) {
    return await handleSyncCommand(chatId, activeKey.userId, activeLocale);
  }

  // 6e. /dock atau /menu (Dock menu disabled)
  if (text === '/dock' || text === '/menu') {
    await sendTelegramMessage(chatId, activeLocale === 'id' ? '👌 Menu dock telah dinonaktifkan. Gunakan menu perintah resmi (/) atau inline menu.' : '👌 Dock menu is disabled. Use the official commands menu (/) or inline menu.', {
      reply_markup: REMOVE_DOCK_KEYBOARD,
    });
    return { ok: true, action: 'dock_disabled' };
  }

  // 7. /search <kata_kunci> atau /src <kata_kunci>
  if (
    text === '/search' ||
    text === '/src' ||
    text.startsWith('/search ') ||
    text.startsWith('/src ') ||
    /^(\/(search|src))(@[a-zA-Z0-9_]+)?(\s+[\s\S]*)?$/.test(text)
  ) {
    const keyword = text.replace(/^\/(search|src)(@[a-zA-Z0-9_]+)?\s*/, '').trim();

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
      const backMarkup = {
        inline_keyboard: [[{ text: '◀️ Kembali', callback_data: 'menu:start' }]],
      };
      await sendTelegramMessage(
        chatId,
        getTelegramMsg('search_empty', activeLocale, { keyword }),
        { parse_mode: 'Markdown', reply_markup: backMarkup }
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
    const searchReply = formatSnippetPage(searchResults, totalCount, 1, PAGE_SIZE, headerTitle, activeLocale, { showDates: true });
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
  const isReplyToAiAnswer = Boolean(
    message.reply_to_message &&
    message.reply_to_message.from?.is_bot &&
    (message.reply_to_message.text?.includes('Jawaban AI:') || message.reply_to_message.text?.includes('AI Answer:')) &&
    !text.startsWith('/')
  );

  if (text.startsWith('/ask') || isReplyToAiAnswer) {
    const question = text.startsWith('/ask') ? text.replace(/^\/ask\s*/, '').trim() : text.trim();

    if (!quotaInfo.isPro) {
      const gated = getTelegramProGatedMessage(process.env.BETTER_AUTH_URL, activeLocale);
      await sendTelegramMessage(chatId, gated.text, {
        reply_markup: gated.replyMarkup,
      });
      return { ok: true, action: 'ask_requires_pro' };
    }

    if (!question) {
      await sendTelegramMessage(
        chatId,
        getTelegramMsg('ask_missing_question', activeLocale)
      );
      return { ok: true, action: 'ask_missing_question' };
    }

    // Build sliding context if this is a reply to previous AI message
    let conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> | undefined;
    if (message.reply_to_message && message.reply_to_message.text) {
      const cleanPrev = message.reply_to_message.text
        .replace(/^.*?(Jawaban AI:|AI Answer:)\s*/i, '')
        .trim();
      if (cleanPrev) {
        conversationHistory = [
          { role: 'assistant', content: cleanPrev },
        ];
      }
    }

    const loadingResult = await sendTelegramMessageWithId(chatId, getTelegramMsg('ask_analyzing', activeLocale));
    const loadingMsgId = loadingResult.messageId;

    (async () => {
      try {
        const answer = await answerNoteQuestion(activeKey.userId, question, undefined, conversationHistory);
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

  // 9. /secure <kunci> <isi_rahasia> atau /sc <kunci> <isi_rahasia> (AES-256-GCM Private Vault - Bypass AI)
  if (
    text === '/secure' ||
    text === '/sc' ||
    text.startsWith('/secure ') ||
    text.startsWith('/sc ') ||
    /^(\/(secure|sc))(@[a-zA-Z0-9_]+)?(\s+[\s\S]*)?$/.test(text)
  ) {
    if (!quotaInfo.isPro) {
      const gated = getTelegramProGatedMessage(process.env.BETTER_AUTH_URL, activeLocale);
      await sendTelegramMessage(chatId, gated.text, {
        reply_markup: gated.replyMarkup,
      });
      return { ok: true, action: 'secure_requires_pro' };
    }

    const secureMatch = text.match(/^\/(?:secure|sc)(?:@[a-zA-Z0-9_]+)?\s+(\S+)\s+([\s\S]+)$/);

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

  // 10. /vault [kunci] atau /vl [kunci] (Buka rahasia atau list kunci Private Vault)
  if (
    text === '/vault' ||
    text === '/vl' ||
    text.startsWith('/vault ') ||
    text.startsWith('/vl ') ||
    /^(\/(vault|vl))(@[a-zA-Z0-9_]+)?(\s+[\s\S]*)?$/.test(text)
  ) {
    const vaultParam = text.replace(/^\/(vault|vl)(@[a-zA-Z0-9_]+)?\s*/, '').trim();
    return await handleVaultCommand(chatId, activeKey, activeLocale, vaultParam);
  }

  // 10a. /temp atau /tp atau /temporary <isi_catatan> (Catatan Sementara / Ephemeral Note - TTL 7 Hari)
  if (
    text === '/temp' ||
    text === '/tp' ||
    text === '/temporary' ||
    text.startsWith('/temp ') ||
    text.startsWith('/tp ') ||
    text.startsWith('/temporary ') ||
    /^(\/(temp|tp|temporary))(@[a-zA-Z0-9_]+)?(\s+[\s\S]*)?$/.test(text)
  ) {
    const tempContent = text.replace(/^\/(temp|tp|temporary)(@[a-zA-Z0-9_]+)?\s*/, '').trim();
    if (!tempContent) {
      await sendTelegramMessage(
        chatId,
        activeLocale === 'id'
          ? 'ℹ️ Silakan masukkan isi catatan sementara: `/temp <isi_catatan>`'
          : 'ℹ️ Please provide temporary note content: `/temp <note_content>`',
        { parse_mode: 'Markdown' }
      );
      return { ok: true, action: 'temp_missing_content' };
    }

    if (!quotaInfo.allowed) {
      const quotaMsg = getTelegramQuotaExceededMessage(process.env.BETTER_AUTH_URL, activeLocale);
      await sendTelegramMessage(chatId, quotaMsg.text, {
        reply_markup: quotaMsg.replyMarkup,
      });
      return { ok: true, action: 'quota_exceeded' };
    }

    const noteId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db.insert(notes).values({
      id: noteId,
      userId: activeKey.userId,
      content: tempContent,
      category: 'others',
      specificTags: ['temp'],
      source: 'telegram',
      isProcessed: false,
      expiresAt,
      isArchived: false,
      createdAt: new Date(),
    });

    await incrementUserMonthlyNotes(activeKey.userId);
    invalidateUserTagsCache(activeKey.userId);

    const reply = activeLocale === 'id'
      ? '⏳ *Saved (Temp 7d)* • Catatan sementara otomatis diarsipkan dalam 7 hari.'
      : '⏳ *Saved (Temp 7d)* • Temporary note will be auto-archived in 7 days.';

    await sendTelegramMessage(chatId, reply, {
      parse_mode: 'Markdown',
      reply_markup: REMOVE_DOCK_KEYBOARD,
    });

    return { ok: true, action: 'temp_saved', noteId };
  }

  // 10b. Invalid Command Guard (pesan berawalan '/' tanpa command yang cocok)
  if (text.startsWith('/')) {
    await sendTelegramMessage(chatId, getTelegramMsg('invalid_command', activeLocale), {
      reply_markup: REMOVE_DOCK_KEYBOARD,
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

    // Safety guard: Jika targetTag kosong/hilang, jangan query string kosong, langsung arahkan ke menu tags
    if (!targetTag || targetTag.trim() === '') {
      const overview = await getTagsOverviewData(activeKey.userId);
      const msg = getTelegramMsg('tags_header', activeLocale, {
        latestTagsText: overview.latestTagsText,
        activeTagsText: overview.activeTagsText,
        recentTagsText: overview.recentTagsText,
      });
      const keyboard = buildCategoriesGridKeyboard(overview.existingCategories, overview.hasVaultNotes);
      if (messageId) {
        await editTelegramMessage(chatId, messageId, msg, { parse_mode: 'HTML', reply_markup: keyboard });
      }
      await answerTelegramCallbackQuery(callbackId);
      return { ok: true, action: 'callback_menu_tags' };
    }

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
    const newText = formatSnippetPage(matchedNotes, totalCount, validPage, PAGE_SIZE, headerTitle, activeLocale, { showDates: true });
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
    let queryVal = '';
    if (parts.length > 5) {
      const extracted = parts.slice(4, parts.length - 1).join(':').trim();
      queryVal = extracted || (nav?.queryVal || '');
    } else {
      queryVal = nav?.queryVal || '';
    }

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
    let queryVal = '';
    if (parts.length > 5) {
      const extracted = parts.slice(4, parts.length - 1).join(':').trim();
      queryVal = extracted || (nav?.queryVal || '');
    } else {
      queryVal = nav?.queryVal || '';
    }

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
    let queryVal = '';
    if (parts.length > 5) {
      const extracted = parts.slice(4, parts.length - 1).join(':').trim();
      queryVal = extracted || (nav?.queryVal || '');
    } else {
      queryVal = nav?.queryVal || '';
    }

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
    let queryVal = '';
    if (parts.length > 5) {
      const extracted = parts.slice(4, parts.length - 1).join(':').trim();
      queryVal = extracted || (nav?.queryVal || '');
    } else {
      queryVal = nav?.queryVal || '';
    }

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

  // 1f2. Kirim Berkas/Media Catatan: note:media:<noteId>
  if (data.startsWith('note:media:')) {
    const parts = data.split(':');
    const noteId = parts[2];
    const [note] = await db
      .select()
      .from(notes)
      .where(eq(notes.id, noteId))
      .limit(1);

    if (!note || !note.attachments || !Array.isArray(note.attachments) || note.attachments.length === 0) {
      await answerTelegramCallbackQuery(callbackId, {
        text: '⚠️ Lampiran file/media tidak ditemukan.',
        show_alert: true,
      });
      return { ok: false, error: 'attachments_not_found', noteId };
    }

    await answerTelegramCallbackQuery(callbackId, {
      text: '📥 Mengirim file/media...',
    });

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

    return { ok: true, action: 'note_media_sent', noteId };
  }

  // 1f3. Menu Start / Kembali ke Start: menu:start
  if (data === 'menu:start') {
    const [activeKey] = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.telegramChatId, chatId), eq(apiKeys.isActive, true)))
      .limit(1);

    let activeLocale: SupportedLocale = 'id';
    if (activeKey) {
      const [u] = await db.select({ preferredLocale: users.preferredLocale }).from(users).where(eq(users.id, activeKey.userId)).limit(1);
      activeLocale = detectTelegramLocale(callbackQuery, u?.preferredLocale);
    } else {
      activeLocale = detectTelegramLocale(callbackQuery, null);
    }

    const helpMsg = getTelegramMsg('help', activeLocale, {
      dashboardUrl: getWebDashboardUrl(),
    });

    if (messageId) {
      await editTelegramMessage(chatId, messageId, helpMsg, {
        parse_mode: 'Markdown',
        reply_markup: START_HELP_MENU_KEYBOARD,
      });
    } else {
      await sendTelegramMessage(chatId, helpMsg, {
        parse_mode: 'Markdown',
        reply_markup: START_HELP_MENU_KEYBOARD,
      });
    }

    await answerTelegramCallbackQuery(callbackId);
    return { ok: true, action: 'callback_menu_start' };
  }

  // 1g. Pagination untuk /pin: page:pin:<queryVal>:<page_num> atau menu:pin
  if (data === 'menu:pin' || data.startsWith('page:pin:')) {
    const parts = data.split(':');
    const pageNum = data === 'menu:pin' ? 1 : parseInt(parts[3] || '1', 10) || 1;

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

  // 1h. Pagination untuk /read: page:read:<queryVal>:<page_num> atau menu:read
  if (data === 'menu:read' || data.startsWith('page:read:')) {
    const parts = data.split(':');
    const pageNum = data === 'menu:read' ? 1 : parseInt(parts[3] || '1', 10) || 1;

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

    // Perbarui session state nomor tag untuk chatId ini
    tagSessionMap.set(chatId, {
      tags: overview.numberToTagMap,
      expiresAt: Date.now() + TAG_SESSION_TTL_MS,
    });

    const msg = getTelegramMsg('tags_header', activeLocale, {
      latestTagsText: overview.latestTagsText,
      activeTagsText: overview.activeTagsText,
      recentTagsText: overview.recentTagsText,
    });

    const keyboard = buildCategoriesGridKeyboard(overview.existingCategories, overview.hasVaultNotes);

    if (messageId) {
      await editTelegramMessage(chatId, messageId, msg, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
    }

    await answerTelegramCallbackQuery(callbackId);
    return { ok: true, action: 'callback_menu_tags' };
  }

  // 1b2. Menu Review: menu:review atau page:review:...
  if (data === 'menu:review' || data.startsWith('page:review:')) {
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

    let targetPage = 1;
    if (data.startsWith('page:review:')) {
      const parts = data.split(':');
      targetPage = parseInt(parts[3] || '1', 10) || 1;
    }

    const res = await handleReviewCommand(chatId, activeKey.userId, targetPage, activeLocale, messageId);
    await answerTelegramCallbackQuery(callbackId);
    return res;
  }

  // 1b3. Review: Sync All
  if (data === 'review:sync_all') {
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
      text: activeLocale === 'id' ? '🔄 Menjalankan AI Sync...' : '🔄 Running AI Sync...',
    });
    return await handleSyncCommand(chatId, activeKey.userId, activeLocale);
  }

  // 1b4. Menu Vault dari inline keyboard category: menu:vault
  if (data === 'menu:vault') {
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
    await answerTelegramCallbackQuery(callbackId);
    return await handleVaultCommand(chatId, activeKey, activeLocale, '');
  }

  // 1b5. Single Note AI Sync dari detail note: note:sync_ai:<id>
  if (data.startsWith('note:sync_ai:')) {
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
    const noteId = data.replace('note:sync_ai:', '');

    const [targetNote] = await db
      .select()
      .from(notes)
      .where(and(eq(notes.id, noteId), eq(notes.userId, activeKey.userId)))
      .limit(1);

    if (!targetNote) {
      await answerTelegramCallbackQuery(callbackId, {
        text: activeLocale === 'id' ? 'Catatan tidak ditemukan.' : 'Note not found.',
      });
      return { ok: false, error: 'note_not_found' };
    }

    try {
      const generated = await generateNoteTags(targetNote.content, undefined, targetNote.createdAt);
      await db
        .update(notes)
        .set({
          category: generated.category,
          specificTags: generated.specific_tags,
          scheduleDates: generated.schedule?.dates || generated.schedule_dates || [],
          schedule: generated.schedule || { dates: generated.schedule_dates || [], isRecurring: false },
          expenses: generated.expenses || [],
          income: generated.income || [],
          debt: generated.debt || [],
          bookmarkType: generated.bookmarkType || undefined,
          credentialType: generated.credentialType || undefined,
          isProcessed: true,
        })
        .where(eq(notes.id, noteId));

      await answerTelegramCallbackQuery(callbackId, {
        text: activeLocale === 'id' ? '✨ Berhasil dikategorikan oleh AI!' : '✨ Successfully organized by AI!',
      });

      const nav = noteNavMap.get(noteId) || { type: 'review', queryVal: 'all', page: 1 };
      return await displayNoteDetail(
        chatId,
        messageId,
        noteId,
        nav.type as any,
        nav.queryVal,
        nav.page
      );
    } catch (syncErr) {
      console.error('[Note AI Sync] Failed:', syncErr);
      await answerTelegramCallbackQuery(callbackId, {
        text: activeLocale === 'id' ? 'Gagal memproses dengan AI.' : 'Failed to process with AI.',
      });
      return { ok: false, error: 'ai_sync_failed' };
    }
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
    const newText = formatSnippetPage(searchResults, totalCount, validPage, PAGE_SIZE, headerTitle, activeLocale, { showDates: true });
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
