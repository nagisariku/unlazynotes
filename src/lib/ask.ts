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
 * Answers a user's question strictly based on their notes from the last 30 days.
 * Exclusive for Pro plan subscribers.
 */
export async function answerNoteQuestion(
  userId: string,
  question: string
): Promise<string> {
  const now = new Date();
  const nowFormatted = formatCurrentTime(now);
  const thirtyDaysAgo = subDays(now, 30);

  // 1. Fetch user notes created within the last 30 days
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
        gte(notes.createdAt, thirtyDaysAgo),
        eq(notes.isEncrypted, false)
      )
    )
    .orderBy(desc(notes.createdAt))
    .limit(100);

  if (userNotes.length === 0) {
    return 'Belum ada catatan yang tersimpan dalam 30 hari terakhir untuk dianalisis oleh AI.';
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
  const lines = text.trim().split('\n');
  while (lines.length > 0) {
    const lastLine = lines[lines.length - 1]?.trim() || '';
    if (
      /(mau\s+(saya|aku)\s+bantu|ada\s+yang\s+(bisa|ingin|perlu)\s+(di|saya|aku)|semoga\s+membantu|ada\s+pertanyaan\s+lain|apakah\s+ada\s+yang|bisa\s+saya\s+bantu)/i.test(
        lastLine
      ) ||
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

Tugas Anda adalah menjawab pertanyaan pengguna secara ringkas, to-the-point, akurat, dan strictly HANYA berdasarkan konteks catatan pengguna (30 hari terakhir) yang diberikan.

Pedoman Temporal Anchoring & Format (Wajib Ditaati):
1. Formula Temporal Anchoring (Wajib Dihitung Matematis):
   - Setiap catatan diawali dengan timestamp pembuatan [createdAt].
   - Kata Waktu Relatif ("besok", "lusa", "3 hari lagi", "nanti malam"):
     Hitung target waktu secara matematis: Target = createdAt + offset relatif.
     (Misal: Catatan dibuat Sabtu 17 Okt "ambil laundry lusa" -> Target = Senin 19 Okt. Jika Current Time Minggu 18 Okt, maka tugas ini MASIH MENDATANG, BELUM LEWAT).
   - Tanggal Mutlak ("tanggal 16", "16 Okt", "20 Okt"):
     Bandingkan langsung dengan Current Time. Jika Current Time 18 Okt, maka "tanggal 16" adalah 2 hari lalu / SUDAH LEWAT. JANGAN PERNAH dimasukkan ke "Hari ini" atau "Mendatang".
   - Tanpa Keterangan Waktu ("deploy hotfix", "beli kemeja", "baca buku"):
     Jadikan createdAt sebagai acuan dan kelompokkan ke "To-Do Tanpa Tenggat". JANGAN berasumsi tugas tersebut untuk hari ini.

2. Format Jawaban Padat, Rapi, & Mobile-Friendly:
   - DILARANG menggunakan heading markdown besar (#, ##, ###).
   - DILARANG KERAS membuat penutup basa-basi atau tawaran bantuan di akhir respons (seperti: "Mau saya bantu...", "Ada yang perlu dibantu lagi?", "Semoga membantu!", dsb.). Akhiri jawaban tepat setelah data/poin terakhir tanpa kalimat penutup tambahan apapun.
   - Maksimal 10-15 baris.
   - Jika pertanyaan meminta daftar tugas / jadwal / agenda / to-do, kelompokkan secara ringkas (lewati kelompok yang kosong):
     ⚠️ *Sudah Lewat (Overdue):*
     • [nama item] - [keterangan waktu / tanggal]
     📌 *Mendatang / Minggu Ini:*
     • [nama item] - [keterangan target waktu, urutkan dari terdekat]
     📝 *To-Do Tanpa Tenggat:*
     • [nama item]
   - Jika pertanyaan bersifat spesifik non-jadwal (misal: pengeluaran, nomor rekening, catatan tertentu), jawab langsung to-the-point dengan rincian singkat tanpa kelompok di atas.

3. Integritas Data & Anti-Halusinasi:
   - Jawab strictly HANYA berdasarkan informasi yang tertulis di catatan pengguna.
   - Jika informasi tidak ditemukan, katakan secara lugas bahwa data tidak ditemukan. Jangan mengarang data di luar catatan.

4. Keselarasan Bahasa (Language Mirroring):
   - Balas menggunakan bahasa yang sama dengan pertanyaan pengguna (ID/EN/dsb.).

5. Pemahaman Semantik & Angka/Mata Uang:
   - Pahami makna kontekstual dan kategori (k / rb = ribu, 20k = Rp 20.000). Jangan campurkan mata uang berbeda tanpa konversi.
   - Evaluasi setiap baris/butir secara independen jika catatan berisi banyak poin.

PENTING: Selalu akhiri respons langsung pada data/poin terakhir. JANGAN PERNAH menambahkan pertanyaan penutup, penawaran follow-up, atau basa-basi robotik di akhir jawaban!`;

    const userPrompt = `Catatan pengguna yang tersimpan (< 30 hari terakhir):
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
