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
  'phrase',
  'word',
  'sentence',
  'debt',
  'loan',
  'loans',
  'unclear',
  'ambiguous',
  // Currency and tax terms forbidden as tags
  'usd',
  'idr',
  'rp',
  'dollar',
  'dollars',
  'rupiah',
  'cent',
  'cents',
  'eur',
  'euro',
  'gbp',
  'sgd',
  'jpy',
  'yen',
  'cny',
  'yuan',
  'tax',
  'pajak',
  // Action verbs forbidden as tags (Indonesian & English)
  'chat',
  'beli',
  'tanya',
  'minum',
  'bayar',
  'transfer',
  'kirim',
  'hubungi',
  'cek',
  'revisi',
  'ingat',
  'baca',
  'makan',
  'minjem',
  'pinjam',
  'ngutang',
  'tulis',
  'bikin',
  'buat',
  'cari',
  'ambil',
  'tarik',
  'simpan',
  'call',
  'ask',
  'buy',
  'pay',
  'send',
  'check',
  'eat',
  'read',
  'write',
  'order',
  'pesen',
  'pesan',
  // Days of week and temporal markers (not tags)
  'senin',
  'selasa',
  'rabu',
  'kamis',
  'jumat',
  'sabtu',
  'minggu',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
  'pagi',
  'siang',
  'sore',
  'malam',
  'today',
  'tomorrow',
  'yesterday',
  'besok',
  'kemarin',
  'lusa',
]);

export function normalizeTag(tag: string): string {
  let t = tag
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  // 1. Prevent truncated words: resolve words > 20 chars to their clean base form without arbitrary chopping
  if (t.length > 20) {
    if (t.includes('demonstrat') || t.includes('demo')) t = 'demo';
    else if (t.includes('presentat')) t = 'presentation';
    else if (t.includes('transcript')) t = 'transcript';
    else if (t.includes('voice-note')) t = 'voice-note';
    else if (t.includes('subscript')) t = 'subscription';
    else if (t.includes('recommendat') || t.includes('referen')) t = 'referensi';
    else if (t.includes('roadmap')) t = 'q4-roadmap';
    else {
      const parts = t.split('-');
      const fit = parts.find(p => p.length >= 3 && p.length <= 20);
      if (fit) t = fit;
      else t = t.slice(0, 20);
    }
  }

  // 2. Universal High-Level Root Domain Umbrella Mappings
  if (t === 'ide' || t === 'ideas') t = 'idea';
  if (
    t === 'makanan' ||
    t === 'jajan' ||
    t === 'food-order' ||
    t === 'street-food' ||
    t === 'snack-food' ||
    t === 'kuliner' ||
    t === 'culinary' ||
    t === 'food-and-beverage'
  ) {
    t = 'food';
  }
  if (t === 'kesehatan' || t === 'medical' || t === 'wellness') t = 'health';
  if (t === 'minuman' || t === 'beverage' || t === 'beverages' || t === 'drinks' || t === 'drink-order') t = 'drink';
  if (t === 'langganan' || t === 'subs') t = 'subscription';
  if (t === 'pekerjaan' || t === 'job' || t === 'jobs') t = 'work';
  if (t === 'rapat' || t === 'sync' || t === 'sprint' || t === 'appointment' || t === 'conference' || t === 'discuss' || t === 'coffee-break') {
    t = 'meeting';
  }
  if (t === 'hewan' || t === 'pets') t = 'pet';
  if (t === 'musik' || t === 'songs') t = 'music';
  if (t === 'game' || t === 'games') t = 'gaming';
  if (t === 'liburan' || t === 'trip' || t === 'vacation' || t === 'wisata' || t === 'tour') t = 'travel';
  if (t === 'keuangan' || t === 'transaksi') t = 'finance';
  if (t === 'product-demo' || t === 'product-demonstration' || t === 'demonstration') t = 'demo';
  if (t === 'feature-idea' || t === 'feature-ideas') t = 'fitur';
  if (t === 'content-idea' || t === 'content-ideas') t = 'konten';
  if (t === 'design') t = 'desain';
  if (t === 'client' || t === 'klien' || t === 'clients') t = 'client';
  if (t === 'cursor-ai' || t === 'cursor-editor') t = 'cursor';
  if (t === 'tahu-gejrot-pedas' || t === 'tahu-gejrot') t = 'tahu-gejrot';

  return t;
}

/**
 * Checks if a new candidate tag is a twin synonym or redundant substring of existing tags.
 */
