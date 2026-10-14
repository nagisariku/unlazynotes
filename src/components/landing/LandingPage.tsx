import { useState } from 'react';
import { Bot, ArrowRight, Sparkles, Check, Bookmark, ShieldAlert, ExternalLink, Globe } from 'lucide-react';

export default function LandingPage() {
  const [locale, setLocale] = useState<'id' | 'en'>('id');

  const content = {
    id: {
      navFeatures: 'Fitur',
      navPricing: 'Harga',
      navLogin: 'Masuk / Daftar',
      badge: 'Capture Kilat via Telegram Bot',
      headline: 'Berhenti Buat Sampah di Obrolan WhatsApp & Telegram Sendiri.',
      subheadline:
        'Kirimkan ide acak, to-do list, catatan tagihan, tautan artikel, atau draf langsung ke bot Telegram kami. AI akan otomatis mengkategorikan dan merapikannya ke dashboard web bersih Anda.',
      ctaTelegram: 'Coba Bot Sekarang',
      ctaDashboard: 'Buka Web Workspace',
      securityNotice:
        'Catatan Keamanan: UnlazyNotes adalah alat tangkap ide cepat, bukan zero-knowledge encrypted vault. Hindari menyimpan kredensial kritis perbankan.',
      featuresTitle: 'Dirancang untuk Tangkapan Cepat Tanpa Friksi',
      featuresSub: 'Tiga pilar utama untuk menjaga pikiran Anda tetap jernih dan teratur.',
      f1Title: 'Chat-First Capture',
      f1Desc: 'Cukup ketik atau forward pesan ke @unlazynotes_bot. Tanpa perlu membuka aplikasi catatan yang berat.',
      f2Title: 'Auto-Tagging AI Instan',
      f2Desc: 'Sistem menganalisis pesan dalam 1 detik dan menyematkan 1 dari 9 kategori baku serta tag spesifik bernilai filter tinggi.',
      f3Title: 'Ekspor Bookmark ke Browser',
      f3Desc: 'Semua link bacaan dan video otomatis terkumpul di kategori Bookmark dan siap diekspor ke format HTML peramban Anda.',
      pricingTitle: 'Pilihan Paket Langganan Sederhana',
      pricingSub: '100% Berbayar tanpa iklan, tanpa data broker, dan tanpa penguncian vendor.',
      monthly: 'Bulan',
      yearly: 'Tahun',
      perMonth: '/bulan',
      standardTitle: 'Standard',
      standardPrice: 'Rp15.000',
      standardDesc: 'Ideal untuk individu yang ingin ruang chat rapi sehari-hari.',
      standardFeatures: [
        'Maksimal 25 catatan baru / hari',
        'Auto-tagging AI 9 kategori',
        'Pencarian kata kunci cepat',
        'Ekspor bookmark ke browser (HTML)',
        'Akses dashboard web selamanya',
      ],
      proTitle: 'Pro',
      proPrice: 'Rp49.000',
      proDesc: 'Kapasitas tanpa batas & kecerdasan AI untuk second-brain Anda.',
      proFeatures: [
        'Catatan tanpa batas (Unlimited)',
        'Fitur AI Contextual Q&A (/ask)',
        'Auto-tagging prioritas tinggi',
        'Pencarian & filter instan',
        'Ekspor bookmark ke browser',
        'Dukungan prioritas',
      ],
      selectPlan: 'Pilih Paket Ini',
      footerCopyright: '© 2026 UnlazyNotes. All rights reserved.',
    },
    en: {
      navFeatures: 'Features',
      navPricing: 'Pricing',
      navLogin: 'Sign In',
      badge: 'Fast Capture via Telegram Bot',
      headline: 'Stop Cluttering Your "Saved Messages" Chat.',
      subheadline:
        'Send random ideas, to-do lists, bills, bookmark links, or drafts directly to our Telegram bot. AI categorizes and organizes them into your distraction-free workspace instantly.',
      ctaTelegram: 'Try Bot on Telegram',
      ctaDashboard: 'Open Web Workspace',
      securityNotice:
        'Security Disclaimer: UnlazyNotes is a quick idea capture tool, not a zero-knowledge encrypted vault. Avoid storing highly critical banking credentials.',
      featuresTitle: 'Built for Frictionless Quick Capture',
      featuresSub: 'Three core pillars to keep your mind clutter-free.',
      f1Title: 'Chat-First Capture',
      f1Desc: 'Just send or forward messages to @unlazynotes_bot. No waiting for bulky note apps to load.',
      f2Title: 'Instant AI Auto-Tagging',
      f2Desc: 'Analyzes your note in 1 second and tags it into 1 of 9 standardized categories plus specific filter tags.',
      f3Title: '1-Click Browser Bookmark Export',
      f3Desc: 'All your saved articles and video links can be exported into standard Netscape HTML for Chrome/Safari.',
      pricingTitle: 'Simple & Transparent Pricing',
      pricingSub: '100% Paid. No ads, no data selling, and zero vendor lock-in.',
      monthly: 'Month',
      yearly: 'Year',
      perMonth: '/mo',
      standardTitle: 'Standard',
      standardPrice: '$1',
      standardDesc: 'Perfect for daily personal idea capturing.',
      standardFeatures: [
        'Up to 25 notes per day',
        'Automated AI 9-category tagging',
        'Fast keyword search in bot & web',
        'Browser bookmark HTML export',
        'Clean web workspace access',
      ],
      proTitle: 'Pro',
      proPrice: '$3',
      proDesc: 'Unlimited power & AI contextual recall for your second brain.',
      proFeatures: [
        'Unlimited notes capture',
        'AI Contextual Q&A via /ask command',
        'High-priority auto-tagging',
        'Advanced instant filter & search',
        'Browser bookmark HTML export',
        'Priority customer support',
      ],
      selectPlan: 'Get Started',
      footerCopyright: '© 2026 UnlazyNotes. All rights reserved.',
    },
  };

  const t = content[locale];

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-zinc-100">
      {/* Navbar */}
      <header className="border-b border-zinc-800/80 sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 font-bold text-lg">
              U
            </div>
            <span className="font-bold text-lg tracking-tight">UnlazyNotes</span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm text-zinc-400 font-medium">
            <a href="#features" className="hover:text-zinc-100 transition-colors">
              {t.navFeatures}
            </a>
            <a href="#pricing" className="hover:text-zinc-100 transition-colors">
              {t.navPricing}
            </a>
          </nav>

          <div className="flex items-center gap-3">
            {/* Currency/Locale Selector */}
            <button
              onClick={() => setLocale(locale === 'id' ? 'en' : 'id')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
              title="Switch Language / Currency"
            >
              <Globe className="w-3.5 h-3.5 text-zinc-400" />
              <span>{locale === 'id' ? 'ID / IDR' : 'EN / USD'}</span>
            </button>

            <a
              href="/login"
              className="px-4 py-2 rounded-lg bg-zinc-100 text-zinc-900 font-semibold text-sm hover:bg-white transition-all shadow-sm"
            >
              {t.navLogin}
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-20 pb-16 px-4 max-w-5xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-medium mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          <span>{t.badge}</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-zinc-100 mb-6 leading-tight max-w-4xl mx-auto">
          {t.headline}
        </h1>

        <p className="text-lg text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          {t.subheadline}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="https://t.me/unlazynotes_bot"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all shadow-lg shadow-indigo-600/25"
          >
            <Bot className="w-4 h-4" />
            <span>{t.ctaTelegram}</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-70" />
          </a>

          <a
            href="/dashboard"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-200 font-medium text-sm transition-all"
          >
            <span>{t.ctaDashboard}</span>
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>

        {/* Security Alert Badge */}
        <div className="mt-12 max-w-xl mx-auto p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-200/90 text-xs flex items-start gap-2.5 text-left">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="leading-snug">{t.securityNotice}</p>
        </div>
      </section>

      {/* Features Showcase */}
      <section id="features" className="py-20 border-t border-zinc-900 bg-zinc-950/40">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">
              {t.featuresTitle}
            </h2>
            <p className="text-zinc-400 text-sm leading-relaxed">{t.featuresSub}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 transition-all">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-5">
                <Bot className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-lg mb-2 text-zinc-100">{t.f1Title}</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">{t.f1Desc}</p>
            </div>

            <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 transition-all">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-5">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-lg mb-2 text-zinc-100">{t.f2Title}</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">{t.f2Desc}</p>
            </div>

            <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 transition-all">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mb-5">
                <Bookmark className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-lg mb-2 text-zinc-100">{t.f3Title}</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">{t.f3Desc}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Comparison */}
      <section id="pricing" className="py-20 border-t border-zinc-900">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">
              {t.pricingTitle}
            </h2>
            <p className="text-zinc-400 text-sm leading-relaxed">{t.pricingSub}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Standard */}
            <div className="p-8 rounded-3xl border border-zinc-800 bg-zinc-900/40 flex flex-col justify-between">
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
                className="w-full py-3 rounded-xl border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-semibold text-sm text-center transition-colors block"
              >
                {t.selectPlan}
              </a>
            </div>

            {/* Pro */}
            <div className="p-8 rounded-3xl border border-indigo-500/50 bg-gradient-to-b from-indigo-950/20 to-zinc-900/40 relative flex flex-col justify-between shadow-xl shadow-indigo-950/20">
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
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm text-center transition-all shadow-md shadow-indigo-600/30 block"
              >
                {t.selectPlan}
              </a>
            </div>
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
            <a href="/login" className="hover:text-zinc-300 transition-colors">
              Web Workspace
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
