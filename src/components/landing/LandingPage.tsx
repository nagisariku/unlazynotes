import { useState } from 'react';
import {
  Bot,
  ArrowRight,
  Sparkles,
  ExternalLink,
  Globe,
  Lock,
  Send,
  Calendar,
} from 'lucide-react';
import {
  Button,
  InstallSnippet,
  CommandTag,
  TerminalCard,
  PricingCard,
  PricingCardDark,
  CtaStripDark,
  FeatureBullet,
  FaqRow,
  PrimaryNav,
  FooterSection,
  LinkMute,
} from '../ui';

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
      badge: 'The Zero-Friction Personal Life OS',
      headline: "Berhenti Biarkan Ide & Catatanmu Jadi 'Kuburan' di Saved Messages.",
      subheadline:
        'Cukup ketik apa saja ke bot Telegram kami sesantai mengirim pesan ke teman. AI otomatis merapikan keuangan, to-do list, password terenkripsi, dan jurnal harian Anda ke dashboard bersih dalam 1 detik.',
      ctaTelegram: 'Mulai di Telegram',
      ctaDashboard: 'Buka Dashboard',
      securityNotice:
        'Private Vault: Untuk password, PIN, & kredensial sensitif, gunakan perintah /secure <kunci> <isi> agar dienkripsi militer AES-256-GCM dan diisolasi 100% dari AI.',

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
      proTitle: 'Max (Pro)',
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

      // CTA Strip
      ctaStripTitle: 'Mulai rapikan hidupmu tanpa repot hari ini.',
      ctaStripBtn: 'Buka Bot Telegram',

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
      badge: 'The Zero-Friction Personal Life OS',
      headline: "Stop Letting Your Best Ideas Die in 'Saved Messages'.",
      subheadline:
        'Just text anything to our Telegram bot like chatting with a friend. AI instantly organizes your finances, to-do lists, encrypted credentials, and daily journals into a clean dashboard in 1 second.',
      ctaTelegram: 'Start on Telegram',
      ctaDashboard: 'Open Dashboard',
      securityNotice:
        'Private Vault: For passwords, PINs, & tokens, use /secure <key> <secret> to encrypt with military-grade AES-256-GCM, 100% isolated from AI.',

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
      proTitle: 'Max (Pro)',
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

      // CTA Strip
      ctaStripTitle: 'Start organizing your thoughts instantly today.',
      ctaStripBtn: 'Open Telegram Bot',

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
      {/* Primary Navigation */}
      <PrimaryNav>
        <div className="flex items-center gap-6">
          <a href="/" className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-xs select-none">
              U
            </span>
            <span className="font-semibold text-body-sm-strong text-ink tracking-tight">
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

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setLocale(locale === 'id' ? 'en' : 'id')}
            className="inline-flex items-center gap-1.5 px-3 h-8 rounded-full border border-hairline bg-surface-soft text-ink text-body-sm cursor-pointer"
            title="Switch Language"
          >
            <Globe className="w-3.5 h-3.5 text-body" />
            <span>{locale === 'id' ? 'ID' : 'EN'}</span>
          </button>

          <a href="/dashboard">
            <Button variant="primary">{t.navLogin}</Button>
          </a>
        </div>
      </PrimaryNav>

      <main className="flex-1">
        {/* 1. Hero Section */}
        <section className="pt-20 pb-16 px-6 max-w-4xl mx-auto text-center">
          <h1 className="text-display-xl text-ink mb-6 max-w-3xl mx-auto tracking-tight">
            {t.headline}
          </h1>

          <p className="text-body-md text-body max-w-2xl mx-auto mb-8">
            {t.subheadline}
          </p>

          {/* Hero Install Snippet */}
          <div className="max-w-lg mx-auto mb-8">
            <InstallSnippet
              command="https://t.me/unlazynotes_bot"
              showCopy={true}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="https://t.me/unlazynotes_bot"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="primary" className="gap-2">
                <Send className="w-4 h-4" />
                <span>{t.ctaTelegram}</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-60" />
              </Button>
            </a>

            <a href="/dashboard">
              <Button variant="secondary" className="gap-2">
                <span>{t.ctaDashboard}</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </a>
          </div>

          {/* Security Notice Pill */}
          <div className="mt-12 max-w-xl mx-auto p-4 rounded-lg border border-hairline bg-surface-soft text-charcoal text-body-sm text-left flex items-start gap-3">
            <Lock className="w-4 h-4 text-ink shrink-0 mt-0.5" />
            <p className="leading-relaxed">{t.securityNotice}</p>
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              {/* Left Column: Raw Telegram Chat in Terminal Card */}
              <TerminalCard title={t.showcaseTelegramTitle}>
                <div className="space-y-4 py-2 font-mono text-code-sm">
                  <div>
                    <span className="text-body text-caption-sm block mb-1"># 1. Catatan Pengeluaran Spontan</span>
                    <div className="flex items-center gap-2 pl-2 border-l-2 border-hairline-strong">
                      <span className="text-charcoal select-none">&gt;</span>
                      <span className="text-ink">tfr 150rb patungan seblak ubed</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-body text-caption-sm block mb-1"># 2. Daftar To-do Cepat</span>
                    <div className="flex items-center gap-2 pl-2 border-l-2 border-hairline-strong">
                      <span className="text-charcoal select-none">&gt;</span>
                      <span className="text-ink">hiling dieng, pilates, belanja tokma</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-body text-caption-sm block mb-1"># 3. Kredensial Terenkripsi</span>
                    <div className="flex items-center gap-2 pl-2 border-l-2 border-hairline-strong">
                      <span className="text-charcoal select-none">&gt;</span>
                      <span className="text-ink">/secure bca pin 123456</span>
                    </div>
                  </div>
                </div>
              </TerminalCard>

              {/* Right Column: Structured Output in Flat Card */}
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-hairline">
                  <div className="text-body-sm-strong text-ink">{t.showcaseDashboardTitle}</div>
                  <CommandTag>{t.showcaseAiTag}</CommandTag>
                </div>

                {/* Structured Note 1 */}
                <div className="bg-canvas border border-hairline rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between text-caption-sm text-body">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> 16 Okt 2026, 13:42
                    </span>
                    <CommandTag>FINANCE</CommandTag>
                  </div>
                  <p className="text-body-sm text-ink font-medium">tfr 150rb patungan seblak ubed</p>
                  <div className="flex items-center justify-between pt-1 text-body-sm">
                    <div className="flex gap-1.5">
                      <span className="text-caption-sm text-body">#ubed</span>
                      <span className="text-caption-sm text-body">#food</span>
                    </div>
                    <span className="font-mono text-ink font-semibold">Rp 150.000</span>
                  </div>
                </div>

                {/* Structured Note 2 */}
                <div className="bg-canvas border border-hairline rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between text-caption-sm text-body">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> 16 Okt 2026, 13:43
                    </span>
                    <CommandTag>TODO</CommandTag>
                  </div>
                  <p className="text-body-sm text-ink font-medium">hiling dieng, pilates, belanja tokma</p>
                  <div className="flex gap-1.5 pt-1 text-caption-sm text-body">
                    <span>#dieng</span>
                    <span>#tokma</span>
                    <span>#pilates</span>
                  </div>
                </div>

                {/* Structured Note 3 */}
                <div className="bg-canvas border border-hairline rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between text-caption-sm text-body">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> 16 Okt 2026, 13:45
                    </span>
                    <CommandTag>VAULT</CommandTag>
                  </div>
                  <div className="flex items-center justify-between bg-surface-soft border border-hairline rounded-full px-3 py-1.5 font-mono text-code-sm">
                    <span className="text-charcoal truncate">
                      {vaultRevealed ? 'pin 123456' : '••••••••••••••••'}
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

        {/* 4. Pricing Comparison: Light Standard + Single Inverted Dark Card */}
        <section id="pricing" className="py-20 px-6 border-t border-hairline bg-canvas">
          <div className="max-w-4xl mx-auto">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <h2 className="text-heading-lg text-ink mb-2">
                {t.pricingTitle}
              </h2>
              <p className="text-body-sm text-body">{t.pricingSub}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
              {/* Standard Tier (Light Flat Card) */}
              <PricingCard>
                <div>
                  <h3 className="text-heading-lg text-ink mb-1">{t.standardTitle}</h3>
                  <p className="text-body-sm text-body mb-6">{t.standardDesc}</p>

                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-display-lg text-ink tabular-nums">{t.standardPrice}</span>
                    <span className="text-body-sm text-body">{t.perMonth}</span>
                  </div>

                  <div className="space-y-3 mb-8">
                    {t.standardFeatures.map((f, i) => (
                      <FeatureBullet key={i}>{f}</FeatureBullet>
                    ))}
                  </div>
                </div>

                <a href="/login" className="block">
                  <Button variant="secondary" fullWidth>
                    {t.selectPlan}
                  </Button>
                </a>
              </PricingCard>

              {/* Max Tier (The Single Inverted Dark Card in the Entire System) */}
              <PricingCardDark>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-heading-lg text-on-dark">{t.proTitle}</h3>
                    <CommandTag className="bg-neutral-800 text-on-dark">POPULAR</CommandTag>
                  </div>
                  <p className="text-body-sm text-on-dark-mute mb-6">{t.proDesc}</p>

                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-display-lg text-on-dark tabular-nums">{t.proPrice}</span>
                    <span className="text-body-sm text-on-dark-mute">{t.perMonth}</span>
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
                    {t.selectPlan}
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
                Bergabung dalam 2 detik tanpa perlu instalasi aplikasi berat.
              </p>
            </div>
            <a
              href="https://t.me/unlazynotes_bot"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0"
            >
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
