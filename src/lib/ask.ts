import { recordAiUsage } from '@/lib/ai-usage';
import { db } from '@/db';
import { notes } from '@/db/schema';
import { eq, and, gte, desc, or, inArray, ilike } from 'drizzle-orm';
import { subDays } from 'date-fns';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateText } from 'ai';
import { getOrFetchUnorganizedCount } from './cache';
import { organizeUserNotes } from './ai/batch-organizer';

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

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

// Conversational stopwords for smart search query extraction
const ASK_SEARCH_STOPWORDS = new Set([
  'apa', 'apakah', 'siapa', 'siapakah', 'kapan', 'dimana', 'bagaimana', 'kenapa', 'mengapa',
  'berapa', 'tolong', 'bisa', 'dong', 'cek', 'cari', 'carikan', 'lihat', 'tampilkan',
  'saya', 'aku', 'kami', 'kita', 'kamu', 'anda', 'dia', 'mereka',
  'ini', 'itu', 'sini', 'situ', 'sana', 'yang', 'di', 'ke', 'dari', 'pada', 'dalam', 'untuk',
  'dengan', 'dan', 'atau', 'tapi', 'tetapi', 'karena', 'jika', 'kalau', 'tentang', 'mengenai',
  'ada', 'adalah', 'yaitu', 'sudah', 'telah', 'sedang', 'akan', 'belum', 'bukan', 'tidak',
  'notes', 'note', 'catatan', 'catatanku', 'semua', 'semuanya', 'daftar', 'list',
  'the', 'is', 'at', 'which', 'on', 'in', 'to', 'for', 'from', 'with', 'and', 'or', 'my'
]);

function extractSearchTerms(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !ASK_SEARCH_STOPWORDS.has(word));
}

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

  return processedLines.join('\n').trim();
}

/**
 * Answers a user's question strictly based on their stored notes.
 * Exclusive for Pro plan subscribers.
 */
