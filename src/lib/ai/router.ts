export type DetectedModule = 'bookmark' | 'finance' | 'credential' | 'todo' | 'general';

/**
 * Fast deterministic intent router.
 * Evaluates whether an incoming note matches high-confidence patterns of specialized modules (bilingual: ID & EN).
 */
export function routeNoteIntent(content: string): DetectedModule {
  const text = content.trim();
  const lower = text.toLowerCase();

  // 1. Action / Todo Intent (Checked before URL to prevent task notes with links from being misclassified as bookmarks)
  const isActionIntent =
    lower.startsWith('todo') ||
    lower.startsWith('task') ||
    lower.startsWith('- [ ]') ||
    lower.startsWith('[ ]') ||
    /\b(harus|wajib|jangan lupa|ingat|kerjakan|tugas|pr|deadline|homework|chores)\b/i.test(lower) ||
    (/\b(belajar|study|kuliah|review|prepare)\b/i.test(lower) && /\b(ujian|exam|uts|uas|kuis|quiz|tes|besok|minggu depan|midterm|finals)\b/i.test(lower));

  if (isActionIntent) {
    return 'todo';
  }

  // 2. URL / Bookmark Router (Pure links or link-primary notes)
  const urlRegex = /(https?:\/\/[^\s]+)/i;
  if (urlRegex.test(text)) {
    return 'bookmark';
  }

  // 3. Credential Router
  if (
    lower.includes('pass ') ||
    lower.includes('password') ||
    lower.includes('wifi') ||
    lower.includes('hotspot') ||
    lower.includes('kredensial') ||
    lower.includes('pin:') ||
    lower.includes('token:') ||
    lower.includes('api_key') ||
    lower.includes('apikey') ||
    lower.includes('secret:') ||
    lower.includes('sandi:')
  ) {
    return 'credential';
  }

  // 4. Finance Router (Indonesian & Global Price/Expense Patterns)
  const hasCurrencySuffix = /\b\d+(\.\d+)?\s*(k|rb|jt|ribu|juta)\b/i.test(lower);
  const hasCurrencyPrefix = /(\$|rp|idr|usd|sgd|eur|gbp)\s*\d+/i.test(lower);
  const hasLargeNominal = /\b\d{4,7}\b/.test(lower); // e.g. 40500, 15000
  const hasFinanceVerb = /\b(traktir|nraktir|bayar|beli|belanja|gaji|salary|pemasukan|transfer masuk|transfer|invoice|tagihan|londry|laundry|spent|spend|bought|paid|paycheck|dividend|harga|cost|fee)\b/i.test(lower);
  const hasItemWithNumber = /\b(seblak|ciken|chicken|ayam|bensin|kopi|coffee|pulsa|parkir|indihome|nongkrong|satpam|burger|uber|lyft|groceries|hosting)\s+(\$|rp)?\d+/i.test(lower);

  // Guard against non-finance false-positives: time formats, postal codes, years, phone numbers
  const isTimeOnly = /(\b(jam|pukul)\s*\d+\b|\b\d+\s*(am|pm)\b)/i.test(lower) && !hasCurrencySuffix && !hasCurrencyPrefix && !hasFinanceVerb;
  const hasNonFinanceContext = /\b(kodepos|kode pos|pos code|zip code|tahun|year|tlp|telp|telepon|phone|hp|wa|whatsapp|no\s*hp|nomor\s*hp|rt\s*\d|rw\s*\d)\b/i.test(lower);

  const isFinance = !isTimeOnly && !hasNonFinanceContext && (
    hasCurrencySuffix ||
    hasCurrencyPrefix ||
    hasItemWithNumber ||
    (hasLargeNominal && hasFinanceVerb) ||
    (hasFinanceVerb && /\b\d+\b/.test(lower))
  );

  if (isFinance) {
    return 'finance';
  }

  // 5. Default to General AI Module (Schedule, Draft, Reference, Random-yap, Others)
  return 'general';
}
