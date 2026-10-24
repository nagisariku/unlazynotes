# UnlazyNotes – Context Handover & Engineering State 🚀

Dokumen ini berfungsi sebagai memori persisten lintas sesi (*session handover*) agar pengembangan dapat langsung dilanjutkan tanpa kehilangan konteks teknis maupun *roadmap*.

---

## 1. Status Lingkungan & Layanan Saat Ini (Sandbox VPS)

- **Repositori Git**: `/home/rikushiro/projects/unlazynotes`
- **Branch Kolaborasi**: `gamma/dev` (Dedicated branch untuk Agent Gamma, branch `main` diproteksi ketat)
- **Layanan Aktif (Systemd)**:
  - `unlazynotes.service`: Server Astro 5 SSR (Port `4321` / `localhost:4321`)
  - `unlazynotes-bot.service`: Polling daemon Telegram `@unlazynotes_bot` (Long Polling)
- **Database**: PostgreSQL 16 lokal port `5432` (`unlazynotes_dev`) via Drizzle ORM
  - Ekstensi aktif: `pg_trgm` (Trigram similarity & fuzzy matching)
  - Index aktif: `notes_content_trgm_idx` (`GIN (content gin_trgm_ops)`)
- **AI Gateway**: Cosmoshub API (`deepseek-v4.1-flash`) – *Profil & Prompt Archive lengkap di [`DEEPSEEK_FLASH_AI_PROFILE.md`](./DEEPSEEK_FLASH_AI_PROFILE.md) & [`CLAUDE_HAIKU_AI_PROFILE.md`](./CLAUDE_HAIKU_AI_PROFILE.md)*
- **Payment & Auth**: DOKU Hosted Checkout Simulator & Better Auth (Google OAuth & Dev Session)
- **Validasi Test Suite**:
  - `scripts/test-batch-organizer.ts`: 100% PASS (Local formatting, privacy shield, smart caching, batch organize & summary)
  - `scripts/test-intent-classifier.ts`: 38/38 Live AI & 38/38 Heuristic (100% PASS - 9 Sacred Pillars)
  - `scripts/test-web-sync-alignment.ts`: 31/31 assertions lolos (100% PASS)
  - `scripts/test-phase4-polishes.ts`: 33/33 tests lolos (100% PASS)
  - `scripts/test-enhancements.ts`: 145/145 assertions lolos (100% PASS)
  - `scripts/test-ask-temporal.ts`: 100% PASS (Dynamic Scope Broad & Targeted, Anchor Time Math, Claude Haiku 5.5 inference)
  - `scripts/test-telegram-i18n.ts`: 33/33 tests lolos (100% PASS)
  - `scripts/test-telegram-alignment.ts`: 33/33 assertions lolos (100% PASS - Dock, Help, Tags, Review, Format)
  - `scripts/test-tier-quota.ts`: 19/19 skenario lolos (100% PASS)
  - `npm run typecheck` & `npm run check`: 0 error (100% Type-Safe)

---

## 2. Fitur & Arsitektur yang Telah Selesai Diimplementasikan

### A. 4-Layer Modular Tagging Engine & Bilingual Taxonomy
1. **Deterministic Intent Router (`src/lib/ai/router.ts`)**:
   - Memotong latensi & biaya token dengan mengklasifikasikan catatan tanpa memanggil LLM jika pola sudah jelas.
   - Prioritas *Action Intent* (todo/study) sebelum URL.
   - Penjagaan *False-Positive* nominal angka (kodepos/tahun/nomor HP tidak salah masuk ke finance).
2. **Specialized Domain Modules (`src/lib/ai/modules/`)**:
   - `finance.ts`: Pengeluaran/pemasukan dengan tag kanonikal berorientasi subjek/entitas (tanpa redundansi tag `expenses`/`income`/`bill`).
   - `bookmark.ts`: Dukungan multi-link tanpa pemecahan (*no splitting*). Ekstraksi platform (`github`, `youtube`, `twitter`, `instagram`, `tiktok`, `netflix`, `facebook`, `spotify`, `linkedin`, `reddit`) dan pembacaan teks caption pendamping secara kontekstual.
   - `todo.ts`: Kluster aksi (`study`, `exam`, `work`, `dev`, `health`).
   - `credential.ts`: Kluster keamanan (`wifi`, `server`, `account`, `database`, `api`, `bank`).
   - `general.ts`: Intelligent Tagging Engine dengan **Intent Priority**:
     - `todo`: Rencana, daftar belanja, agenda multi-baris tanpa nominal/harga (misal `belanja bulanan tokma\nhiling dieng\npilates`).
     - `finance`: Transaksi riil dengan nominal/harga atau niat bayar (`bayar wifi 300k`, `tfr 50rb nasgor`).
     - Ekstraksi 1–3 specific keyword tags yang merepresentasikan subjek, tempat/toko, merk, atau aktivitas (`tokma`, `dieng`, `pilates`).
3. **Bilingual Canonical Taxonomy (`src/lib/ai/taxonomy/`)**:
   - Kamus terstandarisasi dwibahasa (ID & EN) dengan indeks in-memory $O(1)$ alias mapping (misal: `seblak`, `ciken`, `lunch` $\rightarrow$ `food`).
4. **Specific Entity Sanitizer (`src/lib/ai/sanitizer.ts`)**:
   - Menghapus pemaksaan tag `expenses`/`bill`/`income` pada kategori `finance` agar tag diisi oleh subjek/entitas nyata.
   - Memasukkan `expenses`, `income`, `bill` ke `BANNED_TAGS` agar specific tags tidak redundan dengan kategori `finance`.
   - Menjaga entitas unik, nama toko, tempat, atau aktivitas (lowercase-with-hyphens, max 20 karakter).

