import { useState } from 'react';
import { X, Check, Sparkles, Shield, Zap, ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCurrency?: 'IDR' | 'USD';
}

const PRICING = {
  IDR: {
    monthly: { amount: 49000, label: 'Rp 49.000', periodLabel: '/bulan' },
    yearly: { amount: 490000, label: 'Rp 490.000', periodLabel: '/tahun (Hemat 17%)' },
  },
  USD: {
    monthly: { amount: 3, label: '$3', periodLabel: '/month' },
    yearly: { amount: 30, label: '$30', periodLabel: '/year (Save 17%)' },
  },
};

export default function UpgradeModal({
  isOpen,
  onClose,
  initialCurrency = 'IDR',
}: UpgradeModalProps) {
  const [currency, setCurrency] = useState<'IDR' | 'USD'>(initialCurrency);
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const currentPrice = PRICING[currency][period];

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/payment/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: 'pro',
          period,
          currency,
        }),
      });

      const data = await res.json();
      if (res.ok && data.paymentUrl) {
        toast.info('Mengalihkan ke gateway pembayaran...');
        window.location.href = data.paymentUrl;
      } else {
        toast.error(data.error || 'Gagal memulai proses pembayaran');
        setLoading(false);
      }
    } catch (err) {
      toast.error('Terjadi kesalahan jaringan');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-lg rounded-3xl border border-zinc-800 bg-zinc-950 p-6 sm:p-8 shadow-2xl text-zinc-100 space-y-6">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="space-y-1.5 pr-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Sparkles className="w-3.5 h-3.5" />
            <span>UnlazyNotes Pro</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight">Upgrade ke Paket Pro</h2>
          <p className="text-xs text-zinc-400">
            Tingkatkan produktivitas tanpa batas kuota harian dan nikmati asisten cerdas AI.
          </p>
        </div>

        {/* Currency & Period Toggles */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {/* Billing Cycle */}
          <div className="flex items-center p-1 rounded-xl bg-zinc-900 border border-zinc-800 text-xs">
            <button
              onClick={() => setPeriod('monthly')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                period === 'monthly'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Bulanan
            </button>
            <button
              onClick={() => setPeriod('yearly')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                period === 'yearly'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Tahunan (-17%)
            </button>
          </div>

          {/* Currency Toggle */}
          <div className="flex items-center p-1 rounded-xl bg-zinc-900 border border-zinc-800 text-xs">
            <button
              onClick={() => setCurrency('IDR')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                currency === 'IDR'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              IDR (Rp)
            </button>
            <button
              onClick={() => setCurrency('USD')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                currency === 'USD'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              USD ($)
            </button>
          </div>
        </div>

        {/* Price Card */}
        <div className="p-4 rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-950/30 to-zinc-900/60 flex items-baseline justify-between">
          <div>
            <span className="text-3xl font-extrabold text-zinc-100">{currentPrice.label}</span>
            <span className="text-xs text-zinc-400 ml-1.5">{currentPrice.periodLabel}</span>
          </div>
          <span className="text-[11px] text-indigo-400 font-semibold uppercase tracking-wider">
            DOKU Payment Gateway
          </span>
        </div>

        {/* Feature List */}
        <div className="space-y-2.5 text-xs text-zinc-300">
          <p className="font-semibold text-zinc-200">Keuntungan Paket Pro:</p>
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <Check className="w-3 h-3" />
              </div>
              <span><strong>Unlimited Catatan Harian</strong> (Bebas dari limit 25 catatan/hari)</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-5 h-5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                <Zap className="w-3 h-3" />
              </div>
              <span><strong>AI Smart Q&A (<code className="text-indigo-300">/ask</code>)</strong> di Telegram bot</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <Check className="w-3 h-3" />
              </div>
              <span>Prioritas AI categorization &amp; auto-tagging kecepatan tinggi</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <Check className="w-3 h-3" />
              </div>
              <span>Export Bookmarks Netscape HTML &amp; Search tanpa batas</span>
            </div>
          </div>
        </div>

        {/* Checkout Button */}
        <button
          onClick={handleCheckout}
          disabled={loading}
          className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-sm transition-all shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Menyiapkan Invoice DOKU...</span>
            </>
          ) : (
            <>
              <span>Lanjut Pembayaran Aman</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

        {/* Footer Note */}
        <p className="text-[11px] text-zinc-500 text-center flex items-center justify-center gap-1.5">
          <Shield className="w-3 h-3 text-zinc-400" />
          <span>Diproses melalui gateway berlisensi DOKU Payment (QRIS, VA, E-Wallet).</span>
        </p>
      </div>
    </div>
  );
}
