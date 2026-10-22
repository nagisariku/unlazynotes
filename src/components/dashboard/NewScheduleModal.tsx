import { useState, useEffect, useRef } from 'react';
import { X, Sparkles, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { ScheduleItem } from './ScheduleView';

interface NewScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (item: ScheduleItem) => void;
  selectedDate?: Date | null;
}

export default function NewScheduleModal({
  isOpen,
  onClose,
  onCreated,
  selectedDate,
}: NewScheduleModalProps) {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    } else {
      setContent('');
      setIsSubmitting(false);
      setIsEnhancing(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting && !isEnhancing) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, isEnhancing, onClose]);

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

  // AI Polish schedule
  const handleEnhance = async () => {
    const text = content.trim();
    if (!text || isEnhancing) {
      if (!text) toast.info('Ketik agenda jadwal terlebih dahulu');
      return;
    }

    setIsEnhancing(true);
    try {
      const res = await fetch('/api/notes/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      const data = await res.json();
      if (res.ok && data.enhancedText) {
        setContent(data.enhancedText);
        toast.success('Agenda jadwal dirapikan oleh AI ✨');
        textareaRef.current?.focus();
      } else {
        toast.error(data.error || 'Gagal merapikan teks');
      }
    } catch {
      toast.error('Gagal terhubung ke AI service');
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleSubmit = async () => {
    const text = content.trim();
    if (!text || isSubmitting) return;

    setIsSubmitting(true);
    const tempId = `temp-sch-${Date.now()}`;
    const now = selectedDate || new Date();

    const optimisticItem: ScheduleItem = {
      id: tempId,
      content: text,
      category: 'schedule',
      specificTags: ['schedule'],
      source: 'web',
      isPinned: false,
      createdAt: now.toISOString(),
    };

    onCreated(optimisticItem);
    onClose();

    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: text,
          category: 'schedule',
          specificTags: ['schedule'],
        }),
      });

      const data = await res.json();
      if (res.ok && data.note) {
        toast.success('Jadwal baru berhasil disimpan!');
      } else {
        toast.error(data.error || 'Gagal menyimpan jadwal');
      }
    } catch {
      toast.error('Terjadi kesalahan jaringan');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <>
      {/* Full-screen Backdrop covering 100% viewport */}
      <div
        className="fixed inset-0 w-screen h-screen min-h-[100dvh] z-50 bg-black/40 backdrop-blur-xs select-none"
        style={{ top: 0, left: 0, right: 0, bottom: 0, minHeight: '100dvh' }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Centered Popup Box matching QuickComposerModal */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none select-none"
        style={{ top: 0, left: 0, right: 0, bottom: 0, minHeight: '100dvh' }}
      >
        <div className="w-full max-w-2xl sm:max-w-3xl rounded-2xl border border-hairline bg-canvas p-5 sm:p-7 text-ink pointer-events-auto overflow-hidden relative shadow-xl">
          {/* Top subtle header & close button */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-caption-sm font-semibold text-body uppercase tracking-wider font-mono">
              Jadwal Baru
            </span>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-body hover:text-ink hover:bg-surface-soft cursor-pointer transition-colors"
              title="Tutup (Esc)"
              aria-label="Tutup popup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tulis agenda rapat, janji temu, atau deadline penting..."
            rows={6}
            className="w-full bg-transparent text-ink placeholder:text-mute text-body-md resize-none focus:outline-none leading-relaxed p-1 min-h-[160px] sm:min-h-[200px]"
          />

          {/* Bottom Bar: AI enhance + Send button on right (No horizontal line / divider) */}
          <div className="flex items-center justify-end pt-2 mt-3">
            <div className="flex items-center gap-2">
              {/* AI Enhance Text Button */}
              <button
                type="button"
                onClick={handleEnhance}
                disabled={isEnhancing || !content.trim()}
                className={`w-9 h-9 rounded-full border border-hairline flex items-center justify-center cursor-pointer ${
                  content.trim() ? 'bg-surface-soft text-ink hover:bg-canvas' : 'opacity-40 text-mute cursor-not-allowed'
                }`}
                title="AI enhance schedule"
                aria-label="AI enhance schedule"
              >
                {isEnhancing ? (
                  <Loader2 className="w-4 h-4 text-ink animate-spin" />
                ) : (
                  <div className="rotate-45 p-0.5 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 -rotate-45" />
                  </div>
                )}
              </button>

              {/* Send Button */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || !content.trim()}
                className={`h-9 px-5 rounded-full flex items-center justify-center gap-1.5 text-caption-sm font-semibold cursor-pointer ${
                  content.trim() && !isSubmitting
                    ? 'bg-primary text-on-primary hover:opacity-90'
                    : 'bg-surface-soft text-mute border border-hairline cursor-not-allowed opacity-60'
                }`}
                title="Send Schedule"
                aria-label="Send button"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Send</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
