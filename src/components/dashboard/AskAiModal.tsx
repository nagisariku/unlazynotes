import { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Sparkles,
  Send,
  RotateCcw,
} from 'lucide-react';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export interface AskAiModalProps {
  isOpen: boolean;
  onClose: () => void;
  category?: string; // 'workspace' | 'schedule' | 'todo' | 'finance' | 'bookmark' | 'credential'
  placeholder?: string;
  contextTitle?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  workspace: 'Semua Catatan',
  schedule: 'Jadwal & Agenda',
  todo: 'Tugas & ToDo',
  finance: 'Keuangan & Arus Kas',
  bookmark: 'Bookmark & Tautan',
  credential: 'Vault & Kredensial',
};

const DEFAULT_PLACEHOLDERS: Record<string, string> = {
  workspace: 'Tanyakan apa saja tentang catatan Anda...',
  schedule: 'Tanya jadwal, agenda rapat, atau waktu kegiatan Anda...',
  todo: 'Tanya tugas, rencana aksi, atau checklist harian Anda...',
  finance: 'Tanya riwayat pengeluaran, pemasukan, atau utang...',
  bookmark: 'Tanya tautan penting, artikel bacaan, atau repositori...',
  credential: 'Tanya akun login, Wi-Fi, atau kredensial tersimpan...',
};