### B. Telegram Bot UX & Interaksi Bersih (*Zero Friction*)
1. **Silent Note Capture ([`src/lib/telegram-handler.ts`](file:///home/rikushiro/projects/unlazynotes/src/lib/telegram-handler.ts))**:
   - Balasan konfirmasi `Saved "..." • tags: ...` telah dinonaktifkan agar chat history Telegram user tetap rapi tanpa spam.
   - Catatan langsung tersimpan di latar belakang. Respons teks hanya dikirim jika ada *error*, peringatan kuota harian, status langganan kedaluwarsa, atau perintah eksplisit (`/tags`, `/search`, `/ask`).
2. **Unsupported Media Guard**:
   - Jika user mengirim foto, gambar, dokumen/file, video, pesan suara (*voice note*), audio, stiker, atau animasi, bot merespons otomatis:
     > `UnlazyNotes belum mendukung format catatan ini, file/gambar anda tetap tersimpan aman disini.`

### C. Flexible & Fuzzy Search Engine ([`src/lib/search.ts`](file:///home/rikushiro/projects/unlazynotes/src/lib/search.ts))
Mengatasi kekakuan `ILIKE` eksak biasa melalui **3-Tier Matching**:
1. **Punctuation & Delimiter Stripping (`regexp_replace`)**: Menghilangkan tanda baca/spasi sehingga pencarian `almuhajirin` otomatis cocok dengan teks `Al-Muhajirin`.
2. **PostgreSQL Trigram Similarity (`pg_trgm`)**: Menggunakan `word_similarity(query, notes.content) >= 0.35` untuk mentoleransi saltik (*typo*), misal `almuhajrin` atau `rekrusif`.
3. **Smart Relevance Ordering**: Hasil pencarian diurutkan dari kecocokan eksak $\rightarrow$ kecocokan bersih tanpa delimiter $\rightarrow$ skor similarity trigram $\rightarrow$ tanggal terbaru.

### D. Mobile Responsive UI Overhaul
Memastikan navigasi dan pembacaan catatan di layar ponsel berjalan mulus:
1. **Adaptive Top Bar & Slide-over Drawer ([`Sidebar.tsx`](file:///home/rikushiro/projects/unlazynotes/src/components/dashboard/Sidebar.tsx))**: Header khusus mobile dengan tombol hamburger drawer dan backdrop blur.
2. **Thumb-Friendly Bottom Navigation**: Menu aksi cepat (Notes, Bookmarks, Settings) di bagian bawah layar ponsel dengan padding safe-area iOS (`.safe-area-bottom`).
3. **Responsive Grid & Viewports**: Layout flex responsif (`flex-col md:flex-row`), pencegahan clipping pada API key box, serta scrolling terisolasi pada dialog modal.

### E. Database Enum Casting Resilience
Menghindari error PostgreSQL `22P02 (invalid input value for enum note_category)` saat pengguna memfilter tag kustom yang bukan 9 kategori utama (misal `/tags expenses` atau `/tags twitter`):
- Seluruh perbandingan dinamis di [`src/lib/telegram-handler.ts`](file:///home/rikushiro/projects/unlazynotes/src/lib/telegram-handler.ts) dan [`src/pages/api/notes/index.ts`](file:///home/rikushiro/projects/unlazynotes/src/pages/api/notes/index.ts) menggunakan `notes.category::text = ${targetTag}` sehingga PostgreSQL memperlakukan parameter sebagai string aman.

### F. Tanya Jawab AI (`/ask`) Universal Domain-Agnostic, Multilingual, & Temporal Awareness Engine ([`src/lib/ask.ts`](file:///home/rikushiro/projects/unlazynotes/src/lib/ask.ts))
Menghindari *anti-pattern* hardcoding aturan per domain spesifik (F&B, Game, Kuliah, dll.) melalui 7 Prinsip Kognitif Universal yang berlaku untuk semua domain, bahasa (English, ID, bahasa daerah), waktu relatif, dan mata uang:
1. **Kesadaran Waktu Dinamis (*Temporal Awareness*)**:
   - Injeksi waktu saat query dieksekusi ke System Prompt secara dinamis (`Current Time: Jumat, 16 Oktober 2026, 14:05 WIB`).
   - Setiap catatan diformat dengan metadata waktu yang ramah dibaca manusia (`[Jum, 16 Okt 2026, 13:30] [category • specific_tags] content`).
   - LLM melakukan komputasi waktu relatif eksak terhadap *Current Time* untuk pertanyaan seperti "hari ini", "kemarin", "lusa", "2 hari lalu", "minggu ini".
   - Jika rentang waktu yang ditanyakan tidak memiliki data, AI menyatakan ketiadaan data secara lugas dan menyebutkan catatan relevan di waktu lain sebagai konteks bantuan.
2. **Keselarasan Bahasa (*Language Mirroring*)**: AI membalas 100% menggunakan bahasa yang sama persis dengan pertanyaan pengguna (Inggris dijawab Inggris, Indonesia dijawab Indonesia, Jawa/Sunda disesuaikan secara natural).
3. **Penataan Konteks RAG**: Memindahkan konteks catatan dari `system` prompt ke `user` turn agar LLM tidak memicu safety guardrail atau halusinasi pemisahan tag per baris.
4. **Pemahaman Semantik Inklusif**: Mengutamakan makna kontekstual di dunia nyata dibanding pencocokan kata harfiah (*literal string matching*), sehingga kategori otomatis mencakup turunan atau jenisnya (misal: popcorn $\rightarrow$ konsumsi/makanan, tuweb/karil $\rightarrow$ tugas kuliah, topup valo $\rightarrow$ game).
5. **Pembedahan Catatan Campuran (*Multi-Item Dissection*)**: Membedah catatan multi-item secara independen per baris untuk memilah item relevan vs tidak relevan tanpa membuang seluruh isi catatan.
6. **Integritas Metadata Tingkat Catatan**: Menghilangkan halusinasi bahwa tag adalah filter rigid per-kata; tag diperlakukan sebagai konteks payung tingkat catatan.
7. **Mata Uang Campuran & Slang Multibahasa**: Memahami singkatan kasual internasional dan lokal (`k`, `rb`, `ewu`, `rebu`, `goceng`, `cepek`), serta memisahkan perhitungan mata uang yang berbeda (`$ USD` vs `Rp IDR`) tanpa mencampurnya sembarangan.

### G. Dashboard Interactive UX: Quick Web Composer & Clickable Tags
1. **Quick Web Note Composer ([`NotesTimeline.tsx`](file:///home/rikushiro/projects/unlazynotes/src/components/dashboard/NotesTimeline.tsx) & [`POST /api/notes`](file:///home/rikushiro/projects/unlazynotes/src/pages/api/notes/index.ts))**:
   - Input composer box di atas feed catatan dengan shortcut keyboard (`Enter` untuk simpan, `Shift + Enter` untuk baris baru).
   - Optimistic UI: Catatan langsung dimunculkan di paling atas feed secara instan dengan tag `merapikan...`, lalu di-update begitu AI tagging selesai.
   - Endpoint `POST /api/notes` memvalidasi kuota harian Standard/Pro, memanggil AI tagging (`generateNoteTags`), dan menyimpan catatan ke PostgreSQL dengan `source: 'web'`.
2. **Clickable Specific Tags**:
   - Tag pills `#tag` pada [`NoteCard.tsx`](file:///home/rikushiro/projects/unlazynotes/src/components/dashboard/NoteCard.tsx) interaktif. Mengklik tag langsung memicu filtering feed ke tag tersebut via callback ke `NotesTimeline`.
3. **Modal Dialog Note & Tag Editor ([`EditNoteModal.tsx`](file:///home/rikushiro/projects/unlazynotes/src/components/dashboard/EditNoteModal.tsx) & [`PATCH /api/notes/[id]`](file:///home/rikushiro/projects/unlazynotes/src/pages/api/notes/%5Bid%5D.ts))**:
    - Ikon pensil di toolbar NoteCard membuka dialog modal bertema zinc dark.
    - Pengguna dapat mengedit konten teks catatan, mengubah kategori dari 9 pilihan resmi, serta menambah/menghapus specific tags secara dinamis.
    - Endpoint `PATCH /api/notes/[id]` memvalidasi hak milik user, membersihkan tag, menyimpan perubahan ke database, dan mengembalikan data terbaru ke UI secara instan.

### H. Zero-Friction Telegram Onboarding (1-Click Connect)
- **Deep Link Onboarding**: Dukungan parameter payload Telegram `/start <apiKey>` pada [`src/lib/telegram-handler.ts`](file:///home/rikushiro/projects/unlazynotes/src/lib/telegram-handler.ts).
- Pengguna yang mengklik tombol *[📱 Hubungkan ke Telegram]* di Web Settings (`/dashboard/settings.astro`) atau banner onboarding langsung terhubung secara otomatis ke akun mereka tanpa perlu mengetik manual `/login <api_key>`.

### I. Universal Data Export (Data Portability)
- **Endpoint Multi-Format ([`GET /api/notes/export`](file:///home/rikushiro/projects/unlazynotes/src/pages/api/notes/export.ts))**:
  - `?format=json`: Mengekspor seluruh database catatan milik pengguna dalam format JSON terstruktur lengkap beserta metadata, timestamp, kategori, dan tag.
  - `?format=markdown`: Mengekspor catatan ke berkas Markdown (`.md`) yang siap diimpor ke Obsidian, Notion, Logseq, atau arsip lokal.
  - Dukungan filter export terisolasi hanya untuk catatan milik pengguna aktif, serta modul download instan di Web Settings dan modal dashboard.

### J. Flexible Partial Matching & Smart Multi-Token Search
1. **Telegram Private Vault Substring Matching**:
   - Perintah `/vault <query>` di [`src/lib/telegram-handler.ts`](file:///home/rikushiro/projects/unlazynotes/src/lib/telegram-handler.ts) menggunakan `ilike(notes.vaultKey, %${cleanQuery}%)` sehingga mencari `bca` otomatis menemukan `bank_bca`, `bca_card`, dsb.
2. **Dashboard Smart Multi-Token Search**:
   - Filter pencarian client-side di [`NotesTimeline.tsx`](file:///home/rikushiro/projects/unlazynotes/src/components/dashboard/NotesTimeline.tsx) memecah query menjadi token kata terpisah (`query.split(/\s+/)`). Catatan dianggap cocok jika setiap token ditemukan di salah satu dari: isi teks, kategori, specific tags, atau kunci vault.

### K. High-Conversion Landing Page & Interactive Showcase
- Perombakan total landing page di [`src/pages/index.astro`](file:///home/rikushiro/projects/unlazynotes/src/pages/index.astro) dan [`src/components/landing/LandingPage.tsx`](file:///home/rikushiro/projects/unlazynotes/src/components/landing/LandingPage.tsx):
  - Hero section dengan copywriting high-conversion ("Berhenti Biarkan Ide & Catatanmu Jadi 'Kuburan' di Saved Messages").
  - Dual CTA: *[📱 Mulai Gratis di Telegram]* & *[🖥 Buka Web Dashboard]*.
  - Visual perbandingan interaktif *Before vs After*: Menampilkan transformasi chat mentah Telegram menjadi kartu terkurasi rapi di UnlazyNotes.
  - Komponen FAQ Accordion interaktif bertema zinc dark.

### L. Smart Message Debouncing (Buffer 3 Detik Multi-Bubble)
- Mengatasi kebiasaan pengguna mengirim teks panjang/curhat yang terpecah menjadi 2–3 bubble chat berturut-turut.
- Menggunakan in-memory buffer timer 3.0 detik berbasis `chat_id` di [`src/lib/telegram-handler.ts`](file:///home/rikushiro/projects/unlazynotes/src/lib/telegram-handler.ts).
- Pesan-pesan berturut-turut digabungkan menjadi SATU catatan utuh (`\n\n`) sebelum disimpan ke database dan diproses AI tagging, menghemat kuota LLM dan mencegah fragmentasi catatan.
- Perintah bot (`/start`, `/tags`, `/search`, dll.) otomatis mem-bypass debounce dan langsung melakukan pre-flush.
- Ditambahkan graceful shutdown `flushAllDebounceBuffers()` pada `SIGINT`/`SIGTERM` di [`scripts/bot-polling.ts`](file:///home/rikushiro/projects/unlazynotes/scripts/bot-polling.ts).

### M. Inline Keyboard Pagination & Snippet Truncation (`/tags` & `/search`)
- Mencegah fenomena *wall of text* saat query menghasilkan banyak catatan di chat Telegram:
  - Batas 5 catatan per halaman (`PAGE_SIZE = 5`).
  - Baris pertama dijadikan judul tebal `📌 *Judul*`, teks konten dipotong maksimal 120 karakter diikuti ellipsis `...`, disertai tanggal dan badge tags.
  - Navigasi Inline Keyboard interaktif: `[ ◀️ Prev ] [ Hal X / Y ] [ Next ▶️ ]` dengan callback payload `page:tags:<tag>:<page>` dan `page:search:<query>:<page>`.
  - Penanganan `callback_query` menggunakan `editTelegramMessage` (in-place update) dan `answerTelegramCallbackQuery` untuk performa mulus tanpa spam pesan baru.

### N. Horizontal Compact Output for `/tags`
- Format output `/tags` (tanpa argumen) diubah dari bullet vertikal panjang menjadi teks horizontal menyamping yang dipisahkan koma:
  - `📂 *Kategori Utama:*` (daftar kategori yang dimiliki user).
  - `🏷 *Specific Tags:*` (daftar tag spesifik diawali `#`, misal `#s2-ugm, #macbook-m, #ubed, #food`).
  - Dilengkapi tips navigasi ringkas di bagian bawah footer.

### O. Universal Dual-Layer Tagging Engine ([Specific Entity] + [Broad Concept])
- **System Prompt**: Mengarahkan LLM untuk selalu memadukan `[Entitas Spesifik]` + `[Domain/Konsep Payung]` (misal: `"rendang 50k" -> ["rendang", "food"]`, `"tequila 120rb" -> ["tequila", "drink"]`, `"bensin 20k" -> ["bensin", "transport"]`, `"tiket bioskop 50k" -> ["bioskop", "entertainment"]`, `"langganan vps 100k" -> ["vps", "tech"]`, `"panadol 10k" -> ["panadol", "health"]`, `"kemeja putih uniqlo" -> ["uniqlo", "fashion"]`, `"hiling dieng" -> ["dieng", "travel"]`).
- **Normalisasi Kategori**: Fungsi `normalizeCategory()` memetakan sinonim (`food`, `expense`, `spending` $\rightarrow$ `finance`), serta menjamin setiap catatan berharga/bernominal selalu masuk kategori `finance`.
- **Enricher Domain**: Fungsi `enrichDualLayerTags()` menjamin entitas spesifik tetap berpasangan dengan domain payungnya (`food`, `drink`, `transport`, `health`, `internet`, `tech`, `entertainment`, `fashion`, `travel`, `gaming`).
- **Sanitizer & Taksonomi**:
  - Menambahkan kanonikal baru `drink`, `tech`, dan `entertainment` pada [`src/lib/ai/taxonomy/finance.ts`](file:///home/rikushiro/projects/unlazynotes/src/lib/ai/taxonomy/finance.ts).
  - Memasukkan kata sampah generik non-entitas (`price`, `prices`, `cost`, `fee`, `expense`, `purchase`, `payment`, `phrase`, `word`, `subscription`, `unclear`, `ambiguous`) ke `BANNED_TAGS`.
  - Melindungi entitas lokal dan konsep payung agar tidak ter-replace atau di-collapse secara prematur.

### P. NoteCard UI Cleanup (Telegram Indicator)
- Menghapus badge teks `"TELEGRAM"` yang sebelumnya bersanding membingungkan dengan badge Kategori di toolbar kanan atas pada [`NoteCard.tsx`](file:///home/rikushiro/projects/unlazynotes/src/components/dashboard/NoteCard.tsx).
- Menggantikannya dengan icon pesawat kertas Telegram (`Send`) kecil berwarna sky di samping waktu catatan (`createdAt`), sehingga toolbar kanan atas hanya fokus menampilkan badge Kategori utama yang bersih.

### Q. Tier Plan & Quota Management Engine
1. **Tier & Pricing Specification**:
   - **Free Tier**: Maksimal 30 catatan per bulan kalender, reset otomatis tiap tanggal 1 awal bulan berdasarkan zona waktu Asia/Jakarta (WIB). Fitur: basic AI tagging & Web Dashboard view.
   - **Pro Tier**: UNLIMITED Notes tanpa batas kuota.
     - Harga resmi: IDR Rp 15.000/bulan atau Rp 150.000/tahun; USD $1/bulan atau $10/tahun.
     - Fitur Eksklusif Pro: Private Encrypted Vault (`/secure` & `/vault` AES-256-GCM), AI Otak Kedua (`/ask` Temporal RAG), Prioritas Fast-Lane AI Tagging.
2. **Database & Schema User Model**:
   - Atribut tabel `users`: `tier` ('free' | 'pro', default 'free'), `monthly_notes_count` (integer, default 0), `current_billing_period` (varchar 'YYYY-MM', misal '2026-10'), `pro_expires_at` (timestamp with timezone, nullable).
3. **Lazy Monthly Calendar Reset & Expiry Downgrade ([`src/lib/quota-service.ts`](file:///home/rikushiro/projects/unlazynotes/src/lib/quota-service.ts))**:
   - Setiap ada request pembuatan catatan baru (Telegram bot atau Web API), sistem memeriksa apakah bulan berjalan berbeda dengan `current_billing_period`. Jika berganti bulan, `monthly_notes_count` direset ke 0 dan `current_billing_period` diperbarui ke bulan baru.
   - Jika akun Pro telah melewati tanggal `pro_expires_at`, sistem otomatis men-downgrade akun ke `free` dan menerapkan kuota Free 30 catatan/bulan.
4. **Non-Refundable Quota Integrity**:
   - Menghapus catatan tidak pernah mengurangi `monthly_notes_count` (kuota dihitung berdasarkan konsumsi komputasi pembuatan).
5. **Feature Gatekeeping & Paywall**:
   - Perintah Telegram `/secure` & `/vault`: Diblokir untuk akun Free, menampilkan preview manfaat enkripsi rahasia dan link CTA Upgrade Pro.
   - Perintah Telegram `/ask`: Diblokir untuk akun Free, menampilkan penjelasan AI otak kedua eksklusif Pro Tier.
   - Note Capture Paywall: Saat akun Free mencapai 30 catatan, bot membalas dengan pesan Paywall ramah dan menolak penyimpanan. Pada Web Composer (`POST /api/notes`), API merespons HTTP 403 `quotaExceeded: true`.
6. **Prioritas Fast-Lane Tagging Queue ([`src/lib/tagging-queue.ts`](file:///home/rikushiro/projects/unlazynotes/src/lib/tagging-queue.ts))**:
   - Sistem antrean prioritas berbasis memori memisahkan antrean `fastLane` (Pro Tier) dan `standardLane` (Free Tier). Catatan dari pengguna Pro selalu dieksekusi terlebih dahulu.
7. **Validasi Test Suite**:
   - `scripts/test-tier-quota.ts`: 19/19 skenario pengujian komprehensif lolos 100% PASS (lazy reset, 30-note paywall, non-refund on delete, pro unlimited, expired downgrade, gating /secure, /vault, /ask, dan priority queue).

### R. Sistem i18n Telegram Bot (Bilingual EN / ID)
1. **Kamus Terpusat ([`src/lib/i18n/telegram.ts`](file:///home/rikushiro/projects/unlazynotes/src/lib/i18n/telegram.ts))**:
   - Mendukung lokalisasi penuh untuk seluruh command dan feedback bot: `/help`, `/start`, `/login`, `/logout`, `/tags`, `/search`, `/ask`, `/secure`, `/vault`, notifikasi paywall kuota, warning password/kredensial, dan filter format yang belum didukung.
2. **Deteksi Bahasa Adaptif**:
   - Pengguna terdaftar: Menggunakan `user.preferredLocale` yang tersimpan di database.
   - Pengguna belum login: Otomatis mendeteksi bahasa pengirim via `message.from.language_code` (`id` $\rightarrow$ ID, lainnya $\rightarrow$ EN).
   - Sinkronisasi instan saat menghubungkan akun pertama kali.

### S. Dynamic Dual-Layer Taxonomy & Anti-Flood Tagging Engine
1. **Prinsip Taksonomi Universal (High-Level Root)**:
   - Tag payung (*Domain Umbrella*) selalu berupa kata dasar tingkat tertinggi dalam bahasa Inggris (`food`, `drink`, `tech`, `meeting`, `health`, `workout`, `subscription`, `shopping`, `quran`, `quote`, `random-yap`).
   - Dilarang membuat pecahan spesifik dari domain utama (`food-order` $\rightarrow$ `food`, `beverage` $\rightarrow$ `drink`).
2. **Memori Penggunaan Tag (Tag Reuse)**:
   - Injeksi 30 tag riwayat akun pengguna ke konteks LLM untuk mencegah fragmentasi sinonim.
3. **Disiplin Alokasi Tag (Maksimal 2 - 3 Tag per Catatan)**:
   - Tag 1 (WAJIB - Specific Entity): Entitas konkret (cilok, tahu-gejrot, martabak, cursor, q4-roadmap, demo, nasgor, cimin, uniqlo, biore, admin).
   - Tag 2 (WAJIB - Domain Umbrella): 1 kata dasar payung universal.
   - Tag 3 (OPSIONAL - Context/Brand/Person): Brand, pembayaran (`qris`, `cash`), atau nama orang (`gojek`, `bca`, `client`).
4. **Negative Constraints**:
   - Dilarang tag kata kerja aksi (`chat`, `beli`, `tanya`, `minum`, `bayar`, `kirim`, `cari`, `bandingin`) $\rightarrow$ dimasukkan ke `BANNED_TAGS`.
   - Dilarang tag nama mata uang atau pajak (`usd`, `idr`, `rp`, `dollar`, `tax`, `pajak`).
   - Dilarang tag terpotong (*no truncated words*).

### T. Penanganan 4 Edge Case Audit Klasifikasi Catatan
1. **Prioritas Kredensial Mengalahkan Todo**: Jika catatan memuat kredensial, password, PIN, atau token (misal: `"login dashboard admin... passwordnya RahasiaBanget#2026!"`), kategori WAJIB `credential`, BUKAN `todo`, meskipun ada kata kerja aksi seperti `login`.
2. **Kutipan Agama / Quote / Renungan Panjang $\rightarrow$ REFERENCE / DRAFT**: Teks kutipan ayat Al-Qur'an, hadits, doa, dan kutipan filosofis (misal Surah Asy-Syarh) DILARANG masuk `todo`. Masuk ke `reference` (kutipan/doa) atau `draft` (refleksi > 250 karakter).
3. **Multi-line Shopping List adalah TODO (Bukan Others)**: Daftar belanja berbaris tanpa harga WAJIB masuk `todo`. Dilarang memberikan tag halusinasi `food` pada pakaian atau sabun/odol.
4. **Pertahankan Entitas Makanan Utama**: Untuk catatan makanan/jajan pendek, nama makanan konkret selalu dipertahankan sebagai Tag 1 (`cimin 12k` $\rightarrow$ `["cimin", "food"]`, `jajan cilok 5rebu` $\rightarrow$ `["cilok", "food"]`, `martabak telur 45k via qris bca` $\rightarrow$ `["martabak", "food", "qris"]`).

### U. 4 Micro-Tuning Terakhir (Sanitizer & Classifier)
1. **Bug Sanitizer Trailing Hyphen (`/^-+|-+$/g`)**: Pembersihan strip di awal dan akhir tag pada `normalizeTag()` dan `sanitizeTags()` di [`src/lib/ai/sanitizer.ts`](file:///home/rikushiro/projects/unlazynotes/src/lib/ai/sanitizer.ts), mencegah tag berakhiran strip seperti `bab-`.
2. **Guard Kredensial KTP / SIM / Paspor**: Kata `ktp`, `sim`, `paspor` HANYA memicu kategori `credential` jika memuat digit identitas (`\b\d{4,}\b`). Aktivitas birokrasi seperti `"perpanjang sim a... bawa fotokopi ktp"` otomatis masuk `todo`.
3. **Catatan Curhat / Shower Thoughts $\rightarrow$ WAJIB `random-yap`**: Opini santai, uneg-uneg, dan renungan hidup tanpa aksi (misal: `"kadang mikir kenapa orang rela macet-macetan tiap hari demi kerja"`) WAJIB dikategorikan sebagai `random-yap`, BUKAN `others`.
4. **Tugas Riset / Perbandingan adalah TODO**: Catatan yang memuat kata kerja riset atau komparasi harga tanpa pembayaran nominal (misal: `"cari info biaya kuliah s2 itb"`, `"bandingin harga macbook m3 vs m4"`) WAJIB masuk `todo`.
5. **Verifikasi Test Suite**: `scripts/test-intent-classifier.ts` memverifikasi 31/31 skenario uji lolos 100% PASS pada Live AI Pipeline dan Deterministic Heuristic Fallback.

### V. Tagging Pipeline Refinements & Telegram `/tags` Clustered Overhaul
1. **Pemisahan Entitas Hiburan & Guard `#meeting` pada Schedule ([`src/lib/ai/modules/general.ts`](file:///home/rikushiro/projects/unlazynotes/src/lib/ai/modules/general.ts))**:
   - Jadwal hiburan/nonton bioskop (misal `"nonton avatar di cgv sabtu malam jam 21.15 seat f12"`) tetap berkategori `schedule`, namun tidak lagi disusupi tag `#meeting`.
   - Tag payung `entertainment` ditambahkan ke taksonomi kanonikal (`src/lib/ai/taxonomy/general.ts`), menghasilkan tag spesifik entitas (`avatar`, `cgv`) dan payung `entertainment`.
2. **Ekspansi Kapasitas Tag Spesifik (Max 5 Tags)**:
   - Meningkatkan hardcap pemotongan specific tags dari 3 menjadi 5 pada sanitizer ([`src/lib/ai/sanitizer.ts`](file:///home/rikushiro/projects/unlazynotes/src/lib/ai/sanitizer.ts)) dan modul domain (`general.ts`, `finance.ts`, `credential.ts`, `todo.ts`, `src/lib/ai.ts`).
   - Mencegah terpotongnya entitas penting seperti entitas perusahaan (`pt-karya-maju`) dan platform/objek (`website`) pada transaksi multi-entitas yang kaya informasi.
3. **Preservasi Nomor Kriptografi/Teknis & Whitelist Short Tags**:
   - Mencegah sanitizer memotong digit trailing pada istilah kripto/teknis (`ed25519`, `sha256`, `rsa4096`).
   - Melarang pemotongan tag yang menghasilkan singkatan tanpa makna (seperti `#ed`), memasukkan `ed` ke `BANNED_TAGS`.
   - Membatasi tag < 3 karakter kecuali yang terdaftar di whitelist resmi (`ai`, `db`, `ui`, `ux`, `qa`, `ip`, `os`, `id`, `ml`).
4. **Overhaul Perintah `/tags` Telegram (Tampilan Horizontal Minimalis, Tracking Pencarian & Quick-Access Grid 3x3)**:
   - **Tampilan Horizontal & Anti-Clutter**:
     - Format 3 baris horizontal ke samping dipisahkan koma (tanpa bullet point dan tanpa counter jumlah catatan dalam kurung):
       - `🔥 Teraktif: #tag1, #tag2, ... (maks 9)`: 9 tag dengan frekuensi kemunculan tertinggi di seluruh catatan aktif user.
       - `🕒 Terakhir: #tag1, #tag2, ... (maks 9)`: 9 tag unik pertama dari catatan user paling baru dibuat (`createdAt DESC`).
       - `🔍 Sering Dicari: #tag1, #tag2, ... (maks 9)`: 9 tag paling sering dicari user dari riwayat tabel `tag_searches`.
     - Baris yang belum memiliki data otomatis menampilkan tanda `-`.
   - **Tabel Tracking Pencarian (`tag_searches`)**:
     - Dibuat di [`src/db/schema.ts`](file:///home/rikushiro/projects/unlazynotes/src/db/schema.ts) dengan kolom `userId`, `tag`, `count`, `updatedAt`, serta unique index `(userId, tag)`.
     - Setiap kali pengguna mencari atau memfilter dengan `/tags <nama_tag>`, counter pencarian tag di-upsert otomatis.
   - **Inline Keyboard 9 Kategori Utama (Grid 3x3)**:
     - Baris 1: `[ 💰 Finance ] [ 📋 Todo ] [ 📅 Schedule ]`
     - Baris 2: `[ 🔖 Bookmark ] [ 🔐 Credential ] [ 📚 Reference ]`
     - Baris 3: `[ 📝 Draft ] [ 💬 Random-yap ] [ 🏷 Others ]`
     - Tombol mengarah ke callback `page:tags:<category>:1` yang menampilkan cuplikan catatan dan navigasi pagination `[ ◀️ Prev ] [ 1 / N ] [ Next ▶️ ]` serta tombol `[ 🏷 Kembali ke Tags ]`.
5. **Fitur Pin, Note Actions (Salin & Hapus), dan Perintah `/pin`**:
   - Kolom `isPinned: boolean('is_pinned').default(false).notNull()` di tabel `notes`.
   - List cuplikan catatan menampilkan ikon `📌⭐️` untuk catatan berstatus pin dan `📌` untuk catatan standar.
   - Perintah `/pin` menyajikan daftar catatan yang dipin secara kronologis terbaru.
   - Tampilan detail catatan menyajikan tombol aksi Inline Keyboard: `[ 📌 Pin / 📍 Unpin ]`, `[ 📋 Salin ]`, `[ 🗑 Hapus ]`, dan `[ ◀️ Kembali ]`.
6. **Penyederhanaan Hamburger Menu, Dock Menu 2+1 Tombol, & Reset Cache Mobile Keyboard**:
   - **Hamburger Menu Minimalis (`setMyCommands`)**: Disederhanakan menjadi HANYA perintah `/help` (`💡 Bantuan & panduan bot`) di [`scripts/bot-polling.ts`](file:///home/rikushiro/projects/unlazynotes/scripts/bot-polling.ts), menjaga fokus menu tetap bersih tanpa membingungkan pengguna.
   - **Dock Menu Ramah Gestur Mobile (`PERSISTENT_DOCK_KEYBOARD`)**:
     - Reply keyboard 2 baris kompak:
       ```
       [ 🏷 Tags ] [ ⭐️ Pin ]
       [ ❌ Tutup Menu ]
       ```
     - Properti `is_persistent: true` DIHAPUS agar tombol / gestur *Back* pada HP pengguna tidak tertahan (*fix mobile back lag*).
     - Tombol `❌ Tutup Menu` serta command `/close` dan `/hide` mengirimkan payload `remove_keyboard: true` secara eksplisit ke Telegram API untuk membersihkan *cache lock* keyboard pada aplikasi klien Telegram mobile.
   - **Sinkronisasi 10 Perintah Lengkap di `/help` (Dwibahasa ID/EN)**:
     - Seluruh perintah resmi terdokumentasi rapi: `/start`, `/help`, `/login`, `/logout`, `/tags`, `/tags <nama_tag>`, `/pin`, `/search`, `/ask`, `/secure`, `/vault`.
     - Menghapus teks `{securityDisclaimer}` dan menyematkan tautan langsung ke Web Dashboard: `🌐 Web Dashboard: {dashboardUrl}`.

### W. Clean-Consolidation & Refactoring 4-Layer Pipeline AI
Penyempurnaan arsitektur kecerdasan AI berbasis *First-Principles* tanpa *hardcoding* per domain:
1. **Layer 1: Pre-Classifier Regex Natural (`src/lib/ai/modules/general.ts` & `router.ts`)**:
   - Menambahkan deteksi pola penanggalan kalender (`/\b(tanggal|tgl)\s+\d{1,2}\b/i` dan `/\b\d{1,2}\s+(jan|feb|mar|apr|mei|jun|jul|agu|sep|okt|nov|des|...)\b/i`).
   - Catatan seperti `"tuweeb 2, tanggal 16"` otomatis terklasifikasi sebagai `schedule` (bukan `todo`).
2. **Layer 2: System Prompt & Few-Shot Multi-Domain Schedule (`src/lib/ai/modules/general.ts`)**:
   - Mengeliminasi bias `#meeting` pada jadwal non-rapat:
     * Medis: `"kontrol dokter gigi tgl 25 jam 10 pagi"` $\rightarrow$ `["dokter-gigi", "health"]`
     * Bioskop: `"nonton avatar di cgv sabtu malam jam 21.15 seat f12"` $\rightarrow$ `["avatar", "cgv", "entertainment"]`
     * Pendidikan/Kuliah: `"tuweeb 2, tanggal 16"` $\rightarrow$ `["tuweeb", "kuliah"]`
     * Bisnis/Kerja: `"meeting evaluasi sprint tim shirobit jam 14.00"` $\rightarrow$ `["sprint", "shirobit", "meeting"]`
   - Aturan jumlah tag: 3 hingga 5 domain-aware tags.
   - Larangan tegas meta-tag: Menolak tag deskriptor struktural (seperti `date-reference`, `time-info`, `note`, `item`).
3. **Layer 3: Deterministic Post-Processing & Sanitizer Guard (`general.ts`, `sanitizer.ts`, `taxonomy/general.ts`)**:
   - Memutus penyuntikan `#meeting` pada jadwal umum. Tag `#meeting` HANYA aktif jika teks memuat kata kunci eksplisit pertemuan bisnis/kerja (`meeting`, `rapat`, `sync`, `call`, `discuss`, `sprint`, `demo`, `coffee break`), dan secara mutlak diblokir pada jadwal kesehatan (`dokter`, `gigi`, `klinik`, `kontrol`), pendidikan (`tuweb`), atau hiburan (`nonton`, `cgv`).
   - Mencabut alias `appointment` dari canonical `meeting` pada taksonomi kanonikal agar janji dokter tidak terpetakan ke `meeting`.
   - Dynamic meta-tag stripping pada `sanitizeTags()`: membersihkan akhiran `-descriptor`, `-reference[ds]?`, `-marker`, `-meta`, `-info`, atau `-item`.
4. **Layer 4: Temporal Reasoning Engine `/ask` (`src/lib/ask.ts`)**:
   - Query DB mencakup hingga 90 hari terakhir (`subDays(now, 90)` limit 100), dengan evaluasi tugas aktif/jadwal dibatasi 30 hari terakhir.
   - Pemisahan mutlak jadwal masa lampau vs hari ini berdasarkan perbandingan matematis terhadap `Current Time`.
   - Negative Constraint: Dilarang mengarang teks (*"Lanjutkan tugas..."*, *"Prioritas hari ini..."*) untuk memaksakan jadwal lampau ke daftar hari ini.

### X. AI Output Mobile Polish `/ask` (Ergonomi Telegram Mobile)
Mengatasi layout rusak di layar HP pengguna akibat tabel Markdown dan heading besar:
1. **Dilarang Keras Menggunakan Tabel Markdown**:
   - Model dilarang memuntahkan tabel Markdown (`| Kolom | Kolom |` atau `|---|---|`).
   - Ditambahkan parser deterministik `cleanMarkdownTablesAndHeaders()` di `postProcessAskResponse()` yang otomatis mengonversi tabel Markdown yang terlanjur terbentuk menjadi *Timeline Bullet List* (`•`).
2. **Dilarang Menggunakan Heading Markdown Besar**:
   - Menghilangkan tanda pagar (`#`, `##`, `###`), diganti teks tebal bertanda bintang (`*Judul:*`) dengan emoji.
3. **Struktur Pengelompokan Mutlak (Strict 3 Sections, Zero Duplicates)**:
   - `*📌 Jadwal & Tugas Terdekat (Mendatang):*` (Urut murni kronologis ke depan: `• Hari, DD MMM (Jam) - Agenda`)
   - `*⚠️ Sudah Lewat (Overdue):*` (Eksklusif hanya untuk agenda dengan tanggal target < Current Time: `• Agenda (DD MMM) - keterangan selisih lampau`)
   - `*📝 To-Do Tanpa Tenggat (Backlog):*` (Eksklusif untuk tugas aksi tanpa tanggal/jam di teksnya)
4. **Pemisahan Tegas Backlog vs Overdue**:
   - Tanggal pembuatan catatan `[createdAt]` dilarang dijadikan tenggat/deadline. Catatan tanpa tanggal target di teksnya 100% wajib masuk Backlog, bukan Overdue.
5. **Dual-Anchor Prompting**:
   - Menyuntikkan `Waktu Saat Ini (Current Time): ${nowFormatted}` di `systemPrompt` dan diulang di akhir `userPrompt` sehingga LLM tidak pernah salah mengira tanggal catatan masa depan (seperti 21 & 24 Okt) sebagai hari ini.
6. **Zero Intro & Zero Outro**:
   - Dilarang kata pengantar (*"Berikut tugas..."*) dan catatan ambigu di tengah/bawah (*"Catatan: ..."*).
   - Menghapus basa-basi penutup atau pertanyaan robotik di akhir pesan.

### Y. Dynamic Scope, Auto-Chunking Safeguard, & Universal Axioms
1. **Dynamic Scope (Broad vs. Targeted Query)**:
   - **Broad Overview**: Menyajikan 3 zona (*📌 Mendatang*, *⚠️ Sudah Lewat*, *📝 Backlog*), dibatasi maksimal 5–7 item per zona dengan ringkasan sisa `(+ N agenda lainnya, cek menu '/notes')`.
   - **Targeted Query**: Menjawab HANYA entitas/topik yang ditanyakan secara terfokus tanpa menumpahkan agenda dari domain lain yang tidak berkaitan, serta menjelaskan perubahan jadwal (*reschedule*).
2. **Auto-Chunking Safeguard Telegram (`src/lib/telegram.ts`)**:
   - Fungsi `chunkText(text, limit = 4000)` memecah pesan panjang $\le 4000$ karakter secara aman pada batas baris baru (`\n`).
   - Mencegah error `400 Bad Request: message is too long` pada Telegram API dan menyematkan `reply_markup` secara eksklusif pada *chunk* terakhir.
3. **Anchor Time Math ($T_0$) & Anti-Hedging Jadwal**:
   - Titik Nol ($T_0$): `[createdAt]` sebagai jangkar mutlak waktu relatif.
   - Jam Tanpa Hari: Target waktu otomatis jatuh pada tanggal pembuatan catatan ($T_0$).
   - Anti-Hedging: Dilarang menuliskan disclaimer ragu-ragu seperti `"(tanpa tanggal jelas)"` jika catatan memiliki timestamp dan jam.
4. **Isolasi Semantik Domain & Pewarisan Konteks (*Context Inheritance*)**:
   - Catatan multi-baris dan bertag saling berbagi konteks domain. Seluruh baris di dalamnya mewarisi domain dari konteks/tag tersebut sehingga istilah umum (*proposal*, *revisi*, *meeting*) tidak tertukar ke domain lain (misal: tugas kantor tidak tertukar ke tugas kuliah).
5. **Migrasi Model AI ke `claude-haiku-5.5`**:
   - Konfigurasi gateway Cosmoshub dimigrasikan dari `deepseek-v4.1-flash` ke `claude-haiku-5.5`.
   - Inferensi menghasilkan penalaran temporal yang lebih presisi, perhitungan jam lampau yang akurat, dan zero halusinasi.

### Z. Status Verifikasi Test Suite & Standar Branch Kolaborasi
- `scripts/test-phase4-polishes.ts`: 33/33 skenario lolos (100% PASS)
- `scripts/test-enhancements.ts`: 145/145 assertions passed (100% PASS)
- `scripts/test-ask-temporal.ts`: 100% PASS (Broad overview, Targeted laser query, Anchor Time Math, Claude Haiku 5.5)
- `scripts/test-intent-classifier.ts`: 38/38 skenario Live AI & Heuristic passed (100% PASS)
- `scripts/test-telegram-i18n.ts`: 33/33 tests passed (100% PASS)
- `scripts/test-tier-quota.ts`: 19/19 skenario passed (100% PASS)
- `npm run typecheck` & `npm run check`: 0 error (100% Type-Safe)
- **Branching Rule**: Seluruh pengembangan Agent Gamma diisolasi pada branch `gamma/dev`. Branch `main` diproteksi ketat dan DILARANG di-push langsung.

### AA. Phase 4.1 UX & System Polishes (Telegram Bot & AI Guardrails)
1. **Dock Menu Minimalis (1-Row Safe Navigation)**:
   - Disederhanakan menjadi 1 baris murni: `[ 🏷 Tags ] [ ⭐️ Pin ]`.
   - Tombol `❌ Tutup Menu` dihapus sepenuhnya agar tampilan keyboard pengguna tetap bersih.
2. **Kategori Dinamis `/tags` & Pembaruan Emoji**:
   - **Filter Catatan Aktif (Lightweight $O(N)$ in-memory)**: Tombol kategori yang ditampilkan HANYA yang memiliki $\ge 1$ catatan milik user. Jika kategori belum memiliki catatan (0 catatan), tombol tidak ditampilkan.
   - **Pembaruan Emoji Tombol**:
     * Finance: menggunakan `💰 Finance` (kembali ke icon klasik).
     * Bookmark: menggunakan `📎 Bookmark`.
     * Others: menggunakan `Others` (murni tanpa emoji).
   - **Pembersihan Logika "Sering Dicari"**:
     * Kategori "Sering Dicari" beserta logic tracking-nya dihapus dari `/tags`. Konten `/tags` kini ringkas dan fokus hanya pada `🔥 Teraktif` dan `🕒 Terakhir`.
     * Ditambahkan blok `💡 Perintah Cepat:` (`/pin`, `/vault`, `/search`, `/ask`) tepat sebelum instruksi nomor tag.
3. **Invalid Command Guard**:
   - Pesan yang diawali karakter `/` namun tidak cocok dengan perintah terdaftar mana pun otomatis membalas pesan singkat: `invalid command` dan tidak disimpan ke database sebagai catatan.
4. **Dokumentasi `/vault` (Tanpa Kunci) di `/help`**:
   - Menambahkan petunjuk penggunaan perintah `/vault` (tanpa parameter kunci) bagi pengguna yang ingin melihat seluruh daftar kredensial tersimpan saat lupa nama kuncinya.
5. **Perbaikan Bug Detail Catatan Panjang & Re-styling Tombol**:
   - **Root Cause & Fix Bug Catatan Panjang**: Telegram API membatasi parameter `copy_text` pada `CopyTextButton` maksimal **256 karakter**. Catatan panjang sebelumnya memicu error `400 Bad Request: BUTTON_COPY_TEXT_INVALID`. Sistem diperbaiki dengan auto-switch: jika catatan $\le 256$ karakter menggunakan native `copy_text`, jika $> 256$ karakter menggunakan callback `note:copy:<id>` yang mengirim teks catatan mentah ke chat untuk disalin langsung.
   - **Auto-Chunking Safeguard**: Detail teks $> 4000$ karakter otomatis dikirim menggunakan `sendTelegramMessage` chunking alih-alih `editMessageText` yang gagal pada batas 4096 karakter Telegram.
   - **Re-styling Tombol Detail**:
     * Pin: menggunakan ikon bintang `⭐ Pin`.
     * Lepas Pin: murni teks `Lepas Pin` tanpa icon atau emoji apa pun.
     * Salin: tombol `Salin` tanpa emoji.
     * Hapus: tombol `Hapus` tanpa emoji.
   - **Format Konten Baru**:
     `📌` (diikuti break space / baris baru), `{isi notes...}`, (diikuti double break space lega `\n\n\n`), `{EEE, dd/MM/yyyy • HH:mm WIB}`, dan `Tags: {kategori, specific_tags}`.
6. **Optimasi `/ask`: Pembersihan Loading & Anti-Abuse AI Guardrails**:
   - **Pembersihan Pesan Loading**: Pesan `🤖 Sedang menganalisis catatan Anda...` dilacak dengan `message_id` dan otomatis dihapus (`deleteMessage`) setelah jawaban AI terkirim (atau saat terjadi kegagalan).
   - **Penanganan Error**: Jika pemrosesan AI gagal, bot menampilkan pesan error yang ramah pengguna.
   - **System Prompt Anti-Abuse**: AI diinstruksikan menolak dengan tegas dan sopan segala pertanyaan/perintah di luar konteks catatan pengguna (coding/pemrograman, penulisan esai, matematika umum, dll.).
   - **Identitas AI**: Jika pengguna menanyakan model AI yang digunakan, AI menjawab secara konsisten `"Model UnlazyNotesLLM-v1"` dan dilarang membocorkan rincian arsitektur atau vendor internal sistem.

### AB. First-Principles Semantic Intent Refactor & LLM-Driven Classification
1. **Claude Haiku 5.5 sebagai Single Source of Truth**:
   - Menghapus puluhan tumpukan regex kaku pada `normalizeCategory` di `src/lib/ai/modules/general.ts` yang selama ini menimpa hasil inferensi LLM.
   - `normalizeCategory` kini murni menegakkan absolute invariant (pure URL $\rightarrow$ `bookmark`, explicit task checklist `- [ ]` $\rightarrow$ `todo`), memetakan sinonim kata dari model ke 9 kategori resmi, dan mempercayai output LLM secara penuh.
2. **Penguatan Semantic Intent Boundaries di System Prompt**:
   - Menegaskan batas hakikat niat hidup catatan:
     * `todo`: Segala aksi, tugas, perintah, dev tasks, food orders, dan instruksi teknis dalam gaya penulisan bebas apa pun (santai, tanpa bullet, bullet list).
     * `finance`: Transaksi keuangan riil arus kas dompet user. Angka pada spesifikasi produk, tier SaaS (`# free ... # pro $1/month`), atau perbandingan spek barang diklasifikasikan sebagai `draft` / `todo` / `others`, BUKAN `finance`.
     * `schedule`: Terikat titik waktu pelaksanaan, mencakup jam, tanggal kalender, waktu kultural/ibadah (`ba'da maghrib ada kajian`), dan waktu relatif (`nanti sorean mau jogging`).
     * `credential`: Brankas nilai rahasia aktual. Penyebutan fitur UI (seperti `"tambah opsi pin untuk note penting"`) atau administrasi tanpa digit nilai rahasia masuk ke `todo`.
     * `draft`: Dokumen spesifikasi produk/arsitektur/SaaS multi-baris Markdown, esai, dan tulisan panjang.
     * `reference`: Rujukan statis, kutipan, ayat suci, hadits, doa, resep masakan.
     * `bookmark`: Tautan URL.
     * `random-yap`: Curahan hati, uneg-uneg, keluhan santai tanpa aksi.
     * `others`: Log terstruktur non-aksi (gejala kesehatan & obat, metrik fisik seperti `10k langkah keliling komplek`, repetisi gym, ide fitur mentah).
3. **Penyelarasan Security Tip Guardrail Telegram (`src/lib/telegram-handler.ts`)**:
   - Membasmi regex mandiri `hasCredentialKeyword` (`\bpin\b`) yang sebelumnya berjalan terpisah di luar AI.
   - Notifikasi `security_tip` dipasangkan pada callback `onComplete` dari `taggingQueue` dan HANYA dikirim jika kategori AI adalah `credential` DAN memuat indikator nilai rahasia aktual (assignment `password:`, `pin atm`, atau nomor identitas/rekening). Catatan berfitur UI `"pin note"` dipastikan tidak memicu spam security tip.
4. **Penyelarasan Router Offline / Heuristic Fallback (`src/lib/ai/router.ts`)**:
   - Multi-line Markdown dengan header (`#`, `##`) diarahkan ke `general` (me-resolve ke `draft`), bukan `finance`.
   - Perintah aksi teknis dan backlog item (`^[a-z0-9_-]+:\s*-\s+`) diarahkan ke `todo`.
   - Metrik fisik langkah kaki (`10k langkah`) diamankan dari pencocokan mata uang `10k`.
5. **Verifikasi Test Suite**:
   - 38/38 skenario (100% PASS) pada `scripts/test-intent-classifier.ts` baik untuk Live AI Pipeline maupun Heuristic Fallback.

### G. Deferred Batch Organization & Local Privacy Shield (Okt 2026)
Sistem penyimpanan cepat dan hening dengan perlindungan privasi lokal serta perapian cerdas on-demand:
1. **Database Schema & Backfill (`src/db/schema.ts`)**:
   - Menambahkan kolom status proses: `isProcessed: boolean('is_processed').default(false).notNull()`.
   - Index komposit efisiensi query: `index('notes_user_processed_idx').on(t.userId, t.isProcessed)`.
   - 702 catatan lama di database berhasil dimigrasi dan ditandai `is_processed = true`.
2. **Local Formatting Cleanup (Zero AI) (`src/lib/formatter.ts`)**:
   - Fungsi `cleanLocalFormat(content)`:
     - Normalisasi baris baru (`\r\n` dan `\r` $\rightarrow$ `\n`).
     - Pembersihan spasi akhir baris (`line.trimEnd()`).
     - Menghapus breakline antar baris list atau numbering berturut-turut (antar `- ` atau `1. ` tidak ada baris kosong).
     - Menghubungkan baris pengantar/header list yang berakhiran titik dua (`daftar x:`) langsung ke item list pertama tanpa baris kosong pemisah.
     - Menghindari jeda >1x breakline (maksimal 1 baris kosong antar paragraf / `\n\n`).
     - Standarisasi seluruh variasi simbol bullet (`•`, `·`, `∙`, `◦`, `●`, `○`, `■`, `▪`, `▫`, `*`, `+`, `–`, `—`) menjadi `- ` dengan mempertahankan indentasi.
     - **Aturan Mutlak**: Menjaga 100% keaslian huruf besar-kecil, ejaan kata, bahasa gaul, singkatan, angka, dan tanda baca pengguna.
3. **Local Credential Pre-Detection (Local Privacy Shield) (`src/lib/ai/credential-detector.ts`)**:
   - Deteksi nilai rahasia riil di mesin lokal menggunakan Complex Regex:
     - Password assignments (`password:`, `sandi =`, `passwordnya ...`).
     - PIN ATM / Kartu (`pin atm`, `pin: 1234`).
     - Nomor Rekening Bank (diikuti digit $\ge 6$).
     - API Key, Secret Token, Private Key (`ssh-ed25519`, `bearer token`).
     - CVV & Kartu Identitas bernomor (`ktp`, `nik`, `sim` dengan nomor $\ge 6$ digit).
   - **Zero-Knowledge Privacy Guard**: Catatan kredensial langsung ditandai `category = 'credential'`, `isProcessed = true`, dan diekstrak tag lokalnya tanpa pernah dikirim ke AI eksternal, disertai pengiriman `security_tip`.
4. **Silent Capture di Telegram Handler (`src/lib/telegram-handler.ts`)**:
   - Catatan baru diformat lokal, dicek kredensialnya, dan disimpan ke database:
     - Kredensial: `isProcessed: true, category: 'credential'`.
     - Catatan umum: `isProcessed: false, category: 'others'`.
   - Tetap hening tanpa spam teks "tersimpan!" ke chat.
   - Cache counter bertambah secara instan: `unorganized_count:{userId} += 1`.
5. **Tombol Dock Menu, Fitur Sync & Non-Parallel Lock Barrier (`src/lib/telegram-handler.ts`)**:
   - Dock menu persisten selalu menyediakan tombol `🔄 Sync` di samping `🏷 Tags` dan `⭐️ Pin`.
   - Perintah didukung via `/sync`, `🔄 Sync`, `/organize`, `/rapikan`, serta `/dock` dan `/menu` untuk me-refresh dock keyboard.
   - **Animasi Loading Dinamis**: Saat AI memproses catatan, bot memunculkan pesan loading dengan titik tiga dinamis (`🔄 Menyinkronkan.` $\rightarrow$ `..` $\rightarrow$ `...`) setiap 1.2 detik dan menghapusnya saat selesai.
   - **Non-Parallel Lock Barrier**: Selama sinkronisasi berlangsung (`syncInProgressSet` aktif pada `userId` dan `chatId`), bot menolak pesan baru, command, maupun tombol callback query dengan respons ramah menyuruh pengguna menunggu proses sinkronisasi hingga selesai.
   - **Proteksi Anti-Spam**: Concurrency lock dan jeda cooldown 5 detik (`syncCooldownMap`).
   - **Rekonsiliasi Cache vs DB**: Mengecek langsung ke database apakah ada catatan berstatus `is_processed = false`, menyinkronkan counter cache dan tag unik pengguna dengan isi DB riil.
   - **Alur Respons Bersih (Zero Ringkasan Cantik)**:
     - Jika ada catatan unorganized yang diproses AI: membalas *"Sinkronisasi selesai!"*.
     - Jika tidak ada catatan baru di DB: membalas *"Belum ada catatan baru!"*.
6. **Batch AI Organizer (`src/lib/ai/batch-organizer.ts`)**:
   - Chunking safeguard: Memproses per chunk (maksimal 10–12 catatan per panggilan LLM) untuk melindungi limit output token Claude Haiku 5.5.
   - Mengirimkan payload batch ke model dengan menyertakan konteks tag lama user (`userTagContext`) agar tag konsisten.
   - Hierarki Tag: `specific_tags[0]` adalah Main Tag (payung topik utama), `specific_tags[1..]` adalah entitas detail dan konteks.
   - Bulk update database: `isProcessed = true, category = ..., specificTags = ...`.
   - Otomatis menginvalidasi cache tag user dan mereset unorganized counter ke 0.
7. **Penyempurnaan Konten `/tags`**:
   - **Teraktif**: Diambil murni dari frekuensi kemunculan tag dengan jumlah catatan terbanyak di database.
   - **Terakhir**: Mengambil main tag (`specificTags[0]` atau fallback kategori) murni dari 15 catatan terakhir yang dikirim/dirapikan.
   - Tombol inline rapikan di `/tags` ditiadakan karena telah terpusat di tombol dock `🔄 Sync`.
8. **Smart Caching Layer (`src/lib/cache.ts`)**:
   - In-memory cache `user_tags:{userId}` (TTL 1 jam) dan `unorganized_count:{userId}` (TTL 24 jam) untuk kecepatan performa tanpa query berulang ke DB.
9. **Integrasi `/ask`**:
   - `/ask`: Melakukan silent auto-organize catatan unorganized sebelum kalkulasi analisis dieksekusi agar rekap data keuangan/jadwal 100% akurat.

### Y. Command `/read`, Tombol Dock 🔄 Sync Cooldown, & Multimedia Local Compression Engine (Okt 2026)
1. **Command `/read` & Tombol Dock Menu (`src/lib/telegram-handler.ts`)**:
   - Dock keyboard persisten diperbarui:
     - Baris 1: `[ 📖 Read ] [ 🏷 Tags ] [ ⭐️ Pin ]`
     - Baris 2: `[ 🔄 Sync ] [ ❌ Tutup Menu ]`
   - Menampilkan hingga maksimal 27 catatan terakhir (non-encrypted, seluruh kategori) milik user menggunakan paginasi (`PAGE_SIZE = 9`, maksimal 3 halaman: 1-9, 10-18, 19-27).
   - Format cuplikan catatan:
     - Menampilkan cuplikan hingga 140 karakter.
     - Ikon lampiran: `🖼️` jika memiliki gambar, `📎` jika dokumen/file non-gambar.
     - Badge `[unorganized]` jika catatan belum dirapikan oleh AI (`isProcessed = false`).
   - Inline navigation: tombol navigasi pagination `[ ◀️ Prev ] [ 1 / N ] [ Next ▶️ ]` serta tombol nomor pintasan `[ 1 ]` s.d. `[ 9 ]` menuju detail catatan.
2. **Tombol Dock `🔄 Sync` & 10s Cooldown**:
   - Cooldown 10 detik per pengguna (`SYNC_COOLDOWN_MS = 10000`). Jika ditekan berulang dalam kurun 10 detik, membalas: `"⏳ Tunggu sebentar sebelum melakukan sinkronisasi lagi ya!"`.
   - Sinkronisasi instan antara cache in-memory dan database PostgreSQL.
   - Zero-junk response: Hanya membalas `"✅ Sinkronisasi selesai!"` atau `"ℹ️ Belum ada catatan baru!"`.
3. **Lampiran Multimedia & Mesin Kompresi Lokal Sharp (`src/lib/media-processor.ts`)**:
   - **Drizzle Schema Update**: Kolom `attachments` berjenis `jsonb` di tabel `notes` dengan struktur `NoteAttachment[]`:
     `[{ type: 'image' | 'file', originalName: string, mimeType: string, sizeBytes: number, localPath: string, fileId: string }]`.
   - **Validasi Input Ketat**:
     - Batas maksimal berkas 3MB (`media_size_exceeded`): `"⚠️ Ukuran file melebihi batas maksimal 3MB. Catatan tidak disimpan."`
     - Wajib memiliki caption teks (`media_missing_caption`): `"⚠️ Catatan gambar/file wajib menyertakan caption teks. Catatan tidak disimpan."`
     - Debounce Buffer mendukung pengelompokan album foto (*media group*) ke dalam satu catatan yang sama.
   - **Kompresi Gambar Lokal Cepat (Sharp)**:
     - Mengunduh file dari Telegram Bot API via `getFile`.
     - Gambar di-*resize* ke lebar maksimal 1200px (tanpa perbesaran) dan dikonversi ke format WebP dengan *quality* 70%.
     - Menghasilkan ukuran berkas puluhan KB (30KB - 80KB) yang disimpan di `storage/attachments/`.
   - **Zero-Vision AI Policy**:
     - Gambar tidak pernah dikirim ke Vision API Claude/LLM (menghemat token dan menjaga privasi 100%).
     - Konten catatan yang dikirimkan ke AI Organizer secara otomatis disisipi awalan penanda:
       `[Catatan ini memiliki lampiran gambar/file]\n{isi caption}`.
   - **Tampilan Detail Catatan & On-Demand Media Delivery**:
     - Berkas foto/dokumen **tidak lagi dikirim otomatis** saat detail catatan dibuka (`displayNoteDetail`), menjaga riwayat chat pengguna tetap bersih dan hemat kuota data.
     - Inline keyboard detail catatan menyisipkan tombol kondisional `📥 File/Media` (atau `📥 File/Media (${count})` jika memiliki lebih dari 1 berkas lampiran) di antara tombol aksi baris 1 dan tombol navigasi baris 2 hanya jika catatan memiliki lampiran.
     - Mengklik tombol memicu callback query `note:media:${note.id}` yang mengirimkan notifikasi toast Telegram `📥 Mengirim file/media...` dan mengirimkan seluruh lampiran berkas secara *on-demand* (`sendTelegramPhoto` / `sendTelegramDocument`).
4. **Verifikasi Test Suite**:
   - `scripts/test-enhancements-oct19.ts`: 27/27 skenario pengujian lolos 100% PASS (/read pagination max 27, [unorganized] badge, 🖼️/📎 icons, sync cooldown 10s, media size >3MB rejection, media missing caption rejection, Sharp WebP compression, database jsonb persistence, zero-vision AI payload, serta on-demand file/media button & callback).
   - `scripts/test-intent-classifier.ts`: 38/38 live AI dan 38/38 deterministic heuristic lolos 100% PASS.
   - `npm run check` & `npm run typecheck`: 0 errors.

### AA. Penyelarasan Web UI Redesign, TargetDate Schema, & Human Intent Lock (Okt 2026)
1. **Pembaruan Skema Database (`src/db/schema.ts`)**:
   - Kolom `targetDate: timestamp('target_date', { withTimezone: true })` nullable untuk mendukung komponen Calendar Web.
   - Index komposit: `index('notes_user_target_date_idx').on(t.userId, t.targetDate)`.
   - Drizzle kit push tersinkronisasi aman tanpa mengubah data yang sudah ada.
2. **Hukum "Human Intent Trumps AI" & Web Intent Lock (`POST & PATCH /api/notes`)**:
   - Catatan yang dibuat di tab spesifik Web (Todo, Schedule, Bookmarks, Vault) langsung berstatus `isProcessed = true` dengan kategori terpilih (tanpa token LLM).
   - Catatan yang dibuat di tab umum (`others`) tetap `isProcessed = false` agar diproses batch sync di background.
   - Setiap kali user menyimpan edit dari Web (`PATCH /api/notes/[id]`), otomatis dikunci `isProcessed = true` agar terlindungi dari modifikasi atau overwrite AI di masa depan.
   - Mendukung penghapusan lampiran berkas via tombol '✕' pada dialog edit.
3. **Logika Calendar Multi-Schedule (Earliest Anchor Date) (`src/lib/date-extractor.ts`)**:
   - Deteksi otomatis tanggal terlengkap dalam teks jadwal: ISO, DMY, bulan bahasa Indonesia/Inggris, nama hari, kata relatif (besok, lusa), dan waktu (jam).
   - Jika catatan schedule memuat banyak tanggal (misal "Senin 24 Okt meeting, Rabu 26 Okt flight, Jumat 28 Okt demo"), kolom `targetDate` HANYA diisi dengan tanggal terawal yang akan datang (Earliest Upcoming Anchor Date) tanpa memecah baris catatan.
4. **Penyelarasan Bookmarks & Attachments**:
   - Platform tags bookmark dibatasi maksimal Top 3 dominan untuk mencegah tag sprawl pada Table of Contents.
   - Field `attachments` (jsonb) dikembalikan utuh pada `GET /api/notes`, `GET /api/notes/[id]`, `POST`, dan `PATCH`.
5. **Verifikasi Test Suite**:
   - `scripts/test-web-sync-alignment.ts`: 31/31 skenario pengujian PASS (100%).
   - `npm run typecheck` & `npm run build`: 0 error (100% lulus).

### AA. Pure Prompt-Driven 9-Pillar Batch AI Pipeline & Strict Fail-Fast Boundary (Okt 2026)
1. **Penghapusan Intersepsi Regex (Pure LLM Semantics)**:
   - Menghapus pembatasan hardcoded regex (`detectLocalCredential` bypass dan URL hardcoding) pada alur Batch Sync (`src/lib/ai/batch-organizer.ts`).
   - Seluruh catatan unorganized kini dialirkan langsung ke LLM dengan System Prompt 9 Pilar Komprehensif berlandaskan [`unlazynotes_habit_ai_spec.md`](./unlazynotes_habit_ai_spec.md).
2. **Unified 9-Pillar Prompt Architecture**:
   - Mengintegrasikan definisi intensi sakral 9 pilar: `bookmark`, `schedule`, `finance`, `credential`, `todo`, `draft`, `reference`, `random-yap`, `others`.
   - Ekstraksi data terstruktur langsung dari respons model: `expenses`, `income`, `debt`, `schedule`, `schedule_dates`, `source`, dan taksonomi dual-layer `specific_tags` (domain umbrella + subjek konkret).
   - Normalisasi nominal otomatis (`35k` -> 35000, `50rb` -> 50000, `3.5jt` -> 3500000).
3. **Strict Fail-Fast Error Boundary (Anti-Data Corruption)**:
   - Jika AI Gateway (Cosmoshub) mengalami gangguan, timeout, atau kegagalan parsing JSON:
     - Proses batch langsung dibatalkan total (*aborted*).
     - **Zero Partial Mutation**: Tidak ada satu pun catatan yang diubah sebagian atau ditandai `isProcessed = true`.
     - Counter catatan unorganized tetap utuh dan cache tidak direset.
     - Pengguna diberi tahu secara transparan via Telegram atau Web UI bahwa AI sedang bermasalah dan catatan mereka tetap aman.
4. **Penyelarasan Web & Telegram Sync**:
   - Endpoint `/api/notes/sync` diselaraskan untuk memanggil `organizeUserNotes(userId)` secara identik, mengembalikan status 502 jika AI Gateway gagal dan data catatan terupdate penuh saat sukses.
5. **Perbaikan Isolasi Akun Telegram (`telegramChatId`)**:
   - Menambahkan indeks unique `api_keys_telegram_chat_id_unique` pada PostgreSQL.
   - Handler `/login` dan `/start` otomatis melepaskan kunci lama yang terhubung ke `chatId` yang sama sebelum menautkan kunci baru, mencegah tabrakan data antar-akun.

### Z. Non-Persistent 2x2 Dock Menu & Background Non-Blocking Sync Engine (Okt 2026)
1. **2x2 Dock Keyboard (`PERSISTENT_DOCK_KEYBOARD`)**:
   - **Grid Simetris 2x2**:
     ```
     [ 📖 Read ] [ 🔄 Sync ]
     [ 🏷 Tags ] [ ⭐️ Pin ]
     ```
   - **Non-Persistent (Dapat Ditutup Bebas)**: `is_persistent` dinonaktifkan agar pengguna dapat menutup/meminimalkan atau membuka kembali dock secara alami melalui kontrol keyboard bawaan Telegram (ikon keyboard / swipe), tanpa mengunci UI layar.
   - **Tanpa Tombol "Tutup Dock"**: Tidak lagi memerlukan tombol `❌ Tutup Menu` khusus yang memakan ruang baris.
2. **Background Non-Blocking Sync Engine (`src/lib/telegram-handler.ts`)**:
   - **Respon Instan (<200ms)**: Menghapus synchronous blocking barrier (`syncInProgressSet` tidak lagi menolak pesan user/callback). Saat tombol `🔄 Sync` ditekan, bot langsung merespons pesan awal:
     `🔄 Sedang merapikan {count} catatan di latar belakang... Kamu bisa lanjut mencatat seperti biasa!`
   - **Native Typing Indicator**: Menggunakan `bot.api.sendChatAction(chatId, 'typing')` bawaan Telegram sebagai indikator proses latar belakang tanpa polling pesan edit bolak-balik yang rentan terkena rate-limit 429.
   - **Asynchronous AI Execution**: Pemrosesan AI `organizeUserNotes(userId)` berjalan di background. Setelah selesai, bot mengirim konfirmasi singkat `✅ Sinkronisasi selesai!` dan mengupdate cache.
3. **Optimasi Latensi & Fast-Path LLM (`src/lib/ai/batch-organizer.ts`)**:
   - **Fast-Path URL Bookmarks**: Catatan unorganized berupa tautan tunggal (URL valid) langsung diproses secara lokal instan ke kategori `bookmark` tanpa memanggil LLM.
   - **Guard Output Token & Timeout**: Menetapkan `maxTokens: 1500` dan `AbortSignal.timeout(20000)` pada inferensi Claude Haiku 5.5 guna mencegah JSON terpotong di tengah chunk 15 catatan.

### AD. Upgrade Kapasitas AI Context (`/ask`) & Top-60 Tag Ingestion (Okt 2026)
1. **Perluasan Retention Window & Context Limit (`src/lib/ask.ts`)**:
   - Waktu retensi diperluas dari 90 hari menjadi **180 hari (6 bulan)** (`subDays(now, 180)`).
   - Batas query catatan non-terenkripsi dinaikkan dari 100 menjadi **300 catatan terbaru** (`.limit(300)`).
   - Mengoptimalkan kapasitas context window model `deepseek-v4.1-flash` (128K token) untuk second brain yang lebih komprehensif.
2. **Injeksi Top-60 Tag Teraktif (`src/lib/cache.ts` & `src/lib/ai/modules/general.ts`)**:
   - Algoritma penghitungan frekuensi tag menghitung kemunculan seluruh tag per pengguna dan mengurutkannya secara desending (*Most Frequent Tags*).
   - Mengembalikan Top 60 tag teratas (sebelumnya dibatasi 30 tag) ke dalam prompt memori AI guna mencegah ledakan tag sinonim baru (*tag sprawl*).

### AE. Smart Auto-Cleaner, Link Metadata Enricher, & Bulk Cleaning Experience (Okt 2026)
1. **Smart Auto-Cleaner & Ephemeral Notes (`/temp`)**:
   - Skema tabel `notes`: `expiresAt: timestamp('expires_at', { withTimezone: true })` dan `isArchived: boolean('is_archived').default(false).notNull()`.
   - Indeks PostgreSQL: `notes_user_archived_idx` dan `notes_expires_at_idx`.
   - Telegram command `/temp <isi>` menyimpan catatan dengan masa aktif 7 hari (`expiresAt = Date.now() + 7 days`).
   - Fungsi scheduled / background cleaner `autoArchiveExpiredNotes()` di `src/lib/cleaner.ts` mengarsipkan catatan yang telah melewati waktu kadaluwarsa secara hening.
2. **Lightweight Link Metadata Enricher (`src/lib/link-enricher.ts`)**:
   - Ekstraksi judul & pembuat konten YouTube melalui free official oEmbed API tanpa API key.
   - Parsing OpenGraph (`og:title`, `og:description`, `<title>`) secara hemat resource melalui head stream (<25KB, 3s timeout) tanpa instalasi browser berat (0% Puppeteer/Playwright).
   - Terintegrasi dengan pipeline AI (`generateNoteTags` & `organizeUserNotes`) untuk memperkaya konteks URL murni atau minimalis.
3. **Bulk Cleaning Experience (Web Dashboard)**:
   - API endpoint `POST /api/notes/bulk` untuk aksi `archive`, `restore`, dan `delete` massal dengan validasi kepemilikan user dan invalidasi cache tag.
   - `NoteCard.tsx`: Checkbox seleksi dengan `e.stopPropagation()`, badge `⏳ Temp`, highlight visual border & ring saat dipilih.
   - `NotesTimeline.tsx`: Tombol toggle `[ 🧹 Kelola Catatan ]`, filter chips (`Semua`, `⏳ Kadaluwarsa / Temp`, `📅 Selesai > 1 Bulan`), tombol `[ Pilih Semua ]`, floating bottom toolbar (`Arsipkan Semua`, `Hapus Permanen`, `Batal`).

---

## 3. Analisis Kompleksitas & Skalabilitas (Kapasitas 1.000 – 10.000 Users)

Evaluasi teknis arsitektur saat menangani beban 1.000 hingga 10.000 pengguna:

### A. Pemodelan Beban (Traffic Modeling)
- **10.000 Registered Users** $\approx$ 10%–20% DAU = **1.000 – 2.000 user aktif harian**.
- Rata-rata 10–15 catatan/user/hari = **15.000 – 30.000 catatan baru/hari**.
- Rata-rata write request: **~0.35 write/detik**.
- Jam sibuk (*peak traffic*): **~3 – 8 write/detik (QPS)**. Beban ini berada jauh di bawah kapasitas PostgreSQL & Node.js (yang sanggup melayani >500 QPS pada server standar).

### B. Efisiensi Komponen
1. **Ingestion Layer Non-Blocking (<25 ms)**:
   - Request HTTP dari Telegram langsung merespons 200 OK setelah `INSERT` dasar selesai (<25ms).
   - Tagging AI dieksekusi di *background worker*, koneksi database tidak tertahan (*no connection holding*).
2. **Deterministic Router Menghemat 70–80% Biaya & Latensi LLM**:
   - Mayoritas catatan (URL, belanja/makanan, password wifi, todo) diproses lokal dalam memori (<0.5ms CPU).
   - Hanya ~20% catatan yang memanggil LLM Cosmoshub (~1 panggilan LLM/detik di jam sibuk).
3. **Pencarian Terindeks GIN Trigram**:
   - Pencarian tidak melakukan *full table scan*, melainkan memakai *inverted index* `GIN` yang difilter per `user_id`. Query selesai dalam <10ms.
4. **Footprint Resource**:
   - RAM Node.js: ~150 – 350 MB.
   - RAM PostgreSQL: ~200 – 500 MB (seluruh index termuat di RAM).
   - Disk Database: ~1 – 2 GB untuk 1 juta baris catatan.

### C. Checklist Optimasi Menuju Produksi Singapore (>10.000 Users)
1. **Composite Index Multi-Tenant**: Pasang index `CREATE INDEX idx_notes_user_created ON notes(user_id, created_at DESC);` untuk menjamin timeline tetap instan di jutaan baris.
2. **Connection Pool Tuning**: Naikkan `max: 10` menjadi `max: 20-30` pada `src/db/index.ts` (atau pasang PgBouncer jika multi-instance).
3. **Queue Worker Eksternal (>50.000 Users)**: Isolasi *background worker* dengan Redis BullMQ jika lonjakan pesan serentak sangat tinggi.

---

## 4. Konteks Migrasi ke VPS Production (Singapore)

- Server Tencent saat ini adalah **Sandbox / Dev VPS**.
- Semua credential real (Google OAuth Production & Akun DOKU Merchant Production) akan diintegrasikan saat persiapan pindah ke VPS Singapore.
- Prosedur migrasi:
  1. `git clone` dari GitHub `origin main`.
  2. Restore database dump (`pg_dump` $\rightarrow$ `psql`).
  3. Konfigurasi file `.env.production` (koneksi DB, bot token, API keys, DOKU production).
  4. Jalankan via Docker Compose atau Systemd + Nginx SSL Reverse Proxy sesuai panduan di [`DEPLOYMENT.md`](file:///home/rikushiro/projects/unlazynotes/DEPLOYMENT.md).

---

## 5. Ide Fitur & Backlog Eksperimental (Future Features)

Seluruh ide pengembangan, rancangan UX, dan backlog teknis yang statusnya ditahan (*held*) terdokumentasi terpusat di:
- [`FUTURE_FEATURES.md`](./FUTURE_FEATURES.md)
  - **Fitur 1**: *Multi-Bubble & Long-Note Continuation Buffer (Double Comma `,,`)*: Solusi penggabungan catatan multi-bubble dan dokumen panjang pemecah batas 4.096 karakter Telegram.

