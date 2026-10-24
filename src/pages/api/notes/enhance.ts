import type { APIRoute } from 'astro';
import { getSessionUser } from '@/lib/session';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateText } from 'ai';
import { format } from 'date-fns';
import { normalizeCategory, normalizeBookmarkType, normalizeCredentialType } from '@/lib/ai/modules/general';
import { sanitizeTags } from '@/lib/ai/sanitizer';
import { normalizeNominal } from '@/lib/ai/batch-organizer';
import { heuristicTagNote } from '@/lib/ai';
import { recordAiUsage } from '@/lib/ai-usage';
import type { NoteCategory, ScheduleMetadata, ExpenseEntry, IncomeEntry, DebtEntry, BookmarkType, CredentialType } from '@/db/schema';

export const prerender = false;

/**
 * Heuristic fallback note enhancer for offline or mock AI environments.
 */
function heuristicEnhanceText(raw: string): string {
  const text = raw.trim();
  if (!text) return '';

  const isMultiItem =
    text.includes('\n') ||
    (text.includes(',') && !/^\d+,\d+$/.test(text)) ||
    (text.includes(';') && text.length > 10);

  const isTaskLike =
    /\b(beli|bayar|kerjain|bikin|buat|kirim|pesan|cek|hubungi|chat|telp|meeting|rapat|deadline|simpan)\b/i.test(
      text
    );

  if (isMultiItem && isTaskLike) {
    const rawItems = text
      .split(/[\n,;]+/)
      .map((i) => i.trim().replace(/^[-*•\d.)\]\s]+/, '').trim())
      .filter(Boolean);

    if (rawItems.length > 1) {
      return rawItems
        .map((item) => `- [ ] ${item.charAt(0).toUpperCase() + item.slice(1)}`)
        .join('\n');
    }
  }

  let polished = text
    .replace(/\byg\b/gi, 'yang')
    .replace(/\bdgn\b/gi, 'dengan')
    .replace(/\butk\b/gi, 'untuk')
    .replace(/\bbgt\b/gi, 'banget')
    .replace(/\bga\b|\bgak\b/gi, 'tidak')
    .replace(/\bsy\b/gi, 'saya')
    .replace(/\btdk\b/gi, 'tidak')
    .replace(/\bsdh\b|\bsudah\b/gi, 'sudah')
    .replace(/\bblm\b/gi, 'belum')
    .replace(/\btlg\b/gi, 'tolong')
    .replace(/\bkmrn\b/gi, 'kemarin')
    .replace(/\bbsk\b/gi, 'besok');

  polished = polished.charAt(0).toUpperCase() + polished.slice(1);
  return polished;
}

