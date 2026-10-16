import { useState } from 'react';
import {
  Bot,
  ArrowRight,
  Sparkles,
  Check,
  ExternalLink,
  Globe,
  Lock,
  ChevronDown,
  Calendar,
  Send,
  CheckCheck,
  Zap,
} from 'lucide-react';

export default function LandingPage() {
  const [locale, setLocale] = useState<'id' | 'en'>('id');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [vaultRevealed, setVaultRevealed] = useState(false);

  const content = {
    id: {
      navFeatures: 'Fitur',
      navShowcase: 'Showcase',
      navPricing: 'Harga',
      navFaq: 'FAQ',
      navLogin: 'Masuk / Dashboard',
      badge: '⚡️ The Zero-Friction Personal Life OS',
      headline: "Berhenti Biarkan Ide & Catatanmu Jadi 'Kuburan' di Saved Messages.",
      subheadline:
        'Cukup ketik apa saja ke bot Telegram kami sesantai mengirim pesan ke teman. AI otomatis merapikan keuangan, to-do list, password terenkripsi, dan jurnal harian Anda ke dashboard bersih dalam 1 detik.',
      ctaTelegram: '📱 Mulai Gratis di Telegram',
      ctaDashboard: '🖥 Buka Web Dashboard',
      securityNotice:
        '🔒 Private Vault: Untuk password, PIN, & kredensial sensitif, gunakan perintah /secure <kunci> <isi> agar dienkripsi militer AES-256-GCM dan diisolasi 100% dari AI.',

      // Showcase Section
      showcaseTitle: 'Dari Chat Kotor Menjadi Dashboard Rapi',
      showcaseSub: 'Lihat bagaimana pesan teks acak Anda bertransformasi menjadi kartu terstruktur secara otomatis dalam 1 detik.',
      showcaseTelegramTitle: 'Telegram Saved Messages / Bot Chat',
      showcaseDashboardTitle: 'Dashboard Bersih UnlazyNotes',
      showcaseAiTag: '⚡️ 1-Detik Auto-Tagger AI',

      // Features Section
      featuresTitle: 'Dirancang untuk Tangkapan Cepat Tanpa Beban Kognitif',
      featuresSub: 'Tiga pilar arsitektur modern yang membuat pikiran Anda tetap tenang dan teratur.',
      f1Title: 'Chat-First Capture (Zero Friction)',
      f1Desc: 'Cukup ketik atau forward pesan ke @unlazynotes_bot. Tanpa perlu membuka aplikasi catatan yang berat dan rumit.',
      f2Title: 'Auto-Tagging AI & Intent Engine',
      f2Desc: 'Sistem menganalisis pesan dalam 1 detik dan menyematkan 1 dari 9 kategori baku serta keyword tags spesifik bernilai filter tinggi.',
      f3Title: 'Private Vault & Data Portability',
      f3Desc: 'Enkripsi rahasia dengan AES-256-GCM lewat perintah /secure, serta ekspor seluruh catatan ke format JSON atau Markdown kapan saja tanpa vendor lock-in.',

      // Pricing Section
      pricingTitle: 'Pilihan Paket Langganan Sederhana',
      pricingSub: '100% Berbayar tanpa iklan, tanpa pelacakan data, dan tanpa penguncian vendor.',
      monthly: 'Bulan',
      yearly: 'Tahun',
      perMonth: '/bulan',
      standardTitle: 'Standard',
      standardPrice: 'Rp15.000',
      standardDesc: 'Ideal untuk individu yang ingin ruang chat rapi sehari-hari.',
      standardFeatures: [
        'Maksimal 25 catatan baru / hari',
        'Auto-tagging AI 9 kategori',
        'Private Vault terenkripsi AES-256 (/secure)',
        'Pencarian multi-token instan & fleksibel',
        'Ekspor lengkap JSON & Markdown (.md)',
        'Akses dashboard web selamanya',
      ],
      proTitle: 'Pro',
      proPrice: 'Rp49.000',
      proDesc: 'Kapasitas tanpa batas & kecerdasan AI untuk second-brain Anda.',
      proFeatures: [
        'Catatan tanpa batas (Unlimited notes)',
        'Fitur AI Contextual Q&A (/ask)',
        'Auto-tagging prioritas tinggi',
        'Private Vault terenkripsi AES-256 (/secure)',
        'Ekspor lengkap JSON & Markdown (.md)',
        'Dukungan prioritas pelanggan',
      ],
      selectPlan: 'Pilih Paket Ini',

      // FAQ Section
      faqTitle: 'Pertanyaan yang Sering Diajukan (FAQ)',
      faqSub: 'Semua jawaban mengenai keamanan, model harga yang hemat, dan cara penggunaan UnlazyNotes.',
      faqs: [
        {
          q: 'Apakah data pribadi dan catatan saya aman?',
          a: 'Sangat aman. Untuk catatan sensitif seperti kata sandi, token API, dan PIN, Anda dapat menggunakan perintah `/secure <kunci> <isi>` yang otomatis dienkripsi dengan standar militer AES-256-GCM. Data Private Vault Anda terisolasi 100% dan tidak pernah dibaca atau diumpankan ke AI.',
        },
        {
          q: 'Kenapa harganya sangat terjangkau ($1/bln atau $10/thn)?',
          a: 'Kami merancang UnlazyNotes dengan arsitektur Deterministic Intent Router yang cerdas, mengeksekusi 70–80% klasifikasi secara lokal di server tanpa membuang token LLM yang mahal. Efisiensi teknis ini langsung kami kembalikan sebagai penghematan harga langganan untuk pengguna.',
        },
        {
          q: 'Apakah saya bisa mengekspor data catatan saya sewaktu-waktu?',
          a: 'Tentu saja! Kami memegang teguh prinsip Zero Vendor Lock-in. Kapan pun Anda inginkan, Anda dapat mengunduh seluruh arsip catatan Anda ke format JSON atau teks terstruktur Markdown (.md) dalam 1 kali klik dari menu Settings web dashboard.',
        },
        {
          q: 'Bagaimana cara mulai memakainya?',
          a: 'Buka bot @unlazynotes_bot di Telegram, klik tombol Start untuk menghubungkan akun Anda dalam 2 detik, lalu langsung kirim catatan pertama Anda. Tidak perlu instalasi aplikasi tambahan atau registrasi yang berbelit-belit!',
        },
      ],

      footerCopyright: '© 2026 UnlazyNotes. The Zero-Friction Personal Life OS.',
    },
    en: {
      navFeatures: 'Features',
      navShowcase: 'Showcase',
      navPricing: 'Pricing',
      navFaq: 'FAQ',
      navLogin: 'Sign In / Dashboard',
      badge: '⚡️ The Zero-Friction Personal Life OS',
      headline: "Stop Letting Your Best Ideas Die in 'Saved Messages'.",
      subheadline:
        'Just text anything to our Telegram bot like chatting with a friend. AI instantly organizes your finances, to-do lists, encrypted credentials, and daily journals into a clean dashboard in 1 second.',
      ctaTelegram: '📱 Start Free on Telegram',
      ctaDashboard: '🖥 Open Web Dashboard',
      securityNotice:
        '🔒 Private Vault: For passwords, PINs, & tokens, use /secure <key> <secret> to encrypt with military-grade AES-256-GCM, 100% isolated from AI.',

      // Showcase Section
      showcaseTitle: 'From Messy Chat into a Pristine Dashboard',
      showcaseSub: 'See how your unstructured thoughts transform automatically into structured cards in 1 second.',
      showcaseTelegramTitle: 'Telegram Saved Messages / Bot Chat',
      showcaseDashboardTitle: 'Clean UnlazyNotes Dashboard',
      showcaseAiTag: '⚡️ 1-Sec AI Auto-Tagger',

      // Features Section
      featuresTitle: 'Built for Frictionless Quick Capture',
      featuresSub: 'Three modern architectural pillars to keep your mind completely clutter-free.',
      f1Title: 'Chat-First Capture (Zero Friction)',
      f1Desc: 'Just send or forward messages to @unlazynotes_bot. No waiting for bulky note apps to load.',
      f2Title: 'AI Auto-Tagging & Intent Engine',
      f2Desc: 'Analyzes your note in 1 second and tags it into 1 of 9 standardized categories plus high-value specific filter tags.',
      f3Title: 'Private Vault & Data Portability',
      f3Desc: 'Store credentials securely via /secure with AES-256-GCM encryption, and export all your data to JSON or Markdown anytime without vendor lock-in.',

      // Pricing Section
      pricingTitle: 'Simple & Transparent Pricing',
      pricingSub: '100% Paid. No ads, no data tracking, and zero vendor lock-in.',
      monthly: 'Month',
      yearly: 'Year',
      perMonth: '/mo',
      standardTitle: 'Standard',
      standardPrice: '$1',
      standardDesc: 'Perfect for daily personal idea capturing.',
      standardFeatures: [
        'Up to 25 notes per day',
        'Automated AI 9-category tagging',
        'AES-256 encrypted Private Vault (/secure)',
        'Fast & loose multi-token search',
        'Complete JSON & Markdown (.md) export',
        'Lifetime web workspace access',
      ],
      proTitle: 'Pro',
      proPrice: '$3',
      proDesc: 'Unlimited power & AI contextual recall for your second brain.',
      proFeatures: [
        'Unlimited notes capture',
        'AI Contextual Q&A via /ask command',
        'High-priority auto-tagging',
        'AES-256 encrypted Private Vault (/secure)',
        'Complete JSON & Markdown (.md) export',
        'Priority customer support',
      ],
      selectPlan: 'Get Started',

      // FAQ Section
      faqTitle: 'Frequently Asked Questions (FAQ)',
      faqSub: 'Everything you need to know about security, affordable pricing, and our workflow.',
      faqs: [
        {
          q: 'Is my personal data and notes secure?',
          a: 'Extremely secure. For sensitive data such as passwords, API tokens, and PINs, you can use the `/secure <key> <content>` command, which is encrypted with military-grade AES-256-GCM. Your Private Vault notes are completely isolated and 100% bypassed from AI processing.',
        },
        {
          q: 'Why is it so affordable ($1/mo or $10/yr)?',
          a: 'We engineered UnlazyNotes with an in-memory Deterministic Intent Router that resolves 70–80% of notes locally on our server without burning costly LLM tokens. We pass those engineering savings directly to you.',
        },
        {
          q: 'Can I export my notes anytime?',
          a: 'Absolutely! We firmly believe in Zero Vendor Lock-in. You can download all your notes into complete JSON or structured Markdown (.md) files anytime with a single click from the Settings page.',
        },
        {
          q: 'How do I get started?',
          a: 'Simply click [Start Free on Telegram] to open @unlazynotes_bot, tap Start to auto-connect your account in 2 seconds, and start texting your thoughts right away!',
        },
      ],

      footerCopyright: '© 2026 UnlazyNotes. The Zero-Friction Personal Life OS.',
    },
  };

  const t = content[locale];

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-zinc-100 selection:bg-indigo-500 selection:text-white">
      {/* Navbar */}
      <header className="border-b border-zinc-800/80 sticky top-0 z-40 bg-zinc-950/85 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-indigo-600/25 font-black text-lg">
              U
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-base sm:text-lg tracking-tight leading-none text-zinc-100">
                UnlazyNotes
              </span>
              <span className="text-[10px] text-zinc-500 font-medium">Life OS</span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm text-zinc-400 font-medium">
            <a href="#showcase" className="hover:text-zinc-100 transition-colors">
              {t.navShowcase}
            </a>
            <a href="#features" className="hover:text-zinc-100 transition-colors">
              {t.navFeatures}
            </a>
            <a href="#pricing" className="hover:text-zinc-100 transition-colors">
              {t.navPricing}
            </a>
            <a href="#faq" className="hover:text-zinc-100 transition-colors">
              {t.navFaq}
            </a>
          </nav>

          <div className="flex items-center gap-2.5">
            {/* Currency/Locale Selector */}
            <button
              onClick={() => setLocale(locale === 'id' ? 'en' : 'id')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900/60 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Switch Language / Currency"
            >
              <Globe className="w-3.5 h-3.5 text-zinc-400" />
              <span>{locale === 'id' ? 'ID / IDR' : 'EN / USD'}</span>
            </button>

            <a
              href="/dashboard"
              className="px-3.5 sm:px-4 py-2 rounded-xl bg-zinc-100 text-zinc-900 font-semibold text-xs sm:text-sm hover:bg-white transition-all shadow-sm shadow-white/10"
            >
              {t.navLogin}
            </a>
          </div>
        </div>
      </header>

      {/* 1. Hero Section */}
      <section className="pt-16 sm:pt-24 pb-16 px-4 max-w-5xl mx-auto text-center">
        {/* Top Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-semibold mb-6 shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>{t.badge}</span>
        </div>

        {/* Main Headline */}
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-zinc-100 mb-6 leading-[1.15] max-w-4xl mx-auto">
          {t.headline}
        </h1>

        {/* Sub-headline */}
        <p className="text-base sm:text-lg text-zinc-400 max-w-3xl mx-auto mb-10 leading-relaxed font-normal">
          {t.subheadline}
        </p>

        {/* Dual CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-md mx-auto sm:max-w-none">
          <a
            href="https://t.me/unlazynotes_bot"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-sm transition-all shadow-lg shadow-indigo-600/25 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>{t.ctaTelegram}</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-70" />
          </a>

          <a
            href="/dashboard"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-200 font-semibold text-sm transition-all cursor-pointer"
          >
            <span>{t.ctaDashboard}</span>
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>

        {/* Security Alert Badge */}
        <div className="mt-12 max-w-2xl mx-auto p-3.5 sm:p-4 rounded-2xl border border-rose-500/20 bg-rose-500/5 text-rose-200/90 text-xs flex items-start gap-3 text-left">
          <Lock className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">{t.securityNotice}</p>
        </div>
      </section>

      {/* 2. Visual Showcase: "Dari Chat Kotor Menjadi Dashboard Rapi" */}
      <section id="showcase" className="py-16 sm:py-24 border-t border-zinc-900 bg-zinc-950/60">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight mb-3 text-zinc-100">
              {t.showcaseTitle}
            </h2>
            <p className="text-zinc-400 text-sm sm:text-base leading-relaxed">
              {t.showcaseSub}
            </p>
          </div>

          {/* Interactive Showcase Box */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Panel Kiri: Pesan Chat Telegram Mentah */}
            <div className="lg:col-span-5 rounded-3xl border border-zinc-800/90 bg-zinc-900/40 p-5 sm:p-6 flex flex-col justify-between shadow-lg">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80 mb-5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-xs border border-sky-500/30">
                      TG
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-zinc-200">@unlazynotes_bot</h3>
                      <p className="text-[10px] text-zinc-500">bot • online</p>
                    </div>
                  </div>
                  <span className="text-[11px] text-zinc-500 font-mono">1-to-1 Chat</span>
                </div>

                <div className="space-y-3.5">
                  {/* Chat 1 */}
                  <div className="flex justify-end">
                    <div className="max-w-[85%] bg-sky-900/30 border border-sky-700/40 text-sky-100 rounded-2xl rounded-tr-sm px-4 py-2.5 text-xs shadow-sm">
                      <p className="font-normal leading-relaxed">tfr 150rb patungan seblak ubed</p>
                      <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-sky-400/80">
                        <span>13:42</span>
                        <CheckCheck className="w-3 h-3 text-sky-400" />
                      </div>
                    </div>
                  </div>

                  {/* Chat 2 */}
                  <div className="flex justify-end">
                    <div className="max-w-[85%] bg-sky-900/30 border border-sky-700/40 text-sky-100 rounded-2xl rounded-tr-sm px-4 py-2.5 text-xs shadow-sm">
                      <p className="font-normal leading-relaxed whitespace-pre-line">
                        hiling dieng, pilates, belanja tokma
                      </p>
                      <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-sky-400/80">
                        <span>13:43</span>
                        <CheckCheck className="w-3 h-3 text-sky-400" />
                      </div>
                    </div>
                  </div>

                  {/* Chat 3 */}
                  <div className="flex justify-end">
                    <div className="max-w-[85%] bg-sky-900/30 border border-sky-700/40 text-sky-100 rounded-2xl rounded-tr-sm px-4 py-2.5 text-xs shadow-sm font-mono">
                      <p className="text-rose-200/90 leading-relaxed">/secure bca pin 123456</p>
                      <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-sky-400/80 font-sans">
                        <span>13:45</span>
                        <CheckCheck className="w-3 h-3 text-sky-400" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 mt-6 border-t border-zinc-800/60 text-[11px] text-zinc-500 flex items-center justify-between">
                <span>{t.showcaseTelegramTitle}</span>
                <span className="text-zinc-400 font-semibold">Tersimpan Otomatis</span>
              </div>
            </div>

            {/* Panel Tengah: Transisi AI */}
            <div className="lg:col-span-2 flex flex-row lg:flex-col items-center justify-center gap-3 py-2 lg:py-0">
              <div className="h-px lg:h-12 w-12 lg:w-px bg-zinc-800" />
              <div className="px-3 py-1.5 rounded-full border border-indigo-500/40 bg-indigo-500/10 text-indigo-300 text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-indigo-500/20 whitespace-nowrap">
                <Zap className="w-3.5 h-3.5 text-indigo-400" />
                <span>{t.showcaseAiTag}</span>
              </div>
              <div className="h-px lg:h-12 w-12 lg:w-px bg-zinc-800" />
            </div>

            {/* Panel Kanan: Hasil Kurasi di Dashboard */}
            <div className="lg:col-span-5 rounded-3xl border border-zinc-800/90 bg-zinc-900/40 p-5 sm:p-6 flex flex-col justify-between shadow-lg space-y-3.5">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80 mb-1">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-zinc-200">{t.showcaseDashboardTitle}</span>
                </div>
                <span className="text-[10px] uppercase font-semibold text-zinc-500">Live Timeline</span>
              </div>

              {/* Card 1: Finance */}
              <div className="p-3.5 rounded-2xl border border-emerald-500/20 bg-zinc-950/70 space-y-2">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-zinc-500 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> 16 Okt 2026, 13:42
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-medium">TELEGRAM</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold uppercase">
                      finance
                    </span>
                  </div>
                </div>
                <p className="text-xs text-zinc-200 font-medium">tfr 150rb patungan seblak ubed</p>
                <div className="flex items-center justify-between pt-1">
                  <div className="flex gap-1 text-[10px]">
                    <span className="px-1.5 py-0.5 rounded bg-zinc-900 text-emerald-400 border border-emerald-500/20">
                      #ubed
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-zinc-900 text-emerald-400 border border-emerald-500/20">
                      #food
                    </span>
                  </div>
                  <span className="text-xs font-extrabold text-emerald-400">Rp 150.000</span>
                </div>
              </div>

              {/* Card 2: To-Do */}
              <div className="p-3.5 rounded-2xl border border-amber-500/20 bg-zinc-950/70 space-y-2">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-zinc-500 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> 16 Okt 2026, 13:43
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-medium">TELEGRAM</span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold uppercase">
                      todo
                    </span>
                  </div>
                </div>
                <p className="text-xs text-zinc-200 font-medium">hiling dieng, pilates, belanja tokma</p>
                <div className="flex gap-1 text-[10px] pt-1">
                  <span className="px-1.5 py-0.5 rounded bg-zinc-900 text-amber-400 border border-amber-500/20">
                    #dieng
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-zinc-900 text-amber-400 border border-amber-500/20">
                    #tokma
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-zinc-900 text-amber-400 border border-amber-500/20">
                    #pilates
                  </span>
                </div>
              </div>

              {/* Card 3: Private Vault */}
              <div className="p-3.5 rounded-2xl border border-rose-500/30 bg-rose-950/20 space-y-2">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-zinc-500 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> 16 Okt 2026, 13:45
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-300 font-bold">
                      <Lock className="w-2.5 h-2.5" />
                      <span>Private Vault: bca</span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-zinc-950/80 border border-zinc-800 text-xs font-mono">
                  <span className="text-zinc-400 truncate">
                    {vaultRevealed ? 'pin 123456' : '••••••••••••••••'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setVaultRevealed(!vaultRevealed)}
                    className="text-[10px] font-sans px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors cursor-pointer shrink-0"
                  >
                    {vaultRevealed ? 'Tutup' : 'Intip'}
                  </button>
                </div>

                <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-0.5">
                  <div className="flex gap-1">
                    <span className="px-1.5 py-0.5 rounded bg-zinc-900 text-rose-400 border border-rose-500/20">
                      #vault
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-zinc-900 text-rose-400 border border-rose-500/20">
                      #encrypted
                    </span>
                  </div>
                  <span className="text-rose-400/90 font-medium text-[9px]">AES-256-GCM</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Features Pillars */}
      <section id="features" className="py-20 border-t border-zinc-900 bg-zinc-950">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-3">
              {t.featuresTitle}
            </h2>
            <p className="text-zinc-400 text-sm leading-relaxed">{t.featuresSub}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-3xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 transition-all">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-5">
                <Bot className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-lg mb-2 text-zinc-100">{t.f1Title}</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">{t.f1Desc}</p>
            </div>

            <div className="p-6 rounded-3xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 transition-all">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-5">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-lg mb-2 text-zinc-100">{t.f2Title}</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">{t.f2Desc}</p>
            </div>

            <div className="p-6 rounded-3xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 transition-all">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-5">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-lg mb-2 text-zinc-100">{t.f3Title}</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">{t.f3Desc}</p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Pricing Comparison */}
      <section id="pricing" className="py-20 border-t border-zinc-900 bg-zinc-950/60">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-3">
              {t.pricingTitle}
            </h2>
            <p className="text-zinc-400 text-sm leading-relaxed">{t.pricingSub}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Standard */}
            <div className="p-8 rounded-3xl border border-zinc-800 bg-zinc-900/40 flex flex-col justify-between hover:border-zinc-700 transition-all">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-zinc-100">{t.standardTitle}</h3>
                </div>
                <p className="text-zinc-400 text-sm mb-6">{t.standardDesc}</p>
                <div className="flex items-baseline gap-1 mb-8">
                  <span className="text-4xl font-extrabold text-zinc-100">{t.standardPrice}</span>
                  <span className="text-zinc-500 text-sm">{t.perMonth}</span>
                </div>

                <ul className="space-y-3.5 mb-8">
                  {t.standardFeatures.map((f, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-zinc-300">
                      <Check className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <a
                href="/login"
                className="w-full py-3.5 rounded-xl border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-semibold text-sm text-center transition-colors block cursor-pointer"
              >
                {t.selectPlan}
              </a>
            </div>

            {/* Pro */}
            <div className="p-8 rounded-3xl border border-indigo-500/50 bg-gradient-to-b from-indigo-950/30 to-zinc-900/50 relative flex flex-col justify-between shadow-xl shadow-indigo-950/20">
              <div className="absolute -top-3.5 right-6 px-3 py-1 rounded-full bg-indigo-600 text-white text-xs font-bold tracking-wide uppercase shadow">
                Popular
              </div>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-zinc-100">{t.proTitle}</h3>
                </div>
                <p className="text-zinc-400 text-sm mb-6">{t.proDesc}</p>
                <div className="flex items-baseline gap-1 mb-8">
                  <span className="text-4xl font-extrabold text-zinc-100">{t.proPrice}</span>
                  <span className="text-zinc-500 text-sm">{t.perMonth}</span>
                </div>

                <ul className="space-y-3.5 mb-8">
                  {t.proFeatures.map((f, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-zinc-300">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <a
                href="/login"
                className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm text-center transition-all shadow-md shadow-indigo-600/30 block cursor-pointer"
              >
                {t.selectPlan}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* 5. FAQ Section (Accordion) */}
      <section id="faq" className="py-20 border-t border-zinc-900 bg-zinc-950">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-3 text-zinc-100">
              {t.faqTitle}
            </h2>
            <p className="text-zinc-400 text-sm leading-relaxed">{t.faqSub}</p>
          </div>

          <div className="space-y-3.5">
            {t.faqs.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <div
                  key={index}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden transition-all hover:border-zinc-700/80"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    className="w-full px-5 sm:px-6 py-4 sm:py-5 flex items-center justify-between text-left gap-4 cursor-pointer"
                  >
                    <span className="font-semibold text-sm sm:text-base text-zinc-100">
                      {faq.q}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-zinc-400 shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-indigo-400' : ''
                      }`}
                    />
                  </button>

                  {isOpen && (
                    <div className="px-5 sm:px-6 pb-5 pt-1 text-xs sm:text-sm text-zinc-400 leading-relaxed border-t border-zinc-800/40">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-zinc-900 py-10 bg-zinc-950">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <p>{t.footerCopyright}</p>
          <div className="flex items-center gap-6">
            <a
              href="https://t.me/unlazynotes_bot"
              target="_blank"
              rel="noreferrer"
              className="hover:text-zinc-300 transition-colors"
            >
              @unlazynotes_bot
            </a>
            <a href="/dashboard" className="hover:text-zinc-300 transition-colors">
              Web Dashboard
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
