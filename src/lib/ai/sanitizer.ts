import { resolveCanonicalTag, extractTagsFromContent } from './taxonomy';
import type { Category } from './types';

export const BANNED_TAGS = new Set([
  'read-later',
  'readlater',
  'bookmark',
  'money',
  'task',
  'todo',
  'schedule',
  'note',
  'notes',
  'daily-spending',
  'spending',
  'general',
  'others',
  'text',
  'daily',
  'link',
  'url',
  'repo',
  'repository',
  'video',
  'password',
  'item',
  'data',
  'tag',
]);

export function normalizeTag(tag: string): string {
  return tag
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-');
}

/**
 * Enforces the Strict Single-Word Tag Rule with Bilingual Taxonomy Resolution:
 * 1. Strips suffixes (-price, -spending, etc.).
 * 2. Rejects prices, nominal amounts, and pure numbers.
 * 3. Resolves known aliases (ID & EN) to canonical tags via taxonomy.
 * 4. Extracts single strongest token if compound word remains.
 * 5. Limits output to max 2 unique single-word tags.
 */
export function sanitizeTags(tags: string[], category: string, noteContent?: string): string[] {
  let result: string[] = [];
  const catNormalized = category.toLowerCase().trim() as Category;

  for (const raw of tags) {
    let t = normalizeTag(raw);
    if (!t) continue;

    // 1. Strip -price, -cost, -fee, -amount, -nominal, -spending, -expense suffixes
    t = t.replace(/(?<=[a-z]{3})-(price|cost|fee|nominal|amount|spending|expense|expenses)$/, '');
    t = t.replace(/(?<=[a-z]{3})(price|cost|fee|nominal|amount|spending|expense|expenses)$/, '');

    // 2. Reject pure numbers, prices, or currency (e.g. 15k, 60k, 100k, 50rb, $10, rp15k)
    if (
      /^\d+[a-z]*$/i.test(t) ||
      /^(rp|\$)\d+/i.test(t) ||
      /^\d+\s*(k|rb|jt|m|b|ribu|juta)?$/i.test(t) ||
      /^[0-9]+$/.test(t)
    ) {
      continue;
    }

    // 3. Resolve to canonical single-word tag via bilingual taxonomy
    const canonical = resolveCanonicalTag(t, catNormalized);
    if (canonical) {
      t = canonical;
    }

    // 4. Enforce STRICT SINGLE-WORD: if still contains a hyphen, extract single strongest token
    if (t.includes('-')) {
      const parts = t.split('-').filter(p => p.length >= 2 && !BANNED_TAGS.has(p));
      if (parts.length > 0) {
        // Check if any part matches canonical tag
        const canonicalPart = parts.find(p => resolveCanonicalTag(p, catNormalized) !== null);
        t = canonicalPart ? resolveCanonicalTag(canonicalPart, catNormalized)! : parts[parts.length - 1];
      } else {
        continue;
      }
    }

    // Final clean alphanumeric check
    t = t.replace(/[^a-z0-9]/g, '');
    if (!t) continue;

    if (t === catNormalized) continue;
    if (BANNED_TAGS.has(t)) continue;
    if (result.includes(t)) continue;
    result.push(t);
    if (result.length >= 2) break;
  }

  // Finance Category Guarantee
  if (category === 'finance') {
    const lower = (noteContent || '').toLowerCase();
    const isIncome =
      result.includes('income') ||
      /gaji|salary|terima|pemasukan|transfer masuk|cair|earnings|dividend|bonus|paycheck/i.test(lower);
    const isBill =
      result.includes('bill') ||
      /tagihan|subscription|langganan|pdam|pln|bill|utilities|rent|sewa/i.test(lower);

    if (isIncome) {
      const otherTags = result.filter(t => t !== 'income' && t !== 'expenses' && t !== 'bill');
      result = ['income', ...otherTags].slice(0, 2);
    } else {
      const mainTag = isBill ? 'bill' : 'expenses';

      // Auto-cluster recognizable bilingual taxonomy items if room permits
      if (result.length < 2 && noteContent) {
        const autoTags = extractTagsFromContent(noteContent, 'finance', 2);
        for (const at of autoTags) {
          if (at !== 'expenses' && at !== 'income' && at !== 'bill' && !result.includes(at)) {
            result.push(at);
            if (result.length >= 2) break;
          }
        }
      }

      const otherTags = result.filter(t => t !== 'expenses' && t !== 'bill' && t !== 'income');
      result = [mainTag, ...otherTags].slice(0, 2);
    }
  }

  // Study/Exam Category Guarantee
  if (result.includes('study') && noteContent) {
    const lower = noteContent.toLowerCase();
    if (/ujian|exam|uts|uas|quiz|kuis|finals|midterm/i.test(lower)) {
      result = ['study', 'exam'];
    }
  }

  return result.slice(0, 2);
}
