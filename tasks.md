# Implementation Tasks: Ollama Design System Migration & Dashboard Wireframe

## Phase 1: Design Tokens Extraction (Step 1) <!-- id: 0 -->
- [x] Analyze `ollama.design.md` and current Tailwind v4 CSS setup <!-- id: 1 -->
- [x] Extract all tokens (colors, typography, rounded, spacing) into `src/styles/global.css` using Tailwind v4 `@theme` and `@utility` <!-- id: 2 -->
- [x] Create TypeScript design tokens mapping in `src/lib/design-tokens.ts` for type-safe programmatic access <!-- id: 3 -->
- [x] Verify Tailwind v4 compilation and run `npm run typecheck` <!-- id: 4 -->

## Phase 2: Base Components Definition (Step 2 - Completed) <!-- id: 5 -->
- [x] Create base button components (`Button`) <!-- id: 6 -->
- [x] Create input components (`TextInput`, `SearchPill`) <!-- id: 7 -->
- [x] Create terminal & snippet components (`InstallSnippet`, `CommandTag`, `TerminalCard`, `TerminalTrafficLights`) <!-- id: 8 -->
- [x] Create card & layout components (`PricingCard`, `PricingCardDark`, `CtaStripDark`, `FaqRow`, `FeatureBullet`, `PrimaryNav`, `FooterSection`) <!-- id: 9 -->
- [x] Export all from `src/components/ui/index.ts` <!-- id: 16 -->
- [x] Run typecheck to verify component contracts <!-- id: 17 -->

## Phase 3: Page Refactoring (Step 3 - Completed) <!-- id: 10 -->
- [x] Refactor Layout (`src/layouts/Layout.astro`) to clean canvas and paper-white architecture <!-- id: 12 -->
- [x] Refactor Landing Page (`src/components/landing/LandingPage.tsx`) with Ollama components <!-- id: 11 -->
- [x] Refactor Dashboard views (`src/components/dashboard/*`) <!-- id: 13 -->
- [x] Refactor Auth/Login (`src/pages/login.astro`) and Checkout simulator <!-- id: 14 -->
- [x] Refactor Admin console (`src/components/admin/AdminDashboard.tsx`) <!-- id: 18 -->
- [x] Final validation & verification (`tsc --noEmit` & `astro check` passed with 0 errors) <!-- id: 15 -->

## Phase 4: Audit & Bug Fixes <!-- id: 19 -->
- [x] Audit collapsed component root cause: Tailwind v4 `@theme` `--spacing-*` collision overriding `--container-*` scale (`max-w-sm` was collapsing to `8px`) <!-- id: 20 -->
- [x] Moved `--spacing-*` tokens to `:root` in `src/styles/global.css` to restore default container widths <!-- id: 21 -->
- [x] Verified compilation output: `max-w-xs`, `max-w-sm`, `max-w-md`, `max-w-lg`, `max-w-xl` now resolve correctly to `var(--container-*)` <!-- id: 22 -->
- [x] Verified zero errors with `npm run typecheck` and `npx astro check` <!-- id: 23 -->

## Phase 5: Impeccable Enhancement & Antislop Pass <!-- id: 24 -->
- [x] Ran `impeccable.cmd context` and audited against Craft Floor principles <!-- id: 25 -->
- [x] Eliminated kicker/eyebrow above landing headline (anti-slop rule: heading carries its own weight) <!-- id: 26 -->
- [x] Replaced nested bordered cards in terminal showcase and private vault with authentic prompt sessions and recessed surfaces <!-- id: 27 -->
- [x] Enhanced browser surfaces: custom minimal hairline scrollbars, text selection theme, caret coloring, and focus-visible rings <!-- id: 28 -->
- [x] Added `tabular-nums` across all counters, dates, pricing tiers, and admin metrics to eliminate numeral jitter <!-- id: 29 -->
- [x] Enforced WCAG AA compliant contrast for placeholders and disabled buttons (`opacity-65` with neutral surface and readable text) <!-- id: 30 -->
- [x] Added tactile micro-interactions (`active:scale-[0.99]`) and keyboard focus outlines <!-- id: 31 -->
- [x] Ran mechanical detector (`impeccable detect --json` -> `[]` 0 defects) and validated TypeScript (`tsc --noEmit` -> 0 errors) <!-- id: 32 -->

## Phase 6: Sidebar & Content Space Pages Implementation (Wireframe Alignment) <!-- id: 33 -->
- [x] Create `TodoView.tsx` and `src/pages/dashboard/todo.astro` for dedicated To Do checklist page <!-- id: 34 -->
- [x] Create `ScheduleView.tsx` and `src/pages/dashboard/schedule.astro` for dedicated Schedule calendar/agenda page <!-- id: 48 -->
- [x] Create `VaultView.tsx` and `src/pages/dashboard/vault.astro` for Vault & Credentials content space <!-- id: 35 -->
- [x] Implement AES-256-GCM encryption on create in `/api/notes` for Vault notes <!-- id: 36 -->
- [x] Re-architect `Sidebar.tsx` to separate To Do (`/dashboard/todo`) and Schedule (`/dashboard/schedule`) in navigation <!-- id: 37 -->
- [x] Implement Connect/Open Telegram Bot action button and Quick Connect dialog <!-- id: 38 -->
- [x] Implement Profile Card component with Upgrade button (Free plan), Pro badge, and click-to-settings navigation <!-- id: 39 -->
- [x] Connect Telegram bot status & raw API key props across all dashboard pages (`/dashboard`, `/dashboard/todo`, `/dashboard/schedule`, `/dashboard/bookmarks`, `/dashboard/vault`, `/dashboard/settings`) <!-- id: 40 -->
- [x] Verify complete type safety (`npm run typecheck` -> 0 errors) and Astro diagnostics (`astro check` -> 0 errors) <!-- id: 41 -->

## Phase 7: UI/UX Dashboard All Notes Wireframe Implementation <!-- id: 42 -->
- [x] Buat implementation plan artifact dan konfirmasi arsitektur <!-- id: 43 -->
- [x] Buat API endpoint `/api/notes/enhance.ts` untuk AI enhance text <!-- id: 44 -->
- [x] Perbarui query filter di `/api/notes/index.ts` untuk multi-category dan uncategorized support <!-- id: 45 -->
- [x] Buat komponen `NotesFilterPopover.tsx` sesuai wireframe (Date all-time/custom range, multi-select category, radio uncategorized, apply button) <!-- id: 46 -->
- [x] Perbarui `NotesTimeline.tsx` sesuai wireframe (Top searchbox + filter toggle, `[username] Workspace`, empty state Hubungkan Telegram, bottom docked composer dengan diamond AI enhance & send button) <!-- id: 47 -->
- [x] Perbarui `src/pages/dashboard/index.astro` untuk inject `userName`, Telegram connection status & connect URL <!-- id: 48 -->
- [x] Verifikasi typecheck TypeScript (`npx tsc --noEmit`) dan Astro diagnostics (`astro check`) dengan 0 error <!-- id: 49 -->

## Phase 8: Schedule Page Wireframe Slicing (Calendar Mapped + Horizontal Scroll Notes) <!-- id: 50 -->
- [x] Buat implementation plan artifact untuk analisis wireframe Schedule <!-- id: 51 -->
- [x] Perbarui `src/pages/dashboard/schedule.astro` untuk meneruskan field `isPinned` <!-- id: 52 -->
- [x] Implementasikan `ScheduleView.tsx` dengan komponen:
  - Header: judul Schedule & search/filter bar
  - Card Kalender Bulanan: grid 7 kolom, navigasi bulan, highlighting tanggal berjadwal (mapped schedule dots/badges)
  - Bottom Track: tombol `+` New Schedule & horizontal scrolling schedule cards
  - Card Jadwal: pin toggle, delete button, date badge, click to open detail/modal
  - Modal Create / Detail Schedule
- [x] Validasi typecheck TypeScript (`npm run typecheck`) dan Astro diagnostics (`astro check`) dengan 0 error <!-- id: 53 -->

## Phase 9: Vault & Credentials Wireframe Slicing (Split Navigation, Pinned, Grouped Grids) <!-- id: 54 -->
- [x] Buat implementation plan artifact untuk analisis wireframe Vault & Credentials <!-- id: 55 -->
- [x] Perbarui `src/pages/dashboard/vault.astro` untuk serialisasi `isPinned` <!-- id: 56 -->
- [x] Implementasikan `VaultView.tsx` sesuai wireframe:
  - Header: judul Vault & Credentials dan search pill
  - Layout Split-View: Kolom navigasi kategori di kiri (Bank, Crypto Wallet, Gmail, Instagram, dll) dengan divider vertikal
  - Kolom konten kanan:
    - Section Pinned (grid kartu tersemat)
    - Tombol / Card `+` New Credentials
    - Section terkelompok per kategori (Bank, Crypto Wallet, Gmail, dll)
  - Desain Card Kredensial: Label / Key, tombol pin & delete, secret box masking `••••••`, reveal/hide on-demand decryption, salin 1-klik
  - Modal pembuatan kredensial baru dengan pemilihan grup/kategori
- [x] Validasi typecheck TypeScript (`npm run typecheck`) dan Astro diagnostics (`astro check`) dengan 0 error <!-- id: 57 -->



## Phase 8: Workspace Timeline & Note Detail Modal (Already Added Some Notes Wireframe) <!-- id: 50 -->
- [x] Saring dan sembunyikan catatan kredensial dari Workspace (`Credentials not showed!`) di `src/pages/dashboard/index.astro` dan `NotesTimeline.tsx` <!-- id: 51 -->
- [x] Implementasi timeline vertical axis track: section `Pinned` di posisi teratas dan grup tanggal (e.g. `Sat, 18 oct`, `Fri, 17 oct`) <!-- id: 52 -->
- [x] Perbarui kartu catatan `NoteCard.tsx` dengan badge kategori, konten terpangkas (truncated ~3 baris), tombol Pin & Delete interaktif, dan klik untuk membuka detail <!-- id: 53 -->
- [x] Implementasi endpoint `PATCH /api/notes/[id].ts` untuk dukungan toggle `isPinned` <!-- id: 54 -->
- [x] Buat komponen `NoteDetailModal.tsx` sesuai wireframe (header `date & time` + close button, isi catatan lengkap, preview lampiran/tautan embed, tags, dan action buttons Pin, Edit, Delete) <!-- id: 55 -->
- [x] Verifikasi typecheck TypeScript (`npx tsc --noEmit`) dan Astro diagnostics (`astro check`) dengan 0 error <!-- id: 56 -->

## Phase 9: Workspace Composer Popup & Dynamic Slicing Update <!-- id: 57 -->
- [x] Buat komponen `QuickComposerModal.tsx` sebagai popup modal di tengah layar <!-- id: 58 -->
- [x] Implementasi dynamic greeting time-of-day (`Good Morning, [User]`, etc.) pada header Workspace <!-- id: 59 -->
- [x] Implementasi tombol trigger `Add new notes here -> [ + ]` dan tombol `[ + ]` pada empty state <!-- id: 60 -->
- [x] Perbarui pengelompokan tanggal timeline agar catatan hari ini berlabel `Today` <!-- id: 61 -->
- [x] Hapus bottom sticky composer lama dari `NotesTimeline.tsx` <!-- id: 62 -->
- [x] Verifikasi typecheck TypeScript (`npx tsc --noEmit`) dan Astro diagnostics (`astro check`) dengan 0 error <!-- id: 63 -->

## Phase 10: Settings Slicing UI Wireframe Implementation <!-- id: 64 -->
- [x] Inject `joinedDate` dari `users.createdAt` di `src/pages/dashboard/settings.astro` <!-- id: 65 -->
- [x] Refactor `SettingsView.tsx`: Slicing Section 1 Account & Integration (Profile, Joined Date, Logout button, 2x2 Plan & Kuota Cards) <!-- id: 66 -->
- [x] Refactor `SettingsView.tsx`: Slicing Section 2 Telegram Bot Integration (Field auto-copy on click, default censored + Eye toggle, Connect Telegram button, Regenerate Key, Guide) <!-- id: 67 -->
- [x] Refactor `SettingsView.tsx`: Slicing Section 3 Export (Export Notes button & Export Bookmarks button) <!-- id: 68 -->
- [x] Verifikasi typecheck TypeScript (`npx tsc --noEmit`) dan Astro diagnostics (`astro check`) dengan 0 error <!-- id: 69 -->

## Phase 11: ToDo Page & Notes Detail Modal Slicing <!-- id: 70 -->
- [x] Update `src/pages/api/notes/[id].ts` to handle `isProcessed` update on PATCH <!-- id: 71 -->
- [x] Update `src/pages/api/notes/index.ts` to return `isPinned`, `isProcessed`, `attachments` on POST <!-- id: 72 -->
- [x] Update `src/pages/dashboard/todo.astro` to serialize `isPinned`, `isProcessed`, `attachments` <!-- id: 73 -->
- [x] Slicing `TodoView.tsx` matching wireframe (Header ToDo + Searchbox, left filter buttons `today`, `this week`, `all time`, `[ New Task + ]` button, note cards with mark finished, content, pin & delete, date, click to open detail) <!-- id: 74 -->
- [x] Implement Notes Detail modal matching wireframe (Date & time, close button, full note content, link/image embeds, tags at bottom left, vertical buttons: Mark Finished, Pin, Edit, Delete) <!-- id: 75 -->
- [x] Validation check (`tsc --noEmit` & `astro check`) with 0 errors <!-- id: 76 -->

## Phase 12: Bookmarks Page Slicing (Wireframe Alignment) <!-- id: 77 -->
- [x] Update `src/pages/dashboard/bookmarks.astro` to serialize `isPinned` and `attachments` <!-- id: 78 -->
- [x] Create `NewBookmarkModal.tsx` for adding new bookmarks <!-- id: 79 -->
- [x] Slicing `BookmarksView.tsx` matching wireframe (Header Bookmarks + Searchbox, left platform sidebar with divider, Section Pinned with card variants, Section New Bookmarks with `+` card, Section Youtube & Github with OG images & view more button) <!-- id: 80 -->
- [x] Validation check (`tsc --noEmit` & `astro check`) with 0 errors <!-- id: 81 -->

