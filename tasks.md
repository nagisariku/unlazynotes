# Tasks: Enhancement Pilar Bookmark UnlazyNotes

- [x] **Fase 1: Ekstensi Skema Database & Persiapan Types** <!-- id: 1 -->
  - [x] Tambahkan tipe `BookmarkMeta` dan kolom `bookmarkMeta` (JSONB) pada tabel `notes` di `src/db/schema.ts` <!-- id: 1.1 -->
  - [x] Jalankan validasi tipe dan update skema Drizzle (`npx tsc --noEmit`) <!-- id: 1.2 -->

- [x] **Fase 2: Multi-Provider Scraper & Pipeline Asinkron** <!-- id: 2 -->
  - [x] Perluas `src/lib/link-enricher.ts` dengan oEmbed Twitter/X, Reddit `.json`, TikTok oEmbed, Google S2 Favicon, dan metadata OG <!-- id: 2.1 -->
  - [x] Buat fungsi `enrichNoteBookmarkAsync(noteId, content)` non-blocking fire-and-forget <!-- id: 2.2 -->
  - [x] Integrasikan `enrichNoteBookmarkAsync` ke `flushDebounceBuffer` di `src/lib/telegram-handler.ts` <!-- id: 2.3 -->
  - [x] Integrasikan `enrichNoteBookmarkAsync` ke `POST /api/notes` di `src/pages/api/notes/index.ts` <!-- id: 2.4 -->

- [x] **Fase 3: Grounding Context `/ask` untuk Bookmark & Caption** <!-- id: 3 -->
  - [x] Perbarui context builder di `src/lib/ask.ts` agar menyertakan `caption`, `title`, dan `aiSummary` dari `bookmarkMeta` <!-- id: 3.1 -->

- [x] **Fase 4: Deep Reader & AI Summary on Demand (3-in-1 Engine)** <!-- id: 4 -->
  - [x] Pasang library reader extraction ringan (`@mozilla/readability` dan `linkedom`) <!-- id: 4.1 -->
  - [x] Buat modul ekstraksi artikel & AI summarizer di `src/lib/article-reader.ts` <!-- id: 4.2 -->
  - [x] Buat endpoint API `POST /api/bookmarks/[id]/read` dan `PATCH /api/bookmarks/[id]/status` <!-- id: 4.3 -->

- [x] **Fase 5: Enhancement UI Dashboard (`BookmarksView.tsx`)** <!-- id: 5 -->
  - [x] Perbarui `BookmarkCard` untuk menampilkan Favicon Google S2, Judul Asli Web, OG Image nyata, dan Badge Domain <!-- id: 5.1 -->
  - [x] Tambahkan Filter Status Baca (`Semua`, `Belum Dibaca`, `Selesai`) dan Smart Platform Clustering <!-- id: 5.2 -->
  - [x] Buat modal/drawer `ReaderModal.tsx` untuk menampilkan 3 Poin AI Takeaways dan Teks Bersih Artikel <!-- id: 5.3 -->

- [x] **Fase 6: Input Ergonomics & Utility** <!-- id: 6 -->
  - [x] Tambahkan generator Bookmarklet 1-Click di UI Bookmark <!-- id: 6.1 -->
  - [x] Konfigurasi Web Share Target di `public/manifest.json` dan routing tangkap link di dashboard <!-- id: 6.2 -->

- [x] **Fase 7: Verifikasi & Testing E2E** <!-- id: 7 -->
  - [x] Jalankan verifikasi TypeScript (`npm run typecheck`) <!-- id: 7.1 -->
  - [x] Uji fungsionalitas scraping multi-provider dan integrasi bot Telegram <!-- id: 7.2 -->

- [x] **Fase 8: Refinement Workspace Timeline, Filter Bookmarks, ToC Platform, & Ask AI Naming** <!-- id: 8 -->
  - [x] Pastikan urutan tanggal timeline di Workspace strictly dari terbaru ke terlama (`b.timestamp - a.timestamp` dan `b.createdAt - a.createdAt`) <!-- id: 8.1 -->
  - [x] Workspace default tidak menampilkan bookmarks, hapus bookmark dari kategori filter, dan sediakan checkbox 'Tampilkan bookmarks' <!-- id: 8.2 -->
  - [x] Sesuaikan nama Ask AI button per halaman (`Ask Workspace`, `Ask Schedule`, `Ask Todo`, `Ask Finance`, `Ask Bookmark`) <!-- id: 8.3 -->
  - [x] Pindahkan filter platform di Bookmarks ke komponen ToC di bawah ToC Kategori lengkap dengan count dan icon <!-- id: 8.4 -->
  - [x] Hapus Ask AI dari halaman Vault (`VaultView.tsx`) <!-- id: 8.5 -->
  - [x] Verifikasi TypeScript lolos 0 error (`npx tsc --noEmit`) <!-- id: 8.6 -->

- [x] **Fase 9: Polishing Mode Baca, Spacing Caption, Card Link Logic & Divider Cleanup** <!-- id: 9 -->
  - [x] Berikan space gap yang cukup dan proporsional antara teks catatan user dengan caption medsos di modal detail catatan <!-- id: 9.1 -->
  - [x] Sesuaikan logika tampilan link pada kartu bookmark: jika user hanya share link dan ada caption medsos, sembunyikan link dan tampilkan caption medsos; jika tidak ada caption medsos, tampilkan teks link <!-- id: 9.2 -->
  - [x] Hapus garis pemisah horizontal/divider di bawah search box/filter bar dan antara ToC Kategori & Platform di Bookmarks <!-- id: 9.3 -->
  - [x] Masukkan Ringkasan AI di mode baca ke dalam box berlatar `bg-surface-soft`, sesuaikan ukuran teks agar setara dengan transkrip/bacaan lengkap, hapus batasan 3 poin pada prompt AI, dan beri jeda vertikal yang cukup ke bacaan lengkap <!-- id: 9.4 -->
  - [x] Perbaiki scraper artikel Medium/web agar mempertahankan struktur paragraf asli dengan pemisah dua baris baru (`\n\n`) <!-- id: 9.5 -->
  - [x] Perbesar max-height truncation teks caption/catatan pada kartu bookmark (line-clamp-6), tukar posisi ToC Kategori di bawah ToC Platform, hapus penanda hitam pada ToC Kategori, dan terapkan penanda underline serta teks tebal pada ToC Platform <!-- id: 9.6 -->
  - [x] Verifikasi TypeScript lolos 0 error (`npm.cmd run typecheck`) <!-- id: 9.7 -->

