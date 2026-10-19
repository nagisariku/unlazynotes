import { db } from '@/db';
import { notes } from '@/db/schema';
import { eq, and, gte, desc } from 'drizzle-orm';
import { subDays } from 'date-fns';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateText } from 'ai';

/**
 * Formats a Date object into human-friendly Asia/Jakarta short datetime
 * e.g. "Jum, 16 Okt 2026, 13:30"
 */
function formatNoteDate(date: Date): string {
  const dtf = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = dtf.formatToParts(date);
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '';
  return `${getPart('weekday')}, ${getPart('day')} ${getPart('month')} ${getPart('year')}, ${getPart('hour')}:${getPart('minute')}`;
}

/**
 * Formats current date and time for dynamic prompt injection
 * e.g. "Jumat, 16 Oktober 2026, 14:05 WIB"
 */
function formatCurrentTime(date: Date): string {
  const dtf = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = dtf.formatToParts(date);
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '';
  return `${getPart('weekday')}, ${getPart('day')} ${getPart('month')} ${getPart('year')}, ${getPart('hour')}:${getPart('minute')} WIB`;
}

/**
 * Answers a user's question strictly based on their notes from the last 90 days.
 * Exclusive for Pro plan subscribers.
 */
export async function answerNoteQuestion(
  userId: string,
  question: string
): Promise<string> {
  const now = new Date();
  const nowFormatted = formatCurrentTime(now);
  const ninetyDaysAgo = subDays(now, 90);

  // 1. Fetch user notes created within the last 90 days
  const userNotes = await db
    .select({
      content: notes.content,
      category: notes.category,
      specificTags: notes.specificTags,
      createdAt: notes.createdAt,
    })
    .from(notes)
    .where(
      and(
        eq(notes.userId, userId),
        gte(notes.createdAt, ninetyDaysAgo),
        eq(notes.isEncrypted, false)
      )
    )
    .orderBy(desc(notes.createdAt))
    .limit(100);

  if (userNotes.length === 0) {
    return 'Belum ada catatan yang tersimpan dalam 90 hari terakhir untuk dianalisis oleh AI.';
  }

  // 2. Format notes context with human-friendly localized timestamp and category
  const contextNotes = userNotes
    .map((n, idx) => {
      const dateStr = formatNoteDate(new Date(n.createdAt));
      const tags = (n.specificTags || []).filter(Boolean).join(', ');
      const categoryTag = tags ? `${n.category} • ${tags}` : n.category;
      return `${idx + 1}. [${dateStr}] [${categoryTag}] ${n.content}`;
    })
    .join('\n\n');

  const apiKey = process.env.AI_PROVIDER_API_KEY;
  const modelName = process.env.AI_MODEL_NAME || 'deepseek-v4.1-flash';
  const baseURL = process.env.AI_BASE_URL || 'https://api.cosmoshub.tech/v1';

  if (!apiKey || apiKey.startsWith('mock-')) {
    // Basic heuristic search fallback if no LLM key
    const match = userNotes.find((n) =>
      n.content.toLowerCase().includes(question.toLowerCase())
    );
    if (match) {
      return `Berdasarkan catatan Anda:\n"${match.content}"`;
    }
    return `Maaf, informasi mengenai "${question}" tidak ditemukan dalam catatan Anda.`;
  }

  try {
    const openaiCompatible = createOpenAICompatible({
      name: 'openai-compatible',
      baseURL,
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

/**
 * Strips markdown tables, converts any table row into bullet format,
 * strips markdown headings (#, ##, ###) into bold labels (*Label*),
 * and strips robotic conversational closing remarks.
 */
function postProcessAskResponse(text: string): string {
  let cleaned = text.trim();

  // 1. Strip Markdown Headings: Convert '# Title' or '## Title' to '*Title*'
  cleaned = cleaned.replace(/^#{1,6}\s*(.+)$/gm, (_match, title) => {
    const t = title.trim();
    if ((t.startsWith('*') && t.endsWith('*')) || (t.startsWith('**') && t.endsWith('**'))) {
      return t;
    }
    return `*${t}*`;
  });

  // 2. Convert Markdown Tables to clean Bullet Points (Telegram mobile safe)
  const lines = cleaned.split('\n');
  const processedLines: string[] = [];
  let isInsideTable = false;

  for (const line of lines) {
    const trimmed = line.trim();
    // Check if table divider like |---|---|
    if (/^\|(\s*[-:]+\s*\|)+$/.test(trimmed)) {
      isInsideTable = true;
      continue;
    }
    // Check if table row like | col1 | col2 |
    if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.includes('|', 1)) {
      const cells = trimmed
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim())
        .filter(Boolean);

      // If it looks like a header row or divider
      if (!isInsideTable && /^(no|nomor|tgl|tanggal|hari|agenda|tugas|kategori|status)$/i.test(cells[0] || '')) {
        isInsideTable = true;
        continue;
      }
      if (cells.length > 0) {
        processedLines.push(`• ${cells.join(' - ')}`);
        continue;
      }
    } else {
      isInsideTable = false;
      processedLines.push(line);
    }
  }
  cleaned = processedLines.join('\n');

  // 3. Strip robotic conversational closing remarks
  cleaned = cleaned.replace(/\s*(kalau|jika)\s+mau,?\s+(saya|aku)\s+bisa\s+bantu[^\n]*$/i, '');
  cleaned = cleaned.replace(/\s*(mau|bisa)\s+(saya|aku)\s+bantu[^\n]*$/i, '');

  const resultLines = cleaned.trim().split('\n');
  while (resultLines.length > 0) {
    const lastLine = resultLines[resultLines.length - 1]?.trim() || '';
    if (
      /^(mau\s+(saya|aku)|ada\s+yang|bisa\s+(saya|aku)|semoga\s+membantu|apakah\s+(ada|anda|kamu)|perlu\s+(saya|aku)|silakan\s+(tanya|beri|hubungi)|jangan\s+ragu|kalau\s+mau|jika\s+mau)/i.test(
        lastLine
      ) ||
      (/\?["']?$/.test(lastLine) && /(mau|bantu|bisa|perlu|inginkan)/i.test(lastLine)) ||
      /(saya|aku)\s+bisa\s+bantu\b/i.test(lastLine) ||
      lastLine === ''
    ) {
      resultLines.pop();
    } else {
      break;
    }
  }

  return resultLines.join('\n').trim();
}

    const systemPrompt = `Anda adalah asisten cerdas personal UnlazyNotes.
Waktu Saat Ini (Current Time): ${nowFormatted}

Tugas Anda adalah menjawab pertanyaan pengguna secara ringkas, to-the-point, akurat, dan strictly HANYA berdasarkan konteks catatan pengguna yang diberikan.

Prinsip Penalaran Waktu Berbasis First-Principles (Wajib Ditaati):
1. Prinsip Jendela Relevansi Konteks (Context Filtering):
   - Konteks catatan mencakup riwayat hingga 90 hari terakhir.
   - KHUSUS untuk pertanyaan seputar tugas aktif, to-do, deadline, jadwal terdekat, atau agenda: HANYA evaluasi catatan yang berumur <= 30 hari dari Current Time (abaikan to-do purba > 30 hari yang sudah usang).
   - Untuk pertanyaan seputar arsip, referensi, catatan keuangan/pengeluaran, data statis, atau informasi umum: gunakan seluruh konteks 90 hari yang relevan.

2. Algoritma Resolusi Waktu Matematis & Pemisahan Mutlak Waktu:
   - Langkah 1 (Jangkar Waktu): Setiap catatan memiliki [createdAt] sebagai titik tolak waktu mutlak.
   - Langkah 2 (Kalkulasi Target):
     * Waktu Relatif ("besok", "lusa", "3 hari lagi", "nanti malam"): Hitung matematis: Target = createdAt + offset relatif.
       (Contoh: Catatan dibuat Sabtu 17 Okt "ambil laundry lusa" -> Target = Senin 19 Okt. Jika Current Time Minggu 18 Okt, maka tugas ini MASIH MENDATANG, BELUM LEWAT).
     * Tanggal Kalender ("tanggal X" atau "X Okt"): Gunakan bulan dan tahun dari createdAt sebagai referensi penanggalan target.
   - Langkah 3 (Klasifikasi Status Objektif terhadap Current Time):
     * Waktu Saat Ini (Current Time): ${nowFormatted}.
     * Bandingkan tanggal target terhadap Current Time secara objektif dan matematis:
       - JADWAL MENDATANG (Target >= Current Time):
         Jika Current Time adalah ${nowFormatted}, maka semua tanggal setelah hari/jam ini (misalnya nanti sore/malam, 20 Okt, 21 Okt, 24 Okt, dst.) ADALAH MASA DEPAN / MENDATANG.
         DILARANG KERAS mengelompokkan tanggal masa depan (misal: 20, 21, atau 24 Okt) ke dalam kategori "Sudah Lewat"!
         DILARANG membuat paragraf atau narasi penjelas ambigu di tengah list (misal: "Catatan lain tanggal 21 & 24 Okt sudah lewat..."). JANGAN PERNAH menulis kalimat seperti itu!
       - JADWAL LAMPAU (Target < Current Time):
         DILARANG KERAS MENGARANG: Jika tanggal target pada catatan sudah berlalu terhadap waktu sekarang (misal: tanggal 16 < 19 Okt), catatan tersebut adalah JADWAL MASA LAMPAU / SUDAH LEWAT, BUKAN tugas hari ini! JANGAN PERNAH mengarang kalimat seperti "Lanjutkan tugas...", "Prioritas hari ini...", atau "Tugas tertunda yang harus dikerjakan hari ini" untuk menyisipkan jadwal lampau ke dalam daftar Hari Ini.

3. Integritas Status & Anti-Spekulasi:
   - Anggap tugas berstatus aktif kecuali ada catatan lain yang eksplisit menyatakan sudah selesai atau dibatalkan.
   - DILARANG berspekulasi dengan asumsi atau kalimat seperti "tidak ada tanda selesai", "mungkin belum selesai", dsb.

4. Format Output Respons Bersih & Mobile Ergonomics (ATURAN MUTLAK TELEGRAM):
   1. DILARANG KERAS MENGGUNAKAN TABEL MARKDOWN:
      - Jangan pernah menyajikan data dalam bentuk tabel Markdown (| Kolom | Kolom | atau |---|---|).
      - Tampilan tabel Markdown TIDAK didukung oleh Telegram Mobile, menyebabkan layout hancur dan terlipat di HP!
      - Selalu dan hanya gunakan format Timeline Bullet List (•) yang ramah layar smartphone sempit.

   2. DILARANG MENGGUNAKAN HEADING BESAR:
      - Dilarang keras menggunakan # atau ## atau ###.
      - Cukup gunakan teks tebal (*Judul:*) dengan emoji.

   3. STRUKTUR PENGELOMPOKAN MUTLAK (Strict 3 Sections, No Duplicates):
      Jika pengguna bertanya mengenai tugas, jadwal, agenda, deadline, to-do, atau hal yang perlu dikerjakan:
      WAJIB HANYA menggunakan format 3 seksi berikut secara persis (lewati seksi yang kosong, dilarang membuat nama seksi lain seperti 'Tugas (todo)' atau 'Jadwal'):

      *📌 Jadwal & Tugas Terdekat (Mendatang):*
      Urutkan murni kronologis ke depan berdasarkan tanggal terdekat:
      • Hari, DD MMM (Jam) - Agenda
      (Contoh:
      • Sen, 19 Okt (Pagi) - Deadline proposal & Post IG
      • Sel, 20 Okt (10.00) - Demo produk client
      • Rab, 21 Okt (14.00) - Ganti ban mobil
      • Sab, 24 Okt (11.00) - Ganti oli Motul di AHASS)

      *⚠️ Sudah Lewat (Overdue):*
      EKSKLUSIF HANYA untuk agenda/tugas yang teks aslinya secara eksplisit memuat tanggal/jam target yang sudah lewat terhadap Current Time (misal: "tuweeb 2, tanggal 16"):
      • Agenda (DD MMM) - keterangan singkat selisih hari lampau
      (Contoh:
      • Tuweeb 2 (16 Okt) - lewat 3 hari lalu)
      PERHATIAN: DILARANG KERAS memasukkan tugas tanpa tanggal ke seksi Overdue!

      *📝 To-Do Tanpa Tenggat (Backlog):*
      EKSKLUSIF untuk semua tugas atau to-do yang di teks catatannya TIDAK ADA tanggal atau jam target sama sekali (misal: 'deploy hotfix backend unlazynotes', 'chat rizky tanya proposal').
      JANGAN PERNAH gunakan tanggal pembuatan catatan [createdAt] sebagai deadline! Tugas tanpa tanggal target di teksnya 100% WAJIB masuk ke seksi Backlog ini, BUKAN ke Overdue!
      • Tugas aksi
      (Contoh:
      • Deploy hotfix backend unlazynotes)

   4. LARANGAN TEKS PENGANTAR & BASA-BASI (ZERO INTRO / ZERO OUTRO):
      - DILARANG menulis kalimat pengantar (seperti: "Berikut tugas dan jadwal...", "Berdasarkan catatan Anda...", "Berikut adalah daftar..."). LANGSUNG mulai respons dari seksi pertama!
      - DILARANG menulis paragraf atau catatan penjelas tambahan di tengah atau di akhir list (seperti: "**Catatan:** ada satu agenda...", "Catatan lain sudah lewat...", dsb.).
      - TANPA BASA-BASI PENUTUP: Akhiri pesan langsung pada butir bullet terakhir tanpa kalimat penutup, tawaran bantuan robotik ("Mau saya bantu...", "Ada yang perlu dibantu?"), atau salam penutup.

   - Jika pertanyaan bersifat spesifik non-jadwal (misal: total pengeluaran, nomor rekening, catatan tertentu), jawab langsung to-the-point dengan rincian singkat tanpa kelompok di atas.

5. Keselarasan Bahasa & Pemahaman Semantik:
   - Balas menggunakan bahasa yang sama dengan pertanyaan pengguna (ID/EN/dsb.).
   - Pahami format kasual/slang dan mata uang (k / rb = ribu). JANGAN campurkan mata uang berbeda tanpa konversi.

CONTOH POLA FORMAT OUTPUT (IKUTI 100%):
*📌 Jadwal & Tugas Terdekat (Mendatang):*
• Sen, 19 Okt (07.00) - Kirim proposal ke klien
• Rab, 21 Okt (14.00) - Ganti ban mobil
• Sab, 24 Okt (11.00) - Ganti oli Motul di AHASS

*⚠️ Sudah Lewat (Overdue):*
• Tuweeb 2 (16 Okt) - lewat 3 hari lalu

*📝 To-Do Tanpa Tenggat (Backlog):*
• Deploy hotfix backend unlazynotes

PENTING:
- DILARANG MENGGUNAKAN TABEL MARKDOWN (|---|).
- DILARANG MENGGUNAKAN HEADING # ATAU ##.
- JANGAN MENGELOMPOKKAN TANGGAL MASA DEPAN (20, 21, 24 Okt) KE KATEGORI SUDAH LEWAT.
- TUGAS TANPA TANGGAL (SEPERTI DEPLOY HOTFIX) 100% MASUK KE '*📝 To-Do Tanpa Tenggat (Backlog)*', BUKAN KE OVERDUE!
- LANGSUNG MULAI DARI SEKSI PERTAMA TANPA KATA PENGANTAR DAN TANPA CATATAN PENUTUP!`;

    const userPrompt = `Waktu Saat Ini (Current Time): ${nowFormatted}

Catatan pengguna yang tersimpan (hingga 90 hari terakhir):
---
${contextNotes}
---

Pertanyaan pengguna: ${question}

PANDUAN FORMAT JAWABAN (WAJIB DITAATI):
- Waktu Sekarang: ${nowFormatted}. Semua agenda dengan tanggal target >= Waktu Sekarang (misal: 19 Okt siang/sore/malam, 20 Okt, 21 Okt, 24 Okt) adalah MENDATANG.
- DILARANG KERAS menganggap hari ini adalah tanggal lain selain ${nowFormatted}!
- Jangan gunakan tabel Markdown (|---|) atau heading besar (#, ##). Gunakan bullet list (•).
- Langsung mulai dari seksi pertama tanpa kalimat pengantar dan tanpa kalimat penutup/catatan tambahan.
- Jika menjawab daftar tugas/jadwal/agenda, gunakan struktur 3 seksi ini (lewati seksi yang kosong):
*📌 Jadwal & Tugas Terdekat (Mendatang):*
• Hari, DD MMM (Jam) - Agenda
*⚠️ Sudah Lewat (Overdue):*
• Agenda (DD MMM) - keterangan selisih waktu lampau (HANYA untuk catatan yang memiliki tanggal/jam di teksnya)
*📝 To-Do Tanpa Tenggat (Backlog):*
• Tugas aksi (WAJIB untuk catatan to-do tanpa tanggal di teksnya, DILARANG memasukkannya ke Overdue)`;

    const { text } = await generateText({
      model: openaiCompatible(modelName),
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.1,
    });

    return postProcessAskResponse(text);
  } catch (err) {
    console.error('[AI /ask] Error executing question answering:', err);
    return 'Terjadi kendala saat memproses pertanyaan Anda dengan AI. Silakan coba kembali dalam beberapa saat.';
  }
}