## Phase 14: Dashboard Layout, Empty State & Content Wrapper Refactoring <!-- id: 85 -->
- [x] Refactor Workspace (`NotesTimeline.tsx`) empty state: move "Buat catatan pertama" button before "Hubungkan Telegram" <!-- id: 86 -->
- [x] Standardize content wrapper across all dashboard views to full-width (`w-full px-4 sm:px-6 md:px-8 py-6`) <!-- id: 87 -->
- [x] Eliminate unnecessary vertical scrolling on empty/short dashboard pages by updating layout container in `src/pages/dashboard/*.astro` and removing artificial `min-h-screen` from inner views <!-- id: 88 -->
- [x] Verify all 6 dashboard views (`NotesTimeline.tsx`, `TodoView.tsx`, `BookmarksView.tsx`, `ScheduleView.tsx`, `VaultView.tsx`, `SettingsView.tsx`) <!-- id: 89 -->
- [x] Run validation checks (`tsc --noEmit` & `astro check`) with 0 errors <!-- id: 90 -->

## Phase 15: Comprehensive Zero-Shadow UI/UX Audit <!-- id: 91 -->
- [x] Conduct repository-wide deep audit for all shadow classes (`shadow-2xs`, `shadow-xs`, `shadow-sm`, `shadow-md`, `shadow-lg`, `shadow-xl`, `shadow-2xl`) <!-- id: 92 -->
- [x] Purge all shadow classes from 16 component and modal files <!-- id: 93 -->
- [x] Enforce zero-shadow reset across Tailwind v4 `@theme` in `src/styles/global.css` <!-- id: 94 -->
- [x] Validate compilation with `tsc --noEmit` and `npx astro check` (0 errors) <!-- id: 95 -->

## Phase 16: UI/UX Audit & Complete Animation Removal <!-- id: 96 -->
- [x] Add global animation & transition suppression reset to `src/styles/global.css` <!-- id: 97 -->
- [x] Remove all transition, animation, and scale classes from UI primitives (`src/components/ui/*`) <!-- id: 98 -->
- [x] Remove all transition, animation, and scale classes from Dashboard components & Modals (`src/components/dashboard/*`) <!-- id: 99 -->
- [x] Remove all transition, animation, and scale classes from Admin, Landing, Login, and Checkout (`src/components/admin/*`, `src/components/landing/*`, `src/pages/*`) <!-- id: 100 -->
- [x] Run automated scan script to verify zero remaining animation & transition classes <!-- id: 101 -->
- [x] Validate TypeScript typecheck and Astro diagnostics (`tsc --noEmit` and `astro check`) with 0 errors <!-- id: 102 -->

## Phase 17: Dashboard Consistency (Wrapper, Title 'Zero Workspace' Style, & Search Box) <!-- id: 103 -->
- [x] Upgrade `SearchPill` in `src/components/ui/Input.tsx` to provide standardized magnifying glass, clear button, and dimensions <!-- id: 104 -->
- [x] Pass `userName` prop from `todo.astro`, `schedule.astro`, `bookmarks.astro`, `vault.astro` to their respective views <!-- id: 105 -->
- [x] Update `TodoView.tsx` with standardized wrapper, 'Zero ToDo' title (SF Pro Rounded + Tangerine), and unified search box <!-- id: 106 -->
- [x] Update `ScheduleView.tsx` with standardized wrapper, 'Zero Schedule' title (SF Pro Rounded + Tangerine), and unified search box <!-- id: 107 -->
- [x] Update `BookmarksView.tsx` with standardized wrapper, 'Zero Bookmarks' title (SF Pro Rounded + Tangerine), and unified search box <!-- id: 108 -->
- [x] Update `VaultView.tsx` with standardized wrapper, 'Zero Vault' title (SF Pro Rounded + Tangerine), and unified search box <!-- id: 109 -->
- [x] Standardize `NotesTimeline.tsx` search box with `SearchPill` component <!-- id: 110 -->
- [x] Verify Astro container padding consistency in `src/pages/dashboard/*.astro` <!-- id: 111 -->
- [x] Run verification tests (`tsc --noEmit` and `astro check`) with 0 errors <!-- id: 112 -->

## Phase 17: Sidebar Branding & Global Badge Component Standardization <!-- id: 103 -->
- [x] Perbesar logo icon dan nama aplikasi di sidebar: desktop `w-10 h-10` icon + `text-heading-lg` title, mobile header & drawer `w-9 h-9` icon + `text-heading-md` title <!-- id: 104 -->
- [x] Standarisasi komponen dasar `CommandTag` di `src/components/ui/Terminal.tsx`: `font-sans font-medium`, tanpa border, padding `px-2 py-0.5` <!-- id: 105 -->
- [x] Audit dan seragamkan seluruh badge independen di `Sidebar.tsx`, `AdminDashboard.tsx`, `NoteCard.tsx`, `NoteDetailModal.tsx`, `TodoDetailModal.tsx`, `TodoView.tsx`, `BookmarksView.tsx`, `VaultView.tsx`, `NotesTimeline.tsx`, `SettingsView.tsx`, `LandingPage.tsx`, dan `simulator.astro` <!-- id: 106 -->
- [x] Validasi typecheck TypeScript (`tsc --noEmit`) dan Astro diagnostics (`astro check`) dengan 0 error <!-- id: 107 -->

