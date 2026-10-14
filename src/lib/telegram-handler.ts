import { db } from '@/db';
import { subscriptions, apiKeys, notes, type NoteCategory } from '@/db/schema';
import { eq, and, ilike, desc, sql } from 'drizzle-orm';
import crypto from 'node:crypto';
import { format } from 'date-fns';
import {
  HELP_MESSAGE,
  SECURITY_DISCLAIMER,
  STANDARD_DAILY_QUOTA,
  CATEGORIES,
} from '@/lib/constants';
import {
  hashApiKey,
  sendTelegramMessage,
  formatSavedMessage,
} from '@/lib/telegram';
import { generateNoteTags, normalizeTag } from '@/lib/ai';
import { answerNoteQuestion } from '@/lib/ask';

export interface TelegramProcessResult {
  ok: boolean;
  action?: string;
  error?: string;
  noteId?: string;
  status?: string;
  ignored?: string;
  httpStatus?: number;
}

/**
 * Core Telegram Message Processor.
 * Shared between Webhook handler and direct VPS Long Polling worker.
 */
export async function processTelegramMessage(message: any): Promise<TelegramProcessResult> {
  if (!message || !message.chat) {
    return { ok: true, ignored: 'no_message' };
  }

  const chatId = String(message.chat.id);
  const rawText: string | undefined = message.text || message.caption;

  if (!rawText || !rawText.trim()) {
    return { ok: true, ignored: 'empty_text' };
  }

  const text = rawText.trim();

  // 1. /start atau /help
  if (text.startsWith('/start') || text.startsWith('/help')) {
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
      .where(and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.isActive, true)))
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

    await sendTelegramMessage(
      chatId,
      `✅ *Akun Berhasil Terhubung!*\n\nSelamat datang di UnlazyNotes. Anda sekarang dapat langsung mengirim teks, tautan, ide, to-do list, atau draf ke chat ini untuk disimpan dan di-tag otomatis oleh AI.\n\n${SECURITY_DISCLAIMER}`,
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

  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, activeKey.userId))
    .limit(1);

  if (!sub || sub.status !== 'active') {
    await sendTelegramMessage(
      chatId,
      '⚠️ Paket langganan Anda tidak aktif atau telah kedaluwarsa.\n\nSilakan perpanjang langganan Anda di web dashboard untuk terus menggunakan bot pencatat UnlazyNotes: /dashboard/settings',
      { parse_mode: 'Markdown' }
    );
    return { ok: true, action: 'subscription_inactive' };
  }

  // 5. /tags
  if (text === '/tags') {
    const userNotes = await db
      .select({
        category: notes.category,
        specificTags: notes.specificTags,
      })
      .from(notes)
      .where(eq(notes.userId, activeKey.userId));

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
          if (t) specificTagsSet.add(t);
        }
      }
    }

    const catList = Array.from(categoriesSet).map((c) => `• \`${c}\``).join('\n') || '-';
    const tagList = Array.from(specificTagsSet).map((t) => `• \`${t}\``).join('\n') || '-';

    const msg = `🏷️ *Daftar Tag & Kategori Aktif Anda:*\n\n*Kategori Utama:*\n${catList}\n\n*Specific Tags:*\n${tagList}\n\n_Ketik \`/tags <nama_tag>\` untuk mencari catatan berlabel tersebut._`;
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
            eq(notes.category, 'draft')
          )
        );
      const totalDrafts = Number(countResult?.count || 0);

      const draftMsg = `📝 Ditemukan ${totalDrafts} catatan berlabel *draft*.\n\nUntuk draf atau teks panjang, lihat selengkapnya di web dashboard demi kenyamanan membaca:\n/dashboard?tag=draft`;
      await sendTelegramMessage(chatId, draftMsg, { parse_mode: 'Markdown' });

      return { ok: true, action: 'tags_draft_redirect' };
    }

    const matchedNotes = await db
      .select()
      .from(notes)
      .where(
        and(
          eq(notes.userId, activeKey.userId),
          sql`(${notes.category} = ${targetTag} OR ${notes.specificTags} @> ${JSON.stringify([targetTag])}::jsonb)`
        )
      )
      .orderBy(desc(notes.createdAt))
      .limit(10);

    if (matchedNotes.length === 0) {
      await sendTelegramMessage(chatId, `Tidak ditemukan catatan dengan label \`${targetTag}\`.`, {
        parse_mode: 'Markdown',
      });
      return { ok: true, action: 'tags_none_found' };
    }

    const hasLongNotes = matchedNotes.some((n) => n.content.length > 300);

    let reply = `🏷️ *Catatan dengan label [${targetTag}]* (Ditemukan: ${matchedNotes.length})\n\n`;
    for (let i = 0; i < matchedNotes.length; i++) {
      const n = matchedNotes[i];
      const preview =
        n.content.length > 150 ? `${n.content.substring(0, 150)}...` : n.content;
      const tagsStr = [n.category, ...(n.specificTags || [])].join(', ');
      reply += `${i + 1}. ${preview}\n   _Tags: ${tagsStr}_\n\n`;
    }

    if (hasLongNotes) {
      reply += `\n💡 _Beberapa catatan memiliki draf/teks panjang. Lihat selengkapnya di web dashboard:_\n/dashboard?tag=${encodeURIComponent(
        targetTag
      )}`;
    }

    await sendTelegramMessage(chatId, reply, { parse_mode: 'Markdown' });

    return { ok: true, action: 'tags_filtered' };
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

    const searchResults = await db
      .select()
      .from(notes)
      .where(
        and(
          eq(notes.userId, activeKey.userId),
          ilike(notes.content, `%${keyword}%`)
        )
      )
      .orderBy(desc(notes.createdAt))
      .limit(5);

    if (searchResults.length === 0) {
      await sendTelegramMessage(
        chatId,
        `🔍 Tidak ditemukan catatan dengan kata kunci "*${keyword}*".`,
        { parse_mode: 'Markdown' }
      );
      return { ok: true, action: 'search_empty' };
    }

    let searchReply = `🔍 *Hasil Pencarian untuk:* "${keyword}" (Maks. 5 catatan)\n\n`;
    for (let i = 0; i < searchResults.length; i++) {
      const item = searchResults[i];
      const dateStr = format(new Date(item.createdAt), 'dd MMM yyyy, HH:mm');
      const snippet =
        item.content.length > 180 ? `${item.content.substring(0, 180)}...` : item.content;
      const tagsList = [item.category, ...(item.specificTags || [])].join(', ');
      searchReply += `*${i + 1}.* ${snippet}\n   📅 _${dateStr}_ • _Tags: ${tagsList}_\n\n`;
    }

    await sendTelegramMessage(chatId, searchReply, { parse_mode: 'Markdown' });

    return { ok: true, action: 'search_success' };
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

    if (sub.plan !== 'pro') {
      await sendTelegramMessage(
        chatId,
        '⭐️ *Fitur Eksklusif Paket Pro*\n\nFitur tanya jawab cerdas AI (`/ask`) hanya tersedia untuk pengguna paket Pro.\n\nSilakan upgrade paket Anda untuk menikmati akses AI tanpa batas:\n/dashboard/settings',
        { parse_mode: 'Markdown' }
      );
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

  // 9. Core Note Capture
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  let currentNotesCount = sub.notesTodayCount;
  if (sub.lastNoteDate !== todayStr) {
    currentNotesCount = 0;
  }

  if (sub.plan === 'standard' && currentNotesCount >= STANDARD_DAILY_QUOTA) {
    await sendTelegramMessage(
      chatId,
      `⚠️ Kuota harian Anda untuk paket Standard (${STANDARD_DAILY_QUOTA} catatan/hari) telah tercapai hari ini.\n\nUpgrade ke paket Pro untuk catatan tanpa batas: /dashboard/settings`,
      { parse_mode: 'Markdown' }
    );
    return { ok: false, error: 'daily_quota_exceeded' };
  }

  const noteId = crypto.randomUUID();
  await db.insert(notes).values({
    id: noteId,
    userId: activeKey.userId,
    content: text,
    category: 'others',
    specificTags: [],
    source: null,
    createdAt: new Date(),
  });

  await db
    .update(subscriptions)
    .set({
      notesTodayCount: currentNotesCount + 1,
      lastNoteDate: todayStr,
    })
    .where(eq(subscriptions.id, sub.id));

  // Background AI Categorization & Tagging
  (async () => {
    try {
      const tagResult = await generateNoteTags(text);
      const validCategory: NoteCategory = CATEGORIES.includes(
        tagResult.category as NoteCategory
      )
        ? (tagResult.category as NoteCategory)
        : 'others';

      await db
        .update(notes)
        .set({
          category: validCategory,
          specificTags: tagResult.specific_tags,
          source: tagResult.source || null,
        })
        .where(eq(notes.id, noteId));

      const confirmationText = formatSavedMessage(
        validCategory,
        tagResult.specific_tags
      );
      await sendTelegramMessage(chatId, confirmationText);
    } catch (bgError) {
      console.error(`[Background AI Worker] Error processing note ${noteId}:`, bgError);
    }
  })();

  return {
    ok: true,
    noteId,
    status: 'pending_tag',
  };
}
