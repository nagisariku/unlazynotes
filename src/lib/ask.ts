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
 * Strips robotic conversational closing remarks from LLM responses if present
 */
function cleanClosingRemarks(text: string): string {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/\s*(kalau|jika)\s+mau,?\s+(saya|aku)\s+bisa\s+bantu[^\n]*$/i, '');
  cleaned = cleaned.replace(/\s*(mau|bisa)\s+(saya|aku)\s+bantu[^\n]*$/i, '');

  const lines = cleaned.trim().split('\n');
  while (lines.length > 0) {
    const lastLine = lines[lines.length - 1]?.trim() || '';
    if (
      /^(mau\s+(saya|aku)|ada\s+yang|bisa\s+(saya|aku)|semoga\s+membantu|apakah\s+(ada|anda|kamu)|perlu\s+(saya|aku)|silakan\s+(tanya|beri|hubungi)|jangan\s+ragu|kalau\s+mau|jika\s+mau)/i.test(
        lastLine
      ) ||
      (/\?["']?$/.test(lastLine) && /(mau|bantu|bisa|perlu|inginkan)/i.test(lastLine)) ||
      /(saya|aku)\s+bisa\s+bantu\b/i.test(lastLine) ||
      lastLine === ''
    ) {
      lines.pop();
    } else {
      break;
    }
  }
  return lines.join('\n').trim();
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
     * Tanggal Kalender ("tanggal X" tanpa bulan): Gunakan bulan dan tahun dari createdAt sebagai referensi penanggalan target.
   - Langkah 3 (Klasifikasi Status Objektif terhadap Current Time):
     * DILARANG KERAS MENGARANG: Jika tanggal target pada catatan sudah berlalu terhadap waktu sekarang (misal: tanggal 16 < 19 Okt), catatan tersebut adalah JADWAL MASA LAMPAU / SUDAH LEWAT, BUKAN tugas hari ini! JANGAN PERNAH mengarang kalimat seperti "Lanjutkan tugas...", "Prioritas hari ini...", atau "Tugas tertunda yang harus dikerjakan hari ini" untuk menyisipkan jadwal lampau ke dalam daftar Hari Ini.
     * Jika Target < Current Time -> HANYA BOLEH dimasukkan ke:
       ⚠️ Catatan / Jadwal yang Sudah Lewat (perlu dicek):
     * Jika Target >= Current Time -> Masukkan ke:
       📌 Mendatang / Minggu Ini:
       (urutkan kronologis dari yang paling dekat ke depan).
     * Jika catatan sama sekali tidak memiliki penanda waktu -> Masukkan ke:
       📝 To-Do Tanpa Tenggat:
       (JANGAN diasumsikan jatuh tempo hari ini).

3. Integritas Status & Anti-Spekulasi:
   - Anggap tugas berstatus aktif kecuali ada catatan lain yang eksplisit menyatakan sudah selesai atau dibatalkan.
   - DILARANG berspekulasi dengan asumsi atau kalimat seperti "tidak ada tanda selesai", "mungkin belum selesai", dsb.

4. Format Respons Bersih & Mobile Ergonomics:
   - DILARANG menggunakan heading markdown besar (#, ##, ###).
   - DILARANG KERAS menyertakan penutup basa-basi atau tawaran bantuan di akhir respons (seperti: "Mau saya bantu...", "Ada yang perlu dibantu lagi?", "Semoga membantu!", dsb.). Akhiri jawaban tepat setelah data/poin terakhir tanpa kalimat penutup tambahan apapun.
   - Sajikan dalam format ringkas to-the-point maksimal 10-15 baris.
   - Jika menjawab daftar tugas / jadwal / agenda / to-do, kelompokkan secara rapi (lewati kelompok yang kosong):
     ⚠️ Catatan / Jadwal yang Sudah Lewat (perlu dicek):
     • [nama item] - [keterangan waktu / tanggal lampau]
     📌 Mendatang / Minggu Ini:
     • [nama item] - [keterangan target waktu ke depan, urutkan dari terdekat]
     📝 To-Do Tanpa Tenggat:
     • [nama item]
   - Jika pertanyaan bersifat spesifik non-jadwal (misal: total pengeluaran, nomor rekening, catatan tertentu), jawab langsung to-the-point dengan rincian singkat tanpa kelompok di atas.

5. Keselarasan Bahasa & Pemahaman Semantik:
   - Balas menggunakan bahasa yang sama dengan pertanyaan pengguna (ID/EN/dsb.).
   - Pahami format kasual/slang dan mata uang (k / rb = ribu). JANGAN campurkan mata uang berbeda tanpa konversi.

PENTING: Selalu akhiri respons langsung pada data/poin terakhir. JANGAN PERNAH menambahkan pertanyaan penutup, penawaran follow-up, atau basa-basi robotik di akhir jawaban!`;

    const userPrompt = `Catatan pengguna yang tersimpan (hingga 90 hari terakhir):
---
${contextNotes}
---

Pertanyaan pengguna: ${question}`;

    const { text } = await generateText({
      model: openaiCompatible(modelName),
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.1,
    });

    return cleanClosingRemarks(text);
  } catch (err) {
    console.error('[AI /ask] Error executing question answering:', err);
    return 'Terjadi kendala saat memproses pertanyaan Anda dengan AI. Silakan coba kembali dalam beberapa saat.';
  }
}