- [x] **Fase 10: Mobile Filter Consolidation & Mobile Attachment Row Card Layout** <!-- id: 10 -->
  - [x] Sederhanakan tabs status baca menjadi hanya 'Semua' dan 'Belum Dibaca' (hapus tab 'Dibaca') <!-- id: 10.1 -->
  - [x] Sediakan modal filter pop-up konsolidasi di mobile (`BookmarkFilterModal.tsx`) mencakup Waktu, Status Baca, Platform, dan Kategori dengan tombol trigger di sebelah SearchPill <!-- id: 10.2 -->
  - [x] Sembunyikan deretan tabs filter dan ToC horizontal bar di mobile agar tampilan layar tidak penuh/ramai (`hidden sm:inline-flex` dan `hidden sm:block`) <!-- id: 10.3 -->
  - [x] Ubah kartu bookmark di mobile menjadi layout attachment baris (thumbnail kecil di kiri, judul dan info platform di kanan, mendukung multiple links berderet) <!-- id: 10.4 -->
  - [x] Verifikasi TypeScript lolos 0 error (`npm.cmd run typecheck`) <!-- id: 10.5 -->

- [x] **Fase 11: Mobile Notes Expand & Divider, Web Description Sanity, and Desktop Multi-Link Rows** <!-- id: 11 -->
  - [x] Samakan tampilan catatan bookmark di mobile dengan timeline halaman lain: berupa baris berpemisah horizontal (`border-b border-hairline`), tanpa bingkai kartu, dan saat diklik membuka teks penuh in-place (`isExpanded` highlight) <!-- id: 11.1 -->
  - [x] Hilangkan fallback deskripsi SEO website ke `caption` pada artikel web generik (seperti Medium) agar tidak muncul cuplikan yang dikira hasil processing AI saat user hanya share link <!-- id: 11.2 -->
  - [x] Terapkan layout baris attachment (thumbnail, judul, thumbnail, judul) pada tampilan desktop jika bookmark memiliki lebih dari 2 link (`urls.length > 2`) <!-- id: 11.3 -->
  - [x] Verifikasi TypeScript lolos 0 error (`npm.cmd run typecheck`) <!-- id: 11.4 -->

- [x] **Fase 12: Standarisasi Action Buttons Toolbar pada NoteCard** <!-- id: 12 -->
  - [x] Satukan urutan tombol aksi kartu catatan: `[Mode Baca]` -> `[Salin]` -> `[Edit]` -> `[Pin]` -> `[Hapus]` -> `[Ciutkan]` <!-- id: 12.1 -->
  - [x] Terapkan konsistensi hover desktop (badge kategori di kiri, tombol aksi di kanan) dan reveal mobile saat expanded <!-- id: 12.2 -->
  - [x] Pastikan pure link note dari platform terproteksi login (seperti Threads) tetap berstatus bookmark, tagged domain, dan diproses tanpa error <!-- id: 12.3 -->

- [x] **Fase 13: Arsitektur Modal Catatan Terpadu (Unified Note Modal)** <!-- id: 13 -->
  - [x] Gabungkan `NoteDetailModal`, `EditNoteModal`, dan `ReaderModal` menjadi satu modal terpadu dengan 3 mode internal: `VIEW`, `READ`, `EDIT` <!-- id: 13.1 -->
  - [x] Standarisasi header actions modal: `[Mode Baca / Kembali]` (kondisional jika ada URL) -> `[Edit / Batal Edit]` -> `[Salin]` -> `[Pin]` -> `[Hapus]` -> `[Tutup (X)]` <!-- id: 13.2 -->
  - [x] Hilangkan screen flicker dan state bouncing (`openedFromDetailRef`) di seluruh views (`NotesTimeline`, `BookmarksView`, `TodoView`, `ScheduleView`, `VaultView`, `FinanceView`) <!-- id: 13.3 -->
  - [x] Verifikasi typecheck dan build produksi lolos 0 error <!-- id: 13.4 -->

- [x] **Fase 14: Live Parallel AI Sync & Single-Note Processing Engine** <!-- id: 14 -->
  - [x] Dukung `targetNoteId` spesifik pada `organizeUserNotes` di `src/lib/ai/batch-organizer.ts` untuk pemrosesan kartu catatan satuan (single-note) <!-- id: 14.1 -->
  - [x] Perbarui endpoint `POST /api/notes/sync` agar menerima payload opsional `noteId` dan parameter `excludeEncrypted=true` di `GET /api/notes` <!-- id: 14.2 -->
  - [x] Tambahkan tombol aksi `[Sync AI]` langsung pada kartu catatan uncategorized di `NoteCard.tsx` yang dapat dipicu secara independen dan paralel <!-- id: 14.3 -->
  - [x] Implementasikan reactive live synchronization di `NotesTimeline.tsx` berbasis `sessionStorage`, lifecycle Astro ClientRouter (`astro:page-load`), `window.focus`, dan auto-revalidation polling senyap saat user kembali dari navigasi halaman lain <!-- id: 14.4 -->
  - [x] Terapkan proteksi mutual exclusion disable pada seluruh tombol sync AI (baik tombol batch 'Sync with AI' maupun semua tombol single 'Sync AI' di setiap kartu) saat ada proses sinkronisasi yang sedang aktif <!-- id: 14.5 -->
  - [x] Verifikasi TypeScript lolos 0 error (`npm.cmd run typecheck`) <!-- id: 14.6 -->

- [x] **Fase 15: Breakdown Checklist To-Do & Ekstraksi AI** <!-- id: 15 -->
  - [x] Tambahkan tipe `TodoEntry` dan kolom `todos` (JSONB) pada tabel `notes` di `src/db/schema.ts` <!-- id: 15.1 -->
  - [x] Buat modul AI extraction `src/lib/ai/modules/todo.ts` dan integrasikan ke `batch-organizer.ts` <!-- id: 15.2 -->
  - [x] Tambahkan endpoint handler PATCH 0-token toggle status to-do dan auto-reextract pada `src/pages/api/notes/[id].ts` <!-- id: 15.3 -->
  - [x] Perbarui `src/components/dashboard/NewTodoModal.tsx` agar menyertakan item `todos` awal saat pembuatan manual <!-- id: 15.4 -->
  - [x] Transformasi UI `src/components/dashboard/TodoView.tsx` menjadi actionable checklist dengan progress tracker, filter status, checkbox interaktif, dan tombol reverse-link ke catatan asli via `NoteDetailModal` <!-- id: 15.5 -->
  - [x] Jalankan verifikasi TypeScript (`npm run typecheck`) dan build (`npm run build`) <!-- id: 15.6 -->

