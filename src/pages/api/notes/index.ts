import type { APIRoute } from 'astro';
import { db } from '@/db';
import { notes, subscriptions, type NoteCategory } from '@/db/schema';
import { eq, and, desc, gte, lte, sql } from 'drizzle-orm';
import { getSessionUser } from '@/lib/session';
import { startOfDay, startOfWeek, startOfMonth, format } from 'date-fns';
import { buildFlexibleSearchCondition, buildSearchRelevanceOrder } from '@/lib/search';
import { CATEGORIES, STANDARD_DAILY_QUOTA } from '@/lib/constants';
import { generateNoteTags } from '@/lib/ai';
import { ensureUserInitialResources } from '@/lib/auth';
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
  const tag = url.searchParams.get('tag')?.trim();
  const range = url.searchParams.get('range')?.trim();
  const startDateStr = url.searchParams.get('startDate')?.trim();
  const endDateStr = url.searchParams.get('endDate')?.trim();

  const conditions = [eq(notes.userId, user.id)];

  if (q) {
    conditions.push(buildFlexibleSearchCondition(q));
  }

  if (category) {
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

    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, user.id))
      .limit(1);

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    let currentNotesCount = sub?.notesTodayCount || 0;
    if (sub && sub.lastNoteDate !== todayStr) {
      currentNotesCount = 0;
    }

    if (sub?.plan === 'standard' && currentNotesCount >= STANDARD_DAILY_QUOTA) {
      return new Response(
        JSON.stringify({
          error: `Kuota harian Anda untuk paket Standard (${STANDARD_DAILY_QUOTA} catatan/hari) telah tercapai hari ini. Silakan upgrade ke Pro.`,
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // AI Categorization & Tagging
    const tagResult = await generateNoteTags(trimmedContent);
    const validCategory: NoteCategory = CATEGORIES.includes(
      tagResult.category as NoteCategory
    )
      ? (tagResult.category as NoteCategory)
      : 'others';

    const noteId = crypto.randomUUID();
    const now = new Date();

    const [newNote] = await db
      .insert(notes)
      .values({
        id: noteId,
        userId: user.id,
        content: trimmedContent,
        category: validCategory,
        specificTags: tagResult.specific_tags || [],
        source: tagResult.source || 'web',
        createdAt: now,
      })
      .returning();

    if (sub) {
      await db
        .update(subscriptions)
        .set({
          notesTodayCount: currentNotesCount + 1,
          lastNoteDate: todayStr,
        })
        .where(eq(subscriptions.id, sub.id));
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