export default function AskAiModal({
  isOpen,
  onClose,
  category = 'workspace',
  placeholder,
  contextTitle,
}: AskAiModalProps) {
  const [mounted, setMounted] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const displayCategoryLabel = contextTitle || CATEGORY_LABELS[category] || 'Catatan';
  const displayPlaceholder = placeholder || DEFAULT_PLACEHOLDERS[category] || 'Tanyakan apa saja ke AI...';

  // Auto-focus and auto-resize textarea
  const adjustTextareaHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const minH = 38;
    const maxH = 140;
    el.style.height = `${Math.min(Math.max(el.scrollHeight, minH), maxH)}px`;
  }, []);

  // Auto-scroll chat to bottom
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior,
      });
    }
  }, []);

  useIsomorphicLayoutEffect(() => {
    if (isOpen) {
      adjustTextareaHeight();
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
        scrollToBottom('auto');
      }, 50);
      return () => clearTimeout(timer);
    } else {
      // Reset state when modal is closed
      setMessages([]);
      setPrompt('');
      setError(null);
      setIsLoading(false);
    }
  }, [isOpen, adjustTextareaHeight, scrollToBottom]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    const trimmed = prompt.trim();
    if (!trimmed || isLoading) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
    };

    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setPrompt('');
    setIsLoading(true);
    setError(null);

    // Reset textarea height after sending
    setTimeout(() => {
      adjustTextareaHeight();
      scrollToBottom('smooth');
    }, 50);

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: trimmed,
          category: category !== 'workspace' ? category : undefined,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await res.json();
      if (res.ok && data.answer) {
        const assistantMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.answer,
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setTimeout(() => {
          scrollToBottom('smooth');
          textareaRef.current?.focus();
        }, 100);
      } else {
        setError(data.error || 'Gagal memproses pertanyaan ke AI');
      }
    } catch {
      setError('Terjadi kendala jaringan saat menghubungi server');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleReset = () => {
    setMessages([]);
    setPrompt('');
    setError(null);
    setTimeout(() => {
      textareaRef.current?.focus();
      adjustTextareaHeight();
    }, 50);
  };

  if (!isOpen || !mounted) return null;

  return createPortal(
    <>
      {/* Full-screen Backdrop */}
      <div
        className="fixed inset-0 z-[9998] bg-black/75 select-none"
        style={{ top: 0, left: 0, right: 0, bottom: 0 }}
        onClick={!isLoading ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Modal Dialog Container */}
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center px-4 py-8 sm:py-8 sm:px-6 pointer-events-none select-none"
        style={{ top: 0, left: 0, right: 0, bottom: 0, height: '100dvh' }}
      >
        <div className="w-full max-w-2xl sm:max-w-3xl h-[min(640px,85dvh)] flex flex-col rounded-2xl bg-canvas text-ink pointer-events-auto overflow-hidden my-auto shadow-2xl relative !border-0">
          {/* Top Bar / Header: Clean, borderless, zero dividers */}
          <div className="flex items-center justify-between px-6 pt-5 pb-3 bg-canvas shrink-0 select-none !border-0">
            <div className="flex items-center gap-2.5 min-w-0 mr-2">
              <div className="w-7 h-7 rounded-full bg-surface-soft flex items-center justify-center text-ink shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-body-md font-semibold text-ink tracking-tight font-sans">
                  Ask AI
                </span>
                <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-surface-soft text-body">
                  {displayCategoryLabel}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={isLoading}
                  className="h-8 px-3 rounded-full text-caption-sm font-medium bg-surface-soft hover:bg-hairline/60 text-ink transition-colors cursor-pointer inline-flex items-center gap-1.5 !border-0 select-none"
                  title="Mulai sesi tanya baru"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span className="hidden sm:inline">Sesi Baru</span>
                </button>
              )}

              {/* Close Button: X (no border) */}
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-body hover:text-ink hover:bg-surface-soft cursor-pointer transition-colors !border-0"
                title="Tutup (Esc)"
                aria-label="Tutup modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal Body / Scrollable Conversation Thread */}
          <div
            ref={chatScrollRef}
            className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden px-6 py-4 space-y-5 overscroll-contain select-text"
          >
            {messages.length === 0 && !isLoading && (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-8 select-none">
                <div className="w-12 h-12 rounded-2xl bg-surface-soft flex items-center justify-center text-ink mb-3 shadow-xs">
                  <Sparkles className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-body-md font-semibold text-ink font-sans mb-1">
                  Ada yang bisa dibantu tentang catatan Anda?
                </h3>
                <p className="text-body-sm text-body max-w-sm font-sans leading-relaxed">
                  Tanyakan agenda, to-do, pengeluaran, nomor penting, atau cari inspirasi dari seluruh catatan {displayCategoryLabel.toLowerCase()} Anda.
                </p>
              </div>
            )}

            {/* Chat Thread Messages */}
            {messages.map((m) =>
              m.role === 'user' ? (
                <div key={m.id} className="flex justify-end select-text animate-in fade-in duration-150">
                  <div className="max-w-[85%] sm:max-w-[80%] bg-surface-soft rounded-2xl px-4 py-2.5 text-body-md text-ink font-sans leading-relaxed">
                    {m.content}
                  </div>
                </div>
              ) : (
                <div key={m.id} className="space-y-2 select-text animate-in fade-in duration-200">
                  <div className="flex items-center gap-2 select-none">
                    <Sparkles className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-body-sm font-semibold text-ink font-sans">
                      Jawaban AI
                    </span>
                  </div>
                  <div className="text-body-md text-ink leading-relaxed font-sans whitespace-pre-wrap pl-6">
                    {m.content}
                  </div>
                </div>
              )
            )}

            {/* State: Thinking with Animated Sweeping Shimmer Beam */}
            {isLoading && (
              <div className="space-y-3.5 select-none animate-in fade-in duration-200 pt-1">
                <style>{`
                  @keyframes unlazy-shimmer-sweep {
                    0% {
                      transform: translateX(-100%);
                    }
                    100% {
                      transform: translateX(100%);
                    }
                  }
                  .shimmer-track {
                    background-color: #e5e5e5;
                    position: relative;
                    overflow: hidden;
                  }
                  .shimmer-beam {
                    position: absolute;
                    inset: 0;
                    transform: translateX(-100%);
                    background: linear-gradient(
                      90deg,
                      rgba(255, 255, 255, 0) 0%,
                      rgba(255, 255, 255, 0.9) 50%,
                      rgba(255, 255, 255, 0) 100%
                    );
                    animation: unlazy-shimmer-sweep 1.4s infinite cubic-bezier(0.4, 0, 0.2, 1);
                  }
                  .shimmer-beam-d1 { animation-delay: 0s; }
                  .shimmer-beam-d2 { animation-delay: 0.15s; }
                  .shimmer-beam-d3 { animation-delay: 0.3s; }
                  .shimmer-beam-d4 { animation-delay: 0.45s; }
                `}</style>

                <div className="flex items-center gap-2 text-ink">
                  <Sparkles className="w-4 h-4 text-ink animate-spin shrink-0" />
                  <span className="text-body-sm font-semibold tracking-tight text-ink animate-pulse font-sans">
                    Thinking... AI sedang menelusuri catatan Anda
                  </span>
                </div>

                {/* Animated Shimmer Skeleton bars with sweeping light beam */}
                <div className="space-y-2.5 pt-1 pl-6">
                  <div className="h-3.5 rounded-md shimmer-track w-3/4">
                    <div className="shimmer-beam shimmer-beam-d1" />
                  </div>
                  <div className="h-3.5 rounded-md shimmer-track w-full">
                    <div className="shimmer-beam shimmer-beam-d2" />
                  </div>
                  <div className="h-3.5 rounded-md shimmer-track w-5/6">
                    <div className="shimmer-beam shimmer-beam-d3" />
                  </div>
                  <div className="h-3.5 rounded-md shimmer-track w-1/2">
                    <div className="shimmer-beam shimmer-beam-d4" />
                  </div>
                </div>
              </div>
            )}

            {/* State: Error */}
            {!isLoading && error && (
              <div className="space-y-2 select-text text-terminal-red text-body-sm font-medium pl-6">
                <p>{error}</p>
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="text-caption-sm text-ink underline font-medium hover:opacity-80 cursor-pointer !border-0 bg-transparent p-0"
                >
                  Coba lagi
                </button>
              </div>
            )}
          </div>

          {/* Bottom Fixed Composer Row: Seamless, Borderless Input Box */}
          <div className="px-6 pb-5 pt-2 bg-canvas shrink-0 select-none !border-0">
            <div className="relative flex items-end gap-2 bg-surface-soft rounded-2xl p-2 pl-4 focus-within:ring-1 focus-within:ring-hairline transition-all">
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value);
                  adjustTextareaHeight();
                }}
                onKeyDown={handleKeyDown}
                placeholder={messages.length > 0 ? 'Tanyakan hal lanjutan...' : displayPlaceholder}
                disabled={isLoading}
                rows={1}
                className="flex-1 bg-transparent text-ink placeholder:text-mute text-body-md leading-relaxed resize-none focus:outline-none font-sans select-text min-h-[38px] max-h-[120px] p-0 !border-0 overflow-y-auto block"
              />

              <button
                type="button"
                onClick={handleSubmit}
                disabled={!prompt.trim() || isLoading}
                className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 cursor-pointer transition-all !border-0 ${
                  prompt.trim() && !isLoading
                    ? 'bg-primary text-on-primary hover:bg-ink-deep active:scale-95'
                    : 'bg-surface-soft text-mute cursor-not-allowed opacity-60'
                }`}
                title="Kirim (Enter)"
                aria-label="Kirim ke AI"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
