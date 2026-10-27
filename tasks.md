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
