import type { APIRoute } from 'astro';
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

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  // 1. Validasi Keamanan Header Secret Token
  const configuredSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const incomingSecret = request.headers.get('X-Telegram-Bot-Api-Secret-Token');

  if (configuredSecret && configuredSecret !== 'super_secret_webhook_token_123') {
    if (incomingSecret !== configuredSecret) {
      return new Response('Unauthorized', { status: 401 });
    }
  } else if (configuredSecret && incomingSecret && incomingSecret !== configuredSecret) {
    return new Response('Unauthorized', { status: 401 });
  }

  // 2. Parsing Payload
  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const message = body?.message || body?.edited_message;
  if (!message || !message.chat) {
    return new Response(JSON.stringify({ ok: true, ignored: 'no_message' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const chatId = String(message.chat.id);
  const rawText: string | undefined = message.text || message.caption;

  // Abaikan media tanpa teks takarir (caption)
  if (!rawText || !rawText.trim()) {
    return new Response(JSON.stringify({ ok: true, ignored: 'empty_text' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const text = rawText.trim();

  // 3. Penanganan Command: /start atau /help
  if (text.startsWith('/start') || text.startsWith('/help')) {
    sendTelegramMessage(chatId, HELP_MESSAGE, { parse_mode: 'Markdown' });
    return new Response(JSON.stringify({ ok: true, action: 'help' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 4. Penanganan Command: /login <api_key>
  if (text.startsWith('/login')) {
    const parts = text.split(/\s+/);
    const rawApiKey = parts[1];

    if (!rawApiKey) {
      sendTelegramMessage(
        chatId,
        'Format salah. Silakan gunakan format:\n`/login <api_key>`\n\nContoh:\n`/login unz_1234567890abcdef`',
        { parse_mode: 'Markdown' }
      );
      return new Response(JSON.stringify({ ok: true, action: 'login_missing_key' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const keyHash = hashApiKey(rawApiKey);
    const [matchedKey] = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.isActive, true)))
      .limit(1);

    if (!matchedKey) {
      sendTelegramMessage(
        chatId,
        '❌ API Key tidak valid atau dinonaktifkan. Pastikan Anda menyalin API Key yang benar dari halaman Settings di web dashboard.',
        { parse_mode: 'Markdown' }
      );
      return new Response(JSON.stringify({ ok: true, action: 'login_invalid_key' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Tautkan telegram_chat_id ke user
    await db
      .update(apiKeys)
      .set({ telegramChatId: chatId })
      .where(eq(apiKeys.id, matchedKey.id));

    sendTelegramMessage(
      chatId,
      `✅ *Akun Berhasil Terhubung!*\n\nSelamat datang di UnlazyNotes. Anda sekarang dapat langsung mengirim teks, tautan, ide, to-do list, atau draf ke chat ini untuk disimpan dan di-tag otomatis oleh AI.\n\n${SECURITY_DISCLAIMER}`,
      { parse_mode: 'Markdown' }
    );

    return new Response(JSON.stringify({ ok: true, action: 'login_success' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 5. Penanganan Command: /logout
  if (text.startsWith('/logout')) {
    await db
      .update(apiKeys)
      .set({ telegramChatId: null })
      .where(eq(apiKeys.telegramChatId, chatId));

    sendTelegramMessage(
      chatId,
      '🔌 Akun Telegram Anda telah berhasil diputus dari UnlazyNotes. Untuk menyambungkannya kembali, gunakan `/login <api_key>`.',
      { parse_mode: 'Markdown' }
    );

    return new Response(JSON.stringify({ ok: true, action: 'logout_success' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 6. Validasi Autentikasi Pengguna untuk Command Lain & Catatan Biasa
  const [activeKey] = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.telegramChatId, chatId), eq(apiKeys.isActive, true)))
    .limit(1);

  if (!activeKey) {
    sendTelegramMessage(
      chatId,
      '🔒 Akun Telegram Anda belum terhubung ke UnlazyNotes.\n\nSilakan buka dashboard unlazynotes.com -> Settings -> Salin API Key Anda, lalu kirim ke sini:\n`/login <api_key>`',
      { parse_mode: 'Markdown' }
    );
    return new Response(JSON.stringify({ ok: true, action: 'unauthenticated' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Periksa langganan pengguna
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, activeKey.userId))
    .limit(1);

  if (!sub || sub.status !== 'active') {
    sendTelegramMessage(
      chatId,
      '⚠️ Paket langganan Anda tidak aktif atau telah kedaluwarsa.\n\nSilakan perpanjang langganan Anda di web dashboard untuk terus menggunakan bot pencatat UnlazyNotes: https://unlazynotes.com/pricing',
      { parse_mode: 'Markdown' }
    );
    return new Response(JSON.stringify({ ok: true, action: 'subscription_inactive' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 7. Penanganan Command: /tags
  if (text === '/tags') {
    const userNotes = await db
      .select({
        category: notes.category,
        specificTags: notes.specificTags,
      })
      .from(notes)
      .where(eq(notes.userId, activeKey.userId));

    if (userNotes.length === 0) {
      sendTelegramMessage(chatId, 'Belum ada catatan atau tag yang tersimpan.');
      return new Response(JSON.stringify({ ok: true, action: 'tags_empty' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
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
    sendTelegramMessage(chatId, msg, { parse_mode: 'Markdown' });

    return new Response(JSON.stringify({ ok: true, action: 'tags_list' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 8. Penanganan Command: /tags <nama_tag>
  if (text.startsWith('/tags ')) {
    const targetTagRaw = text.substring(6).trim();
    const targetTag = normalizeTag(targetTagRaw);

    if (!targetTag) {
      sendTelegramMessage(chatId, 'Gunakan format: `/tags <nama_tag>`', { parse_mode: 'Markdown' });
      return new Response(JSON.stringify({ ok: true, action: 'tags_filter_missing' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Cek apakah tag adalah draft
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

      const draftMsg = `📝 Ditemukan ${totalDrafts} catatan berlabel *draft*.\n\nUntuk draf atau teks panjang, lihat selengkapnya di web dashboard demi kenyamanan membaca:\nhttps://unlazynotes.com/dashboard?tag=draft`;
      sendTelegramMessage(chatId, draftMsg, { parse_mode: 'Markdown' });

      return new Response(JSON.stringify({ ok: true, action: 'tags_draft_redirect' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Kueri catatan berdasarkan kategori atau specific tags
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
      sendTelegramMessage(chatId, `Tidak ditemukan catatan dengan label \`${targetTag}\`.`, {
        parse_mode: 'Markdown',
      });
      return new Response(JSON.stringify({ ok: true, action: 'tags_none_found' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Periksa apakah terdapat catatan berteks panjang (> 300 char)
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
      reply += `\n💡 _Beberapa catatan memiliki draf/teks panjang. Lihat selengkapnya di web dashboard:_\nhttps://unlazynotes.com/dashboard?tag=${encodeURIComponent(
        targetTag
      )}`;
    }

    sendTelegramMessage(chatId, reply, { parse_mode: 'Markdown' });

    return new Response(JSON.stringify({ ok: true, action: 'tags_filtered' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 9. Penanganan Command: /search <kata_kunci>
  if (text.startsWith('/search')) {
    const keyword = text.replace(/^\/search\s*/, '').trim();

    if (!keyword) {
      sendTelegramMessage(chatId, 'Gunakan format: `/search <kata_kunci>`', {
        parse_mode: 'Markdown',
      });
      return new Response(JSON.stringify({ ok: true, action: 'search_missing_keyword' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
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
      sendTelegramMessage(
        chatId,
        `🔍 Tidak ditemukan catatan dengan kata kunci "*${keyword}*".`,
        { parse_mode: 'Markdown' }
      );
      return new Response(JSON.stringify({ ok: true, action: 'search_empty' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
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

    sendTelegramMessage(chatId, searchReply, { parse_mode: 'Markdown' });

    return new Response(JSON.stringify({ ok: true, action: 'search_success' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 10. Core Capture Loop: Catatan Teks Bebas (Asynchronous & Non-Blocking)
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  let currentNotesCount = sub.notesTodayCount;
  if (sub.lastNoteDate !== todayStr) {
    currentNotesCount = 0;
  }

  // Validasi Kuota Harian untuk Paket Standard
  if (sub.plan === 'standard' && currentNotesCount >= STANDARD_DAILY_QUOTA) {
    sendTelegramMessage(
      chatId,
      `⚠️ Kuota harian Anda untuk paket Standard (${STANDARD_DAILY_QUOTA} catatan/hari) telah tercapai hari ini.\n\nUpgrade ke paket Pro untuk catatan tanpa batas: https://unlazynotes.com/pricing`,
      { parse_mode: 'Markdown' }
    );
    return new Response(
      JSON.stringify({ ok: false, error: 'daily_quota_exceeded' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Langkah 1: Simpan Cepat ke Database dengan status sementara
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

  // Perbarui Counter Kuota di Subscription
  await db
    .update(subscriptions)
    .set({
      notesTodayCount: currentNotesCount + 1,
      lastNoteDate: todayStr,
    })
    .where(eq(subscriptions.id, sub.id));

  // Langkah 2: Background Task Asinkron (AI Tagging & Notifikasi Balasan)
  // Tidak di-await agar HTTP Response 200 OK kembali secara instan (<500ms)
  (async () => {
    try {
      const tagResult = await generateNoteTags(text);

      // Pastikan category adalah salah satu enum yang valid
      const validCategory: NoteCategory = CATEGORIES.includes(
        tagResult.category as NoteCategory
      )
        ? (tagResult.category as NoteCategory)
        : 'others';

      // Update baris catatan dengan hasil AI
      await db
        .update(notes)
        .set({
          category: validCategory,
          specificTags: tagResult.specific_tags,
          source: tagResult.source || null,
        })
        .where(eq(notes.id, noteId));

      // Kirim pesan balasan konfirmasi ke user
      const confirmationText = formatSavedMessage(
        validCategory,
        tagResult.specific_tags
      );
      await sendTelegramMessage(chatId, confirmationText);
    } catch (bgError) {
      console.error(`[Background AI Worker] Error processing note ${noteId}:`, bgError);
    }
  })();

  // Langkah 3: Kembalikan 200 OK Instan (<500 ms) ke Telegram Webhook
  return new Response(
    JSON.stringify({
      ok: true,
      noteId,
      status: 'pending_tag',
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
};
