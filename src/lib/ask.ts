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
Tugas Anda adalah menjawab pertanyaan pengguna secara ringkas, to-the-point, dan ramah strictly HANYA berdasarkan konteks catatan pengguna yang disediakan di bawah ini.

Aturan Penting:
1. Jangan membuat asumsi atau halusinasi di luar data catatan yang tertera.
2. Jika jawaban tidak ditemukan dalam catatan pengguna, katakan dengan sopan bahwa informasi tersebut tidak ditemukan dalam catatan pengguna.
3. Sebutkan detail tanggal atau tag jika relevan untuk mempermudah pengguna.

---
KONTEKS CATATAN PENGGUNA (< 6 BULAN TERAKHIR):
${contextNotes}
---`;

    const { text } = await generateText({
      model: openaiCompatible(modelName),
      system: systemPrompt,
      prompt: question,
      temperature: 0.2,
    });

    return text.trim();
  } catch (err) {
    console.error('[AI /ask] Error executing question answering:', err);
    return 'Terjadi kendala saat memproses pertanyaan Anda dengan AI. Silakan coba kembali dalam beberapa saat.';
  }
}