- [x] **Fase 16: Refinement UI & Ergonomi Halaman To-Do** <!-- id: 16 -->
  - [x] Hapus seluruh sistem, visualisasi bar, dan logic perhitungan progress checklist <!-- id: 16.1 -->
  - [x] Terapkan style tab switcher List / Grid tanpa border (`bg-surface-soft rounded-full p-1 !border-0`) selaras dengan BookmarksView & ScheduleView <!-- id: 16.2 -->
  - [x] Pindahkan opsi filter status to-do ('Semua' vs 'Belum Selesai') ke dalam modal popover `NotesFilterPopover.tsx` <!-- id: 16.3 -->
  - [x] Hapus seluruh tampilan tag/hashtag pada item checklist to-do <!-- id: 16.4 -->
  - [x] Ubah lebar card tiap item checklist menjadi `w-fit max-w-full` (fit-content sesuai panjang isi) <!-- id: 16.5 -->
  - [x] Posisikan tanggal dan tombol reverse-link catatan asli (pure icon `ExternalLink` berukuran `w-4.5 h-4.5` tanpa border/box) langsung di samping teks task <!-- id: 16.6 -->
  - [x] Jalankan verifikasi TypeScript (`npm run typecheck`) lolos 0 error <!-- id: 16.7 -->

- [x] **Fase 17: UI/UX Refinement Kanban Priority Drag-and-Drop, Pure Vertical Lines, & Status Tabs** <!-- id: 17 -->
  - [x] Hapus header 'Checklist Tugas', badge counter, dan horizontal line pada kolom unassigned paling kiri <!-- id: 17.1 -->
  - [x] Hapus badge counter jumlah item pada ketiga kolom prioritas (Low, Normal, High) <!-- id: 17.2 -->
  - [x] Ganti `border-left` dengan elemen vertical divider lurus (`w-px bg-hairline`) tanpa efek rounded corners <!-- id: 17.3 -->
  - [x] Hapus garis horizontal / divider di bawah header Low, Normal, dan High <!-- id: 17.4 -->
  - [x] Bersihkan keterangan placeholder 'Tarik tugas ke sini' dari box/border dan perbesar ukuran teks (`text-body-sm`) <!-- id: 17.5 -->
  - [x] Ubah tab switcher List / Grid menjadi pure icon tanpa label teks <!-- id: 17.6 -->
  - [x] Keluarkan filter status tugas dari modal dan jadikan komponen tabs inline (`Semua` vs `Belum Selesai`) pada controls row <!-- id: 17.7 -->
  - [x] Sesuaikan `TodoItemCard` agar berukuran `w-fit max-w-full` (fit-content) <!-- id: 17.8 -->
  - [x] Hilangkan efek bayangan posisi awal, scale, dan transparansi saat drag sehingga komponen diangkat utuh tanpa ghosting <!-- id: 17.9 -->
  - [x] Sembunyikan item sumber seketika saat di-drag (`isHidden` via deferral `setTimeout(..., 0)`) sehingga card hilang dari kolom sumber <!-- id: 17.10 -->
  - [x] Buat custom floating follower 100% solid (tanpa transparansi native browser) via `setDragImage(emptyCanvas)` dan cursor tracking <!-- id: 17.11 -->
  - [x] Verifikasi TypeScript lolos 0 error (`npm.cmd run typecheck`) <!-- id: 17.12 -->

- [x] **Fase 18: Dynamic Multi-Tenant Timezone Architecture** <!-- id: 18 -->
  - [x] Tambahkan kolom `timezone` pada tabel `users` di `src/db/schema.ts`, Better Auth `src/lib/auth.ts`, dan `src/lib/session.ts` <!-- id: 18.1 -->
  - [x] Jalankan migrasi DB untuk menambahkan kolom `timezone` pada tabel `users` di PostgreSQL <!-- id: 18.2 -->
  - [x] Elevasi `src/lib/timezone.ts` menjadi multi-timezone dynamic engine (`formatInUserTz`, `getTimezoneOffsetString`, `isValidTimezone`) <!-- id: 18.3 -->
  - [x] Integrasikan `userTimezone` ke `src/lib/ai/modules/schedule.ts`, `src/lib/ai/batch-organizer.ts`, dan `src/lib/ai/modules/general.ts` <!-- id: 18.4 -->
  - [x] Buat API endpoint `POST /api/user/timezone` dan auto-sync client-side browser timezone <!-- id: 18.5 -->
  - [x] Verifikasi suite pengujian dan typecheck (`npx tsc --noEmit`) lolos 0 error <!-- id: 18.6 -->

- [x] **Fase 19: Finance Mobile Stat Cards Typography & Break-line Layout** <!-- id: 19 -->
  - [x] Kecilkan ukuran font angka rupiah pada card pengeluaran, pemasukan, dan net cash flow di mobile (text-heading-sm sm:text-heading-lg) agar tidak terpotong <!-- id: 19.1 -->
  - [x] Terapkan break line antara label Rp dan angka rupiah (posisi Rp di atas dengan font lebih kecil text-caption-xs sm:text-caption-sm text-mute, angka rupiah di bawah) <!-- id: 19.2 -->
  - [x] Terapkan break line pada kartu Buku Pinjaman (label Piutang dan Utang di atas, nilai nominal di bawahnya dengan teks Rp berukuran lebih kecil) <!-- id: 19.3 -->
  - [x] Verifikasi TypeScript lolos 0 error (npx tsc --noEmit) <!-- id: 19.4 -->

- [x] **Fase 20: Mobile Ask AI Circle Button Beside Search Box & Modal Filter Schedule** <!-- id: 20 -->
  - [x] Perbarui AskAiButton.tsx dengan varian circle (w-10 h-10 rounded-full !border-0) dan ikon Sparkles <!-- id: 20.1 -->
  - [x] Pasang tombol circle Ask AI di samping search box khusus mobile di seluruh 5 halaman (Workspace, Schedule, ToDo, Finance, Bookmarks) <!-- id: 20.2 -->
  - [x] Sembunyikan tombol header Ask AI pada mobile (hidden sm:flex) agar tidak duplikat <!-- id: 20.3 -->
  - [x] Tambahkan varian schedule ke NotesFilterPopover.tsx (opsi Terdekat, Terlewat, Semua Waktu) <!-- id: 20.4 -->
  - [x] Ganti segmented control tab di ScheduleView.tsx dengan tombol filter modal SlidersHorizontal lengkap dengan indikator aktif <!-- id: 20.5 -->
  - [x] Verifikasi TypeScript lolos 0 error (npx tsc --noEmit) <!-- id: 20.6 -->

