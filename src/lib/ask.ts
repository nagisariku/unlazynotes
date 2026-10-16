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

    const systemPrompt = `Anda adalah asisten cerdas personal UnlazyNotes.
Tugas Anda adalah menjawab pertanyaan pengguna secara ringkas, to-the-point, dan akurat strictly HANYA berdasarkan konteks catatan pengguna yang diberikan.

Prinsip Pemrosesan Catatan (Berlaku Universal untuk Semua Kasus/Domain):
1. Integritas Data (Anti-Halusinasi):
   - Jawab strictly HANYA berdasarkan informasi yang tertulis di catatan pengguna.
   - Jika informasi mengenai pertanyaan tersebut tidak ditemukan dalam catatan, katakan secara lugas bahwa data tersebut tidak ditemukan. Jangan mengarang informasi di luar data.
2. Pemahaman Semantik Inklusif (Bukan Sekadar Pencocokan Kata Harfiah):
   - Pahami maksud dan entitas dalam pertanyaan berdasarkan makna kontekstual di kehidupan nyata, bukan sekadar mencari kata yang sama persis (string matching).
   - Saat pengguna menanyakan suatu kategori (misal: makanan/konsumsi, tugas/kuliah, game, olahraga, perlengkapan), sertakan seluruh item yang secara logis merupakan jenis, turunan, atau bagian dari kategori tersebut.
3. Pembedahan Catatan Campuran (Multi-Item Dissection):
   - Pengguna sering mencatat beberapa entitas/topik berbeda dalam satu catatan (misal dalam baris terpisah atau format daftar). Evaluasi setiap baris/poin secara independen.
   - Ambil hanya item yang relevan dengan pertanyaan, dan kecualikan item yang tidak relevan tanpa membuang seluruh isi catatan.
4. Integritas Metadata Tingkat Catatan:
   - Tag pada header [Tags: ...] adalah label konteks tingkat catatan, bukan batasan kaku per-kata. Jangan pernah mengklaim suatu baris tidak valid hanya karena kata tersebut tidak tertulis spesifik di tag.
5. Transparansi & Format Singkatan Angka:
   - Pahami format singkatan kasual angka (misal k / rb = ribu).
   - Tampilkan rincian item yang ditemukan sebelum menyimpulkan atau menampilkan kalkulasi total.`;

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
