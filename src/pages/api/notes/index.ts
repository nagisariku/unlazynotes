import type { APIRoute } from 'astro';
import { db } from '@/db';
import { notes, type NoteCategory, type ScheduleMetadata, type ExpenseEntry, type IncomeEntry, type DebtEntry, type BookmarkType, type CredentialType, type TodoEntry } from '@/db/schema';
import { eq, ne, and, desc, gte, lte, sql } from 'drizzle-orm';
import { getSessionUser } from '@/lib/session';
import { startOfDay, startOfWeek, startOfMonth } from 'date-fns';
import { buildFlexibleSearchCondition, buildSearchRelevanceOrder } from '@/lib/search';
import { CATEGORIES } from '@/lib/constants';
import { generateNoteTags, extractScheduleEntries, extractFinanceEntries, extractTodoEntries, safeExtractTargetDate } from '@/lib/ai';
import { normalizeBookmarkType, normalizeCredentialType } from '@/lib/ai/modules/general';
import { encryptSecret } from '@/lib/crypto';
import { ensureUserInitialResources } from '@/lib/auth';
import { checkUserQuotaAndTier, incrementUserMonthlyNotes } from '@/lib/quota-service';
import { incrementUnorganizedCount, getOrFetchUserTags, invalidateUserTagsCache } from '@/lib/cache';
import { enrichNoteBookmarkAsync, extractCleanDomain } from '@/lib/link-enricher';
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

  const excludeEncrypted = url.searchParams.get('excludeEncrypted') === 'true';
  if (excludeEncrypted) {
    conditions.push(ne(notes.category, 'credential'), eq(notes.isEncrypted, false));
  }

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

    let todos: TodoEntry[] = Array.isArray(body.todos)
      ? body.todos
          .map((t: any) => ({
            id: String(t.id || crypto.randomUUID()),
            task: String(t.task || t.title || '').trim(),
            isCompleted: Boolean(t.isCompleted),
            completedAt: t.completedAt ? String(t.completedAt) : t.isCompleted ? new Date().toISOString() : null,
            priority: t.priority && ['low', 'normal', 'high'].includes(t.priority) ? t.priority : null,
          }))
          .filter((t: any) => t.task.length > 0)
      : [];

    // Parse targetDate from payload if provided
    if (body.targetDate) {
      const parsed = new Date(body.targetDate);
      if (!isNaN(parsed.getTime())) {
        targetDate = parsed;
      }
    }

    

    let bookmarkType: BookmarkType | null = body.bookmarkType ? normalizeBookmarkType(body.bookmarkType) : null;
    let credentialType: CredentialType | null = body.credentialType ? normalizeCredentialType(body.credentialType) : null;

    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const detectedUrls = Array.from(trimmedContent.matchAll(urlRegex), (m) => m[0]);
    const textWithoutUrls = trimmedContent.replace(urlRegex, '').trim();
    const isPureLink = detectedUrls.length > 0 && textWithoutUrls.length === 0;

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
          try {
            const clientTz = request.headers.get('x-user-timezone') || user.timezone;
            const sched = await extractScheduleEntries(trimmedContent, now, undefined, clientTz);
            schedule = sched.schedule;
            scheduleDates = sched.scheduleDates;
            targetDate = sched.targetDate;
          } catch (err) {
            console.warn('[Schedule Initial Extraction Error]:', err);
          }
        }
      }

      if (finalCategory === 'finance' && expenses.length === 0 && income.length === 0 && debt.length === 0) {
        try {
          const fin = await extractFinanceEntries(trimmedContent);
          expenses = fin.expenses;
          income = fin.income;
          debt = fin.debt;
        } catch (err) {
          console.warn('[Finance Initial Extraction Error]:', err);
        }
      }

      if (finalCategory === 'todo' && todos.length === 0) {
        try {
          todos = await extractTodoEntries(trimmedContent);
        } catch (err) {
          console.warn('[Todo Initial Extraction Error]:', err);
          todos = [
            {
              id: crypto.randomUUID(),
              task: trimmedContent,
              isCompleted: false,
              completedAt: null,
            },
          ];
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
    } else if (isPureLink) {
      // Pure link: instantly categorize as bookmark (100% deterministic external URL)
      finalCategory = 'bookmark';
      bookmarkType = bookmarkType || 'reading_other';
      const primaryUrl = detectedUrls[0];
      const domain = extractCleanDomain(primaryUrl);
      const domainName = domain.split('.')[0] || 'link';
      finalTags = [domainName];
      isProcessed = true; // Instantly available in Bookmarks tab without waiting for AI sync
    } else {
      // General note created without specific category or tags (defaults to 'others')
      // Kept as isProcessed = false so it can be curated later by AI background batch sync
      finalCategory = 'others';
      finalTags = [];
      isProcessed = false;
      await incrementUnorganizedCount(user.id);
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
        todos,
        bookmarkType,
        credentialType,
        attachments,
        createdAt: now,
      })
      .returning();

    await incrementUserMonthlyNotes(user.id);
    invalidateUserTagsCache(user.id);

    // Otomatisasi Background: Eksekusi Link/Bookmark Enrichment secara asinkron (Fire & Forget)
    if (finalCategory === 'bookmark' || /(https?:\/\/[^\s]+)/i.test(finalContent)) {
      enrichNoteBookmarkAsync(newNote.id, finalContent).catch((err) => {
        console.warn('[Background Bookmark Enrichment Error]:', err);
      });
    }

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
          targetDate: newNote.targetDate instanceof Date && !isNaN(newNote.targetDate.getTime()) ? newNote.targetDate.toISOString() : (typeof newNote.targetDate === 'string' ? newNote.targetDate : null),
          scheduleDates: newNote.scheduleDates,
          schedule: newNote.schedule,
          expenses: newNote.expenses,
          income: newNote.income,
          debt: newNote.debt,
          bookmarkType: newNote.bookmarkType,
          bookmarkMeta: newNote.bookmarkMeta,
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