- [x] **Fase 21: UI/UX Wording Alignment, Hover Softening, & Zero Dead-Zone Hit-Testing** <!-- id: 21 -->
  - [x] Samakan style teks header prioritas desktop dengan style teks tanggal timeline di mobile (`text-xl md:text-body-md font-semibold whitespace-nowrap tracking-tight text-body font-mono`) <!-- id: 21.1 -->
  - [x] Hapus seluruh colored dots (hijau, biru, merah) dari header desktop, baris mobile, dan dock prioritas <!-- id: 21.2 -->
  - [x] Ganti wording prioritas: High $\rightarrow$ Urgent, Normal $\rightarrow$ Chill, Low $\rightarrow$ Low <!-- id: 21.3 -->
  - [x] Turunkan opacity & kontras hover box saat drag (`bg-ink/[0.04] border-dashed border-ink/20 shadow-none`) <!-- id: 21.4 -->
  - [x] Perbaiki hit-testing drop zone (zero dead zones) pada dock mobile, kolom desktop, dan baris mobile via partisi geometri dan tracking offset grip handle <!-- id: 21.5 -->
  - [x] Verifikasi TypeScript lolos 0 error (`npm run typecheck`) <!-- id: 21.6 -->

- [x] **Fase 22: Smart Lightweight Retrieval & Interactive Note Deep-Linking for Ask AI** <!-- id: 22 -->
  - [x] Implementasikan hybrid context retrieval (relevance search + temporal anchors, max 20-25 catatan) di `src/lib/ask.ts` <!-- id: 22.1 -->
  - [x] Injeksi note ID ke format konteks dan instruksikan LLM membuat tautan rujukan `[Teks](note://<id>)` <!-- id: 22.2 -->
  - [x] Pasang markdown link parser khusus `note://<id>` di `src/components/dashboard/AskAiModal.tsx` <!-- id: 22.3 -->
  - [x] Integrasikan `NoteDetailModal` di dalam `AskAiModal.tsx` untuk menampilkan catatan saat link diklik <!-- id: 22.4 -->
  - [x] Buat dan jalankan skrip verifikasi E2E `scripts/test-ask-retrieval.ts` <!-- id: 22.5 -->
  - [x] Verifikasi typecheck (`npx tsc --noEmit`) dan regression test lolos 0 error <!-- id: 22.6 -->

- [x] **Fase 23: Mobile Responsiveness & Zero Horizontal Overflow** <!-- id: 23 -->
  - [x] Perbaiki `SearchPill` di `src/components/ui/Input.tsx` agar menggunakan `wrapperClassName` tanpa memaksakan `w-full`, serta tambahkan `min-w-0` pada wrapper dan elemen `<input>` <!-- id: 23.1 -->
  - [x] Hapus `overflow-x-auto` yang memicu scroller horizontal pada baris kontrol `src/components/dashboard/TodoView.tsx` <!-- id: 23.2 -->
  - [x] Pastikan baris kontrol sticky di semua halaman (`NotesTimeline`, `TodoView`, `FinanceView`, `ScheduleView`, `BookmarksView`, `VaultView`, `AdminDashboard`) memiliki `w-full min-w-0` dan `SearchPill` fleksibel (`flex-1 min-w-0 sm:flex-initial sm:w-72 md:w-80`) <!-- id: 23.3 -->
  - [x] Verifikasi typecheck TypeScript lolos 0 error (`npx tsc --noEmit`) <!-- id: 23.4 -->

- [x] **Fase 24: Finance Content Wrapper Normalization & Range Date Filter** <!-- id: 24 -->
  - [x] Ubah root content wrapper pada FinanceView dari max-w-[1680px] 2xl:max-w-[1760px] menjadi w-full max-w-full agar simetris dengan halaman lain dan tombol Ask Finance rata kanan penuh di desktop <!-- id: 24.1 -->
  - [x] Tambahkan dukungan filter tanggal kustom (date range picker menggunakan RayUI Calendar mode range) pada modal pop-up filter keuangan <!-- id: 24.2 -->
  - [x] Sediakan 3 opsi quick preset: 'Bulan Ini', 'Bulan Lalu', 'Semua', serta sinkronisasi seleksi kalender & tombol Reset <!-- id: 24.3 -->
  - [x] Verifikasi TypeScript lolos 0 error (npx tsc --noEmit) <!-- id: 24.4 -->

- [x] **Fase 25: Comprehensive Mobile Viewport Audit & Zero Touch Pan Invariant** <!-- id: 25 -->
  - [x] Kunci viewport meta tag dengan `maximum-scale=1.0, user-scalable=no, viewport-fit=cover` di `src/layouts/Layout.astro` guna mencegah auto-zoom iOS Safari saat tap input <!-- id: 25.1 -->
  - [x] Ganti `overflow-x: hidden` menjadi `overflow-x: clip; max-width: 100vw; width: 100%; touch-action: pan-y pinch-zoom;` pada `html, body` di `src/styles/global.css` <!-- id: 25.2 -->
  - [x] Terapkan `overflow-x: clip [touch-action:pan-y]` pada elemen `<main>` di seluruh 7 halaman dashboard (.astro) untuk menonaktifkan gesture pan horizontal secara native <!-- id: 25.3 -->
  - [x] Hapus anomali `w-[calc(100%+2rem)]` di `VaultView.tsx` dan hapus redundan `w-full` pada kontainer sticky `-mx-4 px-4` agar lebar sticky tidak terpotong atau melebar <!-- id: 25.4 -->
  - [x] Tambahkan `overflow-hidden` pada `TopProgressBar.astro` dan rapikan `-mr-1` di `Sidebar.tsx` <!-- id: 25.5 -->
  - [x] Uji dan verifikasi touch swipe gesture horizontal di browser Chromium mobile (Edge) dengan data riil user: 0px scroll across all 6 pages <!-- id: 25.6 -->

- [x] **Fase 26: Schedule Notes Dividers Restoration & Fit-Content Width Constraint** <!-- id: 26 -->
  - [x] Hapus kelas `border-0` dan `last:border-b-0` yang meniadakan garis pemisah pada `NoteCard.tsx` (`variant="row"`) sehingga horizontal line divider (`border-b border-hairline`) tampil konsisten <!-- id: 26.1 -->
  - [x] Ubah kontainer catatan pada `ScheduleView.tsx` dari `w-full` menjadi `w-fit max-w-full sm:max-w-3xl xl:max-w-4xl min-w-[280px] sm:min-w-[320px]` agar tidak melebar penuh ke kanan layar desktop dan lebarnya pas mengikuti konten (`fit-content`) <!-- id: 26.2 -->
  - [x] Tambahkan `max-w-full` pada kartu row di `NoteCard.tsx` untuk menjaga integritas pembungkusan teks tanpa overflow di mobile <!-- id: 26.3 -->
  - [x] Jalankan verifikasi TypeScript (`npx tsc --noEmit`) lolos 0 error <!-- id: 26.4 -->

