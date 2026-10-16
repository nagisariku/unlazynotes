import { db } from '@/db';
import { users, apiKeys, notes } from '@/db/schema';
import { eq, and, desc, sql, ilike } from 'drizzle-orm';
import crypto from 'node:crypto';
import { format } from 'date-fns';
import { encryptSecret, decryptSecret } from '@/lib/crypto';
import {
  HELP_MESSAGE,
  SECURITY_DISCLAIMER,
} from '@/lib/constants';
import {
  hashApiKey,
  sendTelegramMessage,
  editTelegramMessage,
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
  FREE_MONTHLY_QUOTA,
} from '@/lib/quota-service';
import { taggingQueue } from '@/lib/tagging-queue';

export const PAGE_SIZE = 5;
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
}

interface DebounceBufferItem {
  timer: NodeJS.Timeout;
  messages: string[];
  activeKey: typeof apiKeys.$inferSelect;
  chatId: string;
  noteId: string;
  createdAt: Date;
  tier: 'free' | 'pro';
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
        `*(Sisa kuota Free bulan ini: ${remaining}/30)*`,
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
        '💡 *Tips Keamanan:*\nTerdeteksi informasi sensitif. Untuk data rahasia seperti password, token, atau PIN, Anda disarankan menggunakan perintah:\n`/secure <kunci> <isi>`\nagar otomatis dienkripsi dengan standar AES-256-GCM dan diisolasi sepenuhnya dari AI.',
        { parse_mode: 'Markdown' }
      );
    }

    // 4. Background AI Categorization & Tagging via Priority Queue (Fast-lane Pro)
    taggingQueue.enqueue({
      noteId,
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
 * Format notes snippet page for Telegram message.
 * - Bold first line as title
 * - Truncated snippet up to 120 chars with ellipsis
 * - Date and tags badge
 */
export function formatSnippetPage(
  items: Array<{ content: string; createdAt: Date; category: string; specificTags?: string[] | null }>,
  totalCount: number,
  page: number,
  pageSize: number,
  headerTitle: string
): string {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  let text = `${headerTitle} (Hal. ${page}/${totalPages} • Total: ${totalCount})\n\n`;

  for (let i = 0; i < items.length; i++) {
    const n = items[i];
    const itemIndex = (page - 1) * pageSize + (i + 1);

    // Ambil baris pertama sebagai judul bold (bersihkan karakter markdown formatting mentah)
    const rawLines = n.content.trim().split('\n').map((l) => l.trim()).filter(Boolean);
    const firstLine = rawLines[0] || 'Catatan';
    const cleanTitle = firstLine.replace(/[*_`[\]]/g, '');
    const title = cleanTitle.length > 50 ? `${cleanTitle.slice(0, 50)}...` : cleanTitle;

    // Potong teks konten maksimal 120 karakter diikuti ellipsis
    const cleanFull = n.content.replace(/\s+/g, ' ').trim();
    const snippet = cleanFull.length > 120 ? `${cleanFull.slice(0, 120)}...` : cleanFull;

    const dateStr = format(new Date(n.createdAt), 'dd MMM yyyy, HH:mm');
    const tagsStr = [n.category, ...(n.specificTags || [])].join(', ');

    text += `*${itemIndex}.* 📌 *${title}*\n`;
    text += `${snippet}\n`;
    text += `   📅 _${dateStr}_ • _Tags: ${tagsStr}_\n\n`;
  }

  return text.trim();
}

/**
 * Builds Telegram Inline Keyboard for pagination: [ ◀️ Prev ] [ 1 / N ] [ Next ▶️ ]
 */
export function buildPaginationKeyboard(
  type: 'tags' | 'search',
  queryVal: string,
  currentPage: number,
  totalPages: number
) {
  if (totalPages <= 1) return undefined;

  const buttons: Array<{ text: string; callback_data: string }> = [];

  if (currentPage > 1) {
    buttons.push({
      text: '◀️ Prev',
      callback_data: `page:${type}:${queryVal}:${currentPage - 1}`,
    });
  }

  buttons.push({
    text: `[ ${currentPage} / ${totalPages} ]`,
    callback_data: 'noop',
  });

  if (currentPage < totalPages) {
    buttons.push({
      text: 'Next ▶️',
      callback_data: `page:${type}:${queryVal}:${currentPage + 1}`,
    });
  }

  return {
    inline_keyboard: [buttons],
  };
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
    await sendTelegramMessage(
      chatId,
      'UnlazyNotes belum mendukung format catatan ini, file/gambar anda tetap tersimpan aman disini.'
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

        const userName = matchedUser?.name || 'Teman';
        const welcomeMsg = `🎉 *Halo ${userName}!* Akun Telegram Anda berhasil terhubung dengan UnlazyNotes. Anda kini bisa langsung mengirim catatan apa saja ke sini.`;
        await sendTelegramMessage(chatId, welcomeMsg, { parse_mode: 'Markdown' });
        return { ok: true, action: 'start_auto_connected' };
      }
    }

    await sendTelegramMessage(chatId, HELP_MESSAGE, { parse_mode: 'Markdown' });
    return { ok: true, action: 'help' };
  }

  // 2. /login <api_key>
  if (text.startsWith('/login')) {
    const parts = text.split(/\s+/);
    const rawApiKey = parts[1];

    if (!rawApiKey) {
      await sendTelegramMessage(
        chatId,
        'Format salah. Silakan gunakan format:\n`/login <api_key>`\n\nContoh:\n`/login unz_1234567890abcdef`',
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
        '❌ API Key tidak valid atau dinonaktifkan. Pastikan Anda menyalin API Key yang benar dari halaman Settings di web dashboard.',
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

    const userName = matchedUser?.name || 'Teman';
    await sendTelegramMessage(
      chatId,
      `🎉 *Halo ${userName}!* Akun Telegram Anda berhasil terhubung dengan UnlazyNotes. Anda kini bisa langsung mengirim catatan apa saja ke sini.\n\n${SECURITY_DISCLAIMER}`,
      { parse_mode: 'Markdown' }
    );

    return { ok: true, action: 'login_success' };
  }

  // 3. /logout
  if (text.startsWith('/logout')) {
    await db
      .update(apiKeys)
      .set({ telegramChatId: null })
      .where(eq(apiKeys.telegramChatId, chatId));

    await sendTelegramMessage(
      chatId,
      '🔌 Akun Telegram Anda telah berhasil diputus dari UnlazyNotes. Untuk menyambungkannya kembali, gunakan `/login <api_key>`.',
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
    await sendTelegramMessage(
      chatId,
      '🔒 Akun Telegram Anda belum terhubung ke UnlazyNotes.\n\nSilakan buka dashboard unlazynotes -> Settings -> Salin API Key Anda, lalu kirim ke sini:\n`/login <api_key>`',
      { parse_mode: 'Markdown' }
    );
    return { ok: true, action: 'unauthenticated' };
  }

  const quotaInfo = await checkUserQuotaAndTier(activeKey.userId);

  // 5. /tags (tanpa argumen)
  if (text === '/tags' || /^(\/tags)(@[a-zA-Z0-9_]+)?$/.test(text)) {
    const userNotes = await db
      .select({
        category: notes.category,
        specificTags: notes.specificTags,
      })
      .from(notes)
      .where(
        and(
          eq(notes.userId, activeKey.userId),
          eq(notes.isEncrypted, false)
        )
      );

    if (userNotes.length === 0) {
      await sendTelegramMessage(chatId, 'Belum ada catatan atau tag yang tersimpan.');
      return { ok: true, action: 'tags_empty' };
    }

    const categoriesSet = new Set<string>();
    const specificTagsSet = new Set<string>();

    for (const n of userNotes) {
      if (n.category) categoriesSet.add(n.category);
      if (Array.isArray(n.specificTags)) {
        for (const t of n.specificTags) {
          if (t && typeof t === 'string' && t.trim()) {
            specificTagsSet.add(t.trim());
          }
        }
      }
    }

    const escapeMd = (str: string) => str.replace(/([_*`\[\]])/g, '\\$1');

    const catList =
      Array.from(categoriesSet)
        .map(escapeMd)
        .join(', ') || '-';

    const tagList =
      Array.from(specificTagsSet)
        .map((t) => (t.startsWith('#') ? escapeMd(t) : `#${escapeMd(t)}`))
        .join(', ') || '-';

    const quotaStatus = quotaInfo.isPro
      ? '⭐️ *Paket:* Pro Tier (Catatan Unlimited & Fast-Lane AI)'
      : `📊 *Status Kuota Bulan Ini:* ${quotaInfo.currentCount}/${FREE_MONTHLY_QUOTA} catatan (Reset tiap tgl 1)`;

    const msg = `🏷 *Daftar Kategori & Tag Aktif Anda*\n\n📂 *Kategori Utama:*\n${catList}\n\n🏷 *Specific Tags:*\n${tagList}\n\n${quotaStatus}\n_💡 Tips: Ketik /tags <nama_tag> untuk melihat catatan pada tag tertentu._`;
    await sendTelegramMessage(chatId, msg, { parse_mode: 'Markdown' });

    return { ok: true, action: 'tags_list' };
  }

  // 6. /tags <nama_tag>
  if (text.startsWith('/tags ')) {
    const targetTagRaw = text.substring(6).trim();
    const targetTag = normalizeTag(targetTagRaw);

    if (!targetTag) {
      await sendTelegramMessage(chatId, 'Gunakan format: `/tags <nama_tag>`', { parse_mode: 'Markdown' });
      return { ok: true, action: 'tags_filter_missing' };
    }

    if (targetTag === 'draft') {
      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(notes)
        .where(
          and(
            eq(notes.userId, activeKey.userId),
            eq(notes.category, 'draft'),
            eq(notes.isEncrypted, false)
          )
        );
      const totalDrafts = Number(countResult?.count || 0);

      const draftMsg = `📝 Ditemukan ${totalDrafts} catatan berlabel *draft*.\n\nUntuk draf atau teks panjang, lihat selengkapnya di web dashboard demi kenyamanan membaca:\n/dashboard?tag=draft`;
      await sendTelegramMessage(chatId, draftMsg, { parse_mode: 'Markdown' });

      return { ok: true, action: 'tags_draft_redirect' };
    }

    // Hitung total catatan yang cocok
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

    if (totalCount === 0) {
      await sendTelegramMessage(chatId, `Tidak ditemukan catatan dengan label \`${targetTag}\`.`, {
        parse_mode: 'Markdown',
      });
      return { ok: true, action: 'tags_none_found' };
    }

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
      .offset(0);

    const headerTitle = `🏷️ *Catatan dengan label [${targetTag}]*`;
    const reply = formatSnippetPage(matchedNotes, totalCount, 1, PAGE_SIZE, headerTitle);
    const totalPages = Math.ceil(totalCount / PAGE_SIZE);
    const keyboard = buildPaginationKeyboard('tags', targetTag, 1, totalPages);

    await sendTelegramMessage(chatId, reply, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });

    return { ok: true, action: 'tags_filtered', totalCount };
  }

  // 7. /search <kata_kunci>
  if (text.startsWith('/search')) {
    const keyword = text.replace(/^\/search\s*/, '').trim();

    if (!keyword) {
      await sendTelegramMessage(chatId, 'Gunakan format: `/search <kata_kunci>`', {
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
        `🔍 Tidak ditemukan catatan dengan kata kunci "*${keyword}*".`,
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

    const headerTitle = `🔍 *Hasil Pencarian untuk:* "${keyword}"`;
    const searchReply = formatSnippetPage(searchResults, totalCount, 1, PAGE_SIZE, headerTitle);
    const totalPages = Math.ceil(totalCount / PAGE_SIZE);
    const keyboard = buildPaginationKeyboard('search', keyword, 1, totalPages);

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
        'Gunakan format: `/ask <pertanyaan Anda>`\n\nContoh:\n`/ask Kapan meeting sprint selanjutnya?`',
        { parse_mode: 'Markdown' }
      );
      return { ok: true, action: 'ask_missing_question' };
    }

    if (!quotaInfo.isPro) {
      const gated = getTelegramProGatedMessage(process.env.BETTER_AUTH_URL);
      await sendTelegramMessage(chatId, gated.text, {
        parse_mode: 'Markdown',
        reply_markup: gated.replyMarkup,
      });
      return { ok: true, action: 'ask_requires_pro' };
    }

    await sendTelegramMessage(chatId, '🤖 Sedang menganalisis catatan Anda...');

    (async () => {
      try {
        const answer = await answerNoteQuestion(activeKey.userId, question);
        await sendTelegramMessage(chatId, `💡 *Jawaban AI:*\n\n${answer}`, {
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
      const gated = getTelegramProGatedMessage(process.env.BETTER_AUTH_URL);
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
        'Format salah. Silakan gunakan format:\n`/secure <kunci> <isi_rahasia>`\n\nContoh:\n`/secure wifi-rumah MySecretPassword123`\n`/secure token-prod secret_api_key_xyz`',
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

    const reply = `🔒 *Tersimpan Aman di Private Vault!*\n\nKunci: \`${vaultKey.trim()}\`\n\n_Data dienkripsi AES-256-GCM dan dibypass 100% dari pemrosesan AI._`;
    await sendTelegramMessage(chatId, reply, { parse_mode: 'Markdown' });

    return { ok: true, action: 'secure_saved', noteId };
  }

  // 10. /vault [kunci] (Buka rahasia atau list kunci Private Vault)
  if (text.startsWith('/vault')) {
    if (!quotaInfo.isPro) {
      const gated = getTelegramProGatedMessage(process.env.BETTER_AUTH_URL);
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
          '📭 Private Vault Anda masih kosong.\n\nGunakan perintah `/secure <kunci> <isi>` untuk menyimpan rahasia pertama Anda.',
          { parse_mode: 'Markdown' }
        );
        return { ok: true, action: 'vault_empty' };
      }

      const keysList = Array.from(
        new Set(vaultNotes.map((v) => v.vaultKey || 'tanpa-kunci'))
      )
        .map((k) => `• \`${k}\``)
        .join('\n');

      const msg = `🔒 *Daftar Kunci Private Vault Anda:* (${vaultNotes.length} rahasia)\n\n${keysList}\n\n_Ketik \`/vault <kunci>\` untuk membuka isi rahasia._`;
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
        `❌ Tidak ditemukan rahasia di Private Vault dengan kata kunci \`${cleanQuery}\`.\n\nKetik \`/vault\` untuk melihat daftar seluruh kunci yang tersimpan.`,
        { parse_mode: 'Markdown' }
      );
      return { ok: true, action: 'vault_not_found' };
    }

    if (matchedVaults.length === 1) {
      const matchedVault = matchedVaults[0];
      try {
        const decrypted = decryptSecret(matchedVault.content, activeKey.userId);
        const dateStr = format(new Date(matchedVault.createdAt), 'dd MMM yyyy, HH:mm');
        const reply = `🔓 *Private Vault: [${matchedVault.vaultKey}]*\n📅 _Disimpan: ${dateStr}_\n\n\`\`\`\n${decrypted}\n\`\`\``;
        await sendTelegramMessage(chatId, reply, { parse_mode: 'Markdown' });
        return { ok: true, action: 'vault_revealed' };
      } catch (decErr) {
        console.error('[Private Vault] Decryption error:', decErr);
        await sendTelegramMessage(
          chatId,
          '❌ Gagal mendekripsi data vault. Terjadi kendala kunci atau format data korup.'
        );
        return { ok: false, error: 'vault_decryption_failed' };
      }
    }

    // Jika ditemukan lebih dari 1 catatan yang cocok
    let reply = `🔓 *Ditemukan ${matchedVaults.length} Catatan Private Vault untuk "*${cleanQuery}*":*\n\n`;
    for (let i = 0; i < matchedVaults.length; i++) {
      const item = matchedVaults[i];
      const dateStr = format(new Date(item.createdAt), 'dd MMM yyyy, HH:mm');
      let decrypted = '';
      try {
        decrypted = decryptSecret(item.content, activeKey.userId);
      } catch (err) {
        decrypted = '[Gagal mendekripsi data vault]';
      }
      reply += `*${i + 1}. 🔑 ${item.vaultKey}* (📅 _${dateStr}_)\n\`\`\`\n${decrypted}\n\`\`\`\n\n`;
    }

    await sendTelegramMessage(chatId, reply, { parse_mode: 'Markdown' });
    return { ok: true, action: 'vault_revealed_multiple' };
  }

  // 11. Core Note Capture Quota Enforcement
  if (!quotaInfo.allowed) {
    const quotaMsg = getTelegramQuotaExceededMessage(process.env.BETTER_AUTH_URL);
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
      await answerTelegramCallbackQuery(callbackId, {
        text: 'Sesi akun Telegram belum terhubung.',
      });
      return { ok: false, error: 'unauthenticated' };
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

    const headerTitle = `🏷️ *Catatan dengan label [${targetTag}]*`;
    const newText = formatSnippetPage(matchedNotes, totalCount, validPage, PAGE_SIZE, headerTitle);
    const keyboard = buildPaginationKeyboard('tags', targetTag, validPage, totalPages);

    if (messageId) {
      await editTelegramMessage(chatId, messageId, newText, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    }

    await answerTelegramCallbackQuery(callbackId);
    return { ok: true, action: 'callback_page_tags', page: validPage, totalCount };
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
      await answerTelegramCallbackQuery(callbackId, {
        text: 'Sesi akun Telegram belum terhubung.',
      });
      return { ok: false, error: 'unauthenticated' };
    }

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

    const headerTitle = `🔍 *Hasil Pencarian untuk:* "${query}"`;
    const newText = formatSnippetPage(searchResults, totalCount, validPage, PAGE_SIZE, headerTitle);
    const keyboard = buildPaginationKeyboard('search', query, validPage, totalPages);

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
