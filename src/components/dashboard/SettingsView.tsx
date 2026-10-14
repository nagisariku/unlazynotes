import { useState, useEffect } from 'react';
import { Eye, EyeOff, Copy, Check, RefreshCw, Bot, Shield, CheckCircle2, AlertCircle, Sparkles, Zap } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import UpgradeModal from './UpgradeModal';

interface SettingsViewProps {
  user: {
    id: string;
    name?: string | null;
    email: string;
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
        toast.success('🎉 Pembayaran DOKU berhasil! Akun Anda aktif sebagai Pro.');
      } else if (payment === 'cancelled') {
        setPaymentBanner('cancelled');
        toast.info('Pembayaran dibatalkan atau belum diselesaikan.');
      }
    }
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentKey);
      setCopied(true);
      toast.success('API Key berhasil disalin!');
      setTimeout(() => setCopied(false), 2000);
    } catch {}
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
        toast.error('Gagal menerbitkan API Key baru');
      }
    } catch {
      toast.error('Terjadi kesalahan saat memproses request');
    } finally {
      setIsRegenerating(false);
    }
  };

  const isConnected = Boolean(telegramChatId);
  const plan = subscription?.plan || 'standard';
  const notesCount = subscription?.notesTodayCount || 0;

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8 space-y-8">
      <Toaster position="bottom-right" theme="dark" />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Account &amp; Integrations</h1>
        <p className="text-zinc-400 text-xs mt-1">
          Kelola profil, kunci integrasi Telegram Bot, dan status paket langganan Anda.
        </p>
      </div>

      {/* Section 1: Telegram Integration & API Key */}
      <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100">Telegram Bot Integration</h2>
              <p className="text-xs text-zinc-400">
                Hubungkan bot <span className="font-semibold text-zinc-300">@unlazynotes_bot</span> dengan akun Anda
              </p>
            </div>
          </div>

          {/* Connection Status Badge */}
          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
              isConnected
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
            }`}
          >
            {isConnected ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Terhubung (Chat ID: {telegramChatId})</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Belum Terhubung</span>
              </>
            )}
          </div>
        </div>

        {/* API Key Box */}
        <div>
          <label className="text-xs font-medium text-zinc-400 block mb-2">Telegram API Key Anda:</label>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950 font-mono text-xs text-zinc-300 select-all">
              <span>{showKey ? currentKey : '••••••••••••••••••••••••••••••••••••••••••••'}</span>
              <button
                onClick={() => setShowKey(!showKey)}
                className="text-zinc-500 hover:text-zinc-300 ml-2"
                title={showKey ? 'Sembunyikan' : 'Tampilkan'}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition-colors shrink-0"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Tersalin' : 'Salin Key'}</span>
            </button>

            <button
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold transition-colors shrink-0"
              title="Buat ulang kunci API baru"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
              <span>Regenerate Key</span>
            </button>
          </div>
        </div>

        {/* Quick Instructions */}
        <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-950/60 text-xs text-zinc-400 space-y-2">
          <p className="font-semibold text-zinc-300">Cara Menghubungkan ke Bot:</p>
          <ol className="list-decimal list-inside space-y-1 text-zinc-400">
            <li>Buka Telegram dan cari bot <a href="https://t.me/unlazynotes_bot" target="_blank" rel="noreferrer" className="text-indigo-400 underline font-semibold">@unlazynotes_bot</a>.</li>
            <li>Salin API Key di atas.</li>
            <li>Ketik perintah di chat bot: <code className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-200 font-mono">/login &lt;api_key&gt;</code>.</li>
            <li>Setelah bot membalas konfirmasi sukses, Anda siap mengirim catatan kapan saja!</li>
          </ol>
        </div>
      </div>

      {/* Payment Banner Alert */}
      {paymentBanner === 'success' && (
        <div className="p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>Pembayaran Sukses!</strong> Akun Anda kini aktif dengan paket <strong>Pro</strong>. Nikmati catatan tanpa batas dan asisten AI pintar.
            </span>
          </div>
          <button
            onClick={() => setPaymentBanner(null)}
            className="text-emerald-400 hover:text-emerald-200 text-xs ml-4"
          >
            Tutup
          </button>
        </div>
      )}

      {paymentBanner === 'cancelled' && (
        <div className="p-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Pembayaran dibatalkan atau belum diselesaikan. Anda dapat mencoba kembali kapan saja.</span>
          </div>
          <button
            onClick={() => setPaymentBanner(null)}
            className="text-amber-400 hover:text-amber-200 text-xs ml-4"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Section 2: Subscription Status */}
      <div id="upgrade" className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100">Subscription Status</h2>
              <p className="text-xs text-zinc-400">Informasi paket langganan dan utilisasi kuota harian Anda</p>
            </div>
          </div>

          {plan === 'pro' ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Pro Member</span>
            </div>
          ) : (
            <button
              onClick={() => setIsUpgradeModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Upgrade ke Pro</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950">
            <span className="text-[11px] text-zinc-500 block uppercase font-medium">Paket Aktif</span>
            <span className="text-lg font-bold text-zinc-100 capitalize">{plan} Plan</span>
          </div>

          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950">
            <span className="text-[11px] text-zinc-500 block uppercase font-medium">Kuota Catatan Hari Ini</span>
            <span className="text-lg font-bold text-zinc-100">
              {plan === 'pro' ? 'Unlimited' : `${notesCount} / 25 notes`}
            </span>
          </div>

          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950">
            <span className="text-[11px] text-zinc-500 block uppercase font-medium">Masa Aktif</span>
            <span className="text-lg font-bold text-emerald-400">
              {subscription?.expiresAt
                ? new Date(subscription.expiresAt).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })
                : 'Lifetime / Free'}
            </span>
          </div>
        </div>

        {/* Upgrade Callout Card for Standard Plan */}
        {plan !== 'pro' && (
          <div className="p-5 rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/40 via-zinc-950 to-zinc-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-zinc-100">Upgrade ke UnlazyNotes Pro</h3>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed max-w-lg">
                Dapatkan kuota catatan tanpa batas (unlimited), akses fitur AI Smart Q&A (<code className="text-indigo-300">/ask</code>) langsung di Telegram, dan pemrosesan prioritas.
              </p>
            </div>
            <button
              onClick={() => setIsUpgradeModalOpen(true)}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all shrink-0 shadow-lg shadow-indigo-600/25"
            >
              Mulai Rp 49.000 / bln
            </button>
          </div>
        )}

        {/* Extend Subscription for Pro Plan */}
        {plan === 'pro' && (
          <div className="flex items-center justify-between p-4 rounded-xl border border-zinc-800 bg-zinc-950 text-xs">
            <div className="flex items-center gap-2 text-zinc-400">
              <Zap className="w-4 h-4 text-indigo-400" />
              <span>Ingin memperpanjang atau beralih ke paket tahunan?</span>
            </div>
            <button
              onClick={() => setIsUpgradeModalOpen(true)}
              className="text-indigo-400 hover:text-indigo-300 font-semibold"
            >
              Perpanjang Langganan &rarr;
            </button>
          </div>
        )}
      </div>

      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        initialCurrency={subscription?.currency === 'USD' ? 'USD' : 'IDR'}
      />

      {/* Section 3: Profile Info */}
      <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 space-y-4">
        <h2 className="text-base font-semibold text-zinc-100">Profil Akun (Google OAuth)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-zinc-400 block mb-1">Nama Lengkap</label>
            <input
              type="text"
              readOnly
              value={user.name || 'User'}
              className="w-full px-3.5 py-2 rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-300 text-xs cursor-not-allowed"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-400 block mb-1">Email Terdaftar</label>
            <input
              type="text"
              readOnly
              value={user.email}
              className="w-full px-3.5 py-2 rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-300 text-xs cursor-not-allowed"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