- [x] **Fase 27: Fix Blank White Screen Crash on NotesFilterPopover (React Rules of Hooks Invariant)** <!-- id: 27 -->
  - [x] Identifikasi penyebab crash fatal blank white screen: `useMemo` hook `financeDateRange` dipanggil setelah early return `if (!isOpen || !mounted) return null;` di `src/components/dashboard/NotesFilterPopover.tsx` <!-- id: 27.1 -->
  - [x] Pindahkan hook `financeDateRange` ke atas bersama derived hook lainnya sebelum early return agar dipanggil secara konsisten tanpa syarat pada setiap render <!-- id: 27.2 -->
  - [x] Jalankan verifikasi statis TypeScript (`npx tsc --noEmit`) lolos 0 error <!-- id: 27.3 -->
  - [x] Uji klik tombol filter di semua halaman (`/dashboard`, `/schedule`, `/todo`, `/finance`, `/bookmarks`) via Edge headless CDP: 0 uncaught exception & modal terbuka sempurna <!-- id: 27.4 -->
- [x] **Fase 27: Schedule Target Date Past-Date Gating, Recurrence Tabs, & Dialog Actions** <!-- id: 27 -->
  - [x] Kunci datepicker target date di `NewScheduleModal.tsx` dengan `disabled={{ before: startOfToday() }}` dan default fallback `today` agar user tidak bisa memilih tanggal di masa lalu <!-- id: 27.1 -->
  - [x] Tambahkan komponen tabs option seragam (`bg-surface-soft rounded-full p-1`) tepat di bawah kalender datepicker dengan 3 opsi: `Sekali`, `Setiap Minggu`, dan `Setiap Bulan` <!-- id: 27.2 -->
  - [x] Terapkan proyeksi visual reaktif pada kalender: saat memilih Setiap Minggu, seluruh hari yang sama di minggu-minggu berikutnya ditandai; saat memilih Setiap Bulan, tanggal yang sama di bulan-bulan berikutnya ditandai <!-- id: 27.3 -->
  - [x] Sediakan tombol `Batal` (pure text tanpa background, border, atau box) dan tombol `Selesai` di bagian paling bawah dialog datepicker <!-- id: 27.4 -->
  - [x] Sambungkan payload `recurrenceRule` (`weekly` / `monthly`) dan `isRecurring` ke API `POST /api/notes` serta mapping visual `scheduleMap` di `ScheduleView.tsx` <!-- id: 27.5 -->
  - [x] Jalankan verifikasi TypeScript (`npx tsc --noEmit`) dan automated logic test lolos 0 error <!-- id: 27.6 -->

- [x] **Fase 28: ToDo Time Horizon Architecture (Inbox, Now, Soon, Later), Context Chips, Mini Link, Quick Input, & AI Rule** <!-- id: 28 -->
  - [x] Transformasi kolom ToDo desktop dan baris mobile menjadi Time Horizon: `Inbox` $\rightarrow$ `Now` $\rightarrow$ `Soon` $\rightarrow$ `Later` <!-- id: 28.1 -->
  - [x] Perbarui Mobile Floating Priority Drop Dock menjadi 4 tombol: `Now` · `Soon` · `Later` · `Inbox` <!-- id: 28.2 -->
  - [x] Tampilkan Parent Context Chip (`#tag` atau nama topik induk) pada `TodoItemCard` jika tugas berasal dari multi-item note <!-- id: 28.3 -->
  - [x] Sematkan Direct Mini Link Icon (`Link2`) di samping task jika tugas/catatan mengandung URL web eksternal <!-- id: 28.4 -->
  - [x] Tambahkan Quick In-Place Task Input di atas kanban (input single-line + Enter langsung ke Inbox) <!-- id: 28.5 -->
  - [x] Perkuat aturan AI di `batch-organizer.ts` dengan prinsip Action-Verb Dominance (`todo` vs `bookmark`) <!-- id: 28.6 -->
  - [x] Verifikasi TypeScript lolos 0 error (`npm run typecheck`) <!-- id: 28.7 -->

- [x] **Fase 29: New Schedule Modal Embedded 2-Column Responsive Redesign (Zero-Popup Date Picker & Recurrence)** <!-- id: 29 -->
  - [x] Hapus secondary dialog pop-up (`isDatePickerOpen`) dan tombol redundan `+ Target Date` pada baris tag di `NewScheduleModal.tsx` <!-- id: 29.1 -->
  - [x] Integrasikan date picker (`Calendar`) dan opsi rutinitas (`Sekali`, `Setiap Minggu`, `Setiap Bulan`) langsung ke dalam modal jadwal <!-- id: 29.2 -->
  - [x] Terapkan layout responsif 2-kolom berdampingan pada layar desktop (kiri: input catatan, lampiran, tag; kanan: kalender + opsi rutinitas) dan vertikal bertumpuk pada layar mobile <!-- id: 29.3 -->
  - [x] Posisikan tombol aksi `Batal` (teks tanpa border/outline) dan `Selesai` (tombol pill primer) berdampingan di bagian bawah modal <!-- id: 29.4 -->
  - [x] Jalankan verifikasi TypeScript (`npx tsc --noEmit`) lolos 0 error <!-- id: 29.5 -->

- [x] **Fase 30: Bookmark Platform TOC Style Normalization & Sleek Active Underline** <!-- id: 30 -->
  - [x] Samakan style items TOC Platform dengan TOC Kategori di `BookmarksView.tsx`: gunakan `py-1.5 px-3 rounded-full text-body-sm font-normal text-body hover:text-ink hover:bg-surface-soft !border-0` <!-- id: 30.1 -->
  - [x] Sesuaikan highlight aktif agar tidak terlalu tebal: ubah teks dari `font-semibold` menjadi `font-medium text-ink` <!-- id: 30.2 -->
  - [x] Sesuaikan garis bawah aktif agar tidak tebal: ganti border solid 2px (`border-b-2`) menjadi hairline underline tipis 1px (`underline underline-offset-4 decoration-1`) pada teks label platform <!-- id: 30.3 -->
  - [x] Jalankan verifikasi statis TypeScript (`npx tsc --noEmit`) lolos 0 error <!-- id: 30.4 -->

- [x] **Fase 31: QuickComposerModal Schedule Harmonization & Zero-Popup Dynamic Integration** <!-- id: 31 -->
  - [x] Hapus secondary dialog pop-up (`isDatePickerOpen`) dan tombol `+ Target Date` pada `QuickComposerModal.tsx` <!-- id: 31.1 -->
  - [x] Integrasikan date picker dan opsi rutinitas (`Sekali`, `Setiap Minggu`, `Setiap Bulan`) secara reaktif saat dropdown kategori dipilih `schedule` <!-- id: 31.2 -->
  - [x] Terapkan layout responsif 2-kolom dinamis di desktop dan bertumpuk di mobile saat `category === 'schedule'` <!-- id: 31.3 -->
  - [x] Satukan tombol aksi bawah: `Batal` dan `Simpan` berdampingan di pojok kanan bawah modal <!-- id: 31.4 -->
  - [x] Jalankan verifikasi TypeScript (`npx tsc --noEmit`) lolos 0 error <!-- id: 31.5 -->