export async function answerNoteQuestion(
  userId: string,
  question: string,
  categoryFilter?: string,
  conversationHistory?: ConversationMessage[]
): Promise<string> {
  // 0. Auto-organize unorganized notes silently before answering question
  const unorganizedCount = await getOrFetchUnorganizedCount(userId);
  if (unorganizedCount > 0) {
    try {
      await organizeUserNotes(userId);
    } catch (err) {
      console.warn('[Ask] Failed silent auto-organize before question:', err);
    }
  }

  const now = new Date();
  const nowFormatted = formatCurrentTime(now);
  const oneYearAgo = subDays(now, 365);

  // 1. Fetch user notes using Smart Hybrid Retrieval (Relevance Search + Recency Anchors)
  const conditions = [
    eq(notes.userId, userId),
    eq(notes.isEncrypted, false),
  ];

  if (categoryFilter && categoryFilter !== 'workspace' && categoryFilter !== 'all') {
    conditions.push(eq(notes.category, categoryFilter as any));
    if (!['reference', 'credential', 'draft'].includes(categoryFilter)) {
      conditions.push(gte(notes.createdAt, oneYearAgo));
    }
  } else {
    conditions.push(
      or(
        inArray(notes.category, ['reference', 'credential', 'draft']),
        gte(notes.createdAt, oneYearAgo)
      )!
    );
  }

  const terms = extractSearchTerms(question);

  let searchCandidates: Array<any> = [];
  if (terms.length > 0) {
    const termConditions = terms.map((term) => ilike(notes.content, `%${term}%`));
    searchCandidates = await db
      .select({
        id: notes.id,
        content: notes.content,
        category: notes.category,
        specificTags: notes.specificTags,
        createdAt: notes.createdAt,
        bookmarkMeta: notes.bookmarkMeta,
      })
      .from(notes)
      .where(and(...conditions, or(...termConditions)))
      .orderBy(desc(notes.createdAt))
      .limit(15);
  }

  const anchorCandidates = await db
    .select({
      id: notes.id,
      content: notes.content,
      category: notes.category,
      specificTags: notes.specificTags,
      createdAt: notes.createdAt,
      bookmarkMeta: notes.bookmarkMeta,
    })
    .from(notes)
    .where(and(...conditions))
    .orderBy(desc(notes.createdAt))
    .limit(15);

  const noteMap = new Map<string, any>();
  for (const n of searchCandidates) {
    noteMap.set(n.id, n);
  }
  for (const n of anchorCandidates) {
    if (!noteMap.has(n.id)) {
      noteMap.set(n.id, n);
    }
  }

  const userNotes = Array.from(noteMap.values());
  userNotes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  if (userNotes.length > 25) {
    userNotes.length = 25;
  }

  if (userNotes.length === 0) {
    if (categoryFilter && categoryFilter !== 'workspace' && categoryFilter !== 'all') {
      return `Belum ada catatan kategori "${categoryFilter}" yang tersimpan untuk dianalisis oleh AI.`;
    }
    return 'Belum ada catatan yang tersimpan untuk dianalisis oleh AI.';
  }

  // 2. Format notes context with human-friendly localized timestamp, note ID, and category
  const contextNotes = userNotes
    .map((n, idx) => {
      const dateStr = formatNoteDate(new Date(n.createdAt));
      const tags = (n.specificTags || []).filter(Boolean).join(', ');
      const categoryTag = tags ? `${n.category} • ${tags}` : n.category;
      let noteBody = n.content;
      if (n.category === 'bookmark' && (n as any).bookmarkMeta) {
        const bm = (n as any).bookmarkMeta;
        const metaParts: string[] = [];
        if (bm.title) metaParts.push(`Judul: "${bm.title}"`);
        if (bm.caption) metaParts.push(`Caption/Post: "${bm.caption}"`);
        if (bm.aiSummary && bm.aiSummary.length > 0) {
          metaParts.push(`Ringkasan: ${bm.aiSummary.join('; ')}`);
        } else if (bm.description) {
          metaParts.push(`Deskripsi: "${bm.description}"`);
        }
        if (metaParts.length > 0) {
          noteBody = `${n.content}\n   [Metadata Bookmark -> ${metaParts.join(' | ')}]`;
        }
      }
      return `${idx + 1}. [ID: ${n.id}] [${dateStr}] [${categoryTag}] ${noteBody}`;
    })
    .join('\n\n');

  const apiKey = process.env.AI_PROVIDER_API_KEY;
  const modelName = process.env.AI_MODEL_NAME || 'gemini-3.8-flash';
  const baseURL = process.env.AI_BASE_URL || 'https://api.cosmoshub.tech/v1';

  if (!apiKey || apiKey.startsWith('mock-')) {
    throw new Error('AI Provider API key belum dikonfigurasi');
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

Prinsip Pemrosesan Catatan (Berlaku Universal untuk Semua Kasus & Domain):

1. Cakupan Respons Dinamis (Dynamic Scope - Broad vs. Targeted):
   a. Pertanyaan Menyeluruh (Broad Overview):
      - Contoh: "apa jadwal minggu ini?", "apa jadwal terdekat dan apakah ada yang kelewat?", "rangkum semua tugasku", dsb.
      - Sajikan ikhtisar 3 zona terstruktur (📌 Mendatang, ⚠️ Sudah Lewat, 📝 Backlog).
      - Batas Tampilan: Maksimal 5–7 item terpenting per zona. Sisanya beri keterangan ringkas: "(+ N agenda lainnya, cek menu '/notes')".
   b. Pertanyaan Spesifik / Terarah (Targeted Query):
      - Contoh: menanyakan topik, orang, agenda, tagihan, atau domain tertentu secara spesifik.
      - Jawab HANYA entitas/topik yang ditanyakan secara fokus dan to-the-point.
      - DILARANG KERAS menyertakan catatan dari domain atau agenda lain yang tidak berkaitan dengan pertanyaan.
      - Jika ada pembatalan atau perubahan jadwal (reschedule), jelaskan status terkininya secara ringkas.

2. Waktu Jangkar & Kalkulasi Relatif Presisi (Anchor Time Math):
   - Titik Nol ($T_0$): Gunakan tanggal dan jam pembuatan catatan ([createdAt]) sebagai waktu jangkar ($T_0$) untuk seluruh rujukan waktu relatif.
   - Jam Tanpa Hari: Jika catatan hanya menyebutkan jam (misal: "jam 4 sore", "nanti malam jam 20.00") tanpa menyebut hari/tanggal lain, maka tanggal targetnya ($T_{target}$) otomatis adalah tanggal catatan tersebut dibuat ($T_0$). JANGAN menganggapnya "tidak ada tanggal".
   - Kepastian Jadwal (Anti-Hedging): Tetapkan tanggal target secara definitif berdasarkan $T_0$. DILARANG menuliskan disclaimer ragu-ragu seperti "(tanpa tanggal jelas)" atau "(perlu dicek lagi)" untuk catatan yang memiliki timestamp dan jam.
   - Offset Hari Kalender ($T_{target} = T_0 + \\text{offset}$):
     * "besok [nama_hari]" dihitung maju 1 hari dari $T_0$. (Contoh: jika $T_0$ Senin, maka "besok Selasa" adalah Selasa esok hari, BUKAN masa lampau / minggu lalu).
     * "kemarin lusa" = $T_0 - 2$ hari.
     * "N hari setelah besok" = $T_0 + 1 + N$ hari.
   - Evaluasi Status: Bandingkan $T_{target}$ terhadap Waktu Saat Ini (${nowFormatted}). Jika $T_{target} < Current Time$, maka berstatus Masa Lampau / Sudah Lewat.

3. Isolasi Semantik Domain & Pewarisan Konteks (Domain Boundary & Context Inheritance):
   - Identifikasi domain utama dari pertanyaan pengguna (misal: pendidikan/akademik, finansial, kesehatan, pekerjaan kantor/proyek, legal, perbaikan/otomotif, dsb.).
   - Pewarisan Konteks Multi-baris & Tags: Catatan yang terdiri dari beberapa baris atau memiliki tags spesifik (misal nama tim, proyek, atau klien) saling berbagi konteks. Seluruh baris di dalam catatan tersebut (termasuk istilah umum seperti "proposal", "revisi", "laporan", "meeting") MEWARISI domain dari baris konteks dan tag catatan tersebut. JANGAN menarik istilah umum tersebut ke domain lain (misal: "deadline proposal" pada catatan yang memiliki konteks/tag tim kerja BUKAN merupakan tugas kuliah/akademik).
   - Saring catatan secara ketat: masukkan HANYA catatan yang secara hakiki sesuai dengan domain yang ditanyakan.
   - DILARANG memasukkan to-do/kegiatan dari domain lain hanya karena sama-sama memiliki tenggat waktu atau jam.

4. Integritas Data & Anti-Halusinasi:
   - Jawab strictly HANYA berdasarkan informasi tertulis di catatan pengguna.
   - Jika topik tidak ditemukan dalam catatan, nyatakan secara lugas bahwa data tidak ditemukan. Jangan mengarang data.

5. Logika Finansial & Kalkulasi Implisit:
   - Bedakan pengeluaran belanja kotor vs transfer balik (reimbursement/patungan).
   - Hitung nilai pengeluaran bersih secara akurat jika ada pembagian tagihan.
   - Bedakan kewajiban tagihan rutin dari pengeluaran santai/lifestyle.

6. Format Output Mobile-First:
   - DILARANG menggunakan tabel Markdown (|---|). Gunakan format bullet points yang rapi di smartphone.
   - DILARANG menggunakan heading Markdown besar (# atau ##). Gunakan teks tebal (bold).
   - Tanpa kata pengantar dan tanpa basa-basi penutup robotik.

7. Batasan Domain & Pencegahan Penyalahgunaan (Anti-Abuse Guardrail):
   - Anda HANYA berfungsi sebagai asisten cerdas personal UnlazyNotes untuk menganalisis, mencari, dan merangkum catatan pengguna yang ada di UnlazyNotes.
   - TOLAK secara tegas dan sopan segala pertanyaan atau permintaan di luar konteks catatan pengguna (seperti permintaan coding/pemrograman, penulisan esai/artikel bebas, matematika umum, obrolan santai di luar catatan, dsb.) agar AI tidak disalahgunakan.
   - Contoh respons penolakan: "Maaf, asisten UnlazyNotes hanya dapat menjawab pertanyaan seputar catatan pribadi Anda."
   - Pertanyaan Mengenai Model AI & Sistem:
     * Apabila pengguna bertanya mengenai model AI apa yang digunakan oleh notes/aplikasi ini (misal: "kamu pakai model apa?", "model AI apa yang digunakan notes ini?"), jawab HANYA: "Model UnlazyNotesLLM-v1".
     * DILARANG KERAS membeberkan atau memberi clue/detail teknis apapun mengenai arsitektur sistem, vendor/provider, nama model dasar (seperti Claude, Anthropic, Haiku, OpenAI, GPT, Cosmoshub, dsb.), database, server, atau sistem internal UnlazyNotes.

8. Rujukan Catatan & Tautan Interaktif (Interactive Deep-Linking):
   - Setiap catatan pada konteks memiliki ID unik dalam format: [ID: <id_catatan>].
   - Ketika menyebutkan fakta, agenda, tugas, atau rincian dari suatu catatan, SELALU sertakan tautan rujukan dengan sintaks markdown:
     \`[Lihat Catatan](note://<id_catatan>)\` atau \`[Nama/Topik Singkat](note://<id_catatan>)\`
   - Contoh: "Terdapat pengeluaran server sebesar Rp 245.000 [Lihat Catatan](note://note_fin_01)."
   - Gunakan ID catatan yang persis ada pada konteks catatan. DILARANG KERAS mengarang ID catatan yang tidak ada pada daftar catatan.`;

    let historySection = '';
    if (conversationHistory && conversationHistory.length > 0) {
      const recent = conversationHistory.slice(-6);
      historySection = `\nRiwayat Percakapan Sebelumnya:\n` +
        recent.map((m) => `${m.role === 'user' ? 'Pengguna' : 'Asisten'}: ${m.content}`).join('\n') +
        '\n---\n';
    }

    const userPrompt = `Waktu Saat Ini (Current Time): ${nowFormatted}

Catatan pengguna yang tersimpan:
---
${contextNotes}
---

${historySection}Pertanyaan pengguna saat ini: ${question}

PANDUAN FORMAT JAWABAN (WAJIB DITAATI):
- Jika pertanyaan merujuk pada percakapan sebelumnya (misal kata ganti "itu", "dia", "meetingnya", "harganya", dsb.), pahami konteks dari Riwayat Percakapan Sebelumnya.
- Tentukan apakah pertanyaan bersifat Broad Overview (menyeluruh) atau Targeted Query (spesifik):
  * Jika Broad Overview: gunakan 3 zona (*📌 Jadwal & Tugas Terdekat (Mendatang)*, *⚠️ Sudah Lewat (Overdue / Perlu Dicek)*, *📝 To-Do Tanpa Tenggat (Backlog)*). Maksimal 5-7 item per zona.
  * Jika Targeted Query: Jawab HANYA entitas/topik yang ditanyakan secara fokus dan to-the-point. DILARANG KERAS menumpahkan agenda lain yang tidak relevan!
- Waktu Sekarang: ${nowFormatted}. Semua target >= Waktu Sekarang adalah MENDATANG.
- Jangan gunakan tabel Markdown (|---|) atau heading besar (#, ##). Gunakan bullet list (•).
- Berikan tautan [Lihat Catatan](note://<id_catatan>) pada setiap butir fakta atau rujukan catatan yang relevan.
- Langsung mulai jawaban tanpa kalimat pengantar dan tanpa basa-basi penutup robotik.`;

    const result = await generateText({
      model: openaiCompatible(modelName),
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.1,
    });

    if (result.usage) {
      await recordAiUsage({
        userId,
        feature: 'ask',
        model: modelName,
        usage: result.usage,
      });
    }

    return postProcessAskResponse(result.text);
  } catch (err) {
    console.error('[AI /ask] Error executing question answering:', err);
    throw err;
  }
}
