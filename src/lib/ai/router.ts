export type DetectedModule = 'bookmark' | 'credential' | 'schedule' | 'finance' | 'todo' | 'general';

/**
 * Comprehensive Semantic Intent Router.
 * Evaluates incoming notes against the 6 Primary Intent rules:
 * 1. BOOKMARK: Any note with HTTP/HTTPS link(s) (pure link or with commentary).
 * 2. CREDENTIAL: Passwords, ATM PINs, Bank Account Numbers, NIK KTP, Tokens/API Keys.
 * 3. SCHEDULE: Notes with explicit time/clock or calendar date markers.
 * 4. FINANCE: Financial transactions, spending, purchases, or debt/loans WITH nominal price/amount.
 * 5. TODO: Actions, tasks, commands, or communications without specific calendar/clock times.
 * 6. GENERAL / OTHERS: Non-action thoughts, opinions, raw ideas, health symptoms, and rants.
 */
export function routeNoteIntent(content: string): DetectedModule {
  const text = content.trim();
  const lower = text.toLowerCase();

  // 1. Explicit Todo Checkbox Prefix override (e.g. "- [ ] review: https://...")
  if (lower.startsWith('- [ ]') || lower.startsWith('[ ]') || lower.startsWith('todo:')) {
    return 'todo';
  }

  // 2. BOOKMARK Intent: Deteksi link URL (baik URL murni MAUPUN disertai teks pengantar/komentar)
  const urlRegex = /(https?:\/\/[^\s]+)/i;
  if (urlRegex.test(text)) {
    return 'bookmark';
  }

  // 3. CREDENTIAL Intent: Deteksi data sensitif pribadi (Password, PIN ATM, No Rekening, Token/API Key, dan NIK/SIM dengan nomor)
  const hasPureCredential =
    /\b(password|passwd|pass|kata\s*sandi|sandi|pin(\s*atm)?|no\s*rek|nomor\s*rekening|rekening|token|api[_-]?key|secret|kredensial|credential|seed\s*phrase|ssh-ed\d+|ssh-rsa|private\s*key|ssid|wlan)(nya)?\b/i.test(lower) ||
    /\b(password|pass|pin|token|secret|sandi)(nya)?\s*[:=]/i.test(lower) ||
    lower.startsWith('pass:') ||
    lower.startsWith('pin:') ||
    lower.startsWith('token:') ||
    lower.startsWith('secret:') ||
    lower.startsWith('sandi:');

  // ID documents (KTP, SIM, Paspor, NIK) ONLY trigger credential if accompanied by identity numbers/digits
  const hasIdDocumentWithNumber =
    /\b(nik|ktp|sim|paspor|passport)\b[^\n\r]*?\b\d{4,}\b/i.test(lower) ||
    (/\b(no(mor)?\s*(ktp|nik|sim|paspor|passport)|nik(\s*ktp)?|nomor\s*identitas)\b/i.test(lower) && /\b\d{4,}\b/.test(lower));

  const isCredential = hasPureCredential || hasIdDocumentWithNumber;

  if (isCredential) {
    return 'credential';
  }

  // 4. SCHEDULE Intent: Catatan yang WAJIB memiliki penanda waktu/jam atau tanggal kalender spesifik
  const hasSpecificTime =
    /\b(jam|pukul)\s*\d+([.:]\d+)?(\s*(pagi|siang|sore|malam|wib|wita|wit|am|pm))?\b/i.test(lower) ||
    /\b\d+([.:]\d+)\s*(am|pm|wib|wita|wit)\b/i.test(lower) ||
    /\b(besok|lusa|kemarin)\s+(pagi|siang|sore|malam|jam|pukul)\b/i.test(lower) ||
    /\b(tanggal|tgl)\s+\d{1,2}\b/i.test(lower) ||
    /\b\d{1,2}\s+(jan|feb|mar|apr|mei|jun|jul|agu|sep|okt|nov|des|januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\b/i.test(lower) ||
    /\b(senin|selasa|rabu|kamis|jumat|sabtu|minggu)\s+\d{1,2}\s+(jan|feb|mar|apr|mei|jun|jul|agu|sep|okt|nov|des)\b/i.test(lower) ||
    (/\b(flight|terbang|berangkat)\s+(senin|selasa|rabu|kamis|jumat|sabtu|minggu|\d{1,2}\s+[a-z]+)\b/i.test(lower)) ||
    (/\b(meeting|rapat|sync|call)\b/i.test(lower) && /\b(jam|pukul|\d+[:.]\d+|\d+\s*sore|\d+\s*pagi|\d+\s*siang|\d+\s*malam)\b/i.test(lower));

  // Guard against non-schedule numbers like price
  const hasCurrencySuffix = /\b\d+(\.\d+)?\s*(k|rb|jt|ribu|rebu|juta|perak|usd|dollar|dollars|sgd|eur|gbp)\b/i.test(lower);
  const hasCurrencyPrefix = /(\$|rp\.?|idr|usd|sgd|eur|gbp)\s*\d+/i.test(lower);
  const hasThousandsSeparator = /\b\d{1,3}([.,]\d{3})+(\s*(via|pake|qris|cash|transfer|debit|kredit))?\b/i.test(lower);

  if (hasSpecificTime && !hasCurrencySuffix && !hasCurrencyPrefix && !hasThousandsSeparator) {
    return 'schedule';
  }

  // 5. FINANCE Intent: Transaksi keuangan aktual, belanja, atau utang-piutang yang memuat nominal harga/uang
  const isHealthMetric = /\b\d+\s*(mg|ml|tablet|kapsul|gram)\b/i.test(lower);
  const isWorkoutMetric = /\b\d+\s*(kg|reps|set)\b/i.test(lower);
  const isPostalCode = /\b(kodepos|kode\s*pos|pos\s*code|zip\s*code)\s*\d+\b/i.test(lower);

  const hasDebtPattern =
    /\b(minjem|pinjam|ngutang|utang|piutang|talangin|talangan)\b/i.test(lower) &&
    (/\b\d+(\.\d+)?\s*(k|rb|jt|ribu|rebu|juta|perak)?\b/i.test(lower) || /(\$|rp\.?)\s*\d+/i.test(lower));

  const hasFinanceVerb = /\b(traktir|nraktir|bayar|beli|belanja|gaji|salary|pemasukan|transfer masuk|transfer|invoice|tagihan|londry|laundry|spent|spend|bought|paid|paycheck|dividend|harga|cost|fee|subscription|langganan|qris|cash|patungan)\b/i.test(lower);
  const hasItemWithNumber = /\b(cimin|cilok|tahu|martabak|seblak|ciken|chicken|ayam|bensin|kopi|coffee|pulsa|parkir|indihome|nongkrong|satpam|burger|uber|lyft|groceries|hosting|cursor)\s+.*(\$|rp)?\d+/i.test(lower);

  const isFinance =
    !isHealthMetric &&
    !isWorkoutMetric &&
    !isPostalCode &&
    (
      hasCurrencySuffix ||
      hasCurrencyPrefix ||
      hasThousandsSeparator ||
      hasDebtPattern ||
      hasItemWithNumber ||
      (hasFinanceVerb && (/\b\d+\b/.test(lower) || hasThousandsSeparator))
    );

  if (isFinance) {
    return 'finance';
  }

  // 6. SCRIPTURE / QUOTES / PRAYERS / REFLECTIONS -> 'general' (Reference or Draft, NEVER Todo!)
  const isArabicScript = /[\u0600-\u06FF]/.test(content);
  const isScriptureOrQuote =
    isArabicScript ||
    /\b(surah|qs\b|q\.s\b|ayat|al-qur'?an|quran|hadits|hadist|rasulullah|allah|bismillah|alhamdulillah|doa|quote|kutipan|pepatah|filosofi|renungan|refleksi|asy-syarh|ash-sharh|al-baqarah|al-fatihah)\b/i.test(lower);

  if (isScriptureOrQuote && !lower.startsWith('- [ ]') && !lower.startsWith('todo:')) {
    return 'general';
  }

  // 7. TODO Intent: Segala bentuk aksi, tugas, perintah, atau komunikasi tanpa jam kalender spesifik
  // Multi-line shopping list without prices is strictly TODO (e.g. "beli kemeja putih uniqlo \n stok sabun biore \n obat tetes mata rohto")
  const isShoppingList =
    /\b(beli|stok|belanja|pesen|pesan|order)\b/i.test(lower) &&
    (content.includes('\n') || /\b(dan|serta|stok)\b/i.test(lower));

  const isCommunicationTask = /\b(chat|telepon|telpon|wa|whatsapp|tanya|hubungi|dm|email|follow up|call)\s+[a-z0-9_-]+/i.test(lower);
  const isActionTask =
    isShoppingList ||
    lower.startsWith('todo') ||
    lower.startsWith('task') ||
    /\b(harus|wajib|jangan lupa|ingat|kerjakan|tugas|pr|deadline|homework|chores|beli|cek|revisi|kirim|bereskan|pelajari|siapkan|pesen|pesan|order|cari|carikan|bandingin|bandingkan|compare|riset|research|survey|survei|analisa|analisis|perpanjang|urus|bawa|ambil|fotokopi)\b/i.test(lower) ||
    (/\b(belajar|study|kuliah|review|prepare)\b/i.test(lower) && /\b(ujian|exam|uts|uas|kuis|quiz|tes|besok|minggu depan|midterm|finals)\b/i.test(lower));

  if (isCommunicationTask || isActionTask) {
    return 'todo';
  }

  // 8. OTHERS / RANDOM-YAP: Catatan non-aksi (curahan hati, opini, ide mentah, log kesehatan/gejala, rants)
  return 'general';
}