- [x] **Fase 32: Todo Desktop Full-Height Vertical Dividers & Mobile Drag Auto-Scroll Engine** <!-- id: 32 -->
  - [x] Rentangkan vertical dividers dan 4 kolom kanban desktop ke dasar viewport (`min-h-full flex-1 flex items-stretch`, hapus `my-1` pada pembatas) <!-- id: 32.1 -->
  - [x] Bangun continuous auto-scroll engine berbasis `requestAnimationFrame` pada `TodoView.tsx` dengan target elemen scroll aktif (`main`) <!-- id: 32.2 -->
  - [x] Implementasikan deteksi zona tepi atas dan bawah layar saat drag kartu dengan kalkulasi akselerasi kecepatan adaptif (4px–20px/frame) <!-- id: 32.3 -->
  - [x] Sinkronkan evaluasi geometri drop zone secara dinamis saat konten bergulir di bawah posisi jari/kursor <!-- id: 32.4 -->
  - [x] Jalankan verifikasi statis TypeScript (`npx tsc --noEmit`) dan automated test suite lolos 0 error <!-- id: 32.5 -->

- [x] **Fase 33: Modal Styling Clean-up & Seamless Canvas Normalization** <!-- id: 33 -->
  - [x] Hapus horizontal line/divider atas dan bawah (`border-b`, `border-t`, dan `border` luar) pada `NewScheduleModal.tsx` dan `QuickComposerModal.tsx` agar seamless seperti modal lain (`NewTodoModal`, `NoteDetailModal`) <!-- id: 33.1 -->
  - [x] Pertahankan divider vertikal (`border-l border-hairline`) pemisah komponen date picker dan input catatan <!-- id: 33.2 -->
  - [x] Hapus teks header keterangan tanggal pada sisi kanan komponen date picker <!-- id: 33.3 -->
  - [x] Hapus teks keterangan dinamis di bawah tabs opsi rutinitas (`Sekali`, `Setiap Minggu`, `Setiap Bulan`) <!-- id: 33.4 -->
  - [x] Pastikan invalidasi cache modul Vite dev server bersih (0 `+ Target Date`) dan verifikasi TypeScript lolos 0 error <!-- id: 33.5 -->

- [x] **Fase 33: Bookmark Attachment Link Truncation & Card Height Normalization in NoteDetailModal** <!-- id: 33 -->
  - [x] Tambahkan helper `formatTruncatedUrl(url, maxLength)` di `NoteDetailModal.tsx` untuk membersihkan skema (`https://`, `www.`) dan memotong link panjang ke maksimal 36 karakter <!-- id: 33.1 -->
  - [x] Ganti `line-clamp-2 break-all block` menjadi single-line `truncate block mt-0.5` pada teks URL card attachment agar tidak membungkus ke baris baru <!-- id: 33.2 -->
  - [x] Sematkan atribut `title={linkUrl}` pada tautan dan teks URL agar URL lengkap tetap terbaca saat di-hover <!-- id: 33.3 -->
  - [x] Gunakan `getLinkTitle(linkUrl, currentMeta)` untuk menampilkan judul meta artikel jika tersedia <!-- id: 33.4 -->
  - [x] Jalankan verifikasi statis TypeScript (`npx tsc --noEmit`) lolos 0 error <!-- id: 33.5 -->

- [x] **Fase 34: Mobile Todo Drag-and-Drop Dock Removal & Streamlined Row Reordering** <!-- id: 34 -->
  - [x] Hapus komponen Mobile Floating Priority Drop Dock (`[data-mobile-dock]`) dan JSX target drop-nya di `TodoView.tsx` <!-- id: 34.1 -->
  - [x] Bersihkan logika hit-testing dock di `getZoneUnderPoint` agar sepenuhnya mengandalkan auto-scroll vertikal dan deteksi baris kanban mobile (`data-mobile-row`) <!-- id: 34.2 -->
  - [x] Standarisasi Input Tambah Tugas Cepat di `TodoView.tsx`: hilangkan wording "(Enter)", hapus badge "Enter", dan samakan ukuran serta height-nya dengan SearchPill (`h-10 rounded-full pl-10 pr-4`) <!-- id: 34.3 -->
  - [x] Jalankan verifikasi TypeScript (`npx tsc --noEmit`) dan automated test suite lolos 0 error <!-- id: 34.4 -->

- [x] **Fase 35: Dynamic Platform & Category TOC with Zero-Count Gating, 13 Macro Taxonomies, and Unified Styling** <!-- id: 35 -->
  - [x] Perluas skema `BookmarkType` di `src/db/schema.ts` menjadi 13 taksonomi makro komprehensif (`tech_dev`, `design_creative`, `tools_utility`, `finance_investment`, `health_fitness`, `lifestyle_hobbies`, `media_social`, `work_docs`, `education_research`, `audio_entertainment`, `places`, `shopping`, `reading_other`) <!-- id: 35.1 -->
  - [x] Buat modul canonical platform resolver `resolveBookmarkPlatform` di `src/lib/platform-icons.tsx` yang mengekstrak platform dari kombinasi `source` LLM, `specificTags`, dan domain URL dengan SVG icons lengkap (YouTube, GitHub, X/Twitter, Instagram, TikTok, Spotify, Figma, Reddit, Medium, LinkedIn, Threads, Google Maps, Google Docs) <!-- id: 35.2 -->
  - [x] Bangun Dynamic Platform TOC di `BookmarksView.tsx`: agregasi dinamis dari catatan yang ada, zero-count gating (tidak menampilkan platform dengan jumlah 0), sort descending by count, dan auto-reset filter platform jika count menjadi 0 <!-- id: 35.3 -->
  - [x] Terapkan zero-count gating pada Category TOC di `BookmarksView.tsx`: hanya menampilkan kategori yang memiliki catatan aktif (`count > 0`) <!-- id: 35.4 -->
  - [x] Harmonisasi visual TOC: samakan typography, padding (`py-1.5 px-3 rounded-full text-body-sm font-normal`), hover state, active text (`text-ink font-medium`), dan hairline underline (`underline underline-offset-4 decoration-1`) pada Platform TOC dan Category TOC <!-- id: 35.5 -->
  - [x] Hubungkan `BookmarkFilterModal.tsx` dengan daftar dinamis `availablePlatforms` dan `availableCategories` dari `BookmarksView` <!-- id: 35.6 -->
  - [x] Sinkronkan normalisasi prompt AI di `src/lib/ai/batch-organizer.ts` dan `src/lib/ai/modules/general.ts` agar mendukung 13 kategori makro dan ekstraksi `source` platform <!-- id: 35.7 -->
  - [x] Jalankan verifikasi statis TypeScript (`cmd /c npx tsc --noEmit`) lolos 0 error <!-- id: 35.8 -->

