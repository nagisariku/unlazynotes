import { db } from '../db';
import { notes } from '../db/schema';
import { eq, and, sql } from 'drizzle-orm';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const TAGS_TTL_MS = 60 * 60 * 1000; // 1 Jam
const UNORGANIZED_COUNT_TTL_MS = 24 * 60 * 60 * 1000; // 24 Jam

// In-Memory Caches
const userTagsCache = new Map<string, CacheEntry<string[]>>();
const unorganizedCountCache = new Map<string, CacheEntry<number>>();

/**
 * --- USER TAGS CACHE ---
 */
export function getUserTagsCache(userId: string): string[] | null {
  const entry = userTagsCache.get(userId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    userTagsCache.delete(userId);
    return null;
  }
  return entry.value;
}

export function setUserTagsCache(userId: string, tags: string[]): void {
  userTagsCache.set(userId, {
    value: tags,
    expiresAt: Date.now() + TAGS_TTL_MS,
  });
}

export function invalidateUserTagsCache(userId: string): void {
  userTagsCache.delete(userId);
}

export async function getOrFetchUserTags(userId: string): Promise<string[]> {
  const cached = getUserTagsCache(userId);
  if (cached !== null) return cached;

  const userNotes = await db.query.notes.findMany({
    where: eq(notes.userId, userId),
    columns: { specificTags: true },
  });

  // Hitung frekuensi kemunculan setiap tag untuk menentukan tag paling aktif
  const tagFrequencyMap = new Map<string, number>();
  for (const n of userNotes) {
    if (Array.isArray(n.specificTags)) {
      for (const rawTag of n.specificTags) {
        if (typeof rawTag === 'string' && rawTag.trim()) {
          const tag = rawTag.trim();
          tagFrequencyMap.set(tag, (tagFrequencyMap.get(tag) || 0) + 1);
        }
      }
    }
  }

  // Urutkan tag berdasarkan frekuensi kemunculan tertinggi (Most Frequent Tags)
  const sortedTags = Array.from(tagFrequencyMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag);

  // Ambil maksimal Top 60 tag paling aktif untuk memori AI
  const topTags = sortedTags.slice(0, 60);

  setUserTagsCache(userId, topTags);
  return topTags;
}

/**
 * --- UNORGANIZED NOTES COUNT CACHE ---
 */
export function getUnorganizedCountCache(userId: string): number | null {
  const entry = unorganizedCountCache.get(userId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    unorganizedCountCache.delete(userId);
    return null;
  }
  return entry.value;
}

export function setUnorganizedCountCache(userId: string, count: number): void {
  unorganizedCountCache.set(userId, {
    value: count,
    expiresAt: Date.now() + UNORGANIZED_COUNT_TTL_MS,
  });
}

export function resetUnorganizedCount(userId: string): void {
  setUnorganizedCountCache(userId, 0);
}

export async function getOrFetchUnorganizedCount(userId: string): Promise<number> {
  const cached = getUnorganizedCountCache(userId);
  if (cached !== null) return cached;

  const [res] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notes)
    .where(and(eq(notes.userId, userId), eq(notes.isProcessed, false)));

  const count = Number(res?.count || 0);
  setUnorganizedCountCache(userId, count);
  return count;
}

export async function incrementUnorganizedCount(userId: string, delta: number = 1): Promise<number> {
  const current = await getOrFetchUnorganizedCount(userId);
  const updated = Math.max(0, current + delta);
  setUnorganizedCountCache(userId, updated);
  return updated;
}
