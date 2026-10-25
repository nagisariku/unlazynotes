import type { APIRoute } from 'astro';
import { db } from '@/db';
import { notes, type NoteCategory, type ScheduleMetadata, type ExpenseEntry, type IncomeEntry, type DebtEntry, type BookmarkType, type CredentialType } from '@/db/schema';
import { eq, and, desc, gte, lte, sql } from 'drizzle-orm';
import { getSessionUser } from '@/lib/session';
import { startOfDay, startOfWeek, startOfMonth } from 'date-fns';
import { buildFlexibleSearchCondition, buildSearchRelevanceOrder } from '@/lib/search';
import { CATEGORIES } from '@/lib/constants';
import { generateNoteTags, parseScheduleDates, parseScheduleMetadata, extractFinanceEntries } from '@/lib/ai';
import { normalizeBookmarkType, normalizeCredentialType } from '@/lib/ai/modules/general';
import { encryptSecret } from '@/lib/crypto';
import { ensureUserInitialResources } from '@/lib/auth';
import { checkUserQuotaAndTier, incrementUserMonthlyNotes } from '@/lib/quota-service';
import { extractEarliestScheduleDate } from '@/lib/date-extractor';
import { incrementUnorganizedCount, getOrFetchUserTags, invalidateUserTagsCache } from '@/lib/cache';
import crypto from 'node:crypto';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get('q')?.trim();
  const category = url.searchParams.get('category')?.trim();
  const categoriesParam = url.searchParams.get('categories')?.trim();
  const uncategorizedParam = url.searchParams.get('uncategorized')?.trim();
  const tag = url.searchParams.get('tag')?.trim();
  const range = url.searchParams.get('range')?.trim();
  const startDateStr = url.searchParams.get('startDate')?.trim();
  const endDateStr = url.searchParams.get('endDate')?.trim();

  const conditions = [eq(notes.userId, user.id)];

  if (q) {
    conditions.push(buildFlexibleSearchCondition(q));
  }

  if (uncategorizedParam === 'true') {
    conditions.push(sql`${notes.category}::text = 'others'`);
  } else if (categoriesParam) {
    const cats = categoriesParam.split(',').map((c) => c.trim()).filter(Boolean);
    if (cats.length > 0) {
      conditions.push(sql`${notes.category}::text IN (${sql.join(cats.map((c) => sql`${c}`), sql`, `)})`);
    }
  } else if (category) {
    conditions.push(sql`${notes.category}::text = ${category}`);
  }

  if (tag) {
    conditions.push(sql`${notes.specificTags} @> ${JSON.stringify([tag])}::jsonb`);
  }

  const now = new Date();
  if (range === 'today') {
    conditions.push(gte(notes.createdAt, startOfDay(now)));
  } else if (range === 'this_week') {
    conditions.push(gte(notes.createdAt, startOfWeek(now, { weekStartsOn: 1 })));
  } else if (range === 'this_month') {
    conditions.push(gte(notes.createdAt, startOfMonth(now)));
  } else if (startDateStr && endDateStr) {
    try {
      conditions.push(gte(notes.createdAt, new Date(startDateStr)));
      conditions.push(lte(notes.createdAt, new Date(endDateStr)));
    } catch {}
  }

  const orderConditions = q
    ? buildSearchRelevanceOrder(q)
    : [desc(notes.createdAt)];

  const results = await db
    .select()
    .from(notes)
    .where(and(...conditions))
    .orderBy(...orderConditions);

  return new Response(JSON.stringify({ notes: results }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async ({ request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const content = body?.content;

    if (!content || typeof content !== 'string' || !content.trim()) {
      return new Response(
        JSON.stringify({ error: 'Konten catatan tidak boleh kosong' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const trimmedContent = content.trim();

    // Pastikan user memiliki record subscription & resources
    await ensureUserInitialResources(user.id, user.preferredLocale);

    const quotaInfo = await checkUserQuotaAndTier(user.id);
    if (!quotaInfo.allowed) {
      return new Response(
        JSON.stringify({
          error: `Batas kuota bulanan Free Tier (30 catatan/bulan) telah tercapai. Kuota akan direset otomatis pada tanggal 1 awal bulan depan. Silakan upgrade ke Pro untuk catatan tanpa batas.`,
          quotaExceeded: true,
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    let existingUserTags: string[] = [];
    try {
      existingUserTags = await getOrFetchUserTags(user.id);
    } catch {
      // Non-fatal
    }

    const isSecureCategory = body.category === 'secure' || body.category === 'vault';
    const shouldEncrypt = Boolean(body.isEncrypted || body.category === 'credential' || isSecureCategory);
    const vaultKey = (body.vaultKey ? String(body.vaultKey).trim() : null) || (body.key ? String(body.key).trim() : null);
    const isPinned = Boolean(body.isPinned);
    const attachments = Array.isArray(body.attachments) ? body.attachments : [];
    const now = new Date();

    let finalContent = trimmedContent;
    let finalCategory: NoteCategory = 'others';
    let finalTags: string[] = [];
    let isEncrypted = false;
    let isProcessed = false;
    let targetDate: Date | null = null;
    let scheduleDates: string[] = Array.isArray(body.scheduleDates)
      ? body.scheduleDates.map(String).filter((d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d))
      : [];
    let schedule: ScheduleMetadata = { dates: [], isRecurring: false };
    if (body.schedule && typeof body.schedule === 'object') {
      const dates = Array.isArray(body.schedule.dates)
        ? body.schedule.dates.map(String).filter((d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d))
        : [];
      schedule = {
        dates,
        isRecurring: Boolean(body.schedule.isRecurring),
        recurrenceRule: body.schedule.recurrenceRule,
      };
      if (dates.length > 0 && scheduleDates.length === 0) {
        scheduleDates = dates;
      }
    } else if (scheduleDates.length > 0) {
      schedule = {
        dates: scheduleDates,
        isRecurring: false,
      };
    }

    let expenses: ExpenseEntry[] = Array.isArray(body.expenses)
      ? body.expenses.map((e: any) => ({
          item: String(e.item || 'Pengeluaran').trim(),
          amount: Number(e.amount) || 0,
          currency: e.currency || 'IDR',
        }))
      : [];
    let income: IncomeEntry[] = Array.isArray(body.income)
      ? body.income.map((i: any) => ({
          source: String(i.source || 'Pemasukan').trim(),
          amount: Number(i.amount) || 0,
          currency: i.currency || 'IDR',
        }))
      : [];
    let debt: DebtEntry[] = Array.isArray(body.debt)
      ? body.debt.map((d: any) => ({
          type: d.type === 'payable' ? 'payable' : 'receivable',
          person: String(d.person || 'Seseorang').trim(),
          amount: Number(d.amount) || 0,
          notes: d.notes ? String(d.notes) : undefined,
          isSettled: Boolean(d.isSettled || false),
        }))
      : [];

    // Parse targetDate from payload if provided
    if (body.targetDate) {
      const parsed = new Date(body.targetDate);
      if (!isNaN(parsed.getTime())) {
        targetDate = parsed;
      }
    }

    if (shouldEncrypt) {
      finalContent = encryptSecret(trimmedContent, user.id);
      finalCategory = 'credential';
      finalTags = Array.isArray(body.specificTags) && body.specificTags.length > 0
        ? body.specificTags
        : (isSecureCategory ? ['vault'] : ['credential']);
      isEncrypted = true;
      isProcessed = true; // Human intent: explicitly stored in vault
    } else if (
      body.category &&
      body.category !== 'others' &&
      body.category !== 'uncategorized' &&
      CATEGORIES.includes(body.category as NoteCategory)
    ) {
      // Human Intent Trumps AI: Explicit specific category selected by user (todo, schedule, finance, etc.)
      finalCategory = body.category as NoteCategory;
      finalTags = Array.isArray(body.specificTags) && body.specificTags.length > 0
        ? body.specificTags
        : [finalCategory];
      isProcessed = true; // Lock from AI modification, zero token spent!

      if (finalCategory === 'schedule') {
        if (schedule.dates.length === 0 && scheduleDates.length === 0) {
          const parsedMeta = parseScheduleMetadata(trimmedContent, now);
          schedule = parsedMeta;
          scheduleDates = parsedMeta.dates;
        }
        if (!targetDate && schedule.dates.length > 0) {
          const parsed = new Date(`${schedule.dates[0]}T00:00:00Z`);
          if (!isNaN(parsed.getTime())) targetDate = parsed;
        }
        if (!targetDate) {
          targetDate = extractEarliestScheduleDate(trimmedContent, now);
        }
      }
    } else if (body.category === 'others' && Array.isArray(body.specificTags) && body.specificTags.length > 0) {
      // Explicit 'others' with specific tags
      finalCategory = 'others';
      finalTags = body.specificTags;
      isProcessed = true;
    } else if (Array.isArray(body.specificTags) && body.specificTags.length > 0) {
      // User explicitly specified custom tags without category
      finalCategory = 'others';
      finalTags = body.specificTags;
      isProcessed = true;
    } else {
      // General note created without specific category or tags (defaults to 'others')
      // Kept as isProcessed = false so it can be curated later by AI background batch sync
      finalCategory = 'others';
      finalTags = [];
      isProcessed = false;
      await incrementUnorganizedCount(user.id);
    }

    let bookmarkType: BookmarkType | null = null;
    let credentialType: CredentialType | null = null;

    if (body.bookmarkType) {
      bookmarkType = normalizeBookmarkType(body.bookmarkType);
    }
    if (body.credentialType) {
      credentialType = normalizeCredentialType(body.credentialType);
    }

    if (finalCategory === 'bookmark' && !bookmarkType) {
      bookmarkType = 'reading_other';
    }

    if (finalCategory === 'credential' && !credentialType) {
      credentialType = 'other';
    }

    const noteId = crypto.randomUUID();

    const [newNote] = await db
      .insert(notes)
      .values({
        id: noteId,
        userId: user.id,
        content: finalContent,
        category: finalCategory,
        specificTags: finalTags,
        source: body.source || 'web',
        isEncrypted,
        vaultKey,
        isPinned,
        isProcessed,
        targetDate,
        scheduleDates,
        schedule,
        expenses,
        income,
        debt,
        bookmarkType,
        credentialType,
        attachments,
        createdAt: now,
      })
      .returning();

    await incrementUserMonthlyNotes(user.id);
    invalidateUserTagsCache(user.id);

    // Otomatisasi Background: Eksekusi LLM finance extraction (deepseek-v4.1-flash) secara asinkron
    if (finalCategory === 'finance') {
      extractFinanceEntries(finalContent)
        .then(async (fin) => {
          if (fin.expenses.length > 0 || fin.income.length > 0 || fin.debt.length > 0) {
            await db
              .update(notes)
              .set({
                expenses: fin.expenses,
                income: fin.income,
                debt: fin.debt,
              })
              .where(eq(notes.id, newNote.id));
          }
        })
        .catch((err) => {
          console.warn('[Background Finance Extraction Error]:', err);
        });
    }

    return new Response(
      JSON.stringify({
        success: true,
        note: {
          id: newNote.id,
          content: newNote.content,
          category: newNote.category,
          specificTags: newNote.specificTags,
          source: newNote.source,
          isEncrypted: newNote.isEncrypted,
          vaultKey: newNote.vaultKey,
          isPinned: newNote.isPinned,
          isProcessed: newNote.isProcessed,
          targetDate: newNote.targetDate ? newNote.targetDate.toISOString() : null,
          scheduleDates: newNote.scheduleDates,
          schedule: newNote.schedule,
          expenses: newNote.expenses,
          income: newNote.income,
          debt: newNote.debt,
          bookmarkType: newNote.bookmarkType,
          credentialType: newNote.credentialType,
          attachments: newNote.attachments,
          createdAt: newNote.createdAt.toISOString(),
        },
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    console.error('[API POST /api/notes] Error creating note:', err);
    return new Response(
      JSON.stringify({ error: 'Terjadi kesalahan internal saat menyimpan catatan' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
