import { db } from '@/db';
import { notes } from '@/db/schema';
import { eq, and, gte, desc } from 'drizzle-orm';
import { subMonths, format } from 'date-fns';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateText } from 'ai';

/**
 * Answers a user's question strictly based on their notes from the last 6 months.
 * Exclusive for Pro plan subscribers.
 */
export async function answerNoteQuestion(
  userId: string,
  question: string
): Promise<string> {
  const sixMonthsAgo = subMonths(new Date(), 6);

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

  // 2. Format notes context
  const contextNotes = userNotes
    .map((n, idx) => {
      const dateStr = format(new Date(n.createdAt), 'yyyy-MM-dd HH:mm');
      const tags = [n.category, ...(n.specificTags || [])].join(', ');
      return `[Catatan #${idx + 1}] (${dateStr}) [Tags: ${tags}]:\n${n.content}`;
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

    const systemPrompt = `Anda adalah asisten pribadi pintar UnlazyNotes.
Tugas Anda adalah menjawab pertanyaan pengguna secara ringkas, to-the-point, akurat, dan ramah strictly HANYA berdasarkan konteks catatan pengguna yang diberikan.

Aturan Penting:
1. Jangan membuat asumsi atau halusinasi di luar data catatan yang tertera.
2. Jika jawaban tidak ditemukan dalam catatan pengguna, katakan dengan sopan bahwa informasi tersebut tidak ditemukan dalam catatan pengguna.
3. Sebutkan detail tanggal, kategori, atau tag jika relevan.

Panduan Analisis Finansial & Pengeluaran:
1. Pemahaman Format Angka: Pahami singkatan nominal umum (k = ribu, rb = ribu, misal 5k = 5.000, 10rb = 10.000, 66k = 66.000, 102k = 102.000). Hitung total penjumlahan secara matematis dan presisi.
2. Catatan Multi-Item: Pengguna sering mencatat banyak pengeluaran sekaligus dalam satu catatan (misal rekapan belanja atau pengeluaran harian). Pilah setiap baris item secara semantik. Tag pada header catatan berlaku untuk catatan tersebut secara keseluruhan.
3. Pertanyaan Pengeluaran Makan / Makanan / F&B:
   - Istilah "makan", "makanan", "food", "kuliner", atau "jajan" mencakup seluruh konsumsi Food & Beverages (F&B):
     * Makanan utama/berat (nasi, ayam, baso, makan siang/malam, dll.)
     * Camilan / snack / makanan ringan (popcorn, roti, kue, jajanan, dll.)
     * Minuman konsumsi (es teh, kopi, boba, dll.)
   - JANGAN mengecualikan camilan (seperti popcorn, roti) atau minuman. Item seperti "popcorn" adalah camilan/makanan dan WAJIB dimasukkan dalam perhitungan pengeluaran makan/konsumsi.
   - Pada catatan campuran (misal "nonton 45k, popcorn 66k, gojek 23k, makan 102k"), pilah item secara tepat: nonton adalah hiburan, gojek adalah transportasi, sedangkan popcorn dan makan adalah pengeluaran makanan/konsumsi.
4. Sajikan rincian item yang dihitung beserta harganya, lalu tampilkan total akhir secara jelas.`;

    const userPrompt = `Berikut adalah catatan pengguna yang tersimpan (< 6 bulan terakhir):
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