- [x] **Fase 36: Finance View UI/UX Consistency, Table Divider Removal & Minimum Height Normalization** <!-- id: 36 -->
  - [x] Hapus border pemisah (`border-b border-hairline`) antara thead header tabel dan body isi tabel pada seluruh 4 tabel keuangan (Pengeluaran, Pemasukan, Piutang, Utang) <!-- id: 36.1 -->
  - [x] Terapkan container card `min-h-[300px] sm:min-h-[340px]` pada seluruh 4 tabel baik yang berisi data maupun kosong agar tinggi kartu seragam dan elegan <!-- id: 36.2 -->
  - [x] Pastikan baris data isi tabel tetap compact (`py-2.5 px-3`) di bagian atas tanpa pemaksaan stretch row vertikal (tabel tanpa `h-full`), serta empty state cell terpusat vertikal (`h-60 sm:h-72 align-middle`) <!-- id: 36.3 -->
  - [x] Harmonisasi ukuran typography dan komponen di `FinanceView.tsx`: standarisasi tabel ke `text-body-sm`, sub-heading tabel ke `text-body-sm font-semibold`, stat cards ke `min-h-[120px]`, dan chart card ke `h-56` dengan tabs `px-3 py-1 text-caption-sm` <!-- id: 36.4 -->
  - [x] Standarisasi FAB Catat Keuangan ke style pill global (`fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-40 w-14 h-14 sm:w-auto sm:h-auto p-0 sm:py-3 sm:px-6 rounded-full bg-canvas text-ink border border-hairline shadow-md`) <!-- id: 36.5 -->
  - [x] Jalankan verifikasi TypeScript (`npx tsc --noEmit`) dan automated test suite lolos 0 error <!-- id: 36.6 -->

- [x] **Fase 37: Finance Filter "Minggu Ini" & Telegram Bot /finance Report Command** <!-- id: 37 -->
  - [x] Update `NotesFilterPopover.tsx`: tambahkan `'this_week'` pada `FinanceDateRangeType`, kalkulasi date range `startOfWeek` & `endOfWeek`, dan sediakan tombol preset "Minggu Ini" pada grid quick presets <!-- id: 37.1 -->
  - [x] Update `FinanceView.tsx`: impor `isThisWeek` dari `date-fns` dan tangani `dateFilter.dateRange === 'this_week'` pada `matchesDateFilter` <!-- id: 37.2 -->
  - [x] Implementasikan `handleFinanceCommand` di `src/lib/telegram-handler.ts`: agregasi keuangan 4 periode (Hari Ini, Minggu Ini, Bulan Ini, Bulan Lalu) mencakup pemasukan, pengeluaran, utang, dan piutang <!-- id: 37.3 -->
  - [x] Daftarkan command `/finance` (dan `/fn`, `/keuangan`) di router `processTelegramMessage`, handler callback `menu:finance`, daftar `help` di `src/lib/i18n/telegram.ts`, serta `setMyCommands` di `scripts/bot-polling.ts` <!-- id: 37.4 -->
  - [x] Buat skrip automated test `scripts/test-telegram-finance.ts` untuk memverifikasi kalkulasi transaksi & respon bot Telegram <!-- id: 37.5 -->
  - [x] Jalankan verifikasi statis TypeScript (`npx tsc --noEmit`) dan automated test suite lolos 0 error <!-- id: 37.6 -->

- [x] **Fase 38: Credential First-Principles 5-Pillar Taxonomy & UI/UX Normalization** <!-- id: 38 -->
  - [x] Terapkan 5 pilar ontologis kredensial di `src/db/schema.ts`: `digital_access`, `civil_identity`, `financial_instrument`, `cryptographic_token`, `physical_access`, `other` <!-- id: 38.1 -->
  - [x] Perbarui `normalizeCredentialType` di `src/lib/ai/modules/general.ts` dan system prompt di `src/lib/ai/batch-organizer.ts` agar mendukung pemetaan 5 pilar secara backward-compatible <!-- id: 38.2 -->
  - [x] Harmonisasi visual TOC Credential di `VaultView.tsx`: typography `py-1.5 px-3 rounded-full text-body-sm font-normal`, active text `text-ink font-medium`, dan hairline underline (`underline underline-offset-4 decoration-1`), hapus styling background hitam pill <!-- id: 38.3 -->
  - [x] Sembunyikan TOC horizontal bar di mobile (`hidden sm:block`) pada `VaultView.tsx` untuk mengeliminasi potensi horizontal scroller dan clutter layar kecil <!-- id: 38.4 -->
  - [x] Jalankan verifikasi statis TypeScript (`cmd /c npx tsc --noEmit`) dan automated test suite (42/42 skenario) lolos 0 error <!-- id: 38.5 -->

- [x] **Fase 40: Telegram Command Clean-up (Eliminate Indonesian Aliases, Prune Zombie Commands, and Decouple /sync vs /sync_all)** <!-- id: 40 -->
  - [x] Implementasikan `handleSingleSyncCommand` di `src/lib/telegram-handler.ts` untuk sinkronisasi AI pada 1 catatan tunggal (single note AI sync) <!-- id: 40.1 -->
  - [x] Pisahkan routing `/sync_all` (batch organize) dan `/sync` (single note sync) di `processTelegramMessage` <!-- id: 40.2 -->
  - [x] Bersihkan alias bahasa Indonesia (`/keuangan`, `/jadwal`, `/rapikan`, `🪄 Rapikan`) di router `telegram-handler.ts` <!-- id: 40.3 -->
  - [x] Bersihkan command zombie (`/close`, `/hide`, `/reset`, `❌ Tutup Menu`, `/dock`, `/menu`) dari `telegram-handler.ts` <!-- id: 40.4 -->
  - [x] Pertahankan seluruh tombol UI teks (`📖 Read`, `🏷 Tags`, `⭐️ Pin`, `⭐ Pin`, `📋 Review`, `Review`, `🔄 Sync`, `Sync`, `🪄 Organize`) dan inline buttons/callbacks <!-- id: 40.5 -->
  - [x] Perbarui `setMyCommands` di `scripts/bot-polling.ts` dan panduan `/help` di `src/lib/i18n/telegram.ts` (ID & EN) <!-- id: 40.6 -->
  - [x] Buat skrip automated test `scripts/test-telegram-sync-commands.ts` untuk memverifikasi fungsionalitas `/sync` vs `/sync_all` serta kebersihan alias <!-- id: 40.7 -->
  - [x] Jalankan verifikasi statis TypeScript (`cmd /c npx tsc --noEmit`) dan automated test suite lolos 0 error <!-- id: 40.8 -->

