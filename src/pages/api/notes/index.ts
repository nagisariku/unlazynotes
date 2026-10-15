import type { APIRoute } from 'astro';
import { db } from '@/db';
import { notes, type NoteCategory } from '@/db/schema';
import { eq, and, desc, gte, lte, sql } from 'drizzle-orm';
import { getSessionUser } from '@/lib/session';
import { startOfDay, startOfWeek, startOfMonth } from 'date-fns';
import { buildFlexibleSearchCondition, buildSearchRelevanceOrder } from '@/lib/search';

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
    conditions.push(eq(notes.category, category as NoteCategory));
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
