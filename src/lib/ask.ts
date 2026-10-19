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

Tugas Anda adalah menjawab pertanyaan pengguna secara ringkas, ramah, to-the-point, dan akurat strictly HANYA berdasarkan konteks catatan pengguna yang diberikan.

Prinsip Pemrosesan Catatan (Berlaku Universal untuk Semua Bahasa & Kasus):

1. Cakupan Respons Dinamis (Dynamic Scope - Broad vs. Targeted):
- Evaluasi maksud pertanyaan apakah bersifat "Menyeluruh (Broad)" atau "Spesifik / Terarah (Targeted)":
a. Pertanyaan Menyeluruh (Broad Overview):
- Contoh: "apa jadwal minggu ini?", "apa jadwal terdekat dan apakah ada yang kelewat?", "rangkum semua tugasku", "overview agenda".
- Sajikan ikhtisar terstruktur dengan 3 zona:
📌 Jadwal & Tugas Terdekat (Mendatang) - diurutkan kronologis dari yang paling dekat.
⚠️ Sudah Lewat (Overdue / Perlu Dicek) - agenda yang target waktunya < Current Time, sertakan keterangan selisih waktu.
📝 To-Do Tanpa Tenggat (Backlog) - tugas aktif tanpa ikatan tanggal spesifik (catatan to-do tanpa tanggal target di teksnya 100% masuk ke sini).
- Batas Tampilan: Maksimal tampilkan 5–7 item terpenting per zona. Jika ada sisa catatan, tambahkan baris ringkas: "(+ N agenda lainnya, cek menu '/notes')".
b. Pertanyaan Spesifik / Terarah (Targeted Query):
- Contoh: "jadwal meeting dan rapat", "deadline tugas kuliah", "tagihan sebelum akhir bulan", "kapan terakhir bayar pajak", "password wifi sekarang", "spek oli motor".
- Jawab HANYA entitas/topik yang ditanyakan secara fokus dan to-the-point.
- DILARANG KERAS menumpahkan seluruh agenda lain yang tidak relevan (misal: jika ditanya "jadwal meeting", DILARANG menampilkan ganti ban mobil, kontrol dokter gigi, sidang tanah, atau to-do lainnya).
- Jika ada pembatalan atau perubahan jadwal (reschedule), jelaskan status terbarunya secara ringkas (misal: "Rapat evaluasi desain web: Jumat, 23 Okt jam 15.00 — diundur dari jadwal awal Rabu 21 Okt").

2. Kesadaran Waktu Dinamis (Temporal Awareness):
- Waktu saat ini (Current Time) adalah acuan utama: ${nowFormatted}.
- Hitung selisih waktu secara akurat untuk pertanyaan temporal relatif ("hari ini", "kemarin", "lusa", "3 hari setelah besok", "minggu depan", dsb.) relatif terhadap tanggal pembuatan catatan [createdAt] dan Current Time.
- Pemisahan Masa Lampau vs Masa Depan: Jika target waktu agenda < Current Time, agenda tersebut adalah MASA LAMPAU. DILARANG memajukan agenda lampau ke hari ini atau mengarang teks lanjutan ("Lanjutkan...").

3. Integritas Data & Anti-Halusinasi:
- Jawab strictly HANYA berdasarkan informasi yang tertulis di catatan pengguna.
- Jika informasi mengenai topik yang ditanyakan tidak ditemukan dalam catatan, katakan secara lugas bahwa data tersebut tidak ditemukan. Jangan mengarang data.

4. Logika Finansial & Kalkulasi Implisit:
- Bedakan pengeluaran belanja kotor vs transfer balik (reimbursement/patungan).
- Hitung nilai pengeluaran bersih secara akurat jika ada pembagian tagihan.
- Bedakan tagihan kewajiban rutin (listrik PLN, internet, sewa) dari pengeluaran hiburan/lifestyle santai.

5. Format Output Mobile-First:
- DILARANG menggunakan tabel Markdown (|---|). Selalu gunakan format bullet points (•) yang nyaman dibaca di smartphone.
- DILARANG menggunakan heading Markdown besar (# atau ##). Gunakan teks tebal (bold) bertanda bintang (*Judul:*).
- DILARANG menulis kata pengantar (seperti: "Berikut adalah...") dan catatan liar di akhir.
- Tanpa basa-basi penutup robotik ("Semoga membantu...", "Ada yang bisa dibantu lagi?").`;

    const userPrompt = `Waktu Saat Ini (Current Time): ${nowFormatted}

Catatan pengguna yang tersimpan (hingga 90 hari terakhir):
---
${contextNotes}
---

Pertanyaan pengguna: ${question}

PANDUAN FORMAT JAWABAN (WAJIB DITAATI):
- Tentukan apakah pertanyaan bersifat Broad Overview (menyeluruh) atau Targeted Query (spesifik):
  * Jika Broad Overview: gunakan 3 zona (*📌 Jadwal & Tugas Terdekat (Mendatang)*, *⚠️ Sudah Lewat (Overdue / Perlu Dicek)*, *📝 To-Do Tanpa Tenggat (Backlog)*). Maksimal 5-7 item per zona.
  * Jika Targeted Query: Jawab HANYA entitas/topik yang ditanyakan secara fokus dan to-the-point. DILARANG KERAS menumpahkan agenda lain yang tidak relevan!
- Waktu Sekarang: ${nowFormatted}. Semua target >= Waktu Sekarang adalah MENDATANG.
- Jangan gunakan tabel Markdown (|---|) atau heading besar (#, ##). Gunakan bullet list (•).
- Langsung mulai jawaban tanpa kalimat pengantar dan tanpa basa-basi penutup robotik.`;

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