## Phase 18: Notes Filter Popover Overhaul & RayUI Range Date Picker <!-- id: 108 -->
- [x] Hapus semua garis divider di dalam `NotesFilterPopover.tsx` <!-- id: 109 -->
- [x] Perbesar tombol close (`w-9 h-9` dengan icon `w-5 h-5`) <!-- id: 110 -->
- [x] Perbaiki font weight title "Filter Catatan" menjadi `text-heading-md font-medium text-ink` sesuai design system <!-- id: 111 -->
- [x] Perkecil lebar modal pop-up menjadi `md:w-[328px]` agar lebih proporsional <!-- id: 122 -->
- [x] Hapus label `# Date` dan teks status filter di sebelah kanan (`All time` / `Filter aktif`) <!-- id: 112 -->
- [x] Buat kalender range date RayUI selalu aktif/terbuka secara langsung <!-- id: 123 -->
- [x] Perbaiki styling range date di `Calendar.tsx`: start dan end date menggunakan angka putih kontras (`text-on-primary`) di atas lingkaran hitam, middle date di atas pita soft surface <!-- id: 124 -->
- [x] Implementasi Continuous Soft Ribbon di `Calendar.tsx`: ubah layout grid menjadi tabel collapsed murni tanpa sekat/gap, hilangkan lingkaran hitam, dan satukan seluruh rentang tanggal ke dalam satu pita kapsul halus `bg-hairline` (#e5e5e5) dengan rounded-l-full di pangkal, rounded-r-full di ujung, dan teks hitam tegas `text-ink` merata <!-- id: 127 -->
- [x] Perbaiki kelengkungan pita rentang: pastikan `rounded-l-full rounded-r-none` hanya di tanggal awal, `rounded-r-full rounded-l-none` hanya di tanggal akhir, dan `!rounded-none` di tanggal tengah tanpa kebocoran `rounded-full` dari `selected` atau `day_button` <!-- id: 128 -->
- [x] Terapkan aturan eksplisit CSS di `global.css` & `Calendar.tsx`: `.rdp-range_start` melengkung murni di `top-left` dan `bottom-left` (0px di `top-right` dan `bottom-right`), `.rdp-range_end` melengkung murni di `top-right` dan `bottom-right` (0px di `top-left` dan `bottom-left`), serta `.rdp-month_grid` menggunakan `border-collapse: separate; border-spacing: 0;` agar kelengkungan sudut sel tabel dirender presisi oleh browser <!-- id: 129 -->
- [x] Perkecil ukuran font teks range info dan tombol "Hapus rentang" menjadi `text-[10px]` <!-- id: 125 -->
- [x] Hapus tombol "Hapus rentang" dan teks info rentang tanggal di bawah kalender <!-- id: 130 -->
- [x] Hapus tombol "Clear" pada field multi-select kategori <!-- id: 131 -->
- [x] Ubah tombol footer "Reset" menjadi "Cancel" yang membatalkan draft dan menutup popup <!-- id: 132 -->
- [x] Perluas backdrop overlay modal ke `min-h-[100dvh]` dan `top/left/right/bottom: 0` agar meng-cover seluruh layar secara penuh <!-- id: 133 -->
- [x] Perbaiki bug modal filter terpotong & background screen terscroll: ubah posisi container dari absolute ke fixed dialog overlay (`fixed inset-0 z-50 flex items-center justify-center md:justify-end md:pr-8`), tambahkan `document.body.style.overflow = 'hidden'` untuk scroll-lock halaman latar, dan jadikan Header serta Footer (Cancel & Apply) `shrink-0` pinned permanen sementara area tengah (`flex-1 min-h-0 overflow-y-auto`) scrollable secara mandiri tanpa bocor ke layar (`overscroll-contain`) <!-- id: 135 -->
- [x] Hapus teks keterangan `(multiple select)` pada field Kategori <!-- id: 114 -->
- [x] Perkecil font weight label "Tampilkan uncategorized notes" menjadi `font-normal` dan hapus teks deskripsi <!-- id: 115 -->
- [x] Validasi typecheck TypeScript (`tsc --noEmit`) dan Astro diagnostics (`npx astro check`) dengan 0 error <!-- id: 116 -->

## Phase 19: Mobile Sidebar Refactor & Bottom Dock Removal <!-- id: 112 -->
- [x] Hapus bottom dock menu di mobile view dari `Sidebar.tsx` dan bersihkan `pb-20 md:pb-0` di seluruh page Astro <!-- id: 113 -->
- [x] Perbesar hamburger menu di mobile header (icon `w-7 h-7`), hilangkan box border & background <!-- id: 114 -->
- [x] Tingkatkan kontras badge user tier (`FREE` menggunakan `bg-hairline text-ink font-semibold`, `PRO` menggunakan `bg-primary text-on-primary`) <!-- id: 115 -->
- [x] Perbesar tombol close di mobile drawer (`X` `w-7 h-7`) <!-- id: 116 -->
- [x] Pindahkan tombol Connect Bot ke bagian bawah sebelum profile user (selaras dengan sidebar desktop) <!-- id: 117 -->
- [x] Hapus link Pengaturan Akun dan tombol Logout di bagian paling bawah mobile drawer <!-- id: 118 -->
- [x] Hapus garis divider horizontal di atas area bot button & profile card pada mobile drawer <!-- id: 120 -->
- [x] Kurangi font weight nama aplikasi di sidebar (mobile header, mobile drawer, desktop sidebar) dari `font-bold` menjadi `font-medium` <!-- id: 121 -->
- [x] Perkecil sedikit ukuran logo icon (`w-9 h-9` desktop / `w-8 h-8` mobile) dan title app (`text-[21px]` desktop / `text-[18px]` mobile) di sidebar <!-- id: 134 -->
- [x] Validasi typecheck TypeScript (`tsc --noEmit`) dan Astro diagnostics (`astro check`) dengan 0 error <!-- id: 119 -->

## Phase 21: ToDo View UI/UX Refinement <!-- id: 125 -->
- [x] Hapus label filter dan icon filter di kolom kiri ToDo <!-- id: 126 -->
- [x] Hapus count badge notes pada opsi filter (today, this week, all time) <!-- id: 127 -->
- [x] Sesuaikan kolom filter agar lebarnya shrink-to-fit (`w-fit`) dan tidak full-width <!-- id: 128 -->
- [x] Sesuaikan card notes menjadi shrink-to-fit / min-width max-content (`w-fit min-w-[280px] max-w-full sm:max-w-2xl`) <!-- id: 129 -->
- [x] Sempurnakan lebar card notes Todo menjadi murni `w-max max-w-full sm:max-w-[42rem]` (diperbesar dari `30rem` ke `42rem` / 672px) tanpa batasan minimum artificial, sehingga menyusut rapat memeluk konten seperti pill filter <!-- id: 133 -->
- [x] Sesuaikan tombol "New Task" menjadi `w-fit` dengan styling box dan border persis sama seperti card notes (`rounded-xl border border-hairline bg-canvas hover:border-ink/40`) <!-- id: 130 -->
- [x] Hapus tags, keterangan jam (`HH:mm`), dan icon jam pada card notes, menyisakan format tanggal bersih (`dd MMM yyyy`) <!-- id: 131 -->
- [x] Validasi typecheck TypeScript (`npm run typecheck`) dengan 0 error <!-- id: 132 -->

## Phase 21: Workspace Timeline Continuous Spine & Dense Masonry Gallery <!-- id: 125 -->
- [x] Perbaiki garis timeline menjadi satu garis vertikal utuh berkesinambungan (`absolute left-[135px] top-3 bottom-6 w-0.5 bg-hairline`) tanpa terputus <!-- id: 126 -->
- [x] Hapus keterangan jumlah catatan pada tanggal timeline (misal `(5)`) serta hilangkan badge counter pada pinned <!-- id: 127 -->
- [x] Kompresi NoteCard: perkecil padding card (`p-3`), hapus keterangan waktu dan tags, pertahankan ukuran tombol pin dan delete (`p-1.5`) <!-- id: 128 -->
- [x] Implementasi Masonry Gallery Grid pada notes timeline: kolom responsif (`columns-1 sm:columns-2 md:columns-2 lg:columns-3 xl:columns-4 2xl:columns-5`) dengan `break-inside-avoid` dan packing vertikal tanpa celah/gap kosong <!-- id: 129 -->
- [x] Validasi typecheck TypeScript (`tsc --noEmit`) dan Astro check dengan 0 error <!-- id: 130 -->

## Phase 22: Mobile Notes Filter Popover Max-Width Adjustment <!-- id: 131 -->
- [x] Sesuaikan max-width popover filter catatan pada mobile menjadi `max-w-[335px]` agar pas dan tidak terlalu sempit <!-- id: 132 -->
- [x] Bersihkan sisa transition-colors di dalam `NotesFilterPopover.tsx` <!-- id: 133 -->

## Phase 23: Global Modal & Popup Overlay Standardization & Body Scroll Lock <!-- id: 134 -->
- [x] Audit seluruh 11 modal/popup di seluruh aplikasi (`EditNoteModal`, `UpgradeModal`, `NewBookmarkModal`, `NewTodoModal`, `NoteDetailModal`, `TodoDetailModal`, `QuickComposerModal`, `NotesFilterPopover`, `Sidebar` drawer & bot modal, `ScheduleView` create & detail modals, `VaultView` create modal) <!-- id: 135 -->
- [x] Standarisasi elemen backdrop ke format anti-bocor: `fixed inset-0 w-screen h-screen min-h-[100dvh] z-50 bg-black/40 backdrop-blur-xs` dengan inline style `top: 0, left: 0, right: 0, bottom: 0, minHeight: '100dvh'` <!-- id: 136 -->
- [x] Pasang body scroll lock (`document.body.style.overflow = 'hidden'`) pada seluruh modal untuk mencegah layar background ikut tergeser saat modal terbuka <!-- id: 137 -->
- [x] Pisahkan layer backdrop dan layer dialog box secara bersih dengan container `pointer-events-none` dan dialog card `pointer-events-auto` <!-- id: 138 -->
- [x] Validasi typecheck TypeScript (`tsc --noEmit`) dan Astro diagnostics (`npx astro check`) dengan 0 error <!-- id: 139 -->
- [x] Validasi typecheck TypeScript (`tsc --noEmit`) dengan 0 error <!-- id: 134 -->

## Phase 23: Workspace Card Notes & Timeline Sizing Refinement <!-- id: 135 -->
- [x] Hapus ikon sumber catatan (Telegram/Send) dari card notes di [NoteCard.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/NoteCard.tsx) <!-- id: 136 -->
- [x] Terapkan pencegahan horizontal scroll dengan `break-words [overflow-wrap:anywhere]` dan `overflow-x-hidden` pada container [NotesTimeline.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/NotesTimeline.tsx) dan [index.astro](file:///d:/Code/unlazynotes/src/pages/dashboard/index.astro) <!-- id: 137 -->
- [x] Perbesar lebar (width) card notes dengan menyesuaikan kolom masonry grid dari 5 kolom (`2xl:columns-5`) menjadi `columns-1 sm:columns-2 lg:columns-2 xl:columns-3 2xl:columns-4 gap-3.5` <!-- id: 138 -->
- [x] Perbesar batas tinggi (max-height) preview catatan pada NoteCard menjadi `line-clamp-8` <!-- id: 139 -->
- [x] Perbesar font size label tanggal pada timeline menjadi `text-body-md font-semibold text-ink` (16px) dengan pelebaran kolom kiri ke `md:w-36` (144px) <!-- id: 140 -->
- [x] Perbesar icon Pinned pada timeline node (`w-6 h-6`, icon `w-3.5 h-3.5`), mobile label (`w-4 h-4`), dan tombol pin pada NoteCard (`w-4 h-4`) <!-- id: 141 -->
- [x] Sempurnakan posisi garis spine vertikal timeline ke `left-[151px]` dan bullet node agar selaras presisi <!-- id: 142 -->
- [x] Bersihkan sisa transform micro-animation (`group-hover:rotate-90`) pada tombol Plus <!-- id: 143 -->
- [x] Validasi typecheck TypeScript (`tsc --noEmit`) dan Astro diagnostics (`astro check`) dengan 0 error <!-- id: 144 -->

## Phase 24: Responsive Polish & Timeline Axis Start-Alignment <!-- id: 145 -->
- [x] Hapus padding start pada container timeline ([NotesTimeline.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/NotesTimeline.tsx)) dan ubah alignment kolom label axis menjadi `justify-start` (flush left di 0px) <!-- id: 146 -->
- [x] Kompresi lebar sumbu kiri timeline ke `w-28` (112px) dan sesuaikan sumbu spine ke `left-[111px]` agar cards memiliki lebih banyak ruang horizontal <!-- id: 147 -->
- [x] Optimasi responsivitas masonry grid pada workspace: `columns-1 sm:columns-2 md:columns-1 lg:columns-2 xl:columns-3 2xl:columns-4 gap-3.5` dengan `min-w-0` untuk mengeliminasi pemotongan kartu pada layar tablet / narrow desktop (768px-1024px) <!-- id: 148 -->
- [x] Optimasi responsivitas [TodoView.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/TodoView.tsx): kartu tugas `w-full sm:w-max max-w-full sm:max-w-[42rem]` agar fleksibel di layar sempit <!-- id: 149 -->
- [x] Optimasi responsivitas [ScheduleView.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/ScheduleView.tsx): header bulan `flex-wrap sm:flex-nowrap` dan padding kalender `p-3 sm:p-6` agar 7 kolom tanggal lega di mobile <!-- id: 150 -->
- [x] Optimasi responsivitas [BookmarksView.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/BookmarksView.tsx): grid kartu bookmark `grid-cols-1 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4` <!-- id: 151 -->
- [x] Optimasi responsivitas [VaultView.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/VaultView.tsx): grid kartu vault `grid-cols-1 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3` <!-- id: 152 -->
- [x] Tambahkan `max-w-full overflow-x-hidden` secara konsisten pada seluruh container dashboard view dan `<main>` pada seluruh halaman Astro (`index.astro`, `todo.astro`, `schedule.astro`, `bookmarks.astro`, `vault.astro`, `settings.astro`) <!-- id: 153 -->
- [x] Validasi typecheck TypeScript (`tsc --noEmit`) dan Astro diagnostics (`astro check`) dengan 0 error <!-- id: 154 -->

## Phase 25: Workspace Timeline Polish, Ring Reset & Card Sizing <!-- id: 155 -->
- [x] Hapus floating action button (FAB) 'add notes' di workspace ([NotesTimeline.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/NotesTimeline.tsx)) <!-- id: 156 -->
- [x] Atur label timeline rata kanan semua (`md:justify-end text-right`) termasuk label Pinned <!-- id: 157 -->
- [x] Samakan dots timeline pinned dengan dots lainnya (`w-2.5 h-2.5 rounded-full bg-primary ring-4 ring-canvas`) tanpa icon <!-- id: 158 -->
- [x] Ubah teks "Pinned" dari uppercase ke regular/title case <!-- id: 159 -->
- [x] Hentikan garis timeline pada item terakhir sehingga tidak ada sisa garis menjuntai ke bawah <!-- id: 160 -->
- [x] Sambungkan segmen garis timeline secara utuh dan tanpa celah (overlap -bottom-[53px] hingga dasar dot berikutnya, dan hapus ring putih ring-4 ring-canvas yang memotong garis) <!-- id: 164 -->
- [x] Terapkan `max-w-[90rem]` (90rem) pada card notes ([NoteCard.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/NoteCard.tsx) dan kontainer [NotesTimeline.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/NotesTimeline.tsx)) <!-- id: 161 -->
- [x] Hapus efek ring pada semua form field di seluruh aplikasi ([Input.tsx](file:///d:/Code/unlazynotes/src/components/ui/Input.tsx), [EditNoteModal.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/EditNoteModal.tsx), [NotesFilterPopover.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/NotesFilterPopover.tsx), [login.astro](file:///d:/Code/unlazynotes/src/pages/login.astro), dan [global.css](file:///d:/Code/unlazynotes/src/styles/global.css)) <!-- id: 162 -->
- [x] Validasi typecheck TypeScript (`tsc --noEmit`) dan Astro diagnostics (`astro check`) dengan 0 error <!-- id: 163 -->

## Phase 26: Workspace Wireframe Layout & Content Alignment <!-- id: 165 -->
- [x] Query category item counts (`todo`, `schedule`, `bookmark`, `vault`) di `src/pages/dashboard/index.astro` dan teruskan sebagai props <!-- id: 166 -->
- [x] Reorganisasi Header di `NotesTimeline.tsx`: Workspace title + Dynamic greeting (`Good Morning`, subtitle) di kiri, dan `Hubungkan Telegram` action button di kanan <!-- id: 167 -->
- [x] Buat 4 Shortcut Cards row (`To Do`, `Schedule`, `Bookmarks`, `Credentials`) dengan responsivitas 2 kolom (mobile) & 4 kolom (desktop) <!-- id: 168 -->
- [x] Pisahkan section `Pinned` ke shelf mandiri di atas action row (hanya tampil jika ada catatan yang di-pin) <!-- id: 169 -->
- [x] Pindahkan Search box & Filter toggle ke row yang sama dengan `Add new notes here -> [ + ]` <!-- id: 170 -->
- [x] Sesuaikan Empty State murni teks & deskripsi tanpa tombol ganda <!-- id: 171 -->
- [x] Pertahankan timeline date groups murni tanggal dengan garis spine kontinu yang berakhir di dot terakhir <!-- id: 172 -->
- [x] Validasi typecheck TypeScript (`npm run typecheck`) dan Astro diagnostics (`npx astro check`) dengan 0 error <!-- id: 173 -->

## Phase 27: Feature Cards Square Ratio, Pinned Full-Width & Spacious Section Rhythm <!-- id: 174 -->
- [x] Ubah shortcut feature cards menjadi rasio 1:1 square (`aspect-square`), batas lebar `w-32 sm:w-36 md:w-40 max-w-[160px]`, container `w-fit`, hapus border, ikon, dan angka notes <!-- id: 175 -->
- [x] Lepas batasan max-width pada section catatan Pinned (`w-full columns-...` hingga 6 kolom di 2K) dan tambahkan format tanggal & waktu di bawah setiap card pinned <!-- id: 176 -->
- [x] Perbesar ritme spacing antar section: gap heading Workspace ke Good Morning (`mt-8 sm:mt-10`), satukan Good Morning & Feature Cards (`mt-4`), gap Feature Cards ke Pin (`mt-12 sm:mt-16`), gap Pin ke Controls (`mt-12 sm:mt-16`), dan gap Controls ke Timeline (`mt-10 sm:mt-14`) <!-- id: 177 -->
- [x] Validasi typecheck TypeScript (`npm run typecheck`) dan Astro diagnostics (`npx astro check`) dengan 0 error <!-- id: 178 -->

## Phase 28: Enlarged Feature Cards for Visual & Illustration Space <!-- id: 179 -->
- [x] Perbesar ukuran square feature cards (tetap rasio 1:1) ke skala `w-36 sm:w-48 lg:w-56 xl:w-64` (hingga 256px di desktop/2K) dengan `rounded-2xl sm:rounded-3xl` dan padding lapang `p-5 sm:p-6` agar siap menampung ilustrasi/visual masa depan <!-- id: 180 -->
- [x] Validasi typecheck TypeScript (`npm run typecheck`) dengan 0 error <!-- id: 181 -->

## Phase 29: Pinned Layout Parity & Divider Removal <!-- id: 182 -->
- [x] Kembalikan tata letak grid Pinned notes sama persis dengan kartu timeline: maksimal 4 kolom (`columns-1 sm:columns-2 md:columns-1 lg:columns-2 xl:columns-3 2xl:columns-4`) dengan batas `max-w-[90rem]` (tidak full-width) <!-- id: 183 -->
- [x] Hapus garis divider horizontal (`border-t`) pada keterangan date & time di [NoteCard.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/NoteCard.tsx), sambil tetap menjaga space gap vertikal yang bersih (`mt-3`) antara teks konten catatan dan waktu <!-- id: 184 -->
- [x] Sesuaikan maksimal kolom section Pinned menjadi 5 kolom (`2xl:columns-5`) dengan batas `max-w-[90rem]` <!-- id: 186 -->
- [x] Validasi typecheck TypeScript (`npm run typecheck`) dan Astro diagnostics (`npx astro check`) dengan 0 error <!-- id: 185 -->

## Phase 30: Pinned 5-Column Proportional Width Expansion <!-- id: 187 -->
- [x] Perluas batas maksimal container Pinned secara proporsional ke `max-w-[112.5rem]` (1800px) sehingga penambahan kolom ke-5 pada resolusi 2K tidak mempersempit lebar masing-masing kartu catatan (tetap stabil di ~350px per card persis seperti layout 4 kolom sebelumnya) <!-- id: 188 -->
- [x] Validasi typecheck TypeScript (`npm run typecheck`) dengan 0 error <!-- id: 189 -->

## Phase 31: Feature Cards Macro Scale Enlargement <!-- id: 190 -->
- [x] Perbesar kembali dimensi square feature cards ke skala makro `w-40 sm:w-56 lg:w-64 xl:w-72 2xl:w-80` (hingga 320px x 320px di monitor 2K) dengan `rounded-3xl`, padding `p-6 sm:p-8`, dan font `text-heading-sm md:text-heading-md` agar menjadi kanvas visual/ilustrasi yang sangat leluasa <!-- id: 191 -->
- [x] Validasi typecheck TypeScript (`npm run typecheck`) dengan 0 error <!-- id: 192 -->

## Phase 28: Todo View UI/UX Refinement & List Truncation Expansion <!-- id: 179 -->
- [x] Perbesar ukuran opsi filter tanggal (`today`, `this week`, `all time`) menjadi `py-2.5 px-5 text-body-sm font-medium` <!-- id: 180 -->
- [x] Perbesar ukuran tombol `New Task` menjadi `py-3 px-6 text-body-md font-medium` dengan icon `w-5 h-5` <!-- id: 181 -->
- [x] Kembalikan ketebalan font teks konten tugas menjadi regular (`font-normal`), tidak tebal/bold <!-- id: 182 -->
- [x] Terapkan variasi lebar card notes secara dinamis, estetik, dan ringan menggunakan preset max-width bertingkat berbasis hash deterministik ID catatan (tanpa runtime layout overhead) <!-- id: 183 -->
- [x] Perbesar plafon max-width presets menjadi `38rem` s/d `60rem` (`sm:min-w-[20rem]`) agar kartu tugas lebih lapang <!-- id: 184 -->
- [x] Perluas batas tinggi dan truncating catatan menjadi `line-clamp-8` serta pasang `whitespace-pre-line` agar catatan berbentuk daftar/list ke bawah tampil utuh dan terbaca tanpa terpotong prematur di 2 baris <!-- id: 185 -->
- [x] Susun tombol aksi Pin dan Hapus secara vertikal bertumpuk (Pin di atas, Hapus di bawah) di sisi kanan kartu dengan penambahan jarak pemisah (space gap) yang lega dari konten catatan (`ml-4 sm:ml-6 pl-1` serta `gap-1.5` antar tombol) <!-- id: 186 -->
## Phase 32: Todo View Header Filter Popover Reusability <!-- id: 193 -->
- [x] Tambahkan varian `variant="todo"` pada komponen reusable [NotesFilterPopover.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/NotesFilterPopover.tsx) untuk menyajikan modal popup filter minimalis berisi opsi `Today`, `This Week`, dan `All Time` lengkap dengan aksi `Cancel` dan `Apply` <!-- id: 194 -->
- [x] Pindahkan trigger filter di [TodoView.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/TodoView.tsx) ke samping search box di header (tombol bulat `w-9 h-9` dengan icon `SlidersHorizontal` dan status active indicator, identik dengan workspace) <!-- id: 195 -->
- [x] Hapus tumpukan tombol filter vertikal kolom kiri di [TodoView.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/TodoView.tsx) agar tata letak halaman ToDo bersih dan lapang <!-- id: 196 -->
- [x] Tampilkan active filter chip badge saat filter aktif (`today` / `this week`) untuk mempermudah reset ke `all time` <!-- id: 197 -->
- [x] Validasi typecheck TypeScript (`npm run typecheck`) dan Astro diagnostics (`npx astro check`) dengan 0 error <!-- id: 198 -->

## Phase 33: Searchbox & Filter Below Heading Placement & Floating Action Button <!-- id: 200 -->
- [x] Pindahkan baris kontrol Searchbox dan Filter pada [TodoView.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/TodoView.tsx) ke bawah heading/title dan sebelum konten catatan tugas <!-- id: 201 -->
- [x] Ubah tombol `New Task` di [TodoView.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/TodoView.tsx) menjadi Floating Action Button (FAB) di sudut kanan bawah (`fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-40 rounded-full bg-primary text-on-primary ring-4 ring-canvas`) <!-- id: 202 -->
- [x] Selaraskan tata letak Searchbox pada seluruh halaman dashboard lainnya ([BookmarksView.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/BookmarksView.tsx), [VaultView.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/VaultView.tsx), [ScheduleView.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/ScheduleView.tsx)) agar berada di bawah heading dan sebelum konten <!-- id: 203 -->
- [x] Validasi typecheck TypeScript (`npm run typecheck`) dan Astro diagnostics (`npx astro check`) dengan 0 error <!-- id: 204 -->

## Phase 34: Universal Zero Ring Enforcement & Active Filter Chips / Divider Elimination <!-- id: 205 -->
- [x] Hapus efek ring aktif pada seluruh input field dan searchbox ([Input.tsx](file:///d:/Code/unlazynotes/src/components/ui/Input.tsx) dan [global.css](file:///d:/Code/unlazynotes/src/styles/global.css)) dengan menerapkan *Universal Zero Ring & Zero Outline Policy* (`outline: none !important; --tw-ring-shadow: none !important;`) <!-- id: 206 -->
- [x] Hapus seluruh sisa dekorasi ring pada [TodoView.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/TodoView.tsx), [login.astro](file:///d:/Code/unlazynotes/src/pages/login.astro), dan [simulator.astro](file:///d:/Code/unlazynotes/src/pages/checkout/simulator.astro) <!-- id: 207 -->
- [x] Hapus deretan badge/chip filter aktif, garis divider, serta tombol "Reset Semua" di [NotesTimeline.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/NotesTimeline.tsx) dan [TodoView.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/TodoView.tsx) agar tampilan selalu bersih dan minimalis di semua halaman <!-- id: 208 -->
- [x] Validasi typecheck TypeScript (`npm run typecheck`) dan Astro diagnostics (`npx astro check`) dengan 0 error <!-- id: 209 -->



- [x] Validasi typecheck TypeScript (`tsc --noEmit`) dan Astro diagnostics (`npx astro check`) dengan 0 error <!-- id: 188 -->

## Phase 29: Schedule View Calendar Layout & Normal Width Refactoring (Option 1: Stacked Contained) <!-- id: 189 -->
- [x] Batasi lebar kalender ke proporsi alami (`max-w-xl` ~576px) agar tidak meregang full-width secara canggung <!-- id: 190 -->
- [x] Terapkan grid kalender bersih tanpa sekat border individual per hari (*clean borderless grid*) <!-- id: 191 -->
- [x] Normalisasi sel tanggal dengan rasio persegi simetris (`aspect-square sm:h-12`) dan hover halus <!-- id: 192 -->
- [x] Standarisasi penanda agenda menggunakan dot indikator mikro (`w-1.5 h-1.5 rounded-full bg-ink mt-1`) menggantikan blok hijau neon <!-- id: 193 -->
- [x] Standarisasi state tanggal: solid circle untuk tanggal terpilih (`bg-primary text-on-primary font-semibold`), dan ring netral untuk Hari Ini (`ring-1 ring-hairline-strong font-bold`) <!-- id: 194 -->
- [x] Bersihkan label mentah wireframe menjadi label natural: "Kalender Jadwal" dan "Agenda & Catatan Jadwal" <!-- id: 195 -->
- [x] Validasi typecheck TypeScript (`tsc --noEmit`) dan Astro diagnostics (`astro check`) dengan 0 error <!-- id: 196 -->

## Phase 30: Responsive Breakpoint Harmonization for Feature Cards & Pinned Shelf <!-- id: 197 -->
- [x] Geser breakpoint 4-kolom Feature Cards dari `lg` (1024px) ke `xl` (1280px) agar layar laptop/viewport menengah masuk ke layout 2-kolom (`grid-cols-2 max-w-lg sm:max-w-xl`) <!-- id: 198 -->
- [x] Selaraskan breakpoint Pinned Shelf menjadi 2-kolom pada `lg` (`lg:columns-2`) agar serasi dengan 2-kolom Feature Cards dan Timeline <!-- id: 199 -->
- [x] Pertahankan 4 kolom pada `xl` dan 5 kolom pada `2xl` (monitor 2K) dengan batas kontainer terkontrol <!-- id: 200 -->
- [x] Validasi typecheck TypeScript (`tsc --noEmit`) dengan 0 error <!-- id: 201 -->

## Phase 31: Desktop Card Scale Expansion & Mobile Pinned Viewport Alignment <!-- id: 202 -->
- [x] Perbesar batas ukuran maksimum Feature Cards di desktop menjadi `xl:max-w-7xl 2xl:max-w-[85rem]` (~305px–325px square) <!-- id: 203 -->
- [x] Buat Feature Cards 2x2 full-width fleksibel tanpa pembatas statis (`w-full max-w-full`) <!-- id: 204 -->
- [x] Ubah breakpoint Pinned Shelf menjadi 1-kolom (`columns-1`) pada viewport `< lg` (< 1024px / ~492px) agar otomatis masuk ke tampilan mobile <!-- id: 205 -->
- [x] Validasi typecheck TypeScript (`tsc --noEmit`) dengan 0 error <!-- id: 206 -->

## Phase 32: Pinned Shelf 3-Column Breakpoint for Standard Desktop <!-- id: 207 -->
- [x] Atur breakpoint Pinned Shelf menjadi 3-kolom pada `xl` (`xl:columns-3`) untuk mencegah kartu menyempit ke 226px pada viewport ~996px <!-- id: 208 -->
- [x] Alokasikan 4-kolom pada `2xl` (`2xl:columns-4`) dan 5-kolom pada monitor 2K (`min-[1920px]:columns-5`) <!-- id: 209 -->
- [x] Pertahankan lebar kartu pinned konsisten di rentang ~310px–380px di seluruh breakpoint tanpa efek dempetan <!-- id: 210 -->
- [x] Validasi typecheck TypeScript (`tsc --noEmit`) dengan 0 error <!-- id: 211 -->

## Phase 33: Schedule Notes Card Style & Responsivity Alignment with Pinned Workspace <!-- id: 212 -->
- [x] Ganti horizontal fixed-scroll track di ScheduleView dengan komponen `NoteCard` bergaya Pinned Workspace (`showDateTime={true}`, badge category, pin & delete actions, clean date font-mono tanpa divider) <!-- id: 213 -->
- [x] Terapkan responsivity behavior multi-kolom identik: `columns-1 lg:columns-2 xl:columns-3 2xl:columns-4 min-[1920px]:columns-5 gap-3.5` <!-- id: 214 -->
- [x] Tambahkan tombol aksi '+ Tambah Jadwal' pada header seksi untuk integrasi modal pembuatan jadwal <!-- id: 215 -->
- [x] Validasi typecheck TypeScript (`tsc --noEmit`) dengan 0 error <!-- id: 216 -->

## Phase 34: Feature Card 'Add New Notes' & Action Controls Refactor <!-- id: 217 -->
- [x] Tambahkan kartu 'Add new notes' di urutan pertama Feature Cards yang terhubung ke `QuickComposerModal` <!-- id: 218 -->
- [x] Sesuaikan grid Feature Cards menjadi 5 kolom di desktop (`xl:grid-cols-5`) dan 2 kolom fleksibel pada responsive (`grid-cols-2`) <!-- id: 219 -->
- [x] Hapus kontrol 'Add new notes here' dan tombol plus di bawah bagian Pinned <!-- id: 220 -->
- [x] Posisikan Searchbox dan Filter button secara rapi rata kanan di atas Timeline <!-- id: 221 -->
- [x] Validasi typecheck TypeScript (`tsc --noEmit`) dengan 0 error <!-- id: 222 -->

## Phase 35: Granular Feature Cards Breakpoint Harmonization (3-Col on lg, 4-Col on xl) <!-- id: 223 -->
- [x] Atur Feature Cards menjadi 3 kolom pada viewport `lg` (`lg:grid-cols-3`) dengan wrapping fleksibel (3 kartu di baris 1, 2 kartu di baris 2) <!-- id: 224 -->
- [x] Atur Feature Cards menjadi 4 kolom pada viewport `xl` (`xl:grid-cols-4`) dengan wrapping fleksibel (4 kartu di baris 1, 1 kartu di baris 2) <!-- id: 225 -->
- [x] Alokasikan 5 kolom pada monitor 2K `2xl` (`2xl:grid-cols-5`) dan 2 kolom pada layar mobile `< lg` (`grid-cols-2`) <!-- id: 226 -->
- [x] Validasi typecheck TypeScript (`tsc --noEmit`) dengan 0 error <!-- id: 227 -->

## Phase 36: Borderless Feature Cards & Extensible Architecture Refactoring <!-- id: 228 -->
- [x] Hapus seluruh border dari Feature Cards (`border-none`, flat surface `bg-surface-soft hover:bg-hairline/60`) <!-- id: 229 -->
- [x] Definisikan interface `FeatureCardItem` dengan slot opsional `illustration?: string | React.ReactNode` dan support `href` / `onClick` <!-- id: 230 -->
- [x] Rapikan arsitektur grid sehingga penambahan kartu fitur baru di masa depan otomatis mengalir (*auto-wrap*) di seluruh breakpoint tanpa modifikasi CSS <!-- id: 231 -->
- [x] Validasi typecheck TypeScript (`tsc --noEmit`) dengan 0 error <!-- id: 232 -->

## Phase 37: ReUI Single-Date Calendar Integration in Schedule View <!-- id: 233 -->
- [x] Optimalkan komponen ReUI `Calendar` (`src/components/ui/Calendar.tsx`) agar mendukung styling `mode="single"` (tombol bulat `w-8 h-8 rounded-full`, solid `bg-primary text-on-primary` saat terpilih, dan ring netral pada tanggal Hari Ini) tanpa mendegradasi `mode="range"` pada popover filter <!-- id: 234 -->
- [x] Ganti implementasi grid tanggal manual di `ScheduleView.tsx` dengan komponen ReUI `Calendar` (`mode="single"`, `locale={id}`, `weekStartsOn={1}`) <!-- id: 235 -->
- [x] Terapkan modifier dot agenda (`hasSchedule`) menggunakan pseudo-element `after:` presisi (dot hitam `after:bg-ink` dan dot putih `after:bg-on-primary` saat tanggal aktif dipilih) <!-- id: 236 -->
- [x] Sederhanakan kalkulasi state: hapus perulangan 42-hari manual (`calendarDays`) dan gantikan penghitungan hari aktif dengan filter `isSameMonth` yang efisien <!-- id: 237 -->
- [x] Validasi typecheck TypeScript (`tsc --noEmit`) dan Astro diagnostics (`astro check`) dengan 0 error <!-- id: 238 -->

## Phase 37: Notes Gap Harmonization & Timeline Date Spacing Refactoring <!-- id: 233 -->
- [x] Samakan gap horizontal dan vertikal antar notes secara matematis pada nilai `0.875rem` (14px) via `gap-3.5 [column-gap:0.875rem]` dan `mb-3.5` <!-- id: 234 -->
- [x] Selaraskan breakpoint multi-kolom kartu Timeline agar serasi dengan kartu Pinned (`columns-1 lg:columns-2 xl:columns-3 2xl:columns-4 min-[1920px]:columns-5`) <!-- id: 237 -->
- [x] Validasi typecheck TypeScript (`tsc --noEmit`) dan Astro diagnostics (`astro check`) dengan 0 error <!-- id: 238 -->

## Phase 38: Workspace Controls Layout, Pinned Pagination, Greeting Typography Scale & Global Section Headings Expansion <!-- id: 239 -->
- [x] Tambahkan kembali jarak vertikal proporsional antar grup tanggal di Timeline (`space-y-10 sm:space-y-12`) dan rekalkulasi garis spine penghubung (`top-[16px] -bottom-[56px]`) <!-- id: 240 -->
- [x] Pindahkan search box dan tombol filter di Workspace ke atas bagian Pinned <!-- id: 241 -->
- [x] Batasi catatan Pinned maksimal 6 kartu secara default, dengan tombol toggle 'Tampilkan Semua' / 'Tampilkan Lebih Sedikit' <!-- id: 242 -->
- [x] Perbesar tipografi greeting ("Good Afternoon") dan deskripsi ("Organisir ide, to-do list...") di Workspace & TodoView menjadi `text-3xl sm:text-4xl md:text-5xl` (lebih besar dari judul Workspace) <!-- id: 243 -->
- [x] Perbesar ukuran font seluruh judul section ("Pinned", "Daftar Tugas", "Kalender Jadwal", "Agenda & Catatan Jadwal", "New Bookmarks", dll.) ke skala heading tebal `text-2xl sm:text-3xl font-bold` di seluruh dashboard <!-- id: 244 -->
- [x] Validasi typecheck TypeScript (`tsc --noEmit`) dan Astro diagnostics (`astro check`) dengan 0 error <!-- id: 245 -->


## Phase 39: Pinned Horizontal Scroll Carousel, Section Headings Normalization & Workspace Typography Refinement <!-- id: 246 -->
- [x] Transformasi seksi Pinned menjadi carousel horizontal full-width yang bisa di-scroll secara mulus tanpa menampilkan horizontal scrollbar (`[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden`) <!-- id: 247 -->
- [x] Hapus sistem limitasi 6 kartu, tombol 'Tampilkan Semua', dan keterangan jumlah catatan ("6 dari 13 catatan") dari header Pinned <!-- id: 248 -->
- [x] Kembalikan bobot font sapaan ("Good Afternoon") dan subjudul ("Organisir ide, to-do list...") di Workspace menjadi `font-normal` (tidak tebal) dengan tetap mempertahankan ukuran visual yang lega <!-- id: 249 -->
- [x] Hapus sapaan "Good Afternoon" dari `TodoView.tsx` dan kembalikan header to-do list sesuai kontrak halaman <!-- id: 250 -->
- [x] Normalisasi ukuran font dan bobot teks seluruh judul section di dashboard ("Pinned", "Daftar Tugas", "Kalender Jadwal", "Agenda & Catatan Jadwal", "New Bookmarks", dll.) menjadi `text-xl sm:text-2xl font-normal` <!-- id: 251 -->
- [x] Validasi typecheck TypeScript (`tsc --noEmit`) dan Astro diagnostics (`astro check`) dengan 0 error <!-- id: 252 -->


## Phase 40: Pinned Carousel Natural Masonry Height & Multi-Input Horizontal Scroll Engine <!-- id: 253 -->
- [x] Sesuaikan tinggi kartu Pinned carousel murni berdasarkan konten masing-masing (`items-start`, `self-start`, `h-auto`) identik dengan masonry tanpa perataan paksa <!-- id: 254 -->
- [x] Pasang engine mouse wheel converter yang menerjemahkan scroll vertikal (`deltaY`) menjadi scroll horizontal (`scrollLeft`) saat kursor berada di atas carousel <!-- id: 255 -->
- [x] Implementasikan fitur drag-to-scroll interaktif (`cursor-grab active:cursor-grabbing`) dengan pencegah klik tidak sengaja saat menggeser <!-- id: 256 -->
- [x] Tambahkan tombol navigasi panah kiri/kanan (`ChevronLeft` / `ChevronRight`) di samping judul "Pinned" untuk akses scroll desktop cepat <!-- id: 257 -->
- [x] Validasi typecheck TypeScript (`tsc --noEmit`) dan Astro diagnostics (`astro check`) dengan 0 error <!-- id: 258 -->

## Phase 41: Todo Card Normalization, Pinned Badge Elimination & Global Icon Size Harmonization <!-- id: 259 -->
- [x] Hapus fitur checkbox selesai dan efek coret (`line-through` & `isCompleted`) pada kartu [TodoView.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/TodoView.tsx) dan [TodoDetailModal.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/TodoDetailModal.tsx) sehingga murni menjadi catatan biasa <!-- id: 260 -->
- [x] Hapus teks badge "Pinned" dari seluruh kartu catatan di [TodoView.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/TodoView.tsx) dan [BookmarksView.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/BookmarksView.tsx) agar selaras dengan Workspace di mana status pin hanya ditandai oleh perubahan gaya icon <!-- id: 261 -->
- [x] Standarisasi ukuran icon aksi kartu (`w-4 h-4`) dan styling tombol bulat (`p-1.5 rounded-full`) secara konsisten di seluruh halaman ([NoteCard.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/NoteCard.tsx), [TodoView.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/TodoView.tsx), [BookmarksView.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/BookmarksView.tsx), [VaultView.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/VaultView.tsx)) <!-- id: 262 -->
- [x] Validasi typecheck TypeScript (`tsc --noEmit`) dan Astro diagnostics (`astro check`) dengan 0 error <!-- id: 263 -->

## Phase 42: Timeline Notes Rigid-Width Masonry & Organic Variable Height (Option A) <!-- id: 264 -->
- [x] Implementasi Opsi A pada kartu catatan timeline [NotesTimeline.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/NotesTimeline.tsx) dengan kolom lebar kaku/tetap (`columns-[300px] sm:columns-[320px] [column-width:300px] sm:[column-width:320px] gap-3.5 [column-gap:0.875rem]`) sehingga kartu langsung drop/wrap ke baris/kolom baru seketika saat layar menyusut tanpa melar/menciut fleksibel <!-- id: 265 -->
- [x] Aktifkan variasi tinggi natural & organik pada [NoteCard.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/NoteCard.tsx) dengan mengganti `line-clamp-8` menjadi `line-clamp-none` serta menambahkan `whitespace-pre-wrap` agar panjang teks dan baris paragraf menentukan tinggi kartu secara murni <!-- id: 266 -->
- [x] Sinkronisasi perilaku masonry Opsi A pada grid catatan agenda jadwal [ScheduleView.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/ScheduleView.tsx) agar seragam di seluruh dashboard <!-- id: 267 -->
- [x] Validasi typecheck TypeScript (`tsc --noEmit`) dan Astro diagnostics (`astro check`) dengan 0 error <!-- id: 268 -->

## Phase 44: Pinned Carousel Mouse Wheel Pass-Through Normalization <!-- id: 272 -->
- [x] Hapus event listener `wheel` dan pemblokiran `e.preventDefault()` pada carousel Pinned di [NotesTimeline.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/NotesTimeline.tsx) sehingga scroll wheel mouse tetap menggulir halaman ke atas/bawah secara natural <!-- id: 273 -->
- [x] Pertahankan navigasi horizontal carousel via mouse drag-to-scroll, tombol panah kiri/kanan (`ChevronLeft` / `ChevronRight`), dan gesture sentuh/trackpad <!-- id: 274 -->
- [x] Validasi typecheck TypeScript (`tsc --noEmit`) dan Astro diagnostics (`astro check`) dengan 0 error <!-- id: 275 -->

## Phase 45: Notes Collection Section Title Addition <!-- id: 276 -->
- [x] Tambahkan section title "Notes Collection" di atas area timeline catatan pada [NotesTimeline.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/NotesTimeline.tsx) dengan gaya tipografi yang konsisten dengan "Pinned" (`text-xl sm:text-2xl font-normal text-ink tracking-tight font-sans`) <!-- id: 277 -->
- [x] Validasi typecheck TypeScript (`tsc --noEmit`) dan Astro diagnostics (`astro check`) dengan 0 error <!-- id: 278 -->

## Phase 46: Mobile Timeline Ergonomics Polish (Right-aligned Date, No Dots/Underline, Borderless Divider Notes) <!-- id: 279 -->
- [x] Posisikan teks label tanggal/waktu timeline ("Today", dateKey) di sebelah kanan (`justify-end text-right`) khusus mobile, hapus bullet/dot mobile, hapus divider border bawah tanggal, dan perbesar font size menjadi `text-xl md:text-body-md font-semibold tracking-tight` pada [NotesTimeline.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/NotesTimeline.tsx) <!-- id: 280 -->
- [x] Implementasikan varian kartu timeline borderless pada mobile di [NoteCard.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/NoteCard.tsx): hilangkan box border keliling, sudut bulat, dan background canvas (`border-0 rounded-none bg-transparent`), gantikan dengan divider horizontal tipis pemisah antar catatan (`border-b border-hairline last:border-b-0 md:border md:border-hairline md:last:border-b`), serta pulihkan tampilan box kartu normal pada desktop (`md:`) <!-- id: 281 -->
- [x] Validasi typecheck TypeScript (`tsc --noEmit`) dan Astro diagnostics (`astro check`) dengan 0 error <!-- id: 282 -->

## Phase 47: Schedule Page Mobile Notes Divider & Category Badge Removal <!-- id: 283 -->
- [x] Tambahkan dukungan properti `showCategory` (default: true) pada [NoteCard.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/NoteCard.tsx) untuk menyembunyikan badge kategori dan meratakan aksi tombol ke pojok kanan saat kategori di-hide <!-- id: 284 -->
- [x] Terapkan varian `variant="timeline"` dan `showCategory={false}` pada kartu catatan jadwal di [ScheduleView.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/ScheduleView.tsx) sehingga di mobile tidak menggunakan box border melainkan dipisahkan divider horizontal serta badge kategori dihilangkan <!-- id: 285 -->
- [x] Validasi typecheck TypeScript (`tsc --noEmit`) dan Astro diagnostics (`astro check`) dengan 0 error <!-- id: 286 -->

## Phase 48: Schedule Calendar Header Cleanup & Proportional Size Enlargement <!-- id: 287 -->
- [x] Hapus badge keterangan "{n} hari aktif" dan tombol "Hari Ini" dari header kalender di [ScheduleView.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/ScheduleView.tsx) serta bersihkan memo `activeDaysInMonth` <!-- id: 288 -->
- [x] Perbesar skala kalender secara proporsional: tingkatkan max-width kontainer menjadi `max-w-xl sm:max-w-2xl`, perlebar padding menjadi `p-4 sm:p-6 rounded-2xl`, serta perbesar sel tanggal (`h-11 sm:h-13`), tombol tanggal (`w-10 h-10 sm:w-12 sm:h-12`), dan tombol navigasi bulan agar lebih lega dan nyaman diakses <!-- id: 289 -->
- [x] Validasi typecheck TypeScript (`tsc --noEmit`) dan Astro diagnostics (`astro check`) dengan 0 error <!-- id: 290 -->

## Phase 49: Schedule View Section Header Minimalization, Today Green Ring Circle & Dynamic Date Title <!-- id: 291 -->
- [x] Hapus icon pendamping `CalendarDays` pada judul seksi "Kalender Jadwal" di [ScheduleView.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/ScheduleView.tsx) agar seragam minimal <!-- id: 292 -->
- [x] Hapus badge jumlah notes (`CommandTag`) pada seksi "Agenda dan Catatan Jadwal" <!-- id: 293 -->
- [x] Beri tanda tanggal Today di kalender dengan circle berwarna hijau (`today: '[&>button]:!ring-2 [&>button]:!ring-terminal-green [&>button]:!text-terminal-green font-semibold'`) <!-- id: 294 -->
- [x] Hapus tombol "Reset filter" di atas kalender dan tombol "Tampilkan semua" di galeri catatan saat tanggal dipilih <!-- id: 295 -->
- [x] Update judul seksi catatan secara dinamis ketika tanggal dipilih menjadi `"Agenda dan Catatan Jadwal: {tanggal}"` (contoh: "Agenda dan Catatan Jadwal: 21 Oktober 2026") <!-- id: 296 -->
- [x] Validasi typecheck TypeScript (`tsc --noEmit`) dan Astro diagnostics (`astro check`) dengan 0 error <!-- id: 297 -->

## Phase 50: Workspace Filter Date Presets Removal <!-- id: 298 -->
- [x] Hapus tombol opsi preset filter waktu ("All time", "Hari Ini", "Minggu Ini", "Bulan Ini") pada popover filter catatan Workspace di [NotesFilterPopover.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/NotesFilterPopover.tsx) <!-- id: 299 -->
- [x] Sederhanakan komponen: hapus helper unused `handlePresetSelect` serta fungsi pembantu `date-fns` terkait, dan tambahkan tombol Reset tanggal kontekstual saat rentang tanggal aktif <!-- id: 300 -->
- [x] Validasi typecheck TypeScript (`tsc --noEmit`) dengan 0 error <!-- id: 301 -->

## Phase 51: Schedule Calendar Today Indicator Neutral Gray Circle Pass <!-- id: 302 -->
- [x] Ubah penanda Today di kalender [ScheduleView.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/ScheduleView.tsx) menjadi circle dengan background warna abu-abu netral (`!bg-hairline hover:!bg-hairline-strong`), tanpa ring hijau, dan warna teks tetap hitam (`!text-ink font-semibold`) <!-- id: 303 -->
- [x] Validasi typecheck TypeScript (`tsc --noEmit`) dengan 0 error <!-- id: 304 -->

## Phase 52: Vault & Credentials Split Layout & Bookmarks-Aligned Architecture <!-- id: 305 -->
- [x] Pasang segmented control / grouped radio button di sebelah searchbox pada [VaultView.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/VaultView.tsx) untuk beralih antara menu **Credential** (default) dan **Vault** <!-- id: 306 -->
- [x] Hapus banner / card Zero-Knowledge di sidebar kiri sesuai instruksi pengguna <!-- id: 307 -->
- [x] Implementasikan TOC (Table of Contents) di kolom sebelah kiri dengan gaya dan konsep yang seragam dengan Bookmarks (tombol pill "Semua" + filter tag dinamis beserta badge counter angka) <!-- id: 308 -->
- [x] Rancang layout galeri kartu catatan di kolom kanan (bagian Pinned jika ada, dan pengelompokan seksi per kategori/tag dengan tombol ekspansi jika > 4 kartu) selaras dengan layout Bookmarks <!-- id: 309 -->
- [x] Standarisasi gaya card notes rahasia/vault agar selaras dengan kartu catatan Workspace (badge kategori di kiri atas, toolbar aksi di kanan atas, preview masked atau decrypted plaintext, dan penanggalan rapi) <!-- id: 310 -->
- [x] Tambahkan kueri filter `category: 'vault'` pada [vault.astro](file:///d:/Code/unlazynotes/src/pages/dashboard/vault.astro) agar data kedua menu terambil dengan lengkap <!-- id: 311 -->
- [x] Validasi typecheck TypeScript (`tsc --noEmit`) dengan 0 error <!-- id: 312 -->

## Phase 53: Vault & Credentials Floating Action Button & Header Controls Refinement <!-- id: 313 -->
- [x] Ubah tombol tambah data pada [VaultView.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/VaultView.tsx) menjadi Floating Action Button (FAB) di sudut kanan bawah dengan label dinamis ("Tambah Credential" saat di tab Credential, dan "Tambah Vault" saat di tab Vault) <!-- id: 314 -->
- [x] Posisikan SearchPill langsung di samping kanan segmented tabs (tanpa perataan tengah / `justify-between`) <!-- id: 315 -->
- [x] Hapus border dari box putih pada item tab yang sedang terpilih (`bg-canvas text-ink shadow-xs font-semibold`) <!-- id: 316 -->
- [x] Validasi typecheck TypeScript (`tsc --noEmit`) dengan 0 error <!-- id: 317 -->

## Phase 54: Bookmarks Gallery Showcase Curated Sections & Compact TOC Navigation <!-- id: 318 -->
- [x] Kurasi seksi galeri tengah: hanya buat seksi terpisah untuk tag/platform dengan minimal 2 catatan (`count >= 2`), dibatasi top 5 tags terpopuler <!-- id: 319 -->
- [x] Kelompokkan sisa catatan bertag tunggal / frekuensi rendah ke dalam seksi penutup 'Koleksi Lainnya' (`#section-other`) tanpa ada catatan yang tertinggal <!-- id: 320 -->
- [x] Sinkronkan item Table of Contents (TOC) di sidebar kiri secara compact (6-8 item: Semua, Pinned jika ada, top curated tags, dan Koleksi Lainnya) <!-- id: 321 -->
- [x] Implementasikan smooth-scroll navigasi pada klik TOC dan observer ScrollSpy untuk highlight dinamis <!-- id: 322 -->
- [x] Validasi typecheck TypeScript (`tsc --noEmit`) dengan 0 error <!-- id: 323 -->

## Phase 55: Vault & Bookmarks Empty State Centering, Zero Top Spacing & Standard NoteCard Integration <!-- id: 324 -->
- [x] Standarisasi tampilan empty state pada [VaultView.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/VaultView.tsx) dan [BookmarksView.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/BookmarksView.tsx): sembunyikan TOC saat belum ada catatan sehingga icon dan deskripsi empty state tampil tepat di tengah <!-- id: 325 -->
- [x] Hapus phantom top spacing/margin pada kolom kanan [BookmarksView.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/BookmarksView.tsx) dengan mengeliminasi elemen jangkar kosong berjarak serta menghapus `pt-2` pada seksi kartu sehingga sejajar dengan TOC <!-- id: 326 -->
- [x] Pasang komponen [NoteCard.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/NoteCard.tsx) pada [VaultView.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/VaultView.tsx) untuk tab Credential tanpa masking rahasia, tanpa tampilan tanggal/waktu (`showDateTime={false}`), dan tanpa hashtag (`showTags={false}`) <!-- id: 327 -->
- [x] Pastikan perilaku klik card identik dengan Workspace: di mobile klik mengekspansi kartu secara in-place beserta tombol salin, edit, dan hapus; di desktop klik membuka [NoteDetailModal.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/NoteDetailModal.tsx) <!-- id: 328 -->
- [x] Dekripsi catatan terenkripsi di server-side [vault.astro](file:///d:/Code/unlazynotes/src/pages/dashboard/vault.astro) agar teks langsung terbaca jelas tanpa format sandi acak <!-- id: 329 -->
- [x] Validasi typecheck TypeScript (`tsc --noEmit`) dengan 0 error <!-- id: 330 -->

## Phase 56: Schedule View Calendar Title Removal & Header Spacing/Typography Polish <!-- id: 331 -->
- [x] Hapus section title "Kalender Jadwal" pada [ScheduleView.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/ScheduleView.tsx) sehingga kalender langsung tampil tanpa heading seksi <!-- id: 332 -->
- [x] Perbesar font size calendar header (nama bulan dan tahun) menjadi `text-lg sm:text-xl font-semibold` <!-- id: 333 -->
- [x] Berikan space gap antara baris header kalender (nama bulan, tahun, dan tombol navigasi) ke grid penanggalan dengan `mb-4 sm:mb-6` <!-- id: 334 -->
- [x] Validasi typecheck TypeScript (`tsc --noEmit`) dengan 0 error <!-- id: 335 -->

## Phase 57: Schedule View 2-Column Desktop Sticky Calendar Layout & Compact Resizing <!-- id: 336 -->
- [x] Rancang layout 2 kolom pada desktop (`flex-col lg:flex-row items-start gap-6 lg:gap-8`) di [ScheduleView.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/ScheduleView.tsx): kolom kiri untuk kalender dan kolom kanan untuk galeri agenda/catatan <!-- id: 337 -->
- [x] Buat komponen kalender sticky pada desktop (`lg:sticky lg:top-6`) sehingga tetap di posisinya saat daftar catatan jadwal di-scroll ke bawah <!-- id: 338 -->
- [x] Kecilkan ukuran komponen kalender secara proporsional (`w-full max-w-sm sm:max-w-md lg:w-[340px] xl:w-[360px]`, sel tanggal `h-9 sm:h-10`, tombol tanggal `w-8 h-8 sm:w-9 sm:h-9`, padding `p-3.5 sm:p-4`) agar padat dan rapi di sidebar <!-- id: 339 -->
- [x] Pertahankan tampilan mobile yang intuitif: kalender bertumpuk di atas, dan daftar catatan di bawahnya <!-- id: 340 -->
- [x] Validasi typecheck TypeScript (`tsc --noEmit`) dengan 0 error <!-- id: 341 -->

## Phase 58: Schedule View Calendar Large Scale Restoration <!-- id: 342 -->
- [x] Kembalikan ukuran komponen kalender pada [ScheduleView.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/ScheduleView.tsx) ke skala besar sebelumnya: padding `p-4 sm:p-6 rounded-2xl`, sel tanggal `h-11 sm:h-13`, tombol tanggal `w-10 h-10 sm:w-12 sm:h-12`, dan tombol navigasi `h-9 sm:h-10` <!-- id: 343 -->
- [x] Sesuaikan lebar kolom kiri kalender pada desktop menjadi `lg:w-[480px] xl:w-[540px]` agar menampung kalender besar dengan lega dan tetap sticky (`lg:sticky lg:top-6`) <!-- id: 344 -->
- [x] Validasi typecheck TypeScript (`tsc --noEmit`) dengan 0 error <!-- id: 345 -->

## Phase 59: Schedule View Calendar Fixed-Size Elimination of Shrinking Breakpoints & Responsive XL Multi-Column Alignment <!-- id: 346 -->
- [x] Hapus seluruh breakpoint pengecil ukuran (`sm:`, `md:`) pada elemen internal kalender [ScheduleView.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/ScheduleView.tsx) sehingga ukuran kalender konsisten stabil di semua ukuran layar (tombol tanggal `w-12 h-12`, sel tanggal `h-13`, padding `p-6`, judul bulan `text-xl`, tombol navigasi `h-10 w-10`) <!-- id: 347 -->
- [x] Pindahkan breakpoint layout 2 kolom dari `lg:` ke `xl:` (`flex-col xl:flex-row`), sehingga pada layar sedang/tablet (seperti pada screenshot) catatan tidak terjepit ke strip sempit melainkan bertumpuk lega di bawah kalender <!-- id: 348 -->
- [x] Pasang lebar presisi kontainer kalender `max-w-[440px] xl:w-[440px]` untuk membungkus kalender secara pas tanpa sisa margin kosong berlebih yang memakan ruang kolom catatan <!-- id: 349 -->
- [x] Validasi typecheck TypeScript (`tsc --noEmit`) dengan 0 error <!-- id: 350 -->

## Phase 60: Mobile Full-Width Calendar & Strict Single-Column Divider Mode Across All Dashboard Pages <!-- id: 351 -->
- [x] Perbarui kontainer kalender di [ScheduleView.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/ScheduleView.tsx) menjadi `w-full max-w-full` pada layar `< xl` agar membentang 100% mulus saat galeri catatan berada dalam 1 kolom <!-- id: 352 -->
- [x] Standardisasi kontainer galeri catatan di [ScheduleView.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/ScheduleView.tsx) menjadi `columns-1 md:columns-[280px]` <!-- id: 353 -->
- [x] Standardisasi galeri catatan di [NotesTimeline.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/NotesTimeline.tsx) menjadi `columns-1 md:columns-[300px] lg:columns-[320px]` sehingga strictly 1 kolom saat mode divider (`< md`) <!-- id: 354 -->
- [x] Standardisasi galeri tugas di [TodoView.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/TodoView.tsx) menjadi `columns-1 md:columns-[300px] lg:columns-[320px]` <!-- id: 355 -->
- [x] Standardisasi galeri catatan rahasia di [VaultView.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/VaultView.tsx) (section utama dan pinned) menjadi `columns-1 md:columns-[280px] lg:columns-[310px]` <!-- id: 356 -->
- [x] Standardisasi galeri tautan di [BookmarksView.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/BookmarksView.tsx) (section utama dan pinned) menjadi `columns-1 md:columns-[280px] lg:columns-[310px]` <!-- id: 357 -->
- [x] Validasi typecheck TypeScript (`tsc --noEmit`) dengan 0 error <!-- id: 358 -->

## Phase 63: Bookmark NoteCard & BookmarksView Thumbnail Position Below Notes & Border/Hover-Scale Removal <!-- id: 369 -->
- [x] Pindahkan posisi thumbnail OG image ke bawah teks catatan di [NoteCard.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/NoteCard.tsx) <!-- id: 370 -->
- [x] Pindahkan posisi thumbnail OG image ke bawah teks catatan di [BookmarksView.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/BookmarksView.tsx) dengan struktur kartu terpadu (`p-3.5 sm:p-4`) <!-- id: 371 -->
- [x] Hapus border tambahan pada thumbnail OG image di [NoteCard.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/NoteCard.tsx) dan [BookmarksView.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/BookmarksView.tsx) <!-- id: 372 -->
- [x] Hapus efek animasi hover scale (`group-hover:scale-[1.02]`) pada gambar thumbnail di kedua halaman <!-- id: 373 -->
- [x] Validasi typecheck TypeScript (`tsc --noEmit`) dengan 0 error <!-- id: 374 -->

## Phase 64: Schedule Calendar Desktop Width Expansion & Symmetrical Padding Alignment <!-- id: 375 -->
- [x] Perlebar kolom kalender desktop pada [ScheduleView.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/ScheduleView.tsx) dari `440px` menjadi `480px` (`xl:w-[480px]`) agar lebih lapang dan proporsional terhadap galeri agenda <!-- id: 376 -->
- [x] Terapkan `className="p-0 sm:p-0 w-full"` pada `<Calendar>` untuk menetralkan padding bawaan `DayPicker` (`sm:p-4`) yang sebelumnya mendesak tabel penanggalan ke arah kanan <!-- id: 377 -->
- [x] Pasang `table-fixed` pada `month_grid` di [Calendar.tsx](file:///d:/Code/unlazynotes/src/components/ui/Calendar.tsx) dan [ScheduleView.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/ScheduleView.tsx) untuk menjamin ketujuh kolom hari terbagi rata secara presisi (14.28% per kolom) <!-- id: 378 -->
- [x] Sejajarkan tombol navigasi `<` dan `>` dengan kolom pertama dan terakhir secara simetris (`px-2`) <!-- id: 379 -->
- [x] Validasi typecheck TypeScript (`tsc --noEmit`) dengan 0 error <!-- id: 380 -->

## Phase 65: Schedule View Notes Max 4 Columns Cap & Expanded Card Max-Width <!-- id: 381 -->
- [x] Batasi galeri catatan di [ScheduleView.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/ScheduleView.tsx) maksimal 4 kolom menggunakan `columns-1 md:columns-4 md:[column-count:4]` <!-- id: 382 -->
- [x] Tingkatkan lebar kartu catatan secara proporsional dengan menaikkan target column-width dari `280px` menjadi `320px` (`md:[column-width:320px]`) agar isi catatan tidak cepat terpotong <!-- id: 383 -->
- [x] Atur batas lebar kontainer galeri menjadi `max-w-full 2xl:max-w-[105rem]` agar tampilan tetap seimbang di layar resolusi tinggi/ultrawide <!-- id: 384 -->
- [x] Validasi typecheck TypeScript (`tsc --noEmit`) dengan 0 error <!-- id: 385 -->

## Phase 66: Vault & Credentials Bookmarks-Aligned System & Secure Key-Value Masking Architecture <!-- id: 386 -->
- [x] Sinkronkan sistem layout, seksi kurasi showcase (tags >= 2, top 5, plus Koleksi Lainnya), dan TOC compact (6-8 items) di [VaultView.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/VaultView.tsx) agar 100% selaras dengan Bookmarks <!-- id: 387 -->
- [x] Implementasikan smooth scrolling navigasi TOC dan ScrollSpy `IntersectionObserver` pada [VaultView.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/VaultView.tsx) <!-- id: 388 -->
- [x] Rancang arsitektur kartu catatan rahasia (`VaultCard`) dengan struktur hierarki Key (`vaultKey`) dan Value (`content`) <!-- id: 389 -->
- [x] Terapkan secure masking bawaan (`••••••••••••••••`) pada Value dengan fungsi buka/tutup (toggle reveal/hide) via tombol `Eye/EyeOff` serta klik box nilai rahasia <!-- id: 390 -->
- [x] Tampilkan label Key secara jelas di header kartu dan di modal detail [NoteDetailModal.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/NoteDetailModal.tsx) <!-- id: 391 -->
- [x] Validasi typecheck TypeScript (`tsc --noEmit`) dengan 0 error <!-- id: 392 -->

## Phase 67: Credential Tab Standard NoteCard Restoration & Dedicated Vault Key-Value Masking Separation <!-- id: 393 -->
- [x] Kembalikan tampilan tab Credential pada [VaultView.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/VaultView.tsx) menjadi kartu catatan standar biasa (`NoteCard.tsx`) tanpa masking rahasia sesuai spesifikasi pengguna <!-- id: 394 -->
- [x] Khususkan kartu Key-Value dengan secure masking dan fungsi buka/tutup (reveal/hide) untuk catatan di tab Vault (`VaultCard`) <!-- id: 395 -->
- [x] Pastikan sistem layout showcase, kurasi seksi (count >= 2, top 5, plus Koleksi Lainnya), dan TOC compact (6-8 items) tetap aktif dan seragam di kedua tab <!-- id: 396 -->
- [x] Validasi typecheck TypeScript (`tsc --noEmit`) dengan 0 error <!-- id: 397 -->

## Phase 68: Credential Standard Notes Clean-up & Vault Key-Value Modal Alignment <!-- id: 398 -->
- [x] Sempurnakan klasifikasi catatan dan ekstraksi tag (`isVaultItem` & `getNoteTags`) di [VaultView.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/VaultView.tsx) agar kredensial murni tidak menggunakan fallback `vaultKey` <!-- id: 399 -->
- [x] Sembunyikan field input "Key / Label" pada modal tambah catatan saat tab aktif adalah Credential, sehingga modal hanya meminta input konten catatan biasa dan tags <!-- id: 400 -->
- [x] Sesuaikan `handleCreate` agar hanya menyertakan `vaultKey` saat membuat catatan di tab Vault <!-- id: 401 -->
- [x] Batasi banner "Key / Label" di [NoteDetailModal.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/NoteDetailModal.tsx) khusus untuk catatan Vault saja, sedangkan catatan kredensial tampil sebagai catatan biasa tanpa key/label header <!-- id: 402 -->
- [x] Validasi typecheck TypeScript (`tsc --noEmit`) dengan 0 error <!-- id: 403 -->

## Phase 69: Seeding Dummy Notes for Credential Category <!-- id: 404 -->
- [x] Buat skrip seeder terenkripsi AES-256 [seed-credentials.ts](file:///d:/Code/unlazynotes/scripts/seed-credentials.ts) dengan 10 catatan kredensial realistis (Wi-Fi, server SSH/bastion, database replica/redis, akun team/bot, VPN wireguard, DNS) <!-- id: 405 -->
- [x] Konfigurasikan tag terdistribusi (`wifi`, `server`, `database`, `akun`, `vpn`, `domain`) agar membentuk seksi kurasi bertingkat (tag count >= 2) dan TOC compact di tab Credential <!-- id: 406 -->
- [x] Eksekusi seed ke seluruh akun pengguna di database lokal dan verifikasi dekripsi serta pemetaan kartu berjalan presisi <!-- id: 407 -->
- [x] Validasi typecheck TypeScript (`tsc --noEmit`) dengan 0 error <!-- id: 408 -->

## Phase 70: Vault Layout Spacing Alignment & Standard Sizing Card Refactor <!-- id: 409 -->
- [x] Samakan posisi mulai konten dan jarak gap antar row dengan Bookmarks di [VaultView.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/VaultView.tsx): hapus dummy anchor div `scroll-mt-6`, pasang id `section-all` langsung pada kontainer utama, dan hapus `pt-2` pada seksi kurasi <!-- id: 410 -->
- [x] Standardisasi ukuran kartu catatan `VaultCard` agar sama persis dengan `NoteCard` (`p-3.5 rounded-lg border border-hairline bg-canvas hover:border-hairline-strong`) <!-- id: 411 -->
- [x] Sederhanakan toolbar aksi default pada kartu Vault menjadi hanya tombol Hapus dan Pin (tanpa tombol mata/reveal, salin, dan edit) <!-- id: 412 -->
- [x] Hapus icon gembok dan tampilan hashtag pada kartu catatan Vault <!-- id: 413 -->
- [x] Hilangkan background box pada secret value kartu Vault, diganti dengan masked text langsung menyerupai teks catatan biasa <!-- id: 414 -->
- [x] Pastikan klik pada kartu Vault membuka `NoteDetailModal` untuk melihat nilai rahasia lengkap dan aksi terkait <!-- id: 415 -->
- [x] Validasi typecheck TypeScript (`tsc --noEmit`) dengan 0 error <!-- id: 416 -->

## Phase 71: Regular User Notes Purge & Seeder Admin Restriction <!-- id: 417 -->
- [x] Hapus seluruh catatan dummy pada akun user biasa (`usr_test_riku_01` dan `usr_1792430221638`) sehingga kembali kosong bersih (0 notes) <!-- id: 418 -->
- [x] Pertahankan seluruh 74 catatan pada akun admin (`usr_1792431114098`, `riku@unlazynotes.local`) <!-- id: 419 -->
- [x] Batasi skrip seeder [seed-credentials.ts](file:///d:/Code/unlazynotes/scripts/seed-credentials.ts) khusus untuk akun `role: 'admin'` <!-- id: 420 -->
- [x] Validasi typecheck TypeScript (`tsc --noEmit`) dengan 0 error <!-- id: 421 -->

## Phase 72: Vault Key Icon, Modal Key Fields, & Credential Card Simplification <!-- id: 422 -->
- [x] Tambahkan icon key (`KeyRound`) di samping nama key pada kartu catatan Vault di [VaultView.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/VaultView.tsx) <!-- id: 423 -->
- [x] Batasi teks masking bawaan kartu Vault menjadi 4 titik (`••••`) <!-- id: 424 -->
- [x] Sembunyikan tanggal dan waktu (`showDateTime={false}`) pada kartu catatan di tab Credential <!-- id: 425 -->
- [x] Tambahkan field `Key` di atas konten catatan pada pop-up view [NoteDetailModal.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/NoteDetailModal.tsx) <!-- id: 426 -->
- [x] Tambahkan field editable `Key` di atas textarea konten pada pop-up edit [EditNoteModal.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/EditNoteModal.tsx) <!-- id: 427 -->
- [x] Dukung pembaruan `vaultKey` dan enkripsi ulang otomatis pada endpoint `PATCH /api/notes/[id].ts` <!-- id: 428 -->
- [x] Validasi typecheck TypeScript (`tsc --noEmit`) dengan 0 error <!-- id: 429 -->

## Phase 74: Vault Key View Modal Integration & Compact Ring-Free Refinement <!-- id: 434 -->
- [x] Tampilkan field `Key` secara konsisten pada modal view detail [NoteDetailModal.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/NoteDetailModal.tsx) untuk catatan Vault <!-- id: 435 -->
- [x] Hapus efek aktif border/ring (`focus-within:border-ink`) pada field `Key` di modal edit, create, dan detail <!-- id: 436 -->
- [x] Perkecil batas lebar maksimum field `Key` menjadi compact (`w-full max-w-xs sm:max-w-sm`) di semua modal <!-- id: 437 -->
- [x] Validasi typecheck TypeScript (`tsc --noEmit`) dengan 0 error <!-- id: 438 -->

## Phase 75: Bookmarks & Vault TOC Sticky Navigation, Compact Density & Typography Polish <!-- id: 439 -->
- [x] Buat komponen TOC sticky pada [BookmarksView.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/BookmarksView.tsx) dan [VaultView.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/VaultView.tsx) (`sticky top-0 sm:top-6 self-start`) dan bersihkan `overflow-x-hidden` pada container agar sticky menempel mulus saat catatan di-scroll <!-- id: 440 -->
- [x] Padatkan ukuran tombol TOC menjadi lebih ramping dan compact (`py-1.5 px-3`, `gap-1.5`) <!-- id: 441 -->
- [x] Ubah font-weight item TOC menjadi tidak tebal (`font-normal`) baik saat aktif maupun inaktif <!-- id: 442 -->
- [x] Perbesar font-size angka keterangan jumlah catatan pada TOC menjadi `text-xs sm:text-[13px]` tabular-nums agar lebih jelas terbaca <!-- id: 443 -->
- [x] Validasi typecheck TypeScript (`tsc --noEmit`) dengan 0 error <!-- id: 444 -->

## Phase 76: Vault Excel-Style Compact Grid & TOC Removal <!-- id: 445 -->
- [x] Hapus sidebar TOC dan pengelompokan hashtag khusus pada tab Vault di [VaultView.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/VaultView.tsx) (halaman Credential tetap mempertahankan TOC) <!-- id: 446 -->
- [x] Re-architect card Vault menjadi compact tile bergaya sel Excel (`VaultCompactTile`, `h-10 px-3`) menampilkan key saja tanpa icon <!-- id: 447 -->
- [x] Tambahkan action button sematkan (Pin) dan hapus (Delete) pada tiap compact tile Vault <!-- id: 448 -->
- [x] Terapkan width `fit-content` (`w-fit max-w-full`) pada tiap item Vault desktop agar lebarnya bervariasi mengikuti panjang key <!-- id: 452 -->
- [x] Kelompokkan tampilan Vault menjadi section Pinned dan Semua Vault / unpinned <!-- id: 450 -->
- [x] Validasi typecheck TypeScript (`tsc --noEmit`) dengan 0 error <!-- id: 451 -->

## Phase 77: Vault Mobile Divider Layout & Inline Content Reveal <!-- id: 453 -->
- [x] Ubah tampilan mobile Vault menjadi full width (`w-full`) tanpa card box (`rounded-none border-0 border-b border-hairline bg-transparent px-1 py-3.5`) bergaya divider line seperti notes lainnya <!-- id: 454 -->
- [x] Tambahkan interaksi klik pada mobile untuk me-reveal isi konten penuh secara inline (`isExpanded`) lengkap dengan tombol Salin (Copy), Edit, Pin, Hapus, dan Ciutkan (Collapse) <!-- id: 455 -->
- [x] Pertahankan tampilan desktop sebagai compact `w-fit` tile dengan klik membuka modal detail <!-- id: 456 -->
- [x] Validasi typecheck TypeScript (`tsc --noEmit`) dengan 0 error <!-- id: 457 -->

## Phase 78: Vault Mobile Compact Density, Single-Row Controls, Tag Isolation & Modal Key Alignment <!-- id: 458 -->
- [x] Padatkan padding atas-bawah tampilan mobile Vault (`py-2`, `!p-3 !my-1.5`) dan hapus garis divider pada area konten yang ter-reveal <!-- id: 459 -->
- [x] Posisikan tabs Credential/Vault dan search box berada di satu baris yang sama berdampingan pada mobile (`flex-nowrap w-full`, search box `flex-1 min-w-0`) <!-- id: 460 -->
- [x] Pastikan catatan Vault murni hanya Key dan teks catatan saja tanpa tags (hilangkan tags pada modal detail, modal edit, dan simpan tag kosong pada create/patch) <!-- id: 461 -->
- [x] Rombak posisi field Key dan labelnya pada pop-up modal (Create, Detail, Edit) menjadi berdampingan horizontal (kiri-kanan) dan perbesar font-size label Key <!-- id: 462 -->
- [x] Validasi typecheck TypeScript (`tsc --noEmit`) dengan 0 error <!-- id: 463 -->

## Phase 80: Bookmarks Mobile Space-Saving List View & Side-by-Side Compact Thumbnail <!-- id: 471 -->
- [x] Rombak tampilan kartu bookmark pada layar mobile menjadi format list horizontal (`flex-row items-start gap-3`) di [BookmarksView.tsx](file:///d:/Code/unlazynotes/src/components/dashboard/BookmarksView.tsx) <!-- id: 472 -->
- [x] Posisikan thumbnail OG image di sebelah kanan catatan dengan ukuran kecil/compact (`w-20 h-20 sm:w-24 sm:h-24 rounded-lg object-cover shrink-0`) <!-- id: 473 -->
- [x] Posisikan catatan dan action toolbar (Pin, Delete) di sebelah kiri dengan pembatasan baris `line-clamp-3` agar menghemat ruang layar vertikal secara signifikan <!-- id: 474 -->
- [x] Pertahankan tampilan multi-column masonry di desktop (`md:`) dengan thumbnail berada di bawah catatan <!-- id: 475 -->
- [x] Validasi typecheck TypeScript (`tsc --noEmit`) dengan 0 error <!-- id: 476 -->

## Phase 81: Vault Desktop Dedicated Full-Height Right Sidebar Layout <!-- id: 477 -->
- [x] Rombak arsitektur layout halaman Vault menjadi 3-kolom desktop: Sidebar Utama kiri (`w-64`), Kolom Tengah daftar tile vault (`flex-1 overflow-y-auto`), dan Sidebar Kanan detail/editor (`w-[420px] xl:w-[480px] 2xl:w-[540px] h-full border-l border-hairline`) <!-- id: 478 -->
- [x] Bentangkan height panel kanan full ke atas (`h-full` 100% viewport) dari tepi atas hingga bawah layar dengan pembatas vertikal continuous `border-l border-hairline` mirip sidebar kiri <!-- id: 479 -->
- [x] Sediakan space kosong yang luas dan tenang (empty state) saat belum ada catatan yang dipilih, lengkap dengan header status vault <!-- id: 480 -->
- [x] Implementasikan mode pembaca luas dan mode edit in-place setinggi sidebar dengan textarea ekspansif dan tombol aksi simpan/batal <!-- id: 481 -->
- [x] Sesuaikan posisi tombol floating action (Tambah Vault) agar tidak menimpa sidebar kanan pada breakpoint desktop (`lg:`) <!-- id: 482 -->
- [x] Validasi TypeScript (`npm run typecheck`) berhasil dengan 0 error <!-- id: 483 -->

## Phase 83: Vault Item Action Icons Size Standardization <!-- id: 494 -->
- [x] Samakan ukuran ikon aksi sematkan (Pin) dan hapus (Delete) di setiap item Vault menjadi `w-4 h-4` (16px) sesuai ukuran di kartu Kredensial <!-- id: 495 -->
- [x] Terapkan ukuran `w-4 h-4` seragam pada `VaultCompactTile` (desktop), `VaultMobileItem` (mobile), serta header panel detail kanan <!-- id: 496 -->
- [x] Validasi TypeScript (`tsc --noEmit`) dengan 0 error <!-- id: 497 -->

## Phase 83: Vault Multi-Item Selection, Auto-Display on Search & Borderless Key Input <!-- id: 498 -->
- [x] Ubah input Key/Identifier pada mode edit menjadi borderless tanpa box (`bg-transparent border-0 p-0 focus:ring-0`) persis seperti textarea isi catatan <!-- id: 499 -->
- [x] Terapkan dukungan pemilihan banyak item vault sekaligus (`selectedVaultItemIds`) dengan klik toggle pada tile desktop <!-- id: 500 -->
- [x] Tampilkan seluruh item terpilih dalam sidebar kanan secara vertikal, masing-masing dipisahkan oleh divider line hairline, dan dapat di-scroll ke bawah saat jumlah item banyak <!-- id: 501 -->
- [x] Implementasikan auto-display pada pencarian kata kunci: jika user mengetik di search box (misal: "docker"), seluruh catatan yang cocok langsung otomatis ditampilkan bersamaan di sidebar kanan dengan pemisah divider <!-- id: 502 -->
- [x] Sediakan toolbar aksi independen (Pin, Salin, Edit in-place, Hapus, dan Tutup dari panel) untuk tiap item dalam sidebar kanan <!-- id: 503 -->
- [x] Validasi TypeScript (`npm run typecheck`) berhasil dengan 0 error <!-- id: 504 -->

## Phase 84: Vault Tile Border Clipping Bugfix & Compact Right Sidebar with Key Icon <!-- id: 505 -->
- [x] Perbaiki bug clipping border bawah pada card desktop: ganti `last:border-b-0` menjadi `max-lg:last:border-b-0` pada `VaultCompactTile` agar pada desktop (`lg:`) seluruh card mempertahankan border 4 sisi utuh <!-- id: 506 -->
- [x] Sinkronkan breakpoint flex container vault ke `lg:flex-row lg:flex-wrap items-stretch lg:items-center gap-0 lg:gap-2.5` <!-- id: 507 -->
- [x] Hapus label teks "Key / Identifier" dan "Isi Catatan" pada sidebar detail kanan <!-- id: 508 -->
- [x] Pasang ikon kunci (`KeyRound`) di samping value key identifier pada mode view dan mode edit <!-- id: 509 -->
- [x] Buat sidebar kanan lebih compact: padatkan padding (`px-5 py-4`), perkecil jarak elemen (`space-y-2.5`), dan padatkan divider antar catatan (`pt-3`) <!-- id: 510 -->
- [x] Ubah divider antar catatan dalam sidebar menjadi full-width menggunakan `divide-y divide-hairline` sehingga garis divider membentang penuh menyentuh border vertikal sidebar <!-- id: 512 -->
- [x] Validasi TypeScript (`npm run typecheck`) berhasil dengan 0 error <!-- id: 511 -->

## Phase 85: Plan Badge Contrast Improvement & Borderless Upgrade Button for Free Users <!-- id: 513 -->
- [x] Perbaiki kontras badge PRO dengan background solid hitam (`bg-ink`) dan teks putih (`text-canvas`) serta ukuran font yang diperbesar (`text-[11px] font-bold px-2.5 py-0.5 tracking-wider uppercase`) <!-- id: 514 -->
- [x] Ganti badge Free pada user Free menjadi tombol Upgrade tanpa border (`border-0`) baik di top navigation mobile, top sidebar desktop, maupun profil card <!-- id: 515 -->
- [x] Hubungkan tombol Upgrade untuk membuka `UpgradeModal` secara interaktif <!-- id: 516 -->
- [x] Validasi typecheck dengan `npm run typecheck` (`tsc --noEmit`) dengan 0 error <!-- id: 517 -->

## Phase 86: Admin Panel Header Spacing, Filter Popover & Borderless Table <!-- id: 518 -->
- [x] Hapus badge ADMIN pada header User Admin Panel <!-- id: 519 -->
- [x] Samakan top spacing/margin header Admin Panel dengan halaman dashboard lain (pt-3.5 sm:pt-6 pb-2 sm:pb-3) dan hilangkan excess spacing dari root container <!-- id: 520 -->
- [x] Ganti tab segmented Direktori Pengguna (Semua, Pro, Free, Admin) menjadi tombol filter SlidersHorizontal + modal pop-up seragam (NotesFilterPopover variant admin) <!-- id: 521 -->
- [x] Hapus divider antar row tabel (	body) dan divider pada header tabel (	head) di direktori pengguna <!-- id: 522 -->
- [x] Validasi typecheck dengan 	sc --noEmit dengan 0 error <!-- id: 523 -->


## Phase 87: Bookmarks & Credential Sticky TOC Mobile Full-Width and Scrollbar Concealment <!-- id: 524 -->
- [x] Sembunyikan horizontal scrollbar pada sticky TOC di mobile (`no-scrollbar`, `[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden`) di BookmarksView.tsx dan VaultView.tsx <!-- id: 525 -->
- [x] Perbaiki width sticky TOC container di mobile menjadi `w-[calc(100%+2rem)]` dengan `-mx-4 px-4` agar background solid white/canvas menutup penuh 100% layar (edge-to-edge) tanpa celah tembus/bocor di sisi kanan/kiri <!-- id: 526 -->
- [x] Tambahkan utility `.no-scrollbar` di src/styles/global.css <!-- id: 527 -->
- [x] Validasi typecheck dengan `tsc --noEmit` dengan 0 error <!-- id: 528 -->

## Phase 88: Admin Panel Table Pagination Divider Removal <!-- id: 529 -->
- [x] Hapus garis horizontal (`border-t border-hairline`) sebelum konten pagination footer tabel di AdminDashboard.tsx <!-- id: 530 -->
- [x] Validasi typecheck dengan `tsc --noEmit` dengan 0 error <!-- id: 531 -->

## Phase 89: Settings Mobile 2x2 Cards Grid, Side-by-Side Action Buttons & Typography Normalization <!-- id: 532 -->
- [x] Ubah 4 card status akun (Plan Active, Plan Expired, Quota Notes, Quota /ask) di mobile menjadi grid 2x2 (grid-cols-2) <!-- id: 533 -->
- [x] Posisikan tombol Hubungkan Telegram dan Regenerate Key secara berdampingan (sebelahan) di tampilan mobile <!-- id: 534 -->
- [x] Samakan tinggi input field API Key, tombol Hubungkan Telegram, dan tombol Regenerate Key menjadi identik h-10 (40px) di mobile dan desktop <!-- id: 535 -->
- [x] Normalkan font pada deskripsi bot Telegram dan text Guide menggunakan font biasa/sans, menyisakan font khusus hanya untuk contoh perintah /login <!-- id: 536 -->
- [x] Validasi typecheck dengan \	sc --noEmit\ dengan 0 error <!-- id: 537 -->

## Phase 90: Mobile Note Card Tag Backgrounds & Clean Top Navigation <!-- id: 538 -->
- [x] Sesuaikan background tags (`specificTags`, `category`, preview link, dan attachment) saat card notes diklik/expanded pada mobile menjadi abu-abu (`bg-zinc-100 border border-hairline-strong`) selaras dengan background kartu aktif <!-- id: 539 -->
- [x] Hapus badge PRO/FREE dan tombol Upgrade dari navigation top di mobile (`header.md:hidden`) dan desktop sidebar top <!-- id: 540 -->
- [x] Pastikan tombol Upgrade dan badge PRO tetap tertampil rapi di samping nama user pada Profile Card (sidebar desktop dan drawer sheet mobile) <!-- id: 541 -->
- [x] Validasi TypeScript (`npm run typecheck`) berhasil dengan 0 error <!-- id: 542 -->

## Phase 91: Bookmarks Mobile Divider-Based Rows, In-Place Expansion & Top-Aligned OG Thumbnail <!-- id: 543 -->
- [x] Ubah kartu bookmark di mobile menjadi baris bergaris pembatas (divider-only) tanpa box kartu (ounded-none border-0 border-b border-hairline bg-transparent\) <!-- id: 544 -->
- [x] Terapkan ekspansi in-place langsung saat bookmark diklik di mobile tanpa membuka modal detail, menyajikan konten teks lengkap, daftar link domain, dan hashtag <!-- id: 545 -->
- [x] Sediakan tombol Edit (Pencil) pada toolbar mode ekspansi mobile yang membuka EditNoteModal hanya saat pengguna ingin mengedit <!-- id: 546 -->
- [x] Posisikan gambar OG thumbnail kecil di sisi kanan dengan perataan atas (\self-start\), tidak lagi berada di tengah (\self-center\) <!-- id: 547 -->
- [x] Validasi TypeScript (\	sc --noEmit\) berhasil dengan 0 error <!-- id: 548 -->

## Phase 92: Removal of "Enhance with AI" Button in Vault Creation Modal <!-- id: 549 -->
- [x] Hapus tombol "Enhance with AI" pada modal penambahan catatan rahasia/vault di `VaultView.tsx` untuk menjaga keamanan dan kerahasiaan data enkripsi agar tidak pernah dikirim ke LLM external <!-- id: 550 -->
- [x] Bersihkan state `isEnhancing`, handler `handleEnhance`, serta import ikon `Sparkles` yang tidak terpakai <!-- id: 551 -->
- [x] Validasi TypeScript (`npm run typecheck`) berhasil dengan 0 error <!-- id: 552 -->

## Phase 93: Universal Borderless & Backgroundless Hashtags in Mobile Expanded Note Cards <!-- id: 553 -->
- [x] Hilangkan border dan background pada tampilan hashtag (#tag) saat card notes di-expand pada mobile di NoteCard.tsx (mencakup halaman Workspace, Todo, Schedule, dan Vault Credentials) <!-- id: 554 -->
- [x] Hilangkan border dan background pada hashtag (#tag) saat card bookmark di-expand pada mobile di BookmarksView.tsx <!-- id: 555 -->
- [x] Terapkan tipografi bersih (	ext-caption-sm text-body hover:text-ink font-sans font-medium) tanpa pill padding/box <!-- id: 556 -->
- [x] Validasi TypeScript (
pm run typecheck) berhasil dengan 0 error <!-- id: 557 -->

## Phase 89: Workspace Uncategorized Notes Carousel Shelf <!-- id: 532 -->
- [x] Tambahkan section horizontal carousel "Uncategorized Notes" tepat di bawah section "Pinned" pada NotesTimeline.tsx <!-- id: 533 -->
- [x] Implementasikan mouse drag, tombol navigasi scroll desktop, card size responsif, dan interaksi seragam dengan Pinned shelf <!-- id: 534 -->
- [x] Validasi typecheck dengan `tsc --noEmit` dengan 0 error <!-- id: 535 -->

## Phase 94: Mute Color Alignment for Mobile Expanded Hashtag Texts <!-- id: 558 -->
- [x] Samakan warna teks hashtag (#tag) pada card notes mode expand di mobile dengan warna date & time (	ext-mute hover:text-ink) di NoteCard.tsx <!-- id: 559 -->
- [x] Samakan warna teks hashtag (#tag) pada card bookmark mode expand di mobile dengan warna date & time (	ext-mute hover:text-ink) di BookmarksView.tsx <!-- id: 560 -->
- [x] Validasi TypeScript (
pm run typecheck) berhasil dengan 0 error <!-- id: 561 -->

## Phase 90: Uncategorized Notes Category Badge Removal & Sync with AI Button <!-- id: 536 -->
- [x] Sembunyikan badge kategori pada kartu catatan di section Uncategorized Notes (`showCategory={false}`) di NotesTimeline.tsx <!-- id: 537 -->
- [x] Tambahkan tombol "Sync with AI" berdampingan dengan header judul "Uncategorized Notes" lengkap dengan icon Sparkles / Loader2 saat proses sinkronisasi <!-- id: 538 -->
- [x] Sediakan endpoint backend `POST /api/notes/sync` yang mengklasifikasikan catatan uncategorized via AI (`generateNoteTags`) dan mengembalikan data terbaru secara reaktif <!-- id: 539 -->
- [x] Validasi typecheck dengan `tsc --noEmit` dengan 0 error <!-- id: 540 -->

## Phase 95: Profile & Upgrade Button Decoupling in Desktop Sidebar & Mobile Sheet <!-- id: 562 -->
- [x] Pisahkan komponen Profil (Avatar + Nama User) dan tombol Upgrade menjadi dua komponen independen berdampingan pada sidebar desktop <!-- id: 563 -->
- [x] Pisahkan komponen Profil dan tombol Upgrade pada mobile sheet/drawer, serta hapus ikon panah kanan (ChevronRight) <!-- id: 564 -->
- [x] Hapus icon Sparkles dari tombol Upgrade dan perbesar areanya dengan tinggi seragam h-14 (56px) matching kartu profil <!-- id: 565 -->
- [x] Hilangkan border pada efek hover kedua komponen (hover:bg-surface-soft tanpa border) sehingga efek hover terisolasi pada masing-masing komponen <!-- id: 566 -->
- [x] Validasi TypeScript (
pm run typecheck) berhasil dengan 0 error <!-- id: 567 -->

## Phase 96: Standard Button Height and White Canvas Background for Upgrade Button <!-- id: 568 -->
- [x] Ubah background default tombol Upgrade menjadi putih/canvas (g-canvas) selaras dengan profil, dengan efek hover seragam (hover:bg-surface-soft) <!-- id: 569 -->
- [x] Ubah height tombol Upgrade menjadi ukuran button standar (h-9 px-3.5 rounded-full) tanpa menyamakan height dengan card profil <!-- id: 570 -->
- [x] Pastikan tombol Upgrade tetap borderless (order-0) baik di sidebar desktop maupun sheet mobile <!-- id: 571 -->
- [x] Validasi TypeScript (
pm run typecheck) berhasil dengan 0 error <!-- id: 572 -->

## Phase 97: Schedule Section Title Wording Simplification <!-- id: 573 -->
- [x] Ubah wording heading section pada `src/components/dashboard/ScheduleView.tsx` dari "Agenda dan Catatan Jadwal" menjadi "Agenda" (mendukung format tanggal terpilih maupun default) <!-- id: 574 -->
- [x] Validasi TypeScript (`npm run typecheck`) berhasil dengan 0 error <!-- id: 575 -->

## Phase 91: Settings Free Plan Upgrade Button Relocation & Profile Free Badge <!-- id: 541 -->
- [x] Hapus tombol "Upgrade ke Pro" di dalam card "plan active" pada SettingsView.tsx <!-- id: 542 -->
- [x] Buat tombol "Upgrade to Pro" berdampingan dengan tombol logout di SettingsView.tsx dengan ukuran dan format seragam <!-- id: 543 -->
- [x] Tambahkan badge "FREE" di bawah nama pengguna pada komponen profil desktop sidebar dan mobile drawer (Sidebar.tsx) serta kartu profil SettingsView.tsx <!-- id: 544 -->
- [x] Validasi typecheck dengan `tsc --noEmit` dengan 0 error <!-- id: 545 -->

## Phase 98: Calendar Navigation Border Removal & Responsive Unified White Floating Action Button (FAB) <!-- id: 576 -->
- [x] Hilangkan border lingkaran pada tombol navigasi bulan kalender (`button_previous` & `button_next`) di `ScheduleView.tsx` (`border-0 bg-transparent hover:bg-surface-soft`) <!-- id: 577 -->
- [x] Perbarui tombol Floating Action Button (FAB) di semua 5 halaman dashboard (`NotesTimeline.tsx`, `TodoView.tsx`, `ScheduleView.tsx`, `BookmarksView.tsx`, `VaultView.tsx`): <!-- id: 578 -->
  - Mobile: Tampilkan icon plus saja di dalam box lingkaran yang diperbesar (`w-14 h-14 rounded-full`, icon `w-7 h-7`), sembunyikan label teks (`hidden sm:inline`). <!-- id: 579 -->
  - Desktop: Tampilkan label teks dan icon plus berdampingan dalam pill button (`sm:w-auto sm:h-auto sm:py-3 sm:px-6`). <!-- id: 580 -->
  - Styling warna seragam: Background putih/canvas (`bg-canvas`), border halus (`border border-hairline`), teks dan icon hitam (`text-ink`), bayangan mengambang (`shadow-md`), dan tactile feedback (`hover:bg-surface-soft active:scale-95`). <!-- id: 581 -->
- [x] Validasi TypeScript (`npm run typecheck`) berhasil dengan 0 error <!-- id: 582 -->

## Phase 92: Sync with AI Button Repositioning & Borderless Enlargement <!-- id: 546 -->
- [x] Pindahkan posisi tombol "Sync with AI" agar berdampingan dengan unit title & subtitle pada section Uncategorized Notes di NotesTimeline.tsx <!-- id: 547 -->
- [x] Perbesar ukuran tombol (`px-4 h-9 text-body-sm` dengan icon `w-4 h-4`) serta hilangkan border (`border-0`) <!-- id: 548 -->
- [x] Validasi typecheck dengan `tsc --noEmit` dengan 0 error <!-- id: 549 -->
