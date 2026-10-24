import { recordAiUsage } from '@/lib/ai-usage';
import { generateText } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { format } from 'date-fns';
import { VALID_SOURCES, CATEGORIES, type Source } from '../../constants';
import { sanitizeTags, normalizeTag, BANNED_TAGS } from '../sanitizer';
import { type NoteTagResult } from '../types';
import { routeNoteIntent } from '../router';
import { parseScheduleDates, parseScheduleMetadata } from './schedule';
import { heuristicExtractFinance } from './finance';
import type { NoteCategory, ScheduleMetadata, ExpenseEntry, IncomeEntry, DebtEntry, BookmarkType, CredentialType } from '@/db/schema';

export function normalizeBookmarkType(raw: any): BookmarkType {
  const val = String(raw || '').toLowerCase().trim();
  if (['tech_dev', 'tech', 'dev', 'programming', 'code', 'github', 'coding'].includes(val)) return 'tech_dev';
  if (['media_social', 'media', 'social', 'video', 'youtube', 'sosmed', 'music', 'audio'].includes(val)) return 'media_social';
  if (['work_docs', 'work', 'docs', 'doc', 'document', 'drive', 'figma', 'notion'].includes(val)) return 'work_docs';
  if (['places', 'place', 'location', 'maps', 'map', 'lokasi', 'wisata'].includes(val)) return 'places';
  if (['shopping', 'shop', 'ecommerce', 'marketplace', 'wishlist', 'product', 'tokopedia', 'shopee'].includes(val)) return 'shopping';
  return 'reading_other';
}

export function normalizeCredentialType(raw: any): CredentialType {
  const val = String(raw || '').toLowerCase().trim();
  if (['account', 'akun', 'login', 'user', 'password'].includes(val)) return 'account';
  if (['network', 'jaringan', 'wifi', 'router', 'iot'].includes(val)) return 'network';
  if (['identity_finance', 'identity', 'finance', 'identitas', 'finansial', 'bank', 'ktp', 'sim', 'rekening'].includes(val)) return 'identity_finance';
  if (['license', 'lisensi', 'token', 'key', 'api', 'voucher'].includes(val)) return 'license';
  return 'other';
}

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
/**
 * Normalizes raw category string from LLM into one of the 9 strict NoteCategory enum values.
 * Strictly uses canonical synonym mapping with Pure-LLM Authority (Zero regex keyword overrides).
 */
export function normalizeCategory(rawCat: string | undefined, _content?: string): NoteCategory {
  if (!rawCat) return 'others';
  const c = rawCat.toLowerCase().trim();

  // Mapping sinonim LLM ke 9 kategori baku
  if (['todo', 'task', 'tasks', 'action', 'actions', 'checklist', 'backlog', 'chores', 'job'].includes(c)) {
    return 'todo';
  }
  if (['finance', 'expense', 'expenses', 'spending', 'income', 'money', 'bill', 'bills', 'payment', 'transaksi', 'loan', 'debt'].includes(c)) {
    return 'finance';
  }
  if (['schedule', 'event', 'events', 'appointment', 'calendar', 'meeting', 'jadwal'].includes(c)) {
    return 'schedule';
  }
  if (['random-yap', 'thought', 'thoughts', 'curhat', 'rant', 'rants', 'yap', 'shower-thought', 'uneg-uneg', 'opini', 'symptom', 'symptoms', 'feeling', 'mood', 'reflection', 'health-log'].includes(c)) {
    return 'random-yap';
  }
  if (['bookmark', 'link', 'url', 'web', 'site'].includes(c)) {
    return 'bookmark';
  }
  if (['credential', 'password', 'passwords', 'secret', 'secrets', 'auth', 'token', 'token-key', 'wifi'].includes(c)) {
    return 'credential';
  }
  if (['draft', 'writing', 'article', 'doc', 'docs', 'spec', 'specification', 'document'].includes(c)) {
    return 'draft';
  }
  if (['reference', 'recipe', 'quote', 'quotes', 'snippet', 'documentation', 'scripture'].includes(c)) {
    return 'reference';
  }
  if (['others', 'other', 'idea', 'ideas', 'konsep', 'log', 'fitness', 'workout'].includes(c)) {
    return 'others';
  }
  if (CATEGORIES.includes(c as NoteCategory)) {
    return c as NoteCategory;
  }

  return 'others';
}

