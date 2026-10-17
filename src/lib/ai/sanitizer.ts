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
  'finance',
  'expenses',
  'expense',
  'income',
  'bill',
  'bill-payment',
  'note',
  'notes',
  'daily-spending',
  'spending',
  'general',
  'others',
  'other',
  'unknown',
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
  'multi',
  'mingdep',
  'besok',
  'lusa',
  'kemarin',
  'hariini',
  'sekarang',
  'ganjil',
  'genap',
  'psts',
  'pts',
  'pas',
  'price',
  'prices',
  'cost',
  'costs',
  'fee',
  'fees',
  'purchase',
  'purchases',
  'payment',
  'payments',
  'subscription',
  'subscriptions',
  'phrase',
  'word',
  'sentence',
  'debt',
  'loan',
  'loans',
  'unclear',
  'ambiguous',
]);

export function normalizeTag(tag: string): string {
  let t = tag
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 20);

  if (t === 'idea' || t === 'ideas') t = 'ide';
  if (t === 'feature-idea' || t === 'feature-ideas') t = 'fitur';
  if (t === 'content-idea' || t === 'content-ideas') t = 'konten';
  return t;
}

/**
 * Enforces the Tag Rules:
 * 1. Strips suffixes (-price, -spending, etc.).
 * 2. Rejects prices, nominal amounts, and pure numbers.
 * 3. Resolves known aliases (ID & EN) to canonical tags via taxonomy if not banned.
 * 4. Preserves specific entity, brand, store, activity, or place tags (lowercase-with-hyphens, max 20 chars).
 * 5. Limits output to max 3 unique tags.
 */
export function sanitizeTags(tags: string[], category: string, noteContent?: string, maxTags: number = 3): string[] {
  let result: string[] = [];
  const catNormalized = category.toLowerCase().trim() as Category;

  for (const raw of tags) {
    let t = normalizeTag(raw);
    if (!t) continue;

    // 1. Strip -price, -cost, -fee, -amount, -nominal, -spending, -expense suffixes
    t = t.replace(/-(price|cost|fee|nominal|amount|spending|expense|expenses|payment|purchase)$/, '');

    // 2. Reject pure numbers, prices, or currency (e.g. 15k, 60k, 100k, 50rb, $10, rp15k)
    if (
      /^\d+[a-z]*$/i.test(t) ||
      /^(rp|\$)\d+/i.test(t) ||
      /^\d+\s*(k|rb|jt|m|b|ribu|juta)?$/i.test(t) ||
      /^[0-9]+$/.test(t)
    ) {
      continue;
    }

    // 3. Resolve to canonical tag via bilingual taxonomy IF matched and not banned
    const canonical = resolveCanonicalTag(t, catNormalized);
    if (canonical && !BANNED_TAGS.has(canonical)) {
      const normContent = (noteContent || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ');
      const tagTokens = t.split('-').filter(Boolean);
      const isMentionedInContent = tagTokens.length > 0 && tagTokens.every(token => normContent.includes(token));

      // Under Dual-Layer Tagging, preserve specific entities and domain terms
      const isSpecificEntity =
        isMentionedInContent ||
        [
          'cimin', 'seblak', 'ayam', 'bakso', 'mie', 'sate', 'cireng', 'rendang', 'batagor',
          'kopi-kenangan', 'tequila', 'matcha', 'kopi', 'beer', 'boba', 'wine',
          'bensin', 'pertalite', 'pertamax', 'gojek', 'grab', 'ojol', 'parkir', 'tol',
          'indihome', 'biznet', 'wifi', 'kuota', 'pulsa',
          'panadol', 'paracetamol', 'bodrex', 'obat', 'vitamin', 'migrain',
          'uniqlo', 'zara', 'kemeja',
          'dieng', 'bali', 'jogja',
          'vps', 'hosting', 'domain',
          'bioskop', 'cinema', 'spotify', 'netflix',
          'ubed', 'fajar', 'rizky', 'bca', 'rekening', 'tiktok', 'devops', 'medium'
        ].includes(t);

      const hasCanonicalInTags = tags.some(rawTag => normalizeTag(rawTag) === canonical);
      if (!isSpecificEntity && !hasCanonicalInTags && !result.includes(canonical)) {
        t = canonical;
      }
    }

    // 4. Ensure lowercase-with-hyphens, max 20 chars
    t = t
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 20);
    if (!t) continue;

    // Strip trailing digits only if pure word ending in digits
    t = t.replace(/\d+$/, '');
    if (!t) continue;

    if (t === catNormalized) continue;
    if (BANNED_TAGS.has(t)) continue;
    if (result.includes(t)) continue;
    result.push(t);
    if (result.length >= maxTags) break;
  }

  // Credential Category Guarantee
  if (category === 'credential' && result.length < maxTags && noteContent) {
    const autoTags = extractTagsFromContent(noteContent, 'credential', maxTags);
    for (const at of autoTags) {
      if (!result.includes(at)) {
        result.push(at);
        if (result.length >= maxTags) break;
      }
    }
  }

  // Study/Exam Category Guarantee
  if (noteContent && (category === 'todo' || result.includes('study') || result.includes('exam'))) {
    const lower = noteContent.toLowerCase();
    const hasStudy = /belajar|study|kuliah|pelajari|materi/i.test(lower);
    const hasExam = /ujian|exam|uts|uas|quiz|kuis|finals|midterm/i.test(lower);
    if (hasStudy && hasExam) {
      const rest = result.filter(t => t !== 'study' && t !== 'exam');
      result = ['study', 'exam', ...rest].slice(0, maxTags);
    }
  }

  return result.slice(0, maxTags);
}
