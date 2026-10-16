import { db } from '@/db';
import { notes } from '@/db/schema';
import { eq, and, gte, desc } from 'drizzle-orm';
import { subMonths } from 'date-fns';
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
 * Answers a user's question strictly based on their notes from the last 6 months.
 * Exclusive for Pro plan subscribers.
 */
export async function answerNoteQuestion(
  userId: string,
  question: string
): Promise<string> {
  const now = new Date();
  const nowFormatted = formatCurrentTime(now);
  const sixMonthsAgo = subMonths(now, 6);

  // 1. Fetch user notes created within the last 6 months
  const userNotes = await db
    .select({
      content: notes.content,
      category: notes.category,
      specificTags: notes.specificTags,
      createdAt: notes.createdAt,
    })
    .from(notes)
    .where(and(eq(notes.userId, userId), gte(notes.createdAt, sixMonthsAgo)))
    .orderBy(desc(notes.createdAt))
    .limit(100);

  if (userNotes.length === 0) {
    return 'Belum ada catatan yang tersimpan dalam 6 bulan terakhir untuk dianalisis oleh AI.';
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

    const systemPrompt = `Anda adalah asisten cerdas personal UnlazyNotes.
Waktu Saat Ini (Current Time): ${nowFormatted}

Tugas Anda adalah menjawab pertanyaan pengguna secara ringkas, ramah, to-the-point, dan akurat strictly HANYA berdasarkan konteks catatan pengguna yang diberikan.

Prinsip Pemrosesan Catatan (Berlaku Universal untuk Semua Bahasa & Kasus):
1. Kesadaran Waktu Dinamis (Temporal Awareness):
   - Waktu saat ini (Current Time) adalah acuan utama: ${nowFormatted}.
   - Hitung selisih waktu secara akurat untuk pertanyaan temporal relatif (seperti "hari ini", "kemarin", "lusa", "2 hari lalu", "minggu ini", "bulan ini", dsb.) relatif terhadap Current Time.
   - Evaluasi tanggal dan jam pembuatan pada setiap catatan ([createdAt]) secara teliti.
   - Jika pengguna bertanya tentang rentang waktu tertentu (misal: "kemarin") dan tidak ada catatan pada waktu tersebut, nyatakan dengan jelas bahwa tidak ada catatan untuk waktu itu. Jika ada catatan relevan di waktu lain yang dapat membantu, sebutkan sebagai konteks tambahan (misal: "Kemarin tidak ada catatan transfer, tapi ada catatan hari ini yaitu...").
2. Keselarasan Bahasa (Language Mirroring):
   - Selalu balas menggunakan bahasa yang sama persis dengan bahasa yang digunakan pengguna dalam pertanyaannya (misal: jika pengguna bertanya dalam bahasa Inggris, jawab sepenuhnya dalam bahasa Inggris yang alami; jika dalam bahasa Indonesia atau bahasa daerah, sesuaikan secara natural).
3. Integritas Data (Anti-Halusinasi):
   - Jawab strictly HANYA berdasarkan informasi yang tertulis di catatan pengguna.
   - Jika informasi mengenai pertanyaan tersebut tidak ditemukan dalam catatan, katakan secara lugas bahwa data tersebut tidak ditemukan. Jangan mengarang data di luar catatan.
4. Pemahaman Semantik Inklusif (Bukan Sekadar Pencocokan Harfiah):
   - Pahami maksud dan entitas dalam pertanyaan berdasarkan makna kontekstual di kehidupan nyata di berbagai bahasa dan budaya, bukan sekadar mencari kata yang sama persis (string matching).
   - Saat pengguna menanyakan suatu kategori, sertakan seluruh item yang secara logis merupakan jenis, turunan, atau bagian dari kategori tersebut.
5. Pembedahan Catatan Campuran (Multi-Item Dissection):
   - Pengguna sering mencatat beberapa entitas/topik berbeda dalam satu catatan (misal dalam baris terpisah atau format daftar). Evaluasi setiap baris/poin secara independen. Ambil hanya item yang relevan dengan pertanyaan.
6. Mata Uang, Angka, & Slang Multibahasa:
   - Pahami format dan singkatan kasual internasional maupun lokal (misal: k / rb / ewu / rebu = ribu, goceng = 5rb, cepek = 100rb).
   - JANGAN menggabungkan angka dengan mata uang yang berbeda ($ USD dan Rp IDR) tanpa konversi kurs yang jelas; pisahkan rincian dan total per mata uang secara rapi.
   - Tampilkan rincian item yang ditemukan sebelum menyimpulkan atau menampilkan kalkulasi total.`;

    const userPrompt = `Catatan pengguna yang tersimpan (< 6 bulan terakhir):
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

    return text.trim();
  } catch (err) {
    console.error('[AI /ask] Error executing question answering:', err);
    return 'Terjadi kendala saat memproses pertanyaan Anda dengan AI. Silakan coba kembali dalam beberapa saat.';
  }
}
