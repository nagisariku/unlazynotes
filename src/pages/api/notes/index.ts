import type { APIRoute } from 'astro';
import { db } from '@/db';
import { notes, type NoteCategory } from '@/db/schema';
import { eq, and, desc, gte, lte, sql } from 'drizzle-orm';
import { getSessionUser } from '@/lib/session';
import { startOfDay, startOfWeek, startOfMonth } from 'date-fns';
import { buildFlexibleSearchCondition, buildSearchRelevanceOrder } from '@/lib/search';
import { CATEGORIES } from '@/lib/constants';
import { generateNoteTags } from '@/lib/ai';
import { encryptSecret } from '@/lib/crypto';
import { ensureUserInitialResources } from '@/lib/auth';
import { checkUserQuotaAndTier, incrementUserMonthlyNotes } from '@/lib/quota-service';
import { extractEarliestScheduleDate } from '@/lib/date-extractor';
import { incrementUnorganizedCount } from '@/lib/cache';
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
      const userNotes = await db.query.notes.findMany({
        where: eq(notes.userId, user.id),
        columns: { specificTags: true },
        limit: 50,
      });
      existingUserTags = Array.from(new Set(userNotes.flatMap((n) => n.specificTags || [])));
    } catch {
      // Non-fatal
    }

    const shouldEncrypt = Boolean(body.isEncrypted || body.category === 'credential');
    const vaultKey = body.vaultKey ? String(body.vaultKey).trim() : null;
    const isPinned = Boolean(body.isPinned);
    const attachments = Array.isArray(body.attachments) ? body.attachments : [];
    const now = new Date();

    let finalContent = trimmedContent;
    let finalCategory: NoteCategory = 'others';
    let finalTags: string[] = [];
    let isEncrypted = false;
    let isProcessed = false;
    let targetDate: Date | null = null;

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
        : ['vault', 'credential'];
      isEncrypted = true;
      isProcessed = true; // Human intent: explicitly stored in vault
    } else if (body.category && CATEGORIES.includes(body.category as NoteCategory) && body.category !== 'others') {
      // Human Intent Trumps AI: Explicit category selected in UI (todo, schedule, bookmark, etc.)
      finalCategory = body.category as NoteCategory;
      finalTags = Array.isArray(body.specificTags) && body.specificTags.length > 0
        ? body.specificTags
        : [finalCategory];
      isProcessed = true; // Lock from AI modification, zero token spent!

      if (finalCategory === 'schedule' && !targetDate) {
        targetDate = extractEarliestScheduleDate(trimmedContent, now);
      }
    } else {
      // General note created without specific category (defaults to 'others')
      // Kept as isProcessed = false so it can be curated later by AI background batch sync
      finalCategory = 'others';
      finalTags = Array.isArray(body.specificTags) ? body.specificTags : [];
      isProcessed = false;
      await incrementUnorganizedCount(user.id);
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
        attachments,
        createdAt: now,
      })
      .returning();

    await incrementUserMonthlyNotes(user.id);

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
