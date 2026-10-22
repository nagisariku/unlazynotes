import { useState, useEffect, useMemo } from 'react';
import {
  Eye,
  EyeOff,
  Check,
  RefreshCw,
  LogOut,
  Send,
  Download,
  FileJson,
  Bookmark,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
} from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Toaster, toast } from 'sonner';
import UpgradeModal from './UpgradeModal';
import { Button } from '../ui';

interface SettingsViewProps {
  user: {
    id: string;
    name?: string | null;
    email: string;
    image?: string | null;
    joinedDate?: string | null;
  };
  subscription?: {
    plan: string;
    status: string;
    currency: string;
    notesTodayCount: number;
    expiresAt?: string | null;
  } | null;
  apiKeyInfo?: {
    rawKey?: string | null;
    telegramChatId?: string | null;
    isActive: boolean;
  } | null;
}

export default function SettingsView({ user, subscription, apiKeyInfo }: SettingsViewProps) {
  const [currentKey, setCurrentKey] = useState<string>(
    apiKeyInfo?.rawKey || 'unz_********************************'
  );
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [telegramChatId, setTelegramChatId] = useState<string | null>(
    apiKeyInfo?.telegramChatId || null
  );
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [paymentBanner, setPaymentBanner] = useState<'success' | 'cancelled' | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const payment = params.get('payment');
      if (payment === 'success') {
        setPaymentBanner('success');
        toast.success('Pembayaran DOKU berhasil! Akun Anda aktif sebagai Pro.');
      } else if (payment === 'cancelled') {
        setPaymentBanner('cancelled');
        toast.info('Pembayaran dibatalkan atau belum diselesaikan.');
      }
    }
  }, []);

  // Auto copy on field click
  const handleAutoCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentKey);
      setCopied(true);
      toast.success('API Key berhasil disalin ke clipboard! 📋');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Gagal menyalin API Key');
    }
  };

  const handleRegenerate = async () => {
    if (
      !confirm(
        'PERINGATAN: Membuat ulang API Key akan memutuskan koneksi bot Telegram yang sedang aktif. Anda harus menjalankan /login dengan key baru di Telegram. Lanjutkan?'
      )
    ) {
      return;
    }

    setIsRegenerating(true);
    try {
      const res = await fetch('/api/apikey/regenerate', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.apiKey) {
        setCurrentKey(data.apiKey);
        setShowKey(true);
        setTelegramChatId(null);
        toast.success('API Key baru berhasil diterbitkan!');
      } else {
        toast.error(data.error || 'Gagal menerbitkan API Key baru');
      }
    } catch {
      toast.error('Terjadi kesalahan saat memproses request');
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/';
    } catch {
      window.location.href = '/';
    }
  };

  const isConnected = Boolean(telegramChatId);
  const isPro = subscription?.plan === 'pro';
  const notesCount = subscription?.notesTodayCount || 0;

  // Formatted joined date
  const joinedDateString = (() => {
    if (!user.joinedDate) return 'Baru bergabung';
    try {
      return format(new Date(user.joinedDate), 'd MMMM yyyy', { locale: localeId });
    } catch {
      return 'Baru bergabung';
    }
  })();

  // Formatted expiration date
  const expirationString = (() => {
    if (isPro && subscription?.expiresAt) {
      try {
        return format(new Date(subscription.expiresAt), 'd MMMM yyyy', { locale: localeId });
      } catch {
        return 'Aktif';
      }
    }
    return isPro ? 'Aktif' : 'Free Lifetime';
  })();

  // 1-Click connect URL
  const telegramConnectUrl =
    currentKey && !currentKey.includes('***')
      ? `https://t.me/unlazynotes_bot?start=${encodeURIComponent(currentKey)}`
      : 'https://t.me/unlazynotes_bot';

  const userInitial = (user.name || user.email || 'U').charAt(0).toUpperCase();

  const userLastName = useMemo(() => {
    const raw = user.name || user.email || 'User';
    const parts = raw.trim().split(/\s+/);
    return parts[parts.length - 1];
  }, [user.name, user.email]);

  return (
    <div className="w-full max-w-4xl overflow-x-hidden px-4 sm:px-6 md:px-8 pt-3.5 sm:pt-6 pb-32 sm:pb-12 space-y-6 sm:space-y-8 bg-canvas text-ink relative">
      <Toaster position="bottom-right" />

      {/* Page Title */}
      <div>
        <h1 className="text-display-lg sm:text-display-xl text-ink font-semibold tracking-tight flex items-baseline gap-2.5 flex-wrap">
          <span>{userLastName}</span>
          <span className="font-tangerine tangerine-bold text-[1.15em] leading-none inline-block">
            Settings
          </span>
        </h1>
        <p className="text-body-sm text-body mt-0.5">
          Kelola profil akun, status langganan, integrasi bot Telegram, dan ekspor data Anda.
        </p>
      </div>

      {/* Payment Banner Alert if redirected from checkout */}
      {paymentBanner === 'success' && (
        <div className="p-4 rounded-xl border border-hairline bg-surface-soft text-ink text-body-sm flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-terminal-green shrink-0" />
            <span>
              <strong>Pembayaran Sukses!</strong> Akun Anda kini aktif dengan paket <strong>Pro</strong>.
            </span>
          </div>
          <button
            onClick={() => setPaymentBanner(null)}
            className="text-ink text-caption-sm ml-4 font-semibold hover:underline cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}
      {paymentBanner === 'cancelled' && (
        <div className="p-4 rounded-xl border border-hairline bg-surface-soft text-ink text-body-sm flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-terminal-yellow shrink-0" />
            <span>Pembayaran dibatalkan atau belum diselesaikan. Anda dapat mencoba kembali kapan saja.</span>
          </div>
          <button
            onClick={() => setPaymentBanner(null)}
            className="text-ink text-caption-sm ml-4 font-semibold hover:underline cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* SECTION 1: Account & Integration */}
      <div className="space-y-6">
        <h2 className="text-heading-md font-semibold text-ink">
          Account &amp; Integration
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Avatar + Profil Akun + Logout Button */}
          <div className="lg:col-span-5 flex flex-col items-start space-y-5">
            <div className="flex items-start gap-4">
              {/* Circle Avatar */}
              {user.image ? (
                <img
                  src={user.image}
                  alt={user.name || 'User'}
                  className="w-16 h-16 rounded-full border border-hairline object-cover shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-full border border-hairline bg-surface-soft flex items-center justify-center text-ink text-display-lg font-normal shrink-0 select-none">
                  {userInitial}
                </div>
              )}

              {/* Profil Akun Info */}
              <div className="space-y-1 min-w-0">
                <h3 className="text-body-md font-medium text-ink truncate leading-tight">
                  {user.name || 'User'}
                </h3>
                <div className="pt-0.5 pb-0.5 flex items-center">
                  {isPro ? (
                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-ink text-canvas select-none shadow-xs">
                      PRO
                    </span>
                  ) : (
                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase bg-surface-soft border border-hairline text-body select-none">
                      FREE
                    </span>
                  )}
                </div>
                <p className="text-caption-sm text-body truncate">
                  {user.email}
                </p>
                <div className="flex items-center gap-1.5 text-caption-sm text-body pt-1">
                  <Clock className="w-3.5 h-3.5 text-mute" />
                  <span>Bergabung {joinedDateString}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons: Upgrade to Pro (Free users) + Logout */}
            <div className="flex items-center gap-2.5 flex-wrap">
              {!isPro && (
                <button
                  type="button"
                  onClick={() => setIsUpgradeModalOpen(true)}
                  className="inline-flex items-center gap-2 px-5 h-9 rounded-full bg-ink text-canvas hover:opacity-90 text-caption-sm font-medium cursor-pointer transition-colors shadow-2xs select-none"
                  title="Upgrade ke paket Pro"
                  aria-label="Upgrade to Pro"
                >
                  <Sparkles className="w-3.5 h-3.5 text-canvas" />
                  <span>Upgrade to Pro</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-2 px-5 h-9 rounded-full border border-hairline bg-surface-soft hover:bg-canvas text-ink text-caption-sm font-medium cursor-pointer transition-colors"
                title="Keluar dari akun"
                aria-label="Logout"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>logout</span>
              </button>
            </div>
          </div>

          {/* Right Column: 2x2 Grid of Rounded Cards matching wireframe */}
          <div className="lg:col-span-7 grid grid-cols-2 gap-2.5 sm:gap-3.5">
            {/* Card 1: plan active */}
            <div className="p-3.5 sm:p-4 rounded-xl border border-hairline bg-canvas flex flex-col justify-between">
              <div>
                <span className="text-[10px] sm:text-[11px] text-body uppercase font-sans tracking-wider block">
                  plan active
                </span>
                <span className="text-body-md sm:text-heading-md font-sans font-semibold text-ink capitalize mt-1 block truncate">
                  {isPro ? 'Pro Member' : 'Free Tier'}
                </span>
              </div>
            </div>

            {/* Card 2: plan expired */}
            <div className="p-3.5 sm:p-4 rounded-xl border border-hairline bg-canvas flex flex-col justify-between">
              <div>
                <span className="text-[10px] sm:text-[11px] text-body uppercase font-sans tracking-wider block">
                  plan expired
                </span>
                <span className="text-body-md sm:text-heading-md font-sans font-semibold text-ink mt-1 block truncate">
                  {expirationString}
                </span>
              </div>
            </div>

            {/* Card 3: kuota notes */}
            <div className="p-3.5 sm:p-4 rounded-xl border border-hairline bg-canvas flex flex-col justify-between">
              <div>
                <span className="text-[10px] sm:text-[11px] text-body uppercase font-sans tracking-wider block">
                  kuota notes
                </span>
                <span className="text-body-md sm:text-heading-md font-sans font-semibold text-ink mt-1 block truncate">
                  {isPro ? 'Unlimited' : `${notesCount} / 30`}
                </span>
              </div>
            </div>

            {/* Card 4: kuota /ask */}
            <div className="p-3.5 sm:p-4 rounded-xl border border-hairline bg-canvas flex flex-col justify-between">
              <div>
                <span className="text-[10px] sm:text-[11px] text-body uppercase font-sans tracking-wider block">
                  kuota /ask
                </span>
                <span className="text-body-md sm:text-heading-md font-sans font-semibold text-ink mt-1 block truncate">
                  {isPro ? 'Unlimited' : '10 / hari'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: Telegram Bot Integration matching wireframe */}
      <div className="p-6 rounded-2xl border border-hairline bg-canvas space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-heading-md font-semibold text-ink">
              Telegram Bot Integration
            </h2>
            <p className="text-caption-sm text-body">
              Hubungkan bot <strong className="font-semibold text-ink">@unlazynotes_bot</strong> dengan akun Anda.
            </p>
          </div>

          {/* Connection Status Indicator */}
          {isConnected ? (
            <span className="inline-flex items-center gap-1.5 text-body-sm font-normal text-ink select-none">
              <CheckCircle2 className="w-4 h-4 text-terminal-green shrink-0" />
              <span>Terhubung ({telegramChatId})</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-body-sm font-normal text-ink select-none">
              <AlertCircle className="w-4 h-4 text-terminal-yellow shrink-0" />
              <span>Belum Terhubung</span>
            </span>
          )}
        </div>

        {/* Input Row: Long input field + (Connect button & Regenerate key side-by-side on mobile, inline on desktop) */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
          {/* Long field: auto-copy on click, default censored */}
          <div
            onClick={handleAutoCopy}
            className="flex-1 min-w-0 flex items-center justify-between px-4 h-10 rounded-full border border-hairline bg-surface-soft hover:bg-canvas hover:border-hairline-strong cursor-pointer text-caption-sm text-ink select-none group relative"
            title="Klik field untuk salin otomatis"
          >
            <span className="truncate mr-2 font-mono text-caption-sm">
              {showKey ? currentKey : '••••••••••••••••••••••••••••••••••••••••••••'}
            </span>

            <div className="flex items-center gap-1.5 shrink-0">
              {copied && (
                <span className="inline-flex items-center gap-1 text-[11px] font-sans font-medium text-terminal-green bg-surface-soft px-2 py-0.5 rounded-full">
                  <Check className="w-3 h-3" />
                  <span>Tersalin</span>
                </span>
              )}

              {/* Eye toggle button (stop propagation so it doesn't trigger auto-copy) */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowKey(!showKey);
                }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-mute hover:text-ink hover:bg-canvas/80 border border-transparent hover:border-hairline cursor-pointer transition-colors"
                title={showKey ? 'Sembunyikan Kunci' : 'Tampilkan Kunci'}
                aria-label="Toggle visible key"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Action Buttons: Side-by-side on Mobile, inline on Desktop */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Connect Telegram button */}
            <a
              href={telegramConnectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 h-10 px-4 sm:px-5 rounded-full bg-primary text-on-primary text-caption-sm font-semibold hover:opacity-95 active:bg-ink-deep focus-visible:ring-2 focus-visible:ring-focus-ring cursor-pointer select-none transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span className="whitespace-nowrap">{isConnected ? 'Buka Bot' : 'Hubungkan Telegram'}</span>
            </a>

            {/* Regenerate Key button */}
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="flex-1 md:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 sm:px-4 h-10 rounded-full border border-hairline bg-surface-soft hover:bg-canvas text-ink text-caption-sm font-semibold cursor-pointer select-none transition-colors disabled:opacity-50"
              title="Buat ulang kunci API baru"
              aria-label="Regenerate key"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
              <span className="whitespace-nowrap">Regenerate key</span>
            </button>
          </div>
        </div>

        {/* Guide section matching wireframe */}
        <div className="space-y-2 text-body-sm text-body">
          <span className="font-semibold text-ink text-caption-sm block">
            Guide:
          </span>
          <ol className="list-decimal list-inside space-y-1.5 text-caption-sm text-body">
            <li>
              Klik pada kolom API Key di atas untuk <strong>menyalin otomatis</strong> ke clipboard.
            </li>
            <li>
              Klik tombol <strong>Hubungkan Telegram</strong> untuk membuka bot <a href="https://t.me/unlazynotes_bot" target="_blank" rel="noreferrer" className="text-ink underline font-semibold">@unlazynotes_bot</a> secara instan (1-Click Connect).
            </li>
            <li>
              Jika menyalin manual, kirimkan perintah <code className="px-1.5 py-0.5 rounded-sm bg-surface-soft border border-hairline text-ink font-mono text-[11px]">/login &lt;API_KEY&gt;</code> ke ruang obrolan bot.
            </li>
          </ol>
        </div>
      </div>

      {/* SECTION 3: Export matching wireframe */}
      <div className="p-6 rounded-2xl border border-hairline bg-canvas space-y-4">
        <h2 className="text-heading-md font-semibold text-ink">
          Export
        </h2>
        <p className="text-caption-sm text-body">
          Cadangkan data catatan dan bookmark Anda kapan saja tanpa vendor lock-in.
        </p>

        {/* Two export buttons matching wireframe */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          {/* Export Notes button */}
          <a
            href="/api/notes/export?format=json"
            download
            className="inline-flex items-center gap-2 px-5 h-10 rounded-full border border-hairline bg-surface-soft hover:bg-canvas text-ink text-caption-sm font-semibold cursor-pointer"
            title="Unduh seluruh catatan dalam format JSON"
          >
            <FileJson className="w-4 h-4 text-mute" />
            <span>Export Notes (JSON)</span>
            <Download className="w-3.5 h-3.5 text-body ml-1" />
          </a>

          {/* Export Bookmarks button */}
          <a
            href="/api/bookmarks/export"
            download
            className="inline-flex items-center gap-2 px-5 h-10 rounded-full border border-hairline bg-surface-soft hover:bg-canvas text-ink text-caption-sm font-semibold cursor-pointer"
            title="Unduh bookmark dalam format Netscape HTML (kompatibel Chrome/Firefox)"
          >
            <Bookmark className="w-4 h-4 text-mute" />
            <span>Export Bookmarks (HTML)</span>
            <Download className="w-3.5 h-3.5 text-body ml-1" />
          </a>
        </div>
      </div>

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        initialCurrency={subscription?.currency === 'USD' ? 'USD' : 'IDR'}
      />
    </div>
  );
}
