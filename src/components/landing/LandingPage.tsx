import { useState } from 'react';
import {
  Bot,
  Sparkles,
  Globe,
  Lock,
} from 'lucide-react';
import {
  Button,
  CommandTag,
  PricingCard,
  PricingCardDark,
  CtaStripDark,
  FeatureBullet,
  FaqRow,
  PrimaryNav,
  FooterSection,
  LinkMute,
} from '../ui';

interface LandingPageProps {
  initialLocale?: 'id' | 'en';
  isLoggedIn?: boolean;
}

export default function LandingPage({
  initialLocale = 'id',
  isLoggedIn = false,
}: LandingPageProps) {
  const [locale, setLocale] = useState<'id' | 'en'>(initialLocale);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [vaultRevealed, setVaultRevealed] = useState(false);

  const toggleLanguage = () => {
    const nextLocale = locale === 'id' ? 'en' : 'id';
    setLocale(nextLocale);
    if (typeof window !== 'undefined') {
      window.location.href = nextLocale === 'en' ? '/en' : '/';
    }
  };

  const content = {
    id: {
      navFeatures: 'Fitur',
      navShowcase: 'Showcase',
      navPricing: 'Harga',
      navFaq: 'FAQ',
      headline: "Berhenti Biarkan Ide & Catatanmu Jadi 'Kuburan' di Saved Messages.",
      subheadline:
        'Cukup ketik apa saja ke bot Telegram kami sesantai mengirim pesan ke teman. AI otomatis merapikan keuangan, to-do list, password terenkripsi, dan jurnal harian Anda ke dashboard bersih dalam 1 detik.',
      heroCta: 'Buka Workspace',

      // Showcase Section
      showcaseTitle: 'Dari Chat Mentah Menjadi Dashboard Rapi',
      showcaseSub: 'Lihat bagaimana pesan teks acak Anda bertransformasi menjadi kartu terstruktur secara otomatis dalam 1 detik.',
      showcaseTelegramTitle: 'Telegram • @unlazynotes_bot',
      showcaseDashboardTitle: 'Dashboard UnlazyNotes',
      showcaseAiTag: '1-Detik Auto-Tagger AI',

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
      pricingSub: '1 USD = Rp 18.000. Tanpa iklan, tanpa pelacakan data, dan tanpa penguncian vendor.',
      freeTitle: 'Free Forever ($0)',
      freePrice: 'Rp 0',
      freePeriod: '/selamanya',
      freeDesc: 'Semua kebutuhan esensial untuk merapikan catatan harian Anda.',
      freeFeatures: [
        'All essentials',
        'Maks 30 notes per bulan',
        'Maks 5x ask AI per bulan',
        'AI enhance writing',
        'AI smart categorize',
        'AI smart tagging',
        'Web Workspace & bot telegram',
        'Smart search',
        'Export JSON & Markdown (.md)',
      ],
      proTitle: 'Pro',
      proPrice: 'Rp 18.000',
      proPeriod: '/bulan ($1/bulan atau $10/tahun)',
      proDesc: 'Kapasitas tanpa batas & kecerdasan AI untuk second-brain Anda.',
      proFeatures: [
        'Unlimited Notes',
        'Unlimited ask AI per bulan',
        'Private vault',
      ],
      selectFreePlan: 'Mulai Gratis',
      selectProPlan: 'Pilih Paket Pro',

      // CTA Strip
      ctaStripTitle: 'Mulai rapikan hidupmu tanpa repot hari ini.',
      ctaStripBtn: 'Buka Workspace',

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
      headline: "Stop Letting Your Best Ideas Die in 'Saved Messages'.",
      subheadline:
        'Just text anything to our Telegram bot like chatting with a friend. AI instantly organizes your finances, to-do lists, encrypted credentials, and daily journals into a clean dashboard in 1 second.',
      heroCta: 'open workspace',

      // Showcase Section
      showcaseTitle: 'From Messy Chat into a Structured Dashboard',
      showcaseSub: 'See how your unstructured thoughts transform automatically into structured cards in 1 second.',
      showcaseTelegramTitle: 'Telegram • @unlazynotes_bot',
      showcaseDashboardTitle: 'Clean UnlazyNotes Dashboard',
      showcaseAiTag: '1-Sec AI Auto-Tagger',

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
      pricingSub: '1 USD = Rp 18,000. No ads, no data tracking, and zero vendor lock-in.',
      freeTitle: 'Free Forever ($0)',
      freePrice: '$0',
      freePeriod: '/forever',
      freeDesc: 'All essentials for everyday personal note taking.',
      freeFeatures: [
        'All essentials',
        'Maks 30 notes per bulan',
        'Maks 5x ask AI per bulan',
        'AI enhance writing',
        'AI smart categorize',
        'AI smart tagging',
        'Web Workspace & bot telegram',
        'Smart search',
        'Export JSON & Markdown (.md)',
      ],
      proTitle: 'Pro',
      proPrice: '$1',
      proPeriod: '/month ($1/month or $10/year)',
      proDesc: 'Unlimited power & AI contextual recall for your second brain.',
      proFeatures: [
        'Unlimited Notes',
        'Unlimited ask AI per bulan',
        'Private vault',
      ],
      selectFreePlan: 'Start Free',
      selectProPlan: 'Get Pro',

      // CTA Strip
      ctaStripTitle: 'Start organizing your thoughts instantly today.',
      ctaStripBtn: 'Buka Workspace',

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
          a: 'Simply click [Start on Telegram] to open @unlazynotes_bot, tap Start to auto-connect your account in 2 seconds, and start texting your thoughts right away!',
        },
      ],

      footerCopyright: '© 2026 UnlazyNotes. The Zero-Friction Personal Life OS.',
    },
  };

  const t = content[locale];

  return (
    <div className="min-h-screen flex flex-col bg-canvas text-ink">
      {/* Primary Navigation: Fullwidth end-to-end, light gray background, borderless, centered max-width content */}
      <PrimaryNav>
        {/* Left: App Logo & Title */}
        <div className="flex items-center gap-6">
          <a href={locale === 'en' ? '/en' : '/'} className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-sm select-none">
              U
            </span>
            <span className="font-semibold text-heading-md text-ink tracking-tight">
              UnlazyNotes
            </span>
          </a>

          <div className="hidden md:flex items-center gap-5">
            <LinkMute href="#showcase">{t.navShowcase}</LinkMute>
            <LinkMute href="#features">{t.navFeatures}</LinkMute>
            <LinkMute href="#pricing">{t.navPricing}</LinkMute>
            <LinkMute href="#faq">{t.navFaq}</LinkMute>
          </div>
        </div>

        {/* Right: Language Switcher & Auth Action */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleLanguage}
            className="inline-flex items-center gap-1.5 px-3 h-8 rounded-full border-0 bg-transparent hover:bg-canvas text-ink text-body-sm font-medium cursor-pointer"
            title="Switch Language"
          >
            <Globe className="w-3.5 h-3.5 text-body" />
            <span>{locale === 'id' ? 'ID' : 'EN'}</span>
          </button>

          {isLoggedIn ? (
            <a href="/dashboard">
              <Button variant="primary">workspace</Button>
            </a>
          ) : (
            <a href="/login">
              <button
                type="button"
                className="inline-flex items-center gap-2 h-9 px-4 rounded-full bg-canvas hover:bg-surface-soft active:bg-hairline text-ink text-button-sm border border-hairline cursor-pointer select-none font-medium"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.15z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"/>
                  <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                </svg>
                <span>sign in</span>
              </button>
            </a>
          )}
        </div>
      </PrimaryNav>

      <main className="flex-1">
        {/* 1. Hero Section */}
        <section className="pt-20 pb-16 px-6 max-w-4xl mx-auto text-center">
          <h1 className="font-display font-medium text-[38px] sm:text-[44px] text-ink mb-6 max-w-3xl mx-auto tracking-tight leading-[1.15]">
            {t.headline}
          </h1>

          <p className="font-sans font-normal text-[16px] sm:text-[17px] text-body max-w-2xl mx-auto mb-10 leading-relaxed">
            {t.subheadline}
          </p>

          {/* Single enlarged main CTA button without inner icon */}
          <div className="flex items-center justify-center">
            <a href="/dashboard">
              <button
                type="button"
                className="h-12 px-8 rounded-full bg-primary hover:bg-ink-deep active:scale-98 text-on-primary text-body-lg font-medium cursor-pointer select-none"
              >
                {t.heroCta}
              </button>
            </a>
          </div>
        </section>

        {/* 2. Visual Showcase: Terminal Mockup */}
        <section id="showcase" className="py-20 px-6 border-t border-hairline bg-canvas">
          <div className="max-w-5xl mx-auto">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <h2 className="text-heading-lg text-ink mb-2">
                {t.showcaseTitle}
              </h2>
              <p className="text-body-sm text-body">{t.showcaseSub}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
              {/* Telegram Input Mockup */}
              <div className="p-6 rounded-lg border border-hairline bg-surface-soft flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-4 mb-4 border-b border-hairline">
                    <span className="text-caption-sm text-body">
                      {t.showcaseTelegramTitle}
                    </span>
                    <CommandTag>RAW CHAT</CommandTag>
                  </div>
                  <div className="space-y-4">
                    <div className="bg-canvas border border-hairline rounded-lg p-3 max-w-[85%]">
                      <p className="text-body-sm text-ink">
                        Beli kopi kenangan 25k sama bayar wifi indihome 320rb
                      </p>
                      <span className="text-[10px] text-body block text-right mt-1">
                        10:42 AM
                      </span>
                    </div>

                    <div className="bg-canvas border border-hairline rounded-lg p-3 max-w-[85%]">
                      <p className="text-body-sm text-ink">
                        Meeting evaluasi sprint selasa jam 14.00 di Google Meet
                      </p>
                      <span className="text-[10px] text-body block text-right mt-1">
                        11:15 AM
                      </span>
                    </div>

                    <div className="bg-canvas border border-hairline rounded-lg p-3 max-w-[85%] font-mono text-code-sm">
                      <p className="text-charcoal">
                        /secure pin_atm_bca 987654
                      </p>
                      <span className="text-[10px] text-body block text-right mt-1 font-sans">
                        11:30 AM
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dashboard Output Cards */}
              <div className="p-6 rounded-lg border border-hairline bg-canvas flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-4 mb-4 border-b border-hairline">
                    <span className="text-caption-sm text-ink font-semibold">
                      {t.showcaseDashboardTitle}
                    </span>
                    <span className="text-[11px] font-sans font-medium px-2 py-0.5 rounded-full bg-surface-soft text-body">
                      {t.showcaseAiTag}
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div className="p-3.5 rounded-lg border border-hairline bg-surface-soft flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <CommandTag>FINANCE</CommandTag>
                          <span className="text-[11px] text-body">#coffee #bills</span>
                        </div>
                        <p className="text-body-sm text-ink">
                          Kopi kenangan (Rp25.000) & Indihome (Rp320.000)
                        </p>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-lg border border-hairline bg-surface-soft flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <CommandTag>SCHEDULE</CommandTag>
                          <span className="text-[11px] text-body">#meeting #sprint</span>
                        </div>
                        <p className="text-body-sm text-ink">
                          Meeting evaluasi sprint • Selasa, 14:00
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-3.5 rounded-lg border border-hairline bg-canvas">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-body-sm font-semibold text-ink flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-body" />
                      pin_atm_bca
                    </span>
                    <CommandTag>VAULT</CommandTag>
                  </div>
                  <div className="flex items-center justify-between bg-surface-soft border border-hairline rounded-full px-3 py-1.5 font-mono text-code-sm">
                    <span className="text-charcoal truncate">
                      {vaultRevealed ? 'pin 987654' : '••••••••••••••••'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setVaultRevealed(!vaultRevealed)}
                      className="text-caption-sm text-ink hover:underline cursor-pointer ml-2"
                    >
                      {vaultRevealed ? 'Tutup' : 'Intip'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Features Pillars */}
        <section id="features" className="py-20 px-6 border-t border-hairline bg-canvas">
          <div className="max-w-5xl mx-auto">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <h2 className="text-heading-lg text-ink mb-2">
                {t.featuresTitle}
              </h2>
              <p className="text-body-sm text-body">{t.featuresSub}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 rounded-lg border border-hairline bg-canvas flex flex-col justify-between">
                <div>
                  <div className="w-9 h-9 rounded-full bg-surface-soft border border-hairline flex items-center justify-center text-ink mb-4">
                    <Bot className="w-4 h-4" />
                  </div>
                  <h3 className="text-heading-sm text-ink mb-2">{t.f1Title}</h3>
                  <p className="text-body-sm text-body leading-relaxed">{t.f1Desc}</p>
                </div>
              </div>

              <div className="p-6 rounded-lg border border-hairline bg-canvas flex flex-col justify-between">
                <div>
                  <div className="w-9 h-9 rounded-full bg-surface-soft border border-hairline flex items-center justify-center text-ink mb-4">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <h3 className="text-heading-sm text-ink mb-2">{t.f2Title}</h3>
                  <p className="text-body-sm text-body leading-relaxed">{t.f2Desc}</p>
                </div>
              </div>

              <div className="p-6 rounded-lg border border-hairline bg-canvas flex flex-col justify-between">
                <div>
                  <div className="w-9 h-9 rounded-full bg-surface-soft border border-hairline flex items-center justify-center text-ink mb-4">
                    <Lock className="w-4 h-4" />
                  </div>
                  <h3 className="text-heading-sm text-ink mb-2">{t.f3Title}</h3>
                  <p className="text-body-sm text-body leading-relaxed">{t.f3Desc}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Pricing Comparison: Free Forever ($0) + Pro ($1/bulan atau $10/tahun) */}
        <section id="pricing" className="py-20 px-6 border-t border-hairline bg-canvas">
          <div className="max-w-4xl mx-auto">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <h2 className="text-heading-lg text-ink mb-2">
                {t.pricingTitle}
              </h2>
              <p className="text-body-sm text-body">{t.pricingSub}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
              {/* Free Forever Tier */}
              <PricingCard>
                <div>
                  <h3 className="text-heading-lg text-ink mb-1">{t.freeTitle}</h3>
                  <p className="text-body-sm text-body mb-6">{t.freeDesc}</p>

                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-display-lg text-ink tabular-nums">{t.freePrice}</span>
                    <span className="text-body-sm text-body">{t.freePeriod}</span>
                  </div>

                  <div className="space-y-3 mb-8">
                    {t.freeFeatures.map((f, i) => (
                      <FeatureBullet key={i}>{f}</FeatureBullet>
                    ))}
                  </div>
                </div>

                <a href="/login" className="block">
                  <Button variant="secondary" fullWidth>
                    {t.selectFreePlan}
                  </Button>
                </a>
              </PricingCard>

              {/* Pro Tier (Inverted Dark Card) */}
              <PricingCardDark>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-heading-lg text-on-dark">{t.proTitle}</h3>
                    <CommandTag className="bg-neutral-800 text-on-dark">POPULAR</CommandTag>
                  </div>
                  <p className="text-body-sm text-on-dark-mute mb-6">{t.proDesc}</p>

                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-display-lg text-on-dark tabular-nums">{t.proPrice}</span>
                    <span className="text-body-sm text-on-dark-mute">{t.proPeriod}</span>
                  </div>

                  <div className="space-y-3 mb-8">
                    {t.proFeatures.map((f, i) => (
                      <FeatureBullet key={i} onDark={true}>
                        {f}
                      </FeatureBullet>
                    ))}
                  </div>
                </div>

                <a href="/login" className="block">
                  <Button variant="pill-on-dark" fullWidth>
                    {t.selectProPlan}
                  </Button>
                </a>
              </PricingCardDark>
            </div>
          </div>
        </section>

        {/* 5. Inverted Dark CTA Strip */}
        <section className="py-12 px-6 max-w-4xl mx-auto">
          <CtaStripDark>
            <div>
              <h2 className="text-heading-lg text-on-dark mb-1">{t.ctaStripTitle}</h2>
              <p className="text-body-sm text-on-dark-mute">
                Kelola catatan dan produktivitas Anda tanpa ribet.
              </p>
            </div>
            <a href="/dashboard" className="shrink-0">
              <Button variant="pill-on-dark">{t.ctaStripBtn}</Button>
            </a>
          </CtaStripDark>
        </section>

        {/* 6. FAQ Section */}
        <section id="faq" className="py-20 px-6 border-t border-hairline bg-canvas">
          <div className="max-w-3xl mx-auto">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <h2 className="text-heading-lg text-ink mb-2">
                {t.faqTitle}
              </h2>
              <p className="text-body-sm text-body">{t.faqSub}</p>
            </div>

            <div className="divide-y divide-hairline">
              {t.faqs.map((faq, index) => (
                <FaqRow
                  key={index}
                  question={faq.q}
                  answer={faq.a}
                  isOpen={openFaq === index}
                  onToggle={() => setOpenFaq(openFaq === index ? null : index)}
                />
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer Section */}
      <FooterSection>
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>{t.footerCopyright}</p>
          <div className="flex items-center gap-6">
            <LinkMute
              href="https://t.me/unlazynotes_bot"
              target="_blank"
              rel="noreferrer"
            >
              @unlazynotes_bot
            </LinkMute>
            <LinkMute href="/dashboard">Web Dashboard</LinkMute>
          </div>
        </div>
      </FooterSection>
    </div>
  );
}
