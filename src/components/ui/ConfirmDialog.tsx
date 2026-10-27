import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle, Trash2, Loader2, Info } from 'lucide-react';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary';
  isLoading?: boolean;
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Konfirmasi',
  cancelLabel = 'Batal',
  variant = 'danger',
  isLoading = false,
}: ConfirmDialogProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll when dialog is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen || !mounted) return null;

  const iconBadge = (() => {
    switch (variant) {
      case 'danger':
        return (
          <div className="w-10 h-10 rounded-full bg-terminal-red/10 text-terminal-red flex items-center justify-center shrink-0">
            <Trash2 className="w-5 h-5" />
          </div>
        );
      case 'warning':
        return (
          <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
        );
      default:
        return (
          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Info className="w-5 h-5" />
          </div>
        );
    }
  })();

  const confirmBtnClasses = (() => {
    switch (variant) {
      case 'danger':
        return 'bg-terminal-red text-white hover:bg-terminal-red/90';
      case 'warning':
        return 'bg-amber-600 text-white hover:bg-amber-700';
      default:
        return 'bg-ink text-canvas hover:opacity-90';
    }
  })();

  const dialogContent = (
    <>
      {/* Full-screen Backdrop covering 100% viewport (clicking does not close modal) */}
      <div
        className="fixed inset-0 z-[9998] bg-black/75 select-none"
        style={{ top: 0, left: 0, right: 0, bottom: 0 }}
        aria-hidden="true"
      />

      {/* Modal Dialog Container */}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        <div
          role="dialog"
          aria-modal="true"
          className="relative w-full max-w-md bg-canvas rounded-2xl border border-hairline shadow-2xl p-5 sm:p-6 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header Row: Icon + Title + Close Button */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {iconBadge}
              <h3 className="text-heading-md font-semibold text-ink font-sans">
                {title}
              </h3>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="p-1.5 rounded-full text-mute hover:text-ink hover:bg-surface-soft cursor-pointer transition-colors !border-0 disabled:opacity-50"
              title="Tutup dialog"
              aria-label="Tutup dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Description */}
          <div className="mt-3">
            <p className="text-body-sm text-body leading-relaxed font-sans whitespace-pre-line">
              {description}
            </p>
          </div>

          {/* Actions Footer */}
          <div className="mt-6 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 rounded-full text-body hover:text-ink hover:bg-surface-soft font-sans text-body-sm transition-colors cursor-pointer !border-0 disabled:opacity-50"
            >
              {cancelLabel}
            </button>

            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className={`px-4.5 py-2 rounded-full font-sans text-body-sm font-medium transition-colors cursor-pointer !border-0 flex items-center gap-1.5 disabled:opacity-60 ${confirmBtnClasses}`}
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{confirmLabel}</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(dialogContent, document.body);
}