/**
 * Lightweight tag normalizer for offline fallback compatibility.
 * In the AI flow, tags are generated directly by the LLM following prompt rules.
 */
export function enrichDualLayerTags(
  tags: string[],
  _category: NoteCategory,
  _content: string,
  _rawLlmCat?: string
): string[] {
  return [...tags]
    .map((t) => normalizeTag(t))
    .filter((t) => t && !BANNED_TAGS.has(t))
    .slice(0, 5);
}

/**
 * Specialized General AI Module.
 * Uses robust text generation with JSON extraction to prevent parser errors
 * caused by markdown code fences (```json ... ```) from models like DeepSeek.
 */
export async function processGeneralNote(
  content: string,
  heuristicFallback: (text: string) => NoteTagResult,
  existingUserTags?: string[],
  noteCreatedAt?: Date | string
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

    const refDate = noteCreatedAt ? new Date(noteCreatedAt) : new Date();
    const formattedRefDate = format(refDate, 'yyyy-MM-dd (EEEE)');

    const userTagContext =
      existingUserTags && existingUserTags.length > 0
        ? `\nUSER EXISTING TAG MEMORY (Prioritize reusing these tags over inventing new synonyms):\n${JSON.stringify(existingUserTags.slice(0, 60))}\n`
        : '';

    const result = await generateText({
      model: openaiCompatible(modelName),
      temperature: 0,
      system: `You are an intelligent semantic classifier and tagging engine for UnlazyNotes.
Analyze the user's note and return a strict JSON object with:
1. "category": exactly 1 primary intent category out of 9: "bookmark" | "schedule" | "finance" | "credential" | "todo" | "draft" | "reference" | "random-yap" | "others".
2. "specific_tags": 2 to 4 domain-aware tags (lowercase-with-hyphens, free from domain boundaries).
3. "source": detected platform source string or null (e.g. "maps", "youtube", "drive", "github", "figma", "spotify", "tokopedia", etc.).
4. "bookmark_type": macro sub-type string ONLY if category is "bookmark". Must be exactly one of: "tech_dev" | "media_social" | "work_docs" | "places" | "shopping" | "reading_other".
5. "credential_type": macro sub-type string ONLY if category is "credential". Must be exactly one of: "account" | "network" | "identity_finance" | "license" | "other".
6. "schedule": structured object {"dates": ["YYYY-MM-DD"], "isRecurring": boolean, "recurrenceRule"?: {"frequency": "daily"|"weekly"|"monthly"|"custom_interval", "intervalDays"?: number, "daysOfWeek"?: number[], "dayOfMonth"?: number, "timeString"?: "HH:mm"}} (only for schedule category, relative to anchor time: ${formattedRefDate}).
7. "schedule_dates": array of ISO "YYYY-MM-DD" dates (only for schedule category, relative to anchor time: ${formattedRefDate}).
8. "expenses": array of {"item": string, "amount": number, "currency": "IDR"|"USD"|string} (only for finance category).
9. "income": array of {"source": string, "amount": number, "currency": "IDR"|"USD"|string} (only for finance category).
10. "debt": array of {"type": "payable"|"receivable", "person": string, "amount": number, "notes"?: string} (only for finance category).

PRIMARY INTENT CATEGORIES (Strictly 9 Sacred Pillars from unlazynotes_habit_ai_spec.md, classify strictly by user's CORE SEMANTIC INTENT):
1. "bookmark": Pointer eksternal & tautan digital (Web, Maps/lokasi, Wishlist Tokopedia/Shopee, Docs Drive/Figma/Notion, Media YouTube/X, Deep-links Spotify/Zoom). Subjek inti catatan adalah URL/link. Output "source" dan "bookmark_type".
2. "schedule": Dimensi waktu / time-anchor di kalender hidup pengguna: jam spesifik ("Meeting evaluasi jam 14.00"), hari relatif ("Gym sabtu, konsul dokter gigi senin"), rentang hari ("Cuti tahunan 10-15 Nov", "Bedrest 3 hari ke depan"), tiket perjalanan ("Flight GA-421 jumat 08.20 gate 4"), kadaluwarsa/masa berlaku ("SIM motor habis 14 Nov 2026", "Masa aktif s/d 30 Okt"), jadwal ibadah/kultural ("Jumatan 11.45", "Kajian rutin ba'da isya"), dan rutinitas berulang/habitual ("Badminton tiap selasa malam", "Ganti filter aquarium tiap 3 hari", "Gajian tiap tanggal 25", "Daily standup senin-jumat jam 9"). Output structured "schedule" & "schedule_dates".
3. "finance": Nilai ekonomi & arus keuangan: pengeluaran belanja/makan/bensin/token ("cimin 20k", "kopi 22k", "jajan cilok 5rebu"), pemasukan gaji/freelance ("cair fee 3.5jt dari pak budi"), utang payable ("Pinjem uang Doni 200rb buat servis motor"), piutang/talangan receivable ("Talangin makan siang Rendy 45k nanti diganti"), split bill patungan ("Futsal semalam 180k patungan bertiga @60k"), rencana budget ("Budget liburan max 3jt"), log aset/investasi ("Beli emas Antam 1gr 1.450.000"). Nominal angka harus dikonversi ke integer (20k->20000, 3.5jt->3500000, 5rb->5000). Output structured "expenses", "income", "debt".
4. "credential": Kunci akses otentikasi & identitas pengenal resmi: akun login & sandi, Wi-Fi SSID & password, nomor identitas resmi (NIK KTP, KK, NPWP, BPJS, paspor), nomor rekening bank & Virtual Account ("BCA 827192837 a/n Rikushiro"), serial number lisensi software, kode voucher kuota internet, PIN gembok koper/digital. Teks disimpan polos tanpa masking paksa. Output "credential_type".
5. "todo": Kehendak aksi / actionable task yang harus diselesaikan di dunia nyata: instruksi kerja & follow-up ("chat mas Eko tanya kontrak", "kirim invoice ke pak Budi"), daftar belanjaan groceries/errands ("beli: telur 1kg, kopi tubruk, odol, sabun"), daftar bawaan mudik/packing list ("charger laptop, obat tetes mata, jaket"), pesanan delivery ("pesen martabak manis gojek"), riset/komparasi ("cari info kuliah s2 itb", "bandingin harga macbook m3 vs m4"), birokrasi ("perpanjang sim a ke polres bawa fotokopi ktp"), dan wish-action ("nonton film Interstellar kalau senggang").
6. "draft": Materi komunikasi / outgoing content yang sedang disusun untuk audiens eksternal / pihak luar: draf pesan formal/negosiasi, draf izin sakit/cuti ke atasan, caption media sosial, draf email penawaran/lamaran, respon komplain / template CS, notulensi mentah rapat tim sebelum dibagikan.
7. "reference": Fakta objektif / data statis untuk dicek sewaktu-waktu (lookup knowledge): data personal & ukuran (ukuran kemeja L slim fit, nomor sepatu 42, minus kacamata), alamat pengiriman lengkap, nomor resi pelacakan paket ("JNE JP9283719283"), nomor polis asuransi / golongan darah / rekam medis ("Polis Prudential no 09182319 a.n Riku"), riwayat servis kendaraan ("servis ganti oli km 12.500 bengkel AHASS"), spesifikasi teknis barang (tipe baterai CR2032, kode warna #F4F4F4, nomor plat motor), resep masakan ("resep sambal bawang: cabai 15, bawang 5"), DOSIS OBAT RESMI / FORMAL ("Dosis amoxicillin 3x1 sesudah makan"), snippet kode/config bash docker, dan ayat suci / hadits / quotes (QS Asy-Syarh, hadits nabi). SCRIPTURES & QUOTES ARE ALWAYS REFERENCE!
8. "random-yap": Refleksi subjektif / expressive dump dunia internal (pikiran, emosi, tubuh, refleksi) tanpa beban aksi dan tanpa audiens luar:
   - LOG GEJALA KESEHATAN TUBUH & SENSASI FISIK SUBJEKTIF ("Asam lambung agak perih siang ini gara-gara telat sarapan terus langsung ngopi", "Pinggang pegal kebanyakan duduk di depan laptop", "Lagi migrain minum paracetamol biar mendingan").
   - LOG MOOD & REFLEKSI PERSONAL ("Lagi ngerasa burnout banget sama rutinitas koding", "Seneng banget kerjaan kelar tepat waktu").
   - CATATAN MIMPI PAGI HARI ("Mimpi aneh ketemu dinosaurus di stasiun").
   - EVALUASI & REVIEW SUBJEKTIF BEBAS ("Review resto X di mall baru kuahnya keasinan rating 6/10", review film/buku/musik bebas) TANPA transaksi uang riil dan TANPA tugas aksi.
   - IDE LIAR SEKILAS (shower thoughts / celetukan acak).
9. "others": Penampung netral yang aman (fail-safe): forward obrolan panjang WA/Telegram campur aduk, kode OTP / token verifikasi acak SMS, teks sangat ambigu 1-2 kata tanpa fokus tunggal, dan catatan repetisi olahraga/workout tanpa tanggal ("leg day 4 set squat 60kg", "10k langkah keliling komplek").

BOOKMARK SUB-TYPE RULES (Mandatory for category "bookmark"):
- "tech_dev": Koding, pemrograman, repository kode (GitHub, GitLab), package registry (npm, pypi, crates), terminal/cli, cloud infra, dokumentasi teknis library/framework.
- "media_social": Video (YouTube, TikTok), sosial media (X/Twitter, Instagram, Threads, Reddit, Facebook), musik & audio streaming (Spotify, SoundCloud).
- "work_docs": Desain UI & dokumen kerja kolaboratif (Figma, Notion, Google Docs, Sheets, Slides, Drive, Miro, Confluence, Trello). WAJIB: Seluruh link Figma, Notion, Drive, dan dokumen kerja adalah "work_docs", BUKAN "tech_dev"!
- "places": Lokasi fisik, Google Maps, koordinat GPS, resto/cafe, petunjuk arah jalan, rute wisata.
- "shopping": Marketplace, e-commerce (Tokopedia, Shopee, Amazon, Blibli), wishlist tautan belanja produk/barang.
- "reading_other": Artikel blog, esai, berita, atau bacaan umum lainnya (Fallback mutlak jika tidak masuk 5 tipe di atas).

CREDENTIAL SUB-TYPE RULES (Mandatory for category "credential"):
- "account": Akun user login, username, email, kata sandi / password web atau aplikasi.
- "network": Akses jaringan & perangkat fisik: Wi-Fi SSID & password, router, hotspot, PIN gembok / smart lock pintu.
- "identity_finance": Nomor rekening bank apa pun (BCA, Mandiri, BRI, dll), Virtual Account (VA), nomor identitas kependudukan resmi (NIK KTP, SIM, paspor, NPWP, BPJS, KK).
- "license": Seluruh API token, API key (Stripe, OpenAI, AWS, dll), secret key developer, token bot, SSH keys, serial key software, voucher kuota/diskon. WAJIB: Token dan API Key adalah "license", BUKAN "account"!
- "other": Kredensial campuran atau catatan rahasia lainnya (Fallback mutlak jika tidak masuk 4 tipe di atas).

DISAMBIGUATION HEURISTICS (Hukum Batas Ambivalensi Wajib):
- Tautan / URL adalah subjek utama -> bookmark.
- Transaksi nominal uang adalah subjek utama -> finance.
- Ada kehendak aksi / tindakan nyata -> todo.
- Terikat titik waktu pelaksanaan / kalender -> schedule.
- Kunci akses / sandi / nomor rekening / identitas resmi aktual -> credential.
- Draf pesan untuk audiens eksternal -> draft.
- Fakta objektif / data lookup / ukuran / resep / ayat suci / dosis obat formal -> reference.
- Refleksi internal, sensasi tubuh / gejala kesehatan subjektif, curhat, review bebas -> random-yap.
- Forward panjang campur aduk / OTP / fragmen ambigu -> others.

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
5. Credentials (Strict Priority over Todo when containing credentials, output credential_type):
   - "login dashboard admin pake email admin@shirobit.com passwordnya RahasiaBanget#2026!" -> {"category": "credential", "specific_tags": ["admin", "dashboard", "login"], "credential_type": "account"}
   - "wifi kantor ssid: Shirobit-Guest password: KopiEnakBanget2026" -> {"category": "credential", "specific_tags": ["wifi", "kantor"], "credential_type": "network"}
   - "nomor rekening bca riku 1234567890" -> {"category": "credential", "specific_tags": ["bca", "rekening"], "credential_type": "identity_finance"}
   - "nik ktp riku 3201234567890123" -> {"category": "credential", "specific_tags": ["ktp", "nik"], "credential_type": "identity_finance"}
   - "secret api key stripe sk_live_98237192837192837192" -> {"category": "credential", "specific_tags": ["stripe", "api-key"], "credential_type": "license"}
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
11. Bookmarks (Extract dominant platform, URL path entities like repo/user, key topics, and bookmark_type):
   - "https://medium.com/p/123 bacaan devops bagus" -> {"category": "bookmark", "specific_tags": ["medium", "devops"], "bookmark_type": "reading_other"}
   - "https://youtu.be/xyz referensi animasi web" -> {"category": "bookmark", "specific_tags": ["youtube", "animasi", "referensi"], "bookmark_type": "media_social"}
   - "https://github.com/shadcn-ui/ui tutorial komponen" -> {"category": "bookmark", "specific_tags": ["github", "shadcn", "ui"], "source": "github", "bookmark_type": "tech_dev"}
   - "https://www.figma.com/design/xyz123 desain dashboard" -> {"category": "bookmark", "specific_tags": ["figma", "desain", "dashboard"], "bookmark_type": "work_docs"}
   - "https://maps.google.com/?q=cafe-senja tempat ngopi" -> {"category": "bookmark", "specific_tags": ["cafe-senja", "maps"], "bookmark_type": "places"}
   - "https://tokopedia.com/product/mouse-wireless" -> {"category": "bookmark", "specific_tags": ["tokopedia", "mouse"], "bookmark_type": "shopping"}
12. Health Symptoms & Bodily Sensations (RANDOM-YAP, Pilar 8):
   - "migrain minum paracetamol" -> {"category": "random-yap", "specific_tags": ["health", "migrain", "paracetamol"]}
   - "Asam lambung agak perih siang ini gara-gara telat sarapan terus langsung ngopi" -> {"category": "random-yap", "specific_tags": ["health", "asam-lambung", "refluks"]}
   - "pinggang pegal kebanyakan duduk di depan laptop" -> {"category": "random-yap", "specific_tags": ["health", "pegal"]}
   - "Lagi ngerasa burnout banget sama rutinitas koding" -> {"category": "random-yap", "specific_tags": ["burnout", "mental-health", "koding"]}
13. Formal Medical Dosage & Static Knowledge (REFERENCE, Pilar 7):
   - "Dosis amoxicillin 3x1 sesudah makan" -> {"category": "reference", "specific_tags": ["health", "amoxicillin", "dosis"]}
   - "Polis Prudential no 09182319 a.n Riku" -> {"category": "reference", "specific_tags": ["asuransi", "prudential"]}
   - "Ukuran kemeja: L slim fit, sepatu: 42" -> {"category": "reference", "specific_tags": ["fashion", "sizing"]}
14. Workout Logs & Ambiguous Fragments (OTHERS, Pilar 9):
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
      prompt: `Classify and extract tags as JSON:
- "category": exactly 1 of "finance" | "todo" | "schedule" | "bookmark" | "credential" | "reference" | "draft" | "random-yap" | "others"
- "specific_tags": [2-4 concrete lowercase-with-hyphens tags]
- "source": platform name or null
- "bookmark_type": (ONLY if category is bookmark) exactly 1 of:
    * "tech_dev" (coding, repo, github, gitlab, npm, dev tools, programming docs)
    * "media_social" (youtube, tiktok, twitter, instagram, spotify, music, video)
    * "work_docs" (figma, notion, google docs/drive/sheets, miro, design files, work specs)
    * "places" (google maps, cafe, resto, location, route)
    * "shopping" (tokopedia, shopee, amazon, wishlist, store)
    * "reading_other" (articles, news, general reading)
- "credential_type": (ONLY if category is credential) exactly 1 of:
    * "account" (login username/password, email credentials)
    * "network" (wifi SSID/password, router, IoT/smart lock pin)
    * "identity_finance" (bank account / no rek, virtual account, KTP, SIM, paspor, BPJS, KK)
    * "license" (API keys, developer tokens, secret keys, software licenses, serial numbers, vouchers)
    * "other" (other secret credentials)
- "schedule": {"dates": ["YYYY-MM-DD"], "isRecurring": boolean, "recurrenceRule"?: {...}} (if schedule)
- "schedule_dates": ["YYYY-MM-DD"] (if schedule)
- "expenses": [{"item": string, "amount": number, "currency": string}] (if finance)
- "income": [{"source": string, "amount": number, "currency": string}] (if finance)
- "debt": [{"type": "payable"|"receivable", "person": string, "amount": number, "notes"?: string}] (if finance)

Note text:
"""${content}"""`,
    });

    await recordAiUsage({
      feature: 'tagging',
      model: modelName,
      usage: result.usage,
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

    const cleanTags = sanitizeTags(rawTags, category, content, 5, existingUserTags);

    let cleanSource: Source | null = null;
    if (parsed.source) {
      const s = String(parsed.source).toLowerCase().trim();
      cleanSource = s as Source;
    }

    let scheduleMetadata: ScheduleMetadata | undefined = undefined;
    let scheduleDates: string[] | undefined = undefined;
    if (category === 'schedule') {
      if (parsed.schedule && typeof parsed.schedule === 'object') {
        const rawDates = Array.isArray(parsed.schedule.dates)
          ? parsed.schedule.dates
          : Array.isArray(parsed.schedule_dates)
          ? parsed.schedule_dates
          : [];
        const validDates = rawDates.map(String).filter((d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d));
        if (validDates.length > 0 || parsed.schedule.isRecurring) {
          scheduleMetadata = {
            dates: validDates,
            isRecurring: Boolean(parsed.schedule.isRecurring),
            recurrenceRule: parsed.schedule.recurrenceRule,
          };
          scheduleDates = validDates;
        } else {
          const heuristicMeta = parseScheduleMetadata(content, refDate);
          scheduleMetadata = heuristicMeta;
          scheduleDates = heuristicMeta.dates;
        }
      } else if (Array.isArray(parsed.schedule_dates) && parsed.schedule_dates.length > 0) {
        const validDates = parsed.schedule_dates
          .map(String)
          .filter((d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d));
        scheduleMetadata = {
          dates: validDates,
          isRecurring: false,
        };
        scheduleDates = validDates;
      } else {
        const heuristicMeta = parseScheduleMetadata(content, refDate);
        scheduleMetadata = heuristicMeta;
        scheduleDates = heuristicMeta.dates;
      }
    }

    let expenses: ExpenseEntry[] | undefined = undefined;
    let income: IncomeEntry[] | undefined = undefined;
    let debt: DebtEntry[] | undefined = undefined;
    if (category === 'finance') {
      const heuristicFin = heuristicExtractFinance(content);
      if (Array.isArray(parsed.expenses) && parsed.expenses.length > 0) {
        expenses = parsed.expenses.map((e: any) => ({
          item: String(e.item || 'Pengeluaran').trim(),
          amount: Number(e.amount) || 0,
          currency: e.currency || 'IDR',
        }));
      } else {
        expenses = heuristicFin.expenses;
      }

      if (Array.isArray(parsed.income) && parsed.income.length > 0) {
        income = parsed.income.map((i: any) => ({
          source: String(i.source || 'Pemasukan').trim(),
          amount: Number(i.amount) || 0,
          currency: i.currency || 'IDR',
        }));
      } else {
        income = heuristicFin.income;
      }

      if (Array.isArray(parsed.debt) && parsed.debt.length > 0) {
        debt = parsed.debt.map((d: any) => ({
          type: d.type === 'payable' ? 'payable' : 'receivable',
          person: String(d.person || 'Seseorang').trim(),
          amount: Number(d.amount) || 0,
          notes: d.notes ? String(d.notes) : undefined,
          isSettled: Boolean(d.isSettled || false),
        }));
      } else {
        debt = heuristicFin.debt;
      }
    }

    let bookmarkType: BookmarkType | undefined = undefined;
    let credentialType: CredentialType | undefined = undefined;

    if (category === 'bookmark') {
      bookmarkType = normalizeBookmarkType(parsed.bookmark_type || parsed.bookmarkType);
    }
    if (category === 'credential') {
      credentialType = normalizeCredentialType(parsed.credential_type || parsed.credentialType);
    }

    return {
      category,
      specific_tags: cleanTags,
      source: cleanSource,
      schedule: scheduleMetadata,
      schedule_dates: scheduleDates,
      expenses,
      income,
      debt,
      bookmark_type: bookmarkType,
      credential_type: credentialType,
      bookmarkType,
      credentialType,
    };
  } catch (err) {
    console.warn('[AI] Error in processGeneralNote LLM, using heuristic fallback:', err);
    return heuristicFallback(content);
  }
}
