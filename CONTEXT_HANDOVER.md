# UnlazyNotes – Context Handover & Engineering State 🚀

Dokumen ini berfungsi sebagai memori persisten lintas sesi (*session handover*) agar pengembangan dapat langsung dilanjutkan tanpa kehilangan konteks teknis maupun *roadmap*.

---

## 1. Status Lingkungan & Layanan Saat Ini (Sandbox VPS)

- **Repositori Git**: `/home/rikushiro/projects/unlazynotes`
- **Branch**: `main` (Bersih di commit lokal `78b982a`)
- **Layanan Aktif (Systemd)**:
  - `unlazynotes.service`: Server Astro 5 SSR (Port `4321` / `localhost:4321`)
  - `unlazynotes-bot.service`: Polling daemon Telegram `@unlazynotes_bot` (Long Polling)
- **Database**: PostgreSQL 16 lokal port `5432` (`unlazynotes_dev`) via Drizzle ORM
  - Ekstensi aktif: `pg_trgm` (Trigram similarity & fuzzy matching)
  - Index aktif: `notes_content_trgm_idx` (`GIN (content gin_trgm_ops)`)
- **AI Gateway**: Cosmoshub API (`deepseek-v4.1-flash`)
- **Payment & Auth**: DOKU Hosted Checkout Simulator & Better Auth (Google OAuth & Dev Session)
- **Validasi Test Suite**:
  - `npm run test:tagging`: 31/31 unit test lolos (100% PASS)
  - `npm run test:webhook`: 10/10 integrasi end-to-end lolos (100% PASS)
  - `npm run typecheck`: 0 TypeScript error

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
8. **Mata Uang Campuran & Slang Multibahasa**: Memahami singkatan kasual internasional dan lokal (`k`, `rb`, `ewu`, `rebu`, `goceng`, `cepek`), serta memisahkan perhitungan mata uang yang berbeda (`$ USD` vs `Rp IDR`) tanpa mencampurnya sembarangan.

### G. Dashboard Interactive UX: Quick Web Composer, Interactive Checklists, & Clickable Tags
1. **Quick Web Note Composer ([`NotesTimeline.tsx`](file:///home/rikushiro/projects/unlazynotes/src/components/dashboard/NotesTimeline.tsx) & [`POST /api/notes`](file:///home/rikushiro/projects/unlazynotes/src/pages/api/notes/index.ts))**:
   - Input composer box di atas feed catatan dengan shortcut keyboard (`Enter` untuk simpan, `Shift + Enter` untuk baris baru).
   - Optimistic UI: Catatan langsung dimunculkan di paling atas feed secara instan dengan tag `merapikan...`, lalu di-update begitu AI tagging selesai.
   - Endpoint `POST /api/notes` memvalidasi kuota harian Standard/Pro, memanggil AI tagging (`generateNoteTags`), dan menyimpan catatan ke PostgreSQL dengan `source: 'web'`.
2. **Clickable Specific Tags**:
   - Tag pills `#tag` pada [`NoteCard.tsx`](file:///home/rikushiro/projects/unlazynotes/src/components/dashboard/NoteCard.tsx) kini interaktif. Mengklik tag langsung memicu filtering feed ke tag tersebut via callback ke `NotesTimeline`.
3. **Interactive To-Do Checklists**:
   - Catatan bertipe `todo` multi-baris dirender sebagai checklist interaktif dengan checkbox native.
   - Mengklik checkbox menerapkan efek coret (*strikethrough*) halus pada baris terkait secara visual di UI.

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

## 4. Roadmap Fitur Berikutnya (The 5 Pillars Blueprint)

Rencana pengembangan lanjutan yang tersimpan di backlog:

### Fase 1: Core AI & Entity Extraction
- **Pilar 1 (URL OpenGraph / Metadata Scraper)**:
  - Background fetcher 15 KB pertama untuk membaca `<title>` dan `<meta description>` URL umum non-sosmed agar tagging bookmark otomatis kontekstual.
- **Pilar 4 (Structured Entity Extractor)**:
  - Menambahkan kolom `metadata: jsonb('metadata')` pada tabel `notes`.
  - Ekstraksi nominal angka & currency (`kopi 12k bensin 20k` $\rightarrow$ `amount: 32000 IDR`).
  - Ekstraksi waktu jadwal (`besok jam 14.00` $\rightarrow$ ISO 8601 UTC timestamp).

### Fase 2: Telegram UX & Personalisasi
- **Pilar 2 (User Tag Memory)**:
  - Mengingat frekuensi tag yang sering dipakai user dari database dan memprioritaskannya dibanding sinonim baru.

### Fase 3: Web Dashboard Enhancements
- **Pilar 5 (Tag Manager & 1-Click Merge Tool)**:
  - Halaman manajemen tag di web dashboard untuk audit tag dan menggabungkan tag secara massal (misal merge `makan` ke `food`).
- **Peningkatan UI/UX**:
  - Peningkatan styling timeline, visual card, dan mobile responsiveness.

---

## 5. Konteks Migrasi ke VPS Production (Singapore)

- Server Tencent saat ini adalah **Sandbox / Dev VPS**.
- Semua credential real (Google OAuth Production & Akun DOKU Merchant Production) akan diintegrasikan saat persiapan pindah ke VPS Singapore.
- Prosedur migrasi:
  1. `git clone` dari GitHub `origin main`.
  2. Restore database dump (`pg_dump` $\rightarrow$ `psql`).
  3. Konfigurasi file `.env.production` (koneksi DB, bot token, API keys, DOKU production).
  4. Jalankan via Docker Compose atau Systemd + Nginx SSL Reverse Proxy sesuai panduan di [`DEPLOYMENT.md`](file:///home/rikushiro/projects/unlazynotes/DEPLOYMENT.md).