export const POST: APIRoute = async ({ request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: { text?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const rawText = body.text ? String(body.text).trim() : '';
  if (!rawText) {
    return new Response(JSON.stringify({ error: 'Teks catatan tidak boleh kosong' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = process.env.AI_PROVIDER_API_KEY;
  const modelName = process.env.AI_MODEL_NAME || 'deepseek-v4.1-flash';
  const baseURL = process.env.AI_BASE_URL || 'https://api.cosmoshub.tech/v1';

  // Fallback to heuristic if no LLM key configured or mock
  if (!apiKey || apiKey.startsWith('mock-')) {
    const enhancedText = heuristicEnhanceText(rawText);
    const fallbackTagResult = heuristicTagNote(rawText);
    return new Response(
      JSON.stringify({
        success: true,
        enhancedText,
        category: fallbackTagResult.category,
        tags: fallbackTagResult.specific_tags,
        schedule: fallbackTagResult.schedule,
        scheduleDates: fallbackTagResult.schedule_dates,
        expenses: fallbackTagResult.expenses,
        income: fallbackTagResult.income,
        debt: fallbackTagResult.debt,
        bookmarkType: fallbackTagResult.bookmarkType || null,
        credentialType: fallbackTagResult.credentialType || null,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    const openaiCompatible = createOpenAICompatible({
      name: 'openai-compatible',
      baseURL,
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const now = new Date();
    const formattedRefDate = format(now, 'yyyy-MM-dd (EEEE)');

    const prompt = `You are an expert AI editor, writer, and classifier for UnlazyNotes.
Analyze the user's note and return a strict JSON object:
{
  "enhanced_text": "Enhanced, polished, and structured text...",
  "category": "bookmark" | "schedule" | "finance" | "credential" | "todo" | "draft" | "reference" | "random-yap" | "others",
  "specific_tags": ["tag-1", "tag-2"],
  "bookmark_type": "tech_dev" | "media_social" | "work_docs" | "places" | "shopping" | "reading_other" (if category is bookmark),
  "credential_type": "account" | "network" | "identity_finance" | "license" | "other" (if category is credential),
  "schedule": {"dates": ["YYYY-MM-DD"], "isRecurring": boolean, "recurrenceRule"?: {...}},
  "schedule_dates": ["YYYY-MM-DD"],
  "expenses": [{"item": string, "amount": number, "currency": "IDR"}],
  "income": [{"source": string, "amount": number, "currency": "IDR"}],
  "debt": [{"type": "payable"|"receivable", "person": string, "amount": number, "notes"?: string}]
}

Enhance Text Rules:
1. Perbaiki dan rapihkan format penulisan, struktur markdown/bullets/checkboxes, tanda baca, huruf kapital, dan tata bahasa alami (bahasa Indonesia atau Inggris sesuai bahasa input).
2. Ringkas dan buat lebih enak dibaca TANPA kehilangan satu pun ide, nama, nomor, tautan, atau informasi detail penting.
3. Jika catatan memuat daftar tugas atau rencana aksi, gunakan format checklist Markdown (- [ ] Tugas).
4. Dilarang menambahkan basa-basi, salam, pengantar, atau komentar tambahan. "enhanced_text" harus murni teks catatan pengguna yang sudah dipoles.

Classification & Tagging Rules:
- Pilih tepat 1 kategori dari 9 pilar kanonik:
  1. "bookmark": Pointer link/URL (Web, Maps, Shopee, YouTube, GitHub).
  2. "schedule": Dimensi waktu, jadwal, jam ("jam 14.00"), tanggal, atau rutinitas berulang (anchor: ${formattedRefDate}).
  3. "finance": Nilai transaksi uang (pengeluaran, pemasukan gaji/fee, pinjaman/talangan). Konversi nominal ke integer murni (35k->35000, 3.5jt->3500000, 50rb->50000). Utang/talangan WAJIB masuk "debt", bukan "expenses"!
  4. "credential": Akun/password, Wi-Fi SSID/pass, No Rekening/VA, NIK/KK, API token.
  5. "todo": Kehendak aksi / actionable task di dunia nyata (belanja, follow-up, riset, birokrasi).
  6. "draft": Materi tulisan/pesan untuk audiens eksternal (draf izin, draf email, caption medsos).
  7. "reference": Fakta statis objektif / data lookup (ukuran, alamat lengkap, resep, dosis obat formal, kutipan ayat suci).
  8. "random-yap": Refleksi subjektif dunia internal (log gejala fisik/kesehatan "asam lambung perih", "migrain", curhat mood, review bebas).
  9. "others": Log repetisi olahraga ("10k langkah", "squat 60kg"), ide konten/fitur sekilas, token OTP.
- specific_tags: 2 hingga 4 tag domain-aware (lowercase-with-hyphens).

Input Note:
"""${rawText}"""`;

    const result = await generateText({
      model: openaiCompatible(modelName),
      temperature: 0.1,
      prompt,
    });

    // Record token usage for admin observability
    await recordAiUsage({
      userId: user.id,
      feature: 'enhance',
      model: modelName,
      usage: result.usage,
    });

    let rawJson = result.text.trim();
    const match = rawJson.match(/\{[\s\S]*\}/);
    if (match) {
      rawJson = match[0];
    }

    let parsed: any = {};
    try {
      parsed = JSON.parse(rawJson);
    } catch {
      console.warn('[AI Note Enhance] Failed to parse JSON, falling back to raw text string');
      const enhancedText = result.text.replace(/```(?:json)?\s*/gi, '').replace(/\s*```$/gi, '').trim() || heuristicEnhanceText(rawText);
      const fallbackTagResult = heuristicTagNote(rawText);
      return new Response(
        JSON.stringify({
          success: true,
          enhancedText,
          category: fallbackTagResult.category,
          tags: fallbackTagResult.specific_tags,
          schedule: fallbackTagResult.schedule,
          scheduleDates: fallbackTagResult.schedule_dates,
          expenses: fallbackTagResult.expenses,
          income: fallbackTagResult.income,
          debt: fallbackTagResult.debt,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const enhancedText = parsed.enhanced_text ? String(parsed.enhanced_text).trim() : heuristicEnhanceText(rawText);
    const category: NoteCategory = normalizeCategory(parsed.category || '', rawText);

    let rawTags: string[] = [];
    if (Array.isArray(parsed.specific_tags)) rawTags = parsed.specific_tags;
    else if (Array.isArray(parsed.tags)) rawTags = parsed.tags;
    const cleanTags = sanitizeTags(rawTags, category, rawText, 5);

    // Extract schedule
    let schedule: ScheduleMetadata | undefined = undefined;
    let scheduleDates: string[] | undefined = undefined;
    if (category === 'schedule') {
      const dates = Array.isArray(parsed.schedule?.dates)
        ? parsed.schedule.dates.map(String).filter((d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d))
        : Array.isArray(parsed.schedule_dates)
        ? parsed.schedule_dates.map(String).filter((d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d))
        : [];

      schedule = {
        dates,
        isRecurring: Boolean(parsed.schedule?.isRecurring),
        recurrenceRule: parsed.schedule?.recurrenceRule,
      };
      scheduleDates = dates;
    }

    // Extract finance
    let expenses: ExpenseEntry[] | undefined = undefined;
    let income: IncomeEntry[] | undefined = undefined;
    let debt: DebtEntry[] | undefined = undefined;
    if (category === 'finance') {
      if (Array.isArray(parsed.expenses) && parsed.expenses.length > 0) {
        expenses = parsed.expenses
          .filter((e: any) => e && (e.item || e.description))
          .map((e: any) => ({
            item: String(e.item || e.description || 'Pengeluaran').trim(),
            amount: normalizeNominal(e.amount),
            currency: String(e.currency || 'IDR').toUpperCase(),
          }))
          .filter((e: any) => e.amount > 0);
      }

      if (Array.isArray(parsed.income) && parsed.income.length > 0) {
        income = parsed.income
          .filter((i: any) => i && (i.source || i.description || i.item))
          .map((i: any) => ({
            source: String(i.source || i.description || i.item || 'Pemasukan').trim(),
            amount: normalizeNominal(i.amount),
            currency: String(i.currency || 'IDR').toUpperCase(),
          }))
          .filter((i: any) => i.amount > 0);
      }

      if (Array.isArray(parsed.debt) && parsed.debt.length > 0) {
        debt = parsed.debt
          .filter((d: any) => d && (d.person || d.name || d.item))
          .map((d: any) => {
            const rawType = String(d.type || '').toLowerCase();
            const type: 'payable' | 'receivable' = rawType.includes('pay') || rawType.includes('utang') ? 'payable' : 'receivable';
            return {
              type,
              person: String(d.person || d.name || 'Seseorang').trim(),
              amount: normalizeNominal(d.amount),
              notes: d.notes ? String(d.notes).trim() : undefined,
              isSettled: Boolean(d.isSettled || false),
            };
          })
          .filter((d: any) => d.amount > 0);
      }
    }

    const bookmarkType = category === 'bookmark' ? normalizeBookmarkType(parsed.bookmark_type || parsed.bookmarkType) : null;
    const credentialType = category === 'credential' ? normalizeCredentialType(parsed.credential_type || parsed.credentialType) : null;

    return new Response(
      JSON.stringify({
        success: true,
        enhancedText,
        category,
        tags: cleanTags,
        schedule,
        scheduleDates,
        expenses,
        income,
        debt,
        bookmarkType,
        credentialType,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    console.warn('[AI Note Enhance] LLM call failed, falling back to heuristic:', err?.message);
    const enhancedText = heuristicEnhanceText(rawText);
    const fallbackTagResult = heuristicTagNote(rawText);
    return new Response(
      JSON.stringify({
        success: true,
        enhancedText,
        category: fallbackTagResult.category,
        tags: fallbackTagResult.specific_tags,
        schedule: fallbackTagResult.schedule,
        scheduleDates: fallbackTagResult.schedule_dates,
        expenses: fallbackTagResult.expenses,
        income: fallbackTagResult.income,
        debt: fallbackTagResult.debt,
        bookmarkType: fallbackTagResult.bookmarkType || null,
        credentialType: fallbackTagResult.credentialType || null,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