- [x] **Fase 41: Pure LLM Dynamic Domain Taxonomy & Heuristic Elimination** <!-- id: 41 -->
  - [x] Decommission pemindaian regex lokal di `src/lib/ai/taxonomy/index.ts` (`extractTagsFromContent` mengembalikan array kosong `[]`) <!-- id: 41.1 -->
  - [x] Bersihkan injeksi tag heuristik di `src/lib/ai/sanitizer.ts`: hapus paksaan regex `/belajar|study/` & `/ujian|exam/` serta pemanggilan `extractTagsFromContent` untuk kredensial <!-- id: 41.2 -->
  - [x] Perluas skema `BookmarkType` dan `CredentialType` di `src/db/schema.ts` dengan tipe terbuka `| (string & {})` agar mendukung domain dinamis tanpa melanggar typecheck <!-- id: 41.3 -->
  - [x] Perbarui `normalizeBookmarkType` di `src/lib/ai/modules/general.ts` dan system prompt di `batch-organizer.ts` & `general.ts`: pertahankan domain dinamis baru dari LLM (`culinary`, `astronomy`, `legal`, `gaming`, dsb.) tanpa dipaksa turun ke `reading_other` <!-- id: 41.4 -->
  - [x] Bangun Category TOC dan seksi kurasi dinamis di `BookmarksView.tsx`: agregasi dinamis langsung dari bookmark aktual user, formatting judul dinamis via `formatBookmarkTypeTitle`, dan zero-count gating <!-- id: 41.5 -->
  - [x] Sinkronkan `BookmarkFilterModal.tsx` dengan daftar dinamis `allAvailableCategories` yang diekstrak dari catatan bookmark user <!-- id: 41.6 -->
  - [x] Jalankan verifikasi statis TypeScript (`cmd /c npx tsc --noEmit`) dan automated test suite (`scripts/test-dynamic-taxonomy.ts`) lolos 0 error <!-- id: 41.7 -->

- [x] **Fase 42: Admin Panel Statistics Filter & Responsive Layout Proportions** <!-- id: 42 -->
  - [x] Tambahkan `variant="admin_stats"` pada `NotesFilterPopover.tsx` (opsi preset: Hari Ini, Minggu Ini, Bulan Ini, Semua, serta Calendar mode range date) <!-- id: 42.1 -->
  - [x] Perbaiki bug tombol "Rentang Tanggal" yang tidak memicu modal (pindahkan `adminStatsDateRange` `useMemo` sebelum early return `if (!isOpen || !mounted)` agar mematuhi React Rules of Hooks) <!-- id: 42.1b -->
  - [x] Teruskan `rawNotes`, `rawPayments`, dan `rawAiLogs` dari `src/pages/admin/index.astro` ke `AdminDashboard.tsx` untuk reaktifitas kalkulasi filter statistik di sisi klien <!-- id: 42.2 -->
  - [x] Bangun filter toolbar interaktif di `AdminDashboard.tsx`: pill presets periode dan tombol trigger date range diposisikan bersebelahan (inline-flex) dengan tinggi seragam `h-10` <!-- id: 42.3 -->
  - [x] Sinkronkan kalkulasi dinamis `activeMetrics` (Ringkasan Platform) dan `activeGraphData` (Grafik Aktivitas) berdasarkan rentang tanggal aktif <!-- id: 42.4 -->
  - [x] Sesuaikan proporsi Grafik Aktivitas: perkecil max-width menjadi proporsional `max-w-5xl sm:max-w-6xl` dengan grid 2-kolom (`grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5`) dan chart height `h-56 sm:h-64` <!-- id: 42.5 -->
  - [x] Perbesar sedikit ukuran kartu Ringkasan Platform (`p-5 sm:p-5.5`, `min-h-[135px] sm:min-h-[142px]`, `text-heading-xl sm:text-display-xs`) dengan `max-w-5xl sm:max-w-6xl` yang konsisten <!-- id: 42.6 -->
  - [x] Jalankan verifikasi statis TypeScript (`cmd /c npx tsc --noEmit`) dan automated tests lolos 0 error <!-- id: 42.7 -->

- [x] **Fase 44: Fix Vault & Credential Tab Switching, Dynamic TOC Scroll & Client Hydration** <!-- id: 44 -->
  - [x] Isolasi modul `src/lib/credential-types.ts` agar pure client-safe tanpa menarik dependensi server (`ai`, `@/db`, `node:crypto`) ke browser bundle `VaultView.tsx` <!-- id: 44.1 -->
  - [x] Re-export `normalizeCredentialType` dari `src/lib/credential-types.ts` di `src/lib/ai/modules/general.ts` <!-- id: 44.2 -->
  - [x] Perbaiki serialisasi `vault.astro`: sertakan `credentialType: n.credentialType` dan query notes dengan `isNotNull(notes.vaultKey)` <!-- id: 44.3 -->
  - [x] Sinkronkan query param URL pada tab switching (`?tab=credential` vs `?tab=vault`) di `VaultView.tsx` <!-- id: 44.4 -->
  - [x] Implementasikan ref container scrolling `scrollContainerRef` dan perbaiki `handleTocClick` serta `IntersectionObserver` agar tidak terjebak di `section-all` <!-- id: 44.5 -->
  - [x] Bangun TOC dan seksi kurasi kredensial dinamis (Pure AI semantic types) matching BookmarksView <!-- id: 44.6 -->
  - [x] Verifikasi TypeScript lolos 0 error (`cmd /c npx tsc --noEmit`) dan Astro check (`cmd /c npx astro check`) <!-- id: 44.7 -->

- [x] **Fase 45: Pure LLM Intent Taxonomy Hardening & Tricky Edge Case Benchmark** <!-- id: 45 -->
  - [x] Selaraskan kembali definisi semantik `random-yap` (memuat raw ideas, brainstorming, shower thoughts, musings) dan bersihkan frasa jebakan `multi-idea` dari `others` di `general.ts` dan `batch-organizer.ts` <!-- id: 45.1 -->
  - [x] Tambahkan aturan eksplisit pada `DISAMBIGUATION HEURISTICS` untuk membedakan ide mentah vs referensi faktual vs kredensial vs tugas <!-- id: 45.2 -->
  - [x] Perluas kamus `normalizeCategory` dengan padanan `idea`, `ideas`, `ide`, `brainstorm`, `brainstorming` ke dalam bucket `random-yap` <!-- id: 45.3 -->
  - [x] Bangun skrip benchmark komparasi 14 edge cases paling sulit lintas 9 pilar di `scripts/test-model-comparison.ts` <!-- id: 45.4 -->
  - [x] Jalankan uji komparasi Gemini-3.8-Flash vs Claude-Haiku-5.5 (Hasil: 14/14 atau 100% konsisten pada kedua model) <!-- id: 45.5 -->
  - [x] Verifikasi TypeScript lolos 0 error (`cmd /c npx tsc --noEmit`) <!-- id: 45.6 -->










