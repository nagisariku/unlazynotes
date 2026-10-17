import { generateText } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { VALID_SOURCES, CATEGORIES, type Source } from '../../constants';
import { sanitizeTags, normalizeTag, BANNED_TAGS } from '../sanitizer';
import { type NoteTagResult } from '../types';
import type { NoteCategory } from '@/db/schema';

/**
 * Normalizes raw category string from LLM into one of the 9 strict NoteCategory enum values.
 * Enforces the 6 Primary Intent rules:
 * 1. BOOKMARK: Any note with HTTP/HTTPS link(s) (unless explicit checkbox task).
 * 2. CREDENTIAL: Passwords, ATM PINs, Bank Account Numbers, NIK KTP, Tokens/API Keys.
 * 3. SCHEDULE: Notes with explicit time/clock or calendar date markers.
 * 4. FINANCE: Financial transactions, spending, purchases, or debt/loans WITH nominal price/amount.
 * 5. TODO: Actions, tasks, commands, or communications without specific calendar/clock times.
 * 6. OTHERS / RANDOM-YAP: Non-action thoughts, opinions, raw ideas, health symptoms, and rants.
 */
export function normalizeCategory(rawCat: string | undefined, content: string): NoteCategory {
  const lower = content.toLowerCase().trim();

  // 1. Explicit Todo Checkbox Prefix or strong task override (e.g. "- [ ] review: https://..." or "harus ... buat ujian: https://...")
  if (
    lower.startsWith('- [ ]') ||
    lower.startsWith('[ ]') ||
    lower.startsWith('todo:') ||
    ((lower.startsWith('harus ') || lower.startsWith('jangan lupa ')) && /\b(ujian|exam|tugas|pr)\b/i.test(lower))
  ) {
    return 'todo';
  }

  // 2. URL -> Bookmark
  const hasUrl = /(https?:\/\/[^\s]+)/i.test(content);
  if (hasUrl) {
    return 'bookmark';
  }

  // 3. Sensitive Credentials (Password, ATM PIN, Bank Account Number, Token, API Key, dan NIK/SIM dengan nomor)
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

  // 4. Schedule (Specific date, hour, clock, or appointment)
  const isSchedulePattern =
    /\b(jam|pukul)\s*\d+([.:]\d+)?(\s*(pagi|siang|sore|malam|wib|wita|wit|am|pm))?\b/i.test(lower) ||
    /\b\d+([.:]\d+)\s*(am|pm|wib|wita|wit)\b/i.test(lower) ||
    /\b(besok|lusa|kemarin)\s+(pagi|siang|sore|malam|jam|pukul)\b/i.test(lower) ||
    /\b(senin|selasa|rabu|kamis|jumat|sabtu|minggu)\s+\d{1,2}\s+(jan|feb|mar|apr|mei|jun|jul|agu|sep|okt|nov|des)\b/i.test(lower) ||
    (/\b(flight|terbang|berangkat)\s+(senin|selasa|rabu|kamis|jumat|sabtu|minggu|\d{1,2}\s+[a-z]+)\b/i.test(lower)) ||
    (/\b(meeting|rapat|sync|call)\b/i.test(lower) && /\b(jam|pukul|\d+[:.]\d+|\d+\s*sore|\d+\s*pagi|\d+\s*siang|\d+\s*malam)\b/i.test(lower));

  const hasCurrencySuffix = /\b\d+(\.\d+)?\s*(k|rb|jt|ribu|rebu|juta|perak|usd|dollar|dollars|sgd|eur|gbp)\b/i.test(lower);
  const hasCurrencyPrefix = /(\$|rp\.?|idr|usd|sgd|eur|gbp)\s*\d+/i.test(lower);
  const hasThousandsSeparator = /\b\d{1,3}([.,]\d{3})+(\s*(via|pake|qris|cash|transfer|debit|kredit))?\b/i.test(lower);

  if (isSchedulePattern && !hasCurrencySuffix && !hasCurrencyPrefix && !hasThousandsSeparator) {
    return 'schedule';
  }

  // 5. Finance: Actual financial transactions, purchases, spending, bills, income, or debt/loans WITH nominal price/amount
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

  // 6. SCRIPTURE / QUOTES / PRAYERS / REFLECTIONS -> 'reference' or 'draft' (NEVER Todo!)
  const isArabicScript = /[\u0600-\u06FF]/.test(content);
  const isScriptureOrQuote =
    isArabicScript ||
    /\b(surah|qs\b|q\.s\b|ayat|al-qur'?an|quran|hadits|hadist|rasulullah|allah|bismillah|alhamdulillah|doa|quote|kutipan|pepatah|filosofi|renungan|refleksi|asy-syarh|ash-sharh|al-baqarah|al-fatihah)\b/i.test(lower);

  if (isScriptureOrQuote && !lower.startsWith('- [ ]') && !lower.startsWith('todo:')) {
    return content.length > 250 ? 'draft' : 'reference';
  }

  // Multi-line shopping list without prices is strictly TODO (e.g. "beli kemeja putih uniqlo \n stok sabun biore \n obat tetes mata rohto")
  const isShoppingList =
    /\b(beli|stok|belanja|pesen|pesan|order)\b/i.test(lower) &&
    (content.includes('\n') || /\b(dan|serta|stok)\b/i.test(lower));

  // 7. Non-Action Health, Workout, and Raw Idea Guards -> others (NOT todo, UNLESS shopping list!)
  const isHealthLog = /\b(migrain|pusing|demam|flu|batuk|pilek|maag|mual|paracetamol|panadol|bodrex|tolak\s*angin|obat|vitamin|apotek)\b/i.test(lower);
  const isWorkoutLog = /\b(squat|bench-press|deadlift|workout|gym|leg\s*day|pushup|pullup)\b/i.test(lower);
  const isRawIdea = /\b(ide\s+konten|ide\s+fitur|ide\s+aplikasi|ide\s+bisnis|ide\s+video|ide\s+tulisan|kepikiran)\b/i.test(lower) || lower.startsWith('ide: ') || lower.startsWith('ide :') || lower.startsWith('ide ');

  if (!isShoppingList && (isHealthLog || isWorkoutLog || isRawIdea) && !lower.startsWith('- [ ]') && !lower.startsWith('todo:') && !/\b(harus|wajib|jangan lupa)\b/i.test(lower)) {
    return 'others';
  }

  // 8. Todo Intent: Actions, tasks, commands, or communications without specific calendar/clock times
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

  // 9. Curhat, Shower Thoughts & Life Musings without action -> 'random-yap' (NOT others!)
  const isCurhatOrShowerThought =
    /\b(kadang mikir|kepikiran|kenapa ya|heran|curhat|uneg-uneg|capek banget|males banget|kok bisa|shower thought|renungan|kenapa orang|ngapain ya)\b/i.test(lower);

  if (isCurhatOrShowerThought) {
    return 'random-yap';
  }

  // If rawCat from LLM was provided, map synonyms or use it
  if (rawCat) {
    const c = rawCat.toLowerCase().trim();
    if (c === 'bookmark' && !hasUrl) {
      return lower.includes('kodepos') ? 'reference' : 'others';
    }
    if (['rant', 'thought', 'yap', 'shower-thought', 'curhat', 'uneg-uneg', 'opini', 'random-yap'].includes(c)) {
      return 'random-yap';
    }
    if (CATEGORIES.includes(c as NoteCategory)) {
      return c as NoteCategory;
    }
    if (['food', 'expense', 'expenses', 'spending', 'purchase', 'bill', 'income', 'money', 'payment', 'transaksi'].includes(c)) {
      return 'finance';
    }
    if (['task', 'todo', 'checklist', 'action', 'plan', 'wishlist', 'shopping', 'activity'].includes(c)) {
      return 'todo';
    }
    if (['calendar', 'meeting', 'event', 'appointment', 'deadline', 'jadwal'].includes(c)) {
      return 'schedule';
    }
    if (['link', 'url', 'web', 'site'].includes(c)) {
      return 'bookmark';
    }
    if (['password', 'pin', 'secret', 'auth', 'token', 'credential'].includes(c)) {
      return 'credential';
    }
    if (['draft', 'writing', 'article', 'document'].includes(c)) {
      return 'draft';
    }
    if (['recipe', 'quote', 'snippet', 'documentation'].includes(c)) {
      return 'reference';
    }
    if (['idea', 'konsep'].includes(c)) {
      return 'others';
    }
  }

  return 'others';
}

/**
 * Ensures universal Dual-Layer Tagging: [Specific Entity] + [Broad Concept/Domain].
 * Strictly enforces 3-tier tag allocation (max 2 - 3 tags per note):
 * - Tag 1 (REQUIRED - Specific Entity): Concrete noun (cilok, tahu-gejrot, martabak, cursor, q4-roadmap, demo, etc.)
 * - Tag 2 (REQUIRED - Domain Umbrella): Universal English root word (food, drink, tech, meeting, subscription, health, etc.)
 * - Tag 3 (OPTIONAL - Context/Brand/Person): Brand, person, or context (gojek, client, bca, etc.)
 */
export function enrichDualLayerTags(
  tags: string[],
  category: NoteCategory,
  content: string,
  rawLlmCat?: string
): string[] {
  const lower = content.toLowerCase();
  let baseTags = [...tags]
    .map((t) => normalizeTag(t))
    .filter((t) => t && !BANNED_TAGS.has(t));

  const domainEntities: string[] = [];
  const domainUmbrellas: string[] = [];
  const domainContexts: string[] = [];

  // 1. Debt & Loans Domain (Utang vs Piutang)
  if (/\b(minjem|pinjam|ngutang|utang|piutang|talangin|talangan)\b/i.test(lower)) {
    const isOurDebt =
      /\b(aku|saya|gue|gua)\s+(minjem|pinjam|ngutang)\b/i.test(lower) ||
      /\b(minjem|pinjam|ngutang|utang)\s+(ke|sama|dari)\s+([a-z0-9_-]+)/i.test(lower);

    if (isOurDebt) {
      domainUmbrellas.push('utang');
      const targetMatch = lower.match(/\b(ke|sama|dari)\s+([a-z0-9_-]+)/i);
      if (targetMatch && targetMatch[2] && !['bank', 'atm', 'pinjol'].includes(targetMatch[2])) {
        domainEntities.push(targetMatch[2]);
      }
    } else {
      domainUmbrellas.push('piutang');
      const borrowerMatch = lower.match(/([a-z0-9_-]+)\s+(minjem|pinjam|ngutang)/i);
      const lentMatch = lower.match(/\b(pinjemin|talangin|kasih pinjam)\s+([a-z0-9_-]+)/i);
      if (borrowerMatch && borrowerMatch[1] && !['aku', 'saya', 'gue', 'gua'].includes(borrowerMatch[1])) {
        domainEntities.push(borrowerMatch[1]);
      } else if (lentMatch && lentMatch[2]) {
        domainEntities.push(lentMatch[2]);
      }
    }
  }

  // 2. Coffee & Beverage Domain
  if (/\b(kopi\s*kenangan|fore|janji\s*jiwa|starbucks|tomoro)\b/i.test(lower)) {
    domainUmbrellas.push('kopi');
    if (/\bkopi\s*kenangan\b/i.test(lower)) domainEntities.push('kopi-kenangan');
    else if (/\bfore\b/i.test(lower)) domainEntities.push('fore');
    else if (/\bjanji\s*jiwa\b/i.test(lower)) domainEntities.push('janji-jiwa');
    else if (/\bstarbucks\b/i.test(lower)) domainEntities.push('starbucks');
    else if (/\btomoro\b/i.test(lower)) domainEntities.push('tomoro');
  } else if (/\b(kopi|coffee|ngopi)\b/i.test(lower) && !/\b(coffee\s*break)\b/i.test(lower)) {
    domainUmbrellas.push('kopi');
  } else if (/\b(tequila|matcha|beer|bir|boba|wine|jus|juice|teh|tea|latte|es\s*teh|cocktail|vodka|soju)\b/i.test(lower)) {
    domainUmbrellas.push('drink');
  }

  // 3. Food / Snack Domain
  const isFood =
    /\b(cimin|cireng|batagor|seblak|nasgor|nasi|ayam|ciken|chicken|bakso|mie|sate|martabak|cilok|tahu\s*gejrot|siomay|pempek|soto|rawon|resto|cafe|kuliner|makanan|gorengan|burger|pizza)\b/i.test(lower) ||
    (category === 'finance' && /\b(makan|jajan|lunch|dinner|snack)\b/i.test(lower));
  if (isFood && !domainUmbrellas.includes('kopi')) {
    domainUmbrellas.push('food');
  }

  // Specific food dishes
  if (/\bmartabak\b/i.test(lower)) domainEntities.push('martabak');
  if (/\bcilok\b/i.test(lower)) domainEntities.push('cilok');
  if (/\btahu\s*gejrot\b/i.test(lower)) domainEntities.push('tahu-gejrot');
  if (/\bnasgor\b/i.test(lower)) domainEntities.push('nasgor');
  if (/\bcimin\b/i.test(lower)) domainEntities.push('cimin');

  // Multi-item food + drink (e.g. "nasgor mawut 18rb es teh 4k")
  if (/\b(es\s*teh|teh|tea)\b/i.test(lower) && domainUmbrellas.includes('food')) {
    domainUmbrellas.push('drink');
  }

  // Brand / Delivery / Payment Context
  if (/\bgojek\b/i.test(lower)) domainContexts.push('gojek');
  if (/\bgrab\b/i.test(lower)) domainContexts.push('grab');
  if (/\bqris\b/i.test(lower)) domainContexts.push('qris');
  if (/\bcash\b/i.test(lower)) domainContexts.push('cash');
  if (/\bbca\b/i.test(lower)) domainContexts.push('bca');

  // Multi-line Shopping List & Department Domain (Clothes, Toiletries, Groceries)
  const isShoppingList =
    /\b(beli|stok|belanja|pesen|pesan|order)\b/i.test(lower) &&
    (content.includes('\n') || /\b(dan|serta|stok)\b/i.test(lower));

  if (isShoppingList || /\b(belanja|shopping|supermarket|mall|toko)\b/i.test(lower)) {
    if (/\buniqlo\b/i.test(lower)) domainEntities.push('uniqlo');
    if (/\bbiore\b/i.test(lower)) domainEntities.push('biore');
    if (/\brohto\b/i.test(lower)) domainEntities.push('rohto');
    if (/\b(kemeja|kaos|baju|celana|rok|jaket)\b/i.test(lower)) domainEntities.push('clothing');
    if (/\b(sabun|shampoo|sampo|odol)\b/i.test(lower)) domainEntities.push('toiletries');
    if (!domainUmbrellas.includes('food')) {
      domainUmbrellas.push('shopping');
    }
  }

  // 4. Tech & Subscription Domain
  if (/\b(subscription|langganan|subs)\b/i.test(lower)) {
    domainUmbrellas.push('subscription');
  }
  if (/\b(cursor)\b/i.test(lower)) {
    domainEntities.push('cursor');
    domainUmbrellas.push('tech');
  } else if (/\b(vps|hosting|server|saas|software|cloud|code|editor|ai)\b/i.test(lower)) {
    domainUmbrellas.push('tech');
  }

  // 5. Schedule & Meeting Domain
  if (/\b(q4\s*roadmap|roadmap)\b/i.test(lower)) {
    domainEntities.push('q4-roadmap');
  }
  if (/\b(demo|product\s*demo|produk\s*demo)\b/i.test(lower)) {
    domainEntities.push('demo');
  }
  if (/\bdesain\b/i.test(lower)) {
    domainEntities.push('desain');
  }
  if (/\b(client|klien)\b/i.test(lower)) {
    domainContexts.push('client');
  }
  // Meeting Domain: HANYA jika teks memuat keyword rapat/diskusi eksplisit (BUKAN otomatis untuk seluruh schedule)
  if (/\b(meeting|rapat|sync|call|sprint|discuss|coffee\s*break|demo)\b/i.test(lower)) {
    domainUmbrellas.push('meeting');
  }

  // Entertainment / Cinema Domain (e.g. nonton avatar di cgv sabtu malam jam 21.15 seat f12)
  if (/\b(nonton|bioskop|cgv|xxi|cinepolis|film|movie|avatar|konser|cinema)\b/i.test(lower)) {
    domainUmbrellas.push('entertainment');
    if (/\bavatar\b/i.test(lower)) domainEntities.push('avatar');
    if (/\bcgv\b/i.test(lower)) domainEntities.push('cgv');
    if (/\bxxi\b/i.test(lower)) domainEntities.push('xxi');
    if (/\bcinepolis\b/i.test(lower)) domainEntities.push('cinepolis');
    if (/\bfilm\b/i.test(lower)) domainEntities.push('film');
    if (/\bmovie\b/i.test(lower)) domainEntities.push('movie');
    if (/\bkonser\b/i.test(lower)) domainEntities.push('konser');
  }

  // Multi-Entity Business & Income Extraction (e.g. "dapet transferan dp website klien 2.5jt pt karya maju")
  if (/\b(transferan|transfer\s*masuk|dp|gaji|salary|pemasukan|invoice)\b/i.test(lower)) {
    domainUmbrellas.push('income');
  }
  if (/\b(website|web)\b/i.test(lower)) {
    domainEntities.push('website');
    if (!domainUmbrellas.includes('tech')) domainUmbrellas.push('tech');
  }
  const ptMatch = lower.match(/\bpt\s+([a-z0-9_-]+(\s+[a-z0-9_-]+)*)/i);
  if (ptMatch) {
    const company = ptMatch[1].trim().replace(/\s+/g, '-');
    domainEntities.push(`pt-${company}`);
  }

  // 6. Communication & Task Domain
  const commMatch = lower.match(/\b(chat|telepon|telpon|wa|whatsapp|hubungi|dm|email|call)\s+([a-z0-9_-]+)(.*)/i);
  if (commMatch) {
    const person = commMatch[2].trim();
    if (person && !['ke', 'sama', 'tentang', 'soal', 'ini', 'itu'].includes(person)) {
      domainEntities.push(person);
    }
    const topicMatch = commMatch[3].match(/\b(tanya|soal|tentang|minta|bahas|cek|mengenai)\s+([a-z0-9_-]+)/i);
    if (topicMatch && topicMatch[2]) {
      domainEntities.push(topicMatch[2]);
    }
  }

  // 7. Health & Wellness Domain (Guarded against shopping lists and todo tasks)
  const isHealth =
    !isShoppingList &&
    category !== 'todo' &&
    /\b(migrain|pusing|demam|flu|batuk|pilek|maag|mual|paracetamol|panadol|bodrex|obat|vitamin|apotek|dokter|klinik)\b/i.test(lower);
  if (isHealth) {
    domainUmbrellas.push('health');
    if (/\bmigrain\b/i.test(lower)) domainEntities.push('migrain');
    if (/\bpusing\b/i.test(lower)) domainEntities.push('pusing');
    if (/\bparacetamol\b/i.test(lower)) domainEntities.push('paracetamol');
    if (/\bpanadol\b/i.test(lower)) domainEntities.push('panadol');
    if (/\bbodrex\b/i.test(lower)) domainEntities.push('bodrex');
  }

  // Gym / Workout Domain
  if (/\b(squat|bench-press|deadlift|workout|gym|leg\s*day|pushup|pullup|cardio)\b/i.test(lower)) {
    domainUmbrellas.push('workout');
    domainUmbrellas.push('gym');
    if (/\bsquat\b/i.test(lower)) domainEntities.push('squat');
    if (/\bleg\s*day\b/i.test(lower)) domainEntities.push('leg-day');
  }

  // 8. Ideas & Creative Domain
  if (/\b(ide|idea|kepikiran|konsep)\b/i.test(lower)) {
    domainUmbrellas.push('idea');
    if (/\btiktok\b/i.test(lower)) domainEntities.push('tiktok');
    if (/\bapp\s*fatigue\b/i.test(lower)) domainEntities.push('app-fatigue');
    if (/\bvoice\s*note\b/i.test(lower)) domainEntities.push('voice-note');
    if (/\bfitur\b/i.test(lower)) domainEntities.push('fitur');
  }

  // 9. Credential Domain
  if (category === 'credential' || /\b(no\s*rek|nomor\s*rekening|rekening|pin\s*atm|pin|password|wifi|token|kredensial)\b/i.test(lower)) {
    if (/\bbca\b/i.test(lower)) domainEntities.push('bca');
    if (/\b(rekening|no\s*rek|nomor\s*rekening)\b/i.test(lower)) domainEntities.push('rekening');
    if (/\batm\b/i.test(lower)) domainEntities.push('atm');
    if (/\bpin\b/i.test(lower)) domainEntities.push('pin');
    if (/\bwifi\b/i.test(lower)) domainEntities.push('wifi');
    if (/\badmin\b/i.test(lower)) domainEntities.push('admin');
    if (/\bdashboard\b/i.test(lower)) domainEntities.push('dashboard');
    if (/\blogin\b/i.test(lower)) domainEntities.push('login');
    if (/\b(nik|ktp)\b/i.test(lower) && /\b\d{4,}\b/.test(lower)) domainEntities.push('ktp');
    if (/\bsim\b/i.test(lower) && /\b\d{4,}\b/.test(lower)) domainEntities.push('sim');
    if (/\bpaspor\b/i.test(lower) && /\b\d{4,}\b/.test(lower)) domainEntities.push('paspor');
  }

  // 10. Scripture & Quotes Domain (Quran, Hadith, Doa, Philosophy, Quotes)
  const isArabicScript = /[\u0600-\u06FF]/.test(content);
  const isScripture =
    isArabicScript ||
    /\b(surah|qs\b|q\.s\b|ayat|al-qur'?an|quran|hadits|hadist|rasulullah|allah|bismillah|alhamdulillah|doa|asy-syarh|ash-sharh|al-baqarah|al-fatihah)\b/i.test(lower);
  const isQuote = /\b(quote|kutipan|pepatah|filosofi|renungan|refleksi)\b/i.test(lower);

  if (isScripture || isQuote) {
    if (/\b(asy-syarh|ash-sharh)\b/i.test(lower)) domainEntities.push('surah-asy-syarh');
    else if (/\bal-baqarah\b/i.test(lower)) domainEntities.push('al-baqarah');
    else if (/\bal-fatihah\b/i.test(lower)) domainEntities.push('al-fatihah');
    else if (/\b(ayat|surah)\b/i.test(lower)) domainEntities.push('ayat');

    if (isScripture) {
      if (/\b(hadits|hadist|rasulullah)\b/i.test(lower)) domainUmbrellas.push('hadits');
      else if (/\b(doa)\b/i.test(lower)) domainUmbrellas.push('doa');
      else domainUmbrellas.push('quran');
    } else {
      domainUmbrellas.push('quote');
    }
  }

  // 11. Curhat & Shower Thoughts Domain (random-yap)
  const isCurhat =
    category === 'random-yap' ||
    /\b(curhat|uneg-uneg|kadang mikir|kepikiran|kenapa ya|heran|capek banget|males banget|kok bisa|shower thought|renungan|kenapa orang|ngapain ya|macet-macetan|macet)\b/i.test(lower);
  if (isCurhat) {
    if (/\b(macet|macet-macetan)\b/i.test(lower)) domainEntities.push('macet');
    if (/\b(kerja|kantor|ngantor)\b/i.test(lower)) domainEntities.push('kerja');
    if (/\b(liburan|healing|istirahat)\b/i.test(lower)) domainEntities.push('liburan');
    if (/\bcurhat\b/i.test(lower)) domainUmbrellas.push('curhat');
    else domainUmbrellas.push('renungan');
  }

  // 12. Research & Comparison & Chore Domain (todo)
  if (/\b(macbook)\b/i.test(lower)) domainEntities.push('macbook');
  if (/\b(laptop|gadget)\b/i.test(lower)) domainEntities.push('laptop');
  if (/\b(biaya\s*kuliah|kuliah|kampus)\b/i.test(lower)) domainEntities.push('kuliah');
  if (/\b(itb|ui|ugm|undip)\b/i.test(lower)) domainEntities.push('itb');
  if (/\bpolres\b/i.test(lower)) domainEntities.push('polres');
  if (/\bsim\b/i.test(lower) && !/\b\d{4,}\b/.test(lower)) domainEntities.push('sim');
  if (/\bktp\b/i.test(lower) && !/\b\d{4,}\b/.test(lower)) domainEntities.push('ktp');

  // Candidate dishes/snacks and transit
  const dishCandidates = [
    'cimin', 'seblak', 'cireng', 'batagor', 'rendang', 'nasgor', 'ayam', 'bakso', 'mie', 'sate',
    'bensin', 'pertalite', 'pertamax', 'parkir', 'tol', 'ojol', 'indihome'
  ];
  for (const dish of dishCandidates) {
    if (lower.includes(dish) && !domainEntities.includes(dish)) {
      domainEntities.push(dish);
    }
  }

  // Combine entities and baseTags with strict domain priorities
  const combined: string[] = [];

  // Specialized Domain Priority 1: Debt & Loans (Utang vs Piutang)
  if (domainUmbrellas.includes('piutang') || domainUmbrellas.includes('utang')) {
    const direction = domainUmbrellas.includes('piutang') ? 'piutang' : 'utang';
    for (const ent of domainEntities) {
      if (!combined.includes(ent)) combined.push(ent);
    }
    if (!combined.includes(direction)) combined.push(direction);
    return combined.slice(0, 5);
  }

  // Specialized Domain Priority 2: Workout & Gym
  if (domainUmbrellas.includes('workout') || domainUmbrellas.includes('gym')) {
    if (!combined.includes('workout')) combined.push('workout');
    if (!combined.includes('gym')) combined.push('gym');
    for (const ent of domainEntities) {
      if (!combined.includes(ent)) combined.push(ent);
    }
    return combined.slice(0, 5);
  }

  // Specialized Domain Priority 3: Ideas & Concepts
  if (domainUmbrellas.includes('idea')) {
    if (!combined.includes('idea')) combined.push('idea');
    for (const ent of domainEntities) {
      if (!combined.includes(ent)) combined.push(ent);
    }
    for (const t of baseTags) {
      if (t !== 'ide' && t !== 'idea' && !combined.includes(t)) combined.push(t);
    }
    return combined.slice(0, 5);
  }

  // Specialized Domain Priority 4: Health & Wellness
  if (category !== 'todo' && domainUmbrellas.includes('health')) {
    if (!combined.includes('health')) combined.push('health');
    for (const ent of domainEntities) {
      if (!combined.includes(ent)) combined.push(ent);
    }
    for (const t of baseTags) {
      if (t !== 'kesehatan' && t !== 'health' && !combined.includes(t)) combined.push(t);
    }
    return combined.slice(0, 5);
  }

  // Specialized Domain Priority 5: Scripture & Quotes
  if (domainUmbrellas.includes('quran') || domainUmbrellas.includes('hadits') || domainUmbrellas.includes('doa') || domainUmbrellas.includes('quote')) {
    for (const ent of domainEntities) {
      if (!combined.includes(ent)) combined.push(ent);
    }
    for (const umb of domainUmbrellas) {
      if (!combined.includes(umb)) combined.push(umb);
    }
    for (const t of baseTags) {
      if (!combined.includes(t) && !BANNED_TAGS.has(t)) combined.push(t);
    }
    return combined.slice(0, 5);
  }

  // Specialized Domain Priority 6: Multi-line Shopping List
  if (isShoppingList) {
    if (!combined.includes('shopping')) combined.push('shopping');
    for (const ent of domainEntities) {
      if (!combined.includes(ent)) combined.push(ent);
      if (combined.length >= 5) break;
    }
    return combined.slice(0, 5);
  }

  // Specialized Domain Priority 7: Curhat / Shower Thoughts (random-yap)
  if (category === 'random-yap' || domainUmbrellas.includes('curhat') || domainUmbrellas.includes('renungan')) {
    for (const ent of domainEntities) {
      if (!combined.includes(ent)) combined.push(ent);
    }
    for (const umb of domainUmbrellas) {
      if (!combined.includes(umb)) combined.push(umb);
    }
    for (const t of baseTags) {
      if (!combined.includes(t) && !BANNED_TAGS.has(t)) combined.push(t);
    }
    if (combined.length === 0) combined.push('renungan');
    return combined.slice(0, 5);
  }

  // STRICT MULTI-TIER ALLOCATION ORDER (Max 5 Tags):
  // Tier 1: Specific Entity (martabak, cursor, q4-roadmap, demo, cilok, tahu-gejrot, nasgor, website, pt-karya-maju)
  for (const ent of domainEntities) {
    if (!combined.includes(ent)) combined.push(ent);
    if (combined.length >= 5) break;
  }

  // Tier 2: Domain Umbrella (food, drink, tech, meeting, entertainment, subscription, etc.)
  if (combined.length < 5) {
    for (const umb of domainUmbrellas) {
      if (!combined.includes(umb)) combined.push(umb);
      if (combined.length >= 5) break;
    }
  }

  // Tier 3: Context / Brand / Person (gojek, client, bca, etc.)
  if (combined.length < 5) {
    for (const ctx of domainContexts) {
      if (!combined.includes(ctx)) combined.push(ctx);
      if (combined.length >= 5) break;
    }
  }

  // Tier 4: Incorporate valid candidate baseTags from LLM if room remains
  if (combined.length < 5) {
    for (const t of baseTags) {
      if (
        !combined.includes(t) &&
        !domainUmbrellas.includes(t) &&
        !domainContexts.includes(t) &&
        !BANNED_TAGS.has(t)
      ) {
        combined.push(t);
        if (combined.length >= 5) break;
      }
    }
  }

  // Fallback if still empty
  if (combined.length === 0) {
    const cleanTokens = lower
      .replace(/(\$|rp)\s*\d+[a-z]*/gi, '')
      .replace(/\b\d+\s*(k|rb|jt|ribu|juta)?\b/gi, '')
      .replace(/\b(beli|bayar|tfr|transfer|kirim|buat|untuk|ke|di)\b/gi, '')
      .split(/[^a-z0-9-]+/)
      .map((t) => normalizeTag(t))
      .filter((t) => t.length >= 3 && !BANNED_TAGS.has(t));

    if (cleanTokens.length > 0) {
      combined.push(cleanTokens[0]);
    }
  }

  return combined.slice(0, 5);
}

/**
 * Specialized General AI Module.
 * Uses robust text generation with JSON extraction to prevent parser errors
 * caused by markdown code fences (```json ... ```) from models like DeepSeek.
 */
export async function processGeneralNote(
  content: string,
  heuristicFallback: (text: string) => NoteTagResult,
  existingUserTags?: string[]
): Promise<NoteTagResult> {
  const apiKey = process.env.AI_PROVIDER_API_KEY;
  const modelName = process.env.AI_MODEL_NAME || 'deepseek-v4.1-flash';

  if (!apiKey || apiKey === 'sk-xxxx' || apiKey.startsWith('mock-')) {
    return heuristicFallback(content);
  }

  try {
    const openaiCompatible = createOpenAICompatible({
      name: 'cosmoshub',
      baseURL: process.env.AI_BASE_URL || 'https://api.cosmoshub.tech/v1',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const userTagContext =
      existingUserTags && existingUserTags.length > 0
        ? `\nUSER EXISTING TAG MEMORY (Prioritize reusing these tags over inventing new synonyms):\n${JSON.stringify(existingUserTags.slice(0, 30))}\n`
        : '';

    const result = await generateText({
      model: openaiCompatible(modelName),
      temperature: 0,
      system: `You are an intelligent semantic classifier and tagging engine for UnlazyNotes.
Analyze the user's note and return a strict JSON object with:
1. "category": exactly 1 primary intent category.
2. "specific_tags": 2 to 5 domain-aware tags (lowercase-with-hyphens).
3. "source": detected platform source string or null.

PRIMARY INTENT CATEGORIES:
- bookmark: Any note containing HTTP/HTTPS link(s), whether pure URL or accompanied by commentary/caption.
- credential: Sensitive private credentials: Password, PIN ATM, Bank Account Number (no rek), Token/API Key.
  CRITICAL ID CARD GUARD: Words like "ktp", "sim", "paspor", "passport", "nik" ONLY trigger "credential" if accompanied by actual identity numbers/digits. Administrative tasks or procedures (e.g. "perpanjang sim a... bawa fotokopi ktp", "urus paspor") are actionable tasks and MUST be classified as "todo", NOT "credential"!
- finance: Actual financial transactions, purchases, spending, bills, income, or debt/loans WITH explicit nominal amount/price. MUST ALWAYS retain the specific entity as Tag 1 (e.g. "cimin 12k" -> ["cimin", "food"]).
- schedule: Notes that WAJIB have a specific calendar date, time, or clock marker (e.g. "meeting jam 14.00", "besok jam 9 pagi ke dokter", "meeting desain jam 3 sore", "demo produk client selasa jam 10 pagi", "flight jumat 20 okt", "nonton avatar di cgv sabtu malam jam 21.15"). Note: Non-meeting schedules like cinema/movies MUST NOT be tagged as 'meeting'; use 'entertainment'!
- todo: Action tasks, commands, chores, food orders, multi-line shopping lists, or research/comparison tasks (e.g. "cari info...", "bandingin harga...", "survei...", "perpanjang sim...", "urus berkas...").
- random-yap: Casual thoughts, uneg-uneg, venting, shower thoughts, and life musings without action (e.g. "kadang mikir kenapa orang rela macet-macetan tiap hari demi kerja...", "kenapa ya tiap senin rasanya...", "curhat capek banget..."). WAJIB use "random-yap" (NOT "others") for personal reflections, curhat, and shower thoughts!
- reference: Religious scriptures, Quranic verses, hadith, prayers (doa), quotes, recipes, code snippets. SCRIPTURES & QUOTES ARE NEVER TODO!
- draft: Long reflections (>250 chars), essays, unformatted articles, speech transcripts.
- others: Specific non-action structured logs: health symptoms & medication logs (e.g. "migrain minum paracetamol"), gym/workout logs ("squat 60kg"), raw feature/business ideas ("ide fitur: ...").

CORE TAGGING PRINCIPLES:
1. High-Level Universal Root Umbrella:
   - Tag payung (Domain Umbrella) HARUS selalu berupa kata dasar tingkat tertinggi dalam bahasa Inggris (Single universal English root word):
     food, drink, tech, work, meeting, entertainment, pet, music, gaming, health, travel, finance, subscription, shopping, quran, quote.
   - DILARANG membuat tag turunan/spesifik yang merupakan pecahan domain utama (gunakan "food" BUKAN "food-order"/"street-food"/"jajan"; gunakan "drink" BUKAN "beverage"/"minuman").
2. Prioritize Tag Reuse (User Tag Memory):
   - Prioritaskan untuk MEMAKAI ULANG tag yang sudah sering digunakan user pada catatan-catatan sebelumnya agar tag dashboard rapi.
3. Tag Allocation Discipline (Maksimal 3 - 5 Tag per Catatan jika banyak entitas konkret):
   - Tag 1 (WAJIB - Specific Entity): Subjek/kata benda konkret dari teks user (contoh: cilok, tahu-gejrot, martabak, cursor, q4-roadmap, demo, nasgor, cimin, uniqlo, biore, admin, website, pt-karya-maju).
   - Tag 2 (WAJIB - Domain Umbrella): 1 kata dasar payung universal (contoh: food, drink, tech, meeting, entertainment, pet, gaming, subscription, shopping, quran).
   - Tag 3 (OPSIONAL - Context/Brand/Person): Brand, payment, atau nama orang jika relevan (contoh: gojek, bca, qris, client).
   - Tag 4 & 5 (OPSIONAL - Multi-Entity): Entitas konkret pendamping (contoh: website, pt-karya-maju, dll.).
4. Negative Constraints:
   - DILARANG Tag Terpotong: Gunakan kata dasar yang utuh (gunakan demo atau presentation, JANGAN potong jadi product-demonstratio).
   - DILARANG Tag Redundan: Jangan keluarkan dua tag yang sinonim / semakna dalam satu catatan (misal: jangan pasang demo bersamaan dengan product-demo, jangan pasang kopi bersamaan dengan coffee).
   - DILARANG Tag Mata Uang / Pajak: Hapus tag nama mata uang seperti usd, idr, rp, dollar, dollars, tax, pajak.
   - DILARANG Tag Kata Kerja: Jangan jadikan kata kerja aksi (seperti chat, beli, tanya, minum, bayar, kirim, cari, bandingin) sebagai tag!
   - DILARANG Tag Halusinasi Makanan: Jangan berikan tag "food" untuk sabun, odol, kemeja, pakaian, atau obat!
${userTagContext}
Examples:
1. Food & Drink (Always Retain Specific Food Entity):
   - "cimin 12k" -> {"category": "finance", "specific_tags": ["cimin", "food"]}
   - "jajan cilok 5rebu" -> {"category": "finance", "specific_tags": ["cilok", "food"]}
   - "martabak telur 45k via qris bca" -> {"category": "finance", "specific_tags": ["martabak", "food", "qris"]}
   - "pesen martabak manis gojek" -> {"category": "todo", "specific_tags": ["martabak", "food", "gojek"]}
   - "kopi kenangan 22k" -> {"category": "finance", "specific_tags": ["kopi-kenangan", "kopi"]}
   - "nasgor mawut 18rb es teh 4k" -> {"category": "finance", "specific_tags": ["nasgor", "food", "drink"]}
   - "jajan tahu gejrot 10rebu" -> {"category": "finance", "specific_tags": ["tahu-gejrot", "food"]}
2. Multi-line Shopping List (TODO, NOT Others, NO Food Hallucination):
   - "beli kemeja putih uniqlo \n stok sabun biore \n obat tetes mata rohto" -> {"category": "todo", "specific_tags": ["shopping", "uniqlo", "biore"]}
3. Research, Comparison & Bureaucracy Tasks (TODO):
   - "perpanjang sim a ke polres bawa fotokopi ktp" -> {"category": "todo", "specific_tags": ["sim", "ktp", "polres"]}
   - "cari info biaya kuliah s2 itb" -> {"category": "todo", "specific_tags": ["kuliah", "itb"]}
   - "bandingin harga macbook m3 vs m4" -> {"category": "todo", "specific_tags": ["macbook", "laptop"]}
4. Curhat & Shower Thoughts (RANDOM-YAP, WAJIB Bukan Others):
   - "kadang mikir kenapa orang rela macet-macetan tiap hari demi kerja" -> {"category": "random-yap", "specific_tags": ["macet", "kerja", "renungan"]}
5. Credentials (Strict Priority over Todo when containing credentials):
   - "login dashboard admin pake email admin@shirobit.com passwordnya RahasiaBanget#2026!" -> {"category": "credential", "specific_tags": ["admin", "dashboard", "login"]}
   - "nomor rekening bca riku 1234567890" -> {"category": "credential", "specific_tags": ["bca", "rekening"]}
   - "nik ktp riku 3201234567890123" -> {"category": "credential", "specific_tags": ["ktp", "nik"]}
6. Scriptures & Quotes (REFERENCE or DRAFT, NEVER Todo):
   - "Maka sesungguhnya bersama kesulitan ada kemudahan. (QS. Asy-Syarh: 5-6)" -> {"category": "reference", "specific_tags": ["surah-asy-syarh", "quran"]}
7. Subscription & Tech:
   - "subscription cursor 20 usd kena tax 20 dollar" -> {"category": "finance", "specific_tags": ["cursor", "subscription", "tech"]}
8. Schedule & Entertainment:
   - "demo produk client selasa jam 10 pagi" -> {"category": "schedule", "specific_tags": ["demo", "meeting", "client"]}
   - "coffee break with client discuss Q4 roadmap jam 4 sore" -> {"category": "schedule", "specific_tags": ["q4-roadmap", "meeting", "client"]}
   - "meeting desain jam 3 sore" -> {"category": "schedule", "specific_tags": ["desain", "meeting"]}
   - "nonton avatar di cgv sabtu malam jam 21.15 seat f12" -> {"category": "schedule", "specific_tags": ["avatar", "cgv", "entertainment"]}
9. Debt & Multi-Entity Business Income (Finance):
   - "ubed minjem 100k" -> {"category": "finance", "specific_tags": ["ubed", "piutang"]}
   - "aku minjem 50k ke fajar" -> {"category": "finance", "specific_tags": ["fajar", "utang"]}
   - "dapet transferan dp website klien 2.5jt pt karya maju" -> {"category": "finance", "specific_tags": ["pt-karya-maju", "website", "client", "income"]}
10. Communication & Tasks (Todo):
   - "chat rizky tanya proposal" -> {"category": "todo", "specific_tags": ["rizky", "proposal"]}
11. Bookmarks:
   - "https://medium.com/p/123 bacaan devops bagus" -> {"category": "bookmark", "specific_tags": ["medium", "devops"]}
   - "https://youtu.be/xyz referensi animasi web" -> {"category": "bookmark", "specific_tags": ["youtube", "animasi", "referensi"]}
12. Health, Workout & Ideas (Others):
   - "migrain minum paracetamol" -> {"category": "others", "specific_tags": ["health", "migrain", "paracetamol"]}
   - "leg day 4 set squat 60kg" -> {"category": "others", "specific_tags": ["workout", "gym", "squat"]}
   - "ide konten tiktok soal app fatigue" -> {"category": "others", "specific_tags": ["idea", "tiktok", "app-fatigue"]}
   - "ide fitur: voice note transcription" -> {"category": "others", "specific_tags": ["idea", "fitur", "voice-note"]}

Formatting:
- Output JSON ONLY.
- lowercase-with-hyphens, max 20 chars per tag.
- Category must be one of: "bookmark" | "credential" | "finance" | "schedule" | "todo" | "others" | "draft" | "reference" | "random-yap".`,
      prompt: `Classify and extract tags as JSON {"category": "finance" | "todo" | "schedule" | "bookmark" | "credential" | "reference" | "draft" | "random-yap" | "others", "specific_tags": [...], "source": null}:\n"""${content}"""`,
    });

    // Extract JSON block even if model wraps in markdown code fences (```json ... ```)
    let rawJson = result.text.trim();
    const match = rawJson.match(/\{[\s\S]*\}/);
    if (match) {
      rawJson = match[0];
    }

    let parsed: any = {};
    try {
      parsed = JSON.parse(rawJson);
    } catch {
      console.warn('[AI] Failed to parse JSON from LLM output, falling back to heuristic:', rawJson);
      return heuristicFallback(content);
    }

    const rawCategory = parsed.category || parsed.type;
    const category = normalizeCategory(rawCategory, content);

    let rawTags: string[] = [];
    if (Array.isArray(parsed.specific_tags)) rawTags = parsed.specific_tags;
    else if (Array.isArray(parsed.tags)) rawTags = parsed.tags;
    else if (typeof parsed.item === 'string') rawTags = [parsed.item];

    const enriched = enrichDualLayerTags(rawTags, category, content, rawCategory);
    const cleanTags = sanitizeTags(enriched, category, content, 5, existingUserTags);

    let cleanSource: Source | null = null;
    if (parsed.source) {
      const s = String(parsed.source).toLowerCase().trim();
      if (VALID_SOURCES.includes(s as Source)) {
        cleanSource = s as Source;
      }
    }

    return {
      category,
      specific_tags: cleanTags,
      source: cleanSource,
    };
  } catch (err) {
    console.warn('[AI] Error in processGeneralNote LLM, using heuristic fallback:', err);
    return heuristicFallback(content);
  }
}
