import { sql, type SQL } from 'drizzle-orm';
import { notes } from '@/db/schema';

/**
 * Builds a flexible SQL search condition that matches:
 * 1. Exact case-insensitive substring (ILIKE)
 * 2. Punctuation/delimiter-stripped alphanumeric substring (e.g. 'almuhajirin' matches 'Al-Muhajirin')
 * 3. Trigram fuzzy word similarity (e.g. 'rekrusif' matches 'rekursif', 'almuhajrin' matches 'al-muhajirin')
 * 4. Tag / Category match
 */
export function buildFlexibleSearchCondition(rawQuery: string): SQL {
  const query = rawQuery.trim();
  const cleanQ = query.toLowerCase().replace(/[^a-z0-9]/g, '');
  const ilikePattern = `%${query}%`;

  if (cleanQ.length >= 3) {
    return sql`(
      ${notes.content} ILIKE ${ilikePattern}
      OR regexp_replace(lower(${notes.content}), '[^a-z0-9]', '', 'g') LIKE ${'%' + cleanQ + '%'}
      OR word_similarity(${query}, ${notes.content}) >= 0.35
      OR ${notes.category}::text ILIKE ${ilikePattern}
      OR ${notes.specificTags}::text ILIKE ${ilikePattern}
    )`;
  }

  // Short queries (< 3 chars): use exact substring or tag match to prevent noisy over-matching
  return sql`(
    ${notes.content} ILIKE ${ilikePattern}
    OR ${notes.category}::text ILIKE ${ilikePattern}
    OR ${notes.specificTags}::text ILIKE ${ilikePattern}
  )`;
}

/**
 * Builds relevance ranking ordering for search queries:
 * 1. Exact substring match (Score 1)
 * 2. Punctuation-stripped match (Score 2)
 * 3. Trigram word similarity match (Score 3)
 * Secondary: word_similarity score DESC, then createdAt DESC.
 */
export function buildSearchRelevanceOrder(rawQuery: string): SQL[] {
  const query = rawQuery.trim();
  const cleanQ = query.toLowerCase().replace(/[^a-z0-9]/g, '');
  const ilikePattern = `%${query}%`;

  if (cleanQ.length >= 3) {
    return [
      sql`CASE 
        WHEN ${notes.content} ILIKE ${ilikePattern} THEN 1
        WHEN regexp_replace(lower(${notes.content}), '[^a-z0-9]', '', 'g') LIKE ${'%' + cleanQ + '%'} THEN 2
        ELSE 3
      END`,
      sql`word_similarity(${query}, ${notes.content}) DESC`,
      sql`${notes.createdAt} DESC`,
    ];
  }

  return [
    sql`CASE WHEN ${notes.content} ILIKE ${ilikePattern} THEN 1 ELSE 2 END`,
    sql`${notes.createdAt} DESC`,
  ];
}
