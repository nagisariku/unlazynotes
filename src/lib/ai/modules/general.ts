import { generateText } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { VALID_SOURCES, CATEGORIES, type Source } from '../../constants';
import { sanitizeTags, normalizeTag, BANNED_TAGS } from '../sanitizer';
import { type NoteTagResult } from '../types';
import { routeNoteIntent } from '../router';
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
  const text = content.trim();
  const lower = text.toLowerCase();

  // 1. Enforce Absolute Invariants:
  // Explicit Todo Checkbox Prefix
  if (lower.startsWith('- [ ]') || lower.startsWith('[ ]') || lower.startsWith('todo:')) {
    return 'todo';
  }

  // Pure URL without extra commentary -> always bookmark
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const strippedOfUrl = text.replace(urlRegex, '').trim();
  const hasUrl = /(https?:\/\/[^\s]+)/i.test(text);
  if (hasUrl && strippedOfUrl.length === 0) {
    return 'bookmark';
  }

  // 2. Jika rawCat ada, percayai LLM (Claude Haiku 5.5) dan petakan sinonim ke 9 kategori baku:
  if (rawCat) {
    const c = rawCat.toLowerCase().trim();

    // Mapping sinonim LLM
    if (['todo', 'task', 'tasks', 'action', 'actions', 'checklist', 'backlog', 'chores', 'job'].includes(c)) {
      return 'todo';
    }
    if (['finance', 'expense', 'expenses', 'spending', 'income', 'money', 'bill', 'bills', 'payment', 'transaksi'].includes(c)) {
      return 'finance';
    }
    if (['schedule', 'event', 'events', 'appointment', 'calendar', 'meeting', 'jadwal'].includes(c)) {
      return 'schedule';
    }
    if (['random-yap', 'thought', 'thoughts', 'curhat', 'rant', 'rants', 'yap', 'shower-thought', 'uneg-uneg', 'opini'].includes(c)) {
      return 'random-yap';
    }
    if (['bookmark', 'link', 'url', 'web', 'site'].includes(c)) {
      return 'bookmark';
    }
    if (['credential', 'password', 'passwords', 'secret', 'secrets', 'auth', 'token', 'token-key'].includes(c)) {
      return 'credential';
    }
    if (['draft', 'writing', 'article', 'doc', 'docs', 'spec', 'specification', 'document'].includes(c)) {
      return 'draft';
    }
    if (['reference', 'recipe', 'quote', 'quotes', 'snippet', 'documentation', 'scripture'].includes(c)) {
      return 'reference';
    }
    if (['others', 'other', 'idea', 'ideas', 'konsep', 'log'].includes(c)) {
      return 'others';
    }

    if (CATEGORIES.includes(c as NoteCategory)) {
      return c as NoteCategory;
    }
  }

  // 3. Fallback Heuristik (HANYA jika LLM gagal atau mengembalikan nilai aneh):
  const fallbackModule = routeNoteIntent(content);
  switch (fallbackModule) {
    case 'bookmark':
      return 'bookmark';
    case 'credential':
      return 'credential';
    case 'schedule':
      return 'schedule';
    case 'finance':
      return 'finance';
    case 'todo':
      return 'todo';
    case 'general':
    default: {
      const isArabic = /[\u0600-\u06FF]/.test(content);
      const isScripture = isArabic || /\b(surah|qs\b|q\.s\b|ayat|al-qur'?an|quran|hadits|hadist|rasulullah|allah|bismillah|alhamdulillah|doa|quote|kutipan)\b/i.test(lower);
      if (isScripture) return text.length > 250 ? 'draft' : 'reference';

      if (text.length > 200 || /^#{1,6}\s+/m.test(text) || text.includes('\n#')) return 'draft';

      if (/\b(kadang mikir|kepikiran|kenapa ya|heran|curhat|uneg-uneg|capek banget|males banget|kok bisa|shower thought|renungan)\b/i.test(lower)) {
        return 'random-yap';
      }

      return 'others';
    }
  }
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
  _rawLlmCat?: string
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
  // Meeting Domain: HANYA jika teks memuat keyword rapat/diskusi/demo kerja eksplisit (BUKAN otomatis untuk seluruh schedule)
  // Jadwal pribadi/kesehatan/hiburan (seperti dokter, nonton, tuweb) DILARANG diberi tag meeting
  const isExplicitMeeting = /\b(meeting|rapat|sync|call|discuss|sprint|demo|coffee\s*break)\b/i.test(lower);
  const isNonMeetingSchedule = /\b(dokter|gigi|klinik|rumah\s*sakit|rs|puskesmas|obat|kontrol|tuweb|tuweeb|nonton|bioskop|cgv|xxi|film|movie)\b/i.test(lower);
  if (isExplicitMeeting && !isNonMeetingSchedule) {
    domainUmbrellas.push('meeting');
  }

  // Health / Medical Schedule (HANYA jika category === 'schedule' dan memuat dokter/gigi/kontrol, misal: "kontrol dokter gigi tgl 25")
  if (category === 'schedule' && /\b(dokter|gigi|klinik|puskesmas|rs|rumah\s*sakit|periksa|kontrol)\b/i.test(lower) && !/\b(surat|fotokopi|berkas)\b/i.test(lower)) {
    if (/\bdokter\b/i.test(lower)) domainEntities.push('dokter');
    if (/\bgigi\b/i.test(lower)) domainEntities.push('gigi');
    if (!domainUmbrellas.includes('health')) domainUmbrellas.push('health');
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

  // 9. Credential Domain (HANYA jika category === 'credential')
  if (category === 'credential') {
    if (/\bbca\b/i.test(lower)) domainEntities.push('bca');
    if (/\b(rekening|no\s*rek|nomor\s*rekening)\b/i.test(lower)) domainEntities.push('rekening');
    if (/\batm\b/i.test(lower)) domainEntities.push('atm');
    if (/\bwifi\b/i.test(lower)) domainEntities.push('wifi');
    if (/\badmin\b/i.test(lower)) domainEntities.push('admin');
    if (/\bdashboard\b/i.test(lower)) domainEntities.push('dashboard');
    if (/\blogin\b/i.test(lower)) domainEntities.push('login');
    if (/\b(nik|ktp)\b/i.test(lower) && /\b\d{4,}\b/.test(lower)) domainEntities.push('ktp');
    if (/\bsim\b/i.test(lower) && /\b\d{4,}\b/.test(lower)) domainEntities.push('sim');
    if (/\bpaspor\b/i.test(lower) && /\b\d{4,}\b/.test(lower)) domainEntities.push('paspor');
  }
  if (/\bpin\b/i.test(lower)) domainEntities.push('pin');

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

  // 13. Dev, Cultural, and Fitness/Step Entities
  if (/\bunlazynotes\b/i.test(lower)) {
    domainEntities.push('unlazynotes');
    if (!domainUmbrellas.includes('tech')) domainUmbrellas.push('tech');
  }
  if (/\b(kajian|pengajian)\b/i.test(lower)) {
    domainEntities.push('kajian');
  }
  if (/\bmaghrib\b/i.test(lower)) {
    domainEntities.push('maghrib');
  }
  if (/\bjogging\b/i.test(lower)) {
    domainEntities.push('jogging');
  }
  if (/\b(langkah|steps?)\b/i.test(lower)) {
    domainEntities.push('langkah');
    if (!domainUmbrellas.includes('workout') && !domainUmbrellas.includes('health')) {
      domainUmbrellas.push('workout');
    }
  }

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
  const modelName = process.env.AI_MODEL_NAME || 'claude-haiku-5.5';

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
2. "specific_tags": 3 to 5 domain-aware tags (lowercase-with-hyphens).
3. "source": detected platform source string or null.

PRIMARY INTENT CATEGORIES (Classify strictly by user's CORE SEMANTIC INTENT, regardless of casual or unformatted writing style):
- todo: Segala catatan yang hakikatnya berupa aksi, tugas, pekerjaan, perintah, instruksi teknis/pembangunan (dev tasks), pesanan, follow-up, atau daftar belanja yang harus ditindaklanjuti. Berlaku untuk gaya penulisan APAPUN (kalimat santai, instruksi teknis, bullet list, catatan ringkas tanpa bullet, e.g. "bikin tombol share di detail notes unlazynotes", "unlazynotes: - latest notes up to 50 notes", "tambahin opsi pin untuk note penting", "pesen martabak", "chat rizky tanya proposal", "perpanjang sim a...").
- finance: Segala catatan transaksi riil arus kas dompet user di dunia nyata (pengeluaran, pemasukan, utang-piutang, pembayaran, tagihan) yang memuat nominal harga/uang (e.g. "cimin 20k", "ubed minjem 100k", "subscription cursor 20 usd").
  PENTING: Jika angka/harga muncul dalam konteks dokumen spesifikasi fitur, rencana tier harga SaaS (misal: "# SaaS Spec \n # free ... # pro $1/month"), jumlah langkah/olahraga ("10k langkah"), atau perbandingan spek barang, HAKIKATNYA adalah draft, todo, atau others, BUKAN finance!
- schedule: Segala kegiatan yang terikat pada titik waktu pelaksanaan (jam spesifik, tanggal kalender, hari, waktu ibadah/kultural seperti sholat/maghrib/kajian e.g. "ba'da maghrib ada kajian", maupun periode relatif seperti nanti sore, besok malam, minggu depan e.g. "nanti sorean mau jogging").
- credential: Brankas penyimpanan nilai rahasia aktual (password akun, PIN kartu/ATM, nomor rekening bank, token/API key, private key).
  PENTING: Penyebutan nama fitur (seperti "pin note", "tambahin opsi pin untuk note penting", "fitur password") atau tugas mengganti/memperpanjang tanpa mencantumkan nilai rahasia BUKAN credential (masuk ke todo)!
- draft: Dokumen terstruktur, spesifikasi fitur produk, rancangan arsitektur, esai, tulisan panjang (>200 karakter).
- reference: Rujukan statis, kutipan, ayat suci (Quran, hadits, doa), resep masakan, kode pemrograman referensi. SCRIPTURES & QUOTES ARE NEVER TODO!
- bookmark: Tautan URL/link yang ingin disimpan atau dibaca (baik URL murni maupun dengan teks pengantar).
- random-yap: Curahan hati, uneg-uneg, keluhan, renungan santai, shower thoughts tanpa aksi (e.g. "kadang mikir kenapa orang rela macet-macetan tiap hari demi kerja...").
- others: Log terstruktur non-aksi spesifik: gejala kesehatan & obat, catatan repetisi gym/workout ("leg day 4 set squat 60kg", "10k langkah keliling komplek"), ide bisnis/fitur mentah.

CORE TAGGING PRINCIPLES:
0. Concrete Domain Entity Rule (Strict Anti-Meta):
   - Tags MUST strictly be concrete real-world topics, brands, subjects, or entities. NEVER output meta-structural or temporal descriptors as tags (e.g. NEVER output date-reference, date-referenced, time-info, note, task-item).
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
   - DILARANG Tag Meeting Salah Sasaran: Tag 'meeting' HANYA boleh diberikan untuk pertemuan kerja/bisnis eksplisit (meeting, rapat, sync, call, discuss, sprint). Jadwal pribadi/medis/kesehatan (seperti dokter, klinik, gigi, kontrol obat), pendidikan (tuweb), atau hiburan (nonton, bioskop) DILARANG KERAS diberi tag 'meeting'!
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
8. Schedule Multi-Domain (Diverse Real-World Categories):
   - "kontrol dokter gigi tgl 25 jam 10 pagi" -> {"category": "schedule", "specific_tags": ["dokter-gigi", "health"]}
   - "nonton avatar di cgv sabtu malam jam 21.15 seat f12" -> {"category": "schedule", "specific_tags": ["avatar", "cgv", "entertainment"]}
   - "tuweeb 2, tanggal 16" -> {"category": "schedule", "specific_tags": ["tuweeb", "kuliah"]}
   - "meeting evaluasi sprint tim shirobit jam 14.00" -> {"category": "schedule", "specific_tags": ["sprint", "shirobit", "meeting"]}
   - "demo produk client selasa jam 10 pagi" -> {"category": "schedule", "specific_tags": ["demo", "meeting", "client"]}
   - "coffee break with client discuss Q4 roadmap jam 4 sore" -> {"category": "schedule", "specific_tags": ["q4-roadmap", "meeting", "client"]}
   - "meeting desain jam 3 sore" -> {"category": "schedule", "specific_tags": ["desain", "meeting"]}
   - "ba'da maghrib ada kajian" -> {"category": "schedule", "specific_tags": ["kajian", "maghrib"]}
   - "nanti sorean mau jogging" -> {"category": "schedule", "specific_tags": ["jogging", "schedule"]}
9. Debt & Multi-Entity Business Income (Finance):
   - "ubed minjem 100k" -> {"category": "finance", "specific_tags": ["ubed", "piutang"]}
   - "aku minjem 50k ke fajar" -> {"category": "finance", "specific_tags": ["fajar", "utang"]}
   - "dapet transferan dp website klien 2.5jt pt karya maju" -> {"category": "finance", "specific_tags": ["pt-karya-maju", "website", "client", "income"]}
10. Communication & Tasks (Todo):
   - "chat rizky tanya proposal" -> {"category": "todo", "specific_tags": ["rizky", "proposal"]}
   - "bikin tombol share di detail notes unlazynotes" -> {"category": "todo", "specific_tags": ["unlazynotes", "fitur", "tech"]}
   - "unlazynotes: - latest notes up to 50 notes" -> {"category": "todo", "specific_tags": ["unlazynotes", "notes", "tech"]}
   - "tambahin opsi pin untuk note penting" -> {"category": "todo", "specific_tags": ["pin", "fitur", "todo"]}
11. Bookmarks:
   - "https://medium.com/p/123 bacaan devops bagus" -> {"category": "bookmark", "specific_tags": ["medium", "devops"]}
   - "https://youtu.be/xyz referensi animasi web" -> {"category": "bookmark", "specific_tags": ["youtube", "animasi", "referensi"]}
12. Health, Workout & Ideas (Others):
   - "migrain minum paracetamol" -> {"category": "others", "specific_tags": ["health", "migrain", "paracetamol"]}
   - "leg day 4 set squat 60kg" -> {"category": "others", "specific_tags": ["workout", "gym", "squat"]}
   - "10k langkah keliling komplek" -> {"category": "others", "specific_tags": ["langkah", "workout", "health"]}
   - "ide konten tiktok soal app fatigue" -> {"category": "others", "specific_tags": ["idea", "tiktok", "app-fatigue"]}
   - "ide fitur: voice note transcription" -> {"category": "others", "specific_tags": ["idea", "fitur", "voice-note"]}
13. SaaS Specs & Architectural Pricing Tiers (DRAFT, NEVER Finance):
   - "# SaaS Architecture & Pricing\n# free\n# pro $1/month" -> {"category": "draft", "specific_tags": ["saas", "pricing", "draft"]}

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
