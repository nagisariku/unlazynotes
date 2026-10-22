import { useState, useEffect } from 'react';
import { X, Shield, Zap, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button, FeatureBullet, CommandTag } from '../ui';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCurrency?: 'IDR' | 'USD';
}

const PRICING = {
  IDR: {
    monthly: { amount: 15000, label: 'Rp 15.000', periodLabel: '/bulan' },
    yearly: { amount: 150000, label: 'Rp 150.000', periodLabel: '/tahun (Hemat 17%)' },
  },
  USD: {
    monthly: { amount: 1, label: '$1', periodLabel: '/month' },
    yearly: { amount: 10, label: '$10', periodLabel: '/year (Save 17%)' },
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

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

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
    } catch {
      toast.error('Terjadi kesalahan jaringan');
      setLoading(false);
    }
  };

  return (
    <>
      {/* Full-screen Backdrop covering 100% viewport */}
      <div
        className="fixed inset-0 w-screen h-screen min-h-[100dvh] z-50 bg-black/40 backdrop-blur-xs"
        style={{ top: 0, left: 0, right: 0, bottom: 0, minHeight: '100dvh' }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Container */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
        style={{ top: 0, left: 0, right: 0, bottom: 0, minHeight: '100dvh' }}
      >
        <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg border border-hairline bg-canvas p-6 text-ink space-y-5 pointer-events-auto">
          {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-full text-body hover:text-ink hover:bg-surface-soft cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="space-y-1.5 pr-8">
          <div className="inline-flex items-center gap-1.5 mb-1">
            <CommandTag>
              <Sparkles className="w-3 h-3 inline mr-1" />
              UnlazyNotes Pro
            </CommandTag>
          </div>
          <h2 className="text-heading-lg text-ink font-semibold">Upgrade ke Paket Pro</h2>
          <p className="text-body-sm text-body">
            Tingkatkan produktivitas tanpa batas kuota harian dan nikmati asisten cerdas AI.
          </p>
        </div>

        {/* Currency & Period Toggles */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {/* Billing Cycle */}
          <div className="flex items-center p-1 rounded-full bg-surface-soft border border-hairline text-caption-sm">
            <button
              onClick={() => setPeriod('monthly')}
              className={`px-3 py-1 rounded-full font-medium cursor-pointer ${ period === 'monthly' ? 'bg-primary text-on-primary' : 'text-body hover:text-ink' }`}
            >
              Bulanan
            </button>
            <button
              onClick={() => setPeriod('yearly')}
              className={`px-3 py-1 rounded-full font-medium cursor-pointer ${ period === 'yearly' ? 'bg-primary text-on-primary' : 'text-body hover:text-ink' }`}
            >
              Tahunan (-17%)
            </button>
          </div>

          {/* Currency Toggle */}
          <div className="flex items-center p-1 rounded-full bg-surface-soft border border-hairline text-caption-sm">
            <button
              onClick={() => setCurrency('IDR')}
              className={`px-3 py-1 rounded-full font-medium cursor-pointer ${ currency === 'IDR' ? 'bg-primary text-on-primary' : 'text-body hover:text-ink' }`}
            >
              IDR (Rp)
            </button>
            <button
              onClick={() => setCurrency('USD')}
              className={`px-3 py-1 rounded-full font-medium cursor-pointer ${ currency === 'USD' ? 'bg-primary text-on-primary' : 'text-body hover:text-ink' }`}
            >
              USD ($)
            </button>
          </div>
        </div>

        {/* Price Card */}
        <div className="p-4 rounded-lg border border-hairline bg-surface-soft flex items-baseline justify-between">
          <div>
            <span className="text-display-lg text-ink">{currentPrice.label}</span>
            <span className="text-body-sm text-body ml-2">{currentPrice.periodLabel}</span>
          </div>
          <CommandTag>DOKU GATEWAY</CommandTag>
        </div>

        {/* Feature List */}
        <div className="space-y-3 text-body-sm">
          <p className="font-semibold text-ink text-caption-sm uppercase tracking-wider">Keuntungan Paket Pro:</p>
          <div className="space-y-2">
            <FeatureBullet>
              <span><strong>UNLIMITED Notes</strong> (Bebas batas 30 catatan/bulan)</span>
            </FeatureBullet>
            <FeatureBullet icon={<Shield className="w-3.5 h-3.5" />}>
              <span><strong>Private Encrypted Vault (<code className="font-mono text-ink">/secure</code>)</strong> enkripsi AES-256-GCM</span>
            </FeatureBullet>
            <FeatureBullet icon={<Zap className="w-3.5 h-3.5" />}>
              <span><strong>AI Otak Kedua (<code className="font-mono text-ink">/ask</code>)</strong> temporal RAG di Telegram</span>
            </FeatureBullet>
            <FeatureBullet>
              <span><strong>Prioritas Fast-Lane Tagging</strong> pemrosesan AI instan</span>
            </FeatureBullet>
          </div>
        </div>

        {/* Checkout Button */}
        <Button
          onClick={handleCheckout}
          disabled={loading}
          variant="primary"
          fullWidth
          className="h-10 gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4" />
              <span>Menyiapkan Invoice DOKU...</span>
            </>
          ) : (
            <>
              <span>Lanjut Pembayaran Aman</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </Button>

        {/* Footer Note */}
        <p className="text-caption-sm text-body text-center flex items-center justify-center gap-1.5">
          <Shield className="w-3 h-3 text-mute" />
          <span>Diproses melalui gateway berlisensi DOKU Payment (QRIS, VA, E-Wallet).</span>
        </p>
      </div>
    </div>
  </>
  );
}