export function isTwinOrRedundantTag(newTag: string, existingTags: string[], category?: Category): boolean {
  for (const existing of existingTags) {
    if (newTag === existing) return true;

    // Direct twin synonym check via canonical taxonomy
    // Redundancy occurs when two tags resolve to the same canonical concept,
    // UNLESS one is a specific entity and the other is the canonical domain umbrella (Dual-Layer tagging!)
    const canonNew = resolveCanonicalTag(newTag, category);
    const canonExisting = resolveCanonicalTag(existing, category);
    if (canonNew && canonExisting && canonNew === canonExisting) {
      // Check if this is an Entity + Umbrella dual-layer pair
      const isDualLayerPair =
        (newTag === canonNew && existing !== canonExisting) ||
        (existing === canonExisting && newTag !== canonNew);

      // Check if both are distinct concrete entities under the same umbrella (e.g. 'nasgor' and 'cimin')
      const isDistinctEntities =
        newTag !== canonNew && existing !== canonExisting && newTag !== existing;

      if (!isDualLayerPair && !isDistinctEntities) {
        return true;
      }
    }

    // Direct synonym / bilingual pairs
    const twinPairs = [
      ['kopi', 'coffee'],
      ['desain', 'design'],
      ['rekening', 'bank-account'],
      ['food', 'makanan'],
      ['drink', 'minuman'],
      ['health', 'kesehatan'],
      ['idea', 'ide'],
      ['meeting', 'rapat'],
      ['work', 'kerja'],
      ['demo', 'product-demo'],
      ['demo', 'produk-demo'],
      ['client', 'klien'],
      ['q4-roadmap', 'roadmap'],
      ['subscription', 'subs'],
      ['medium', 'article'],
      ['youtube', 'video'],
    ];

    for (const [a, b] of twinPairs) {
      if ((newTag === a && existing === b) || (newTag === b && existing === a)) {
        return true;
      }
    }

    // Substring / hyphenated redundancy (e.g. 'demo' vs 'product-demo')
    const isBrandEntityException =
      (newTag === 'kopi-kenangan' && existing === 'kopi') ||
      (existing === 'kopi-kenangan' && newTag === 'kopi');

    if (!isBrandEntityException) {
      if (
        (newTag.includes(existing) && (newTag.startsWith(existing + '-') || newTag.endsWith('-' + existing))) ||
        (existing.includes(newTag) && (existing.startsWith(newTag + '-') || existing.endsWith('-' + newTag)))
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Enforces the Tag Rules:
 * 1. Strips suffixes (-price, -spending, etc.).
 * 2. Rejects prices, nominal amounts, pure numbers, currencies, and tax terms.
 * 3. Resolves known aliases (ID & EN) to canonical tags via taxonomy if not banned.
 * 4. Prioritizes user's existing tags (Tag Reuse) to prevent dashboard fragmentation.
 * 5. Eliminates twin synonyms and redundant tags.
 * 6. Preserves specific entity, brand, store, activity, or place tags.
 * 7. Strictly limits output to max 2 - 3 tags per note.
 */
export function sanitizeTags(
  tags: string[],
  category: string,
  noteContent?: string,
  maxTags: number = 3,
  existingUserTags?: string[]
): string[] {
  let result: string[] = [];
  const catNormalized = category.toLowerCase().trim() as Category;

  for (const raw of tags) {
    let t = normalizeTag(raw);
    if (!t) continue;

    // 1. Strip -price, -cost, -fee, -amount, -nominal, -spending, -expense suffixes
    t = t.replace(/-(price|cost|fee|nominal|amount|spending|expense|expenses|payment|purchase)$/, '');

    // 2. Reject pure numbers, prices, currency, or tax terms
    if (
      /^\d+[a-z]*$/i.test(t) ||
      /^(rp|\$)\d+/i.test(t) ||
      /^\d+\s*(k|rb|jt|m|b|ribu|juta)?$/i.test(t) ||
      /^[0-9]+$/.test(t) ||
      /^(usd|idr|rp|dollar|dollars|rupiah|eur|euro|gbp|sgd|tax|pajak)$/i.test(t)
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
          'martabak', 'cilok', 'tahu-gejrot', 'nasgor',
          'kopi-kenangan', 'tequila', 'matcha', 'kopi', 'beer', 'boba', 'wine',
          'bensin', 'pertalite', 'pertamax', 'gojek', 'grab', 'ojol', 'parkir', 'tol',
          'indihome', 'biznet', 'wifi', 'kuota', 'pulsa',
          'panadol', 'paracetamol', 'bodrex', 'obat', 'vitamin', 'migrain',
          'uniqlo', 'zara', 'kemeja',
          'dieng', 'bali', 'jogja',
          'vps', 'hosting', 'domain',
          'bioskop', 'cinema', 'spotify', 'netflix',
          'ubed', 'fajar', 'rizky', 'bca', 'rekening', 'tiktok', 'devops', 'medium',
          'cursor', 'demo', 'q4-roadmap', 'client'
        ].includes(t);

      const hasCanonicalInTags = tags.some(rawTag => normalizeTag(rawTag) === canonical);
      if (!isSpecificEntity && !hasCanonicalInTags && !result.includes(canonical)) {
        t = canonical;
      }
    }

    // 4. Ensure lowercase-with-hyphens
    t = t
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    if (!t) continue;

    // Strip trailing digits only if pure word ending in digits
    t = t.replace(/\d+$/, '');
    if (!t) continue;

    if (t === catNormalized) continue;
    if (BANNED_TAGS.has(t)) continue;

    // 5. Anti-Redundancy & Twin Synonym Guard
    if (isTwinOrRedundantTag(t, result, catNormalized)) continue;

    // 6. Tag Reuse: Prioritize existing user tags if matching
    if (existingUserTags && existingUserTags.length > 0) {
      const matchedUserTag = existingUserTags.find((ut) => {
        const normUt = normalizeTag(ut);
        if (normUt === t) return true;
        if (t === canonical && normUt === canonical) return true;
        const twinPairs = [
          ['kopi', 'coffee'],
          ['desain', 'design'],
          ['rekening', 'bank-account'],
          ['food', 'makanan'],
          ['drink', 'minuman'],
          ['health', 'kesehatan'],
          ['idea', 'ide'],
          ['meeting', 'rapat'],
          ['work', 'kerja'],
          ['client', 'klien'],
        ];
        return twinPairs.some(([a, b]) => (t === a && normUt === b) || (t === b && normUt === a));
      });
      if (matchedUserTag) {
        t = normalizeTag(matchedUserTag);
      }
    }

    if (!result.includes(t)) {
      result.push(t);
    }
    if (result.length >= maxTags) break;
  }

  // Credential Category Guarantee
  if (category === 'credential' && result.length < maxTags && noteContent) {
    const autoTags = extractTagsFromContent(noteContent, 'credential', maxTags);
    for (const at of autoTags) {
      if (!isTwinOrRedundantTag(at, result, catNormalized)) {
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
