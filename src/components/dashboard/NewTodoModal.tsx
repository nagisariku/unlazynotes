import { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Check,
  Sparkles,
  Loader2,
  Paperclip,
  ImageIcon,
  FileText,
} from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { toast } from 'sonner';
import type { TodoItem } from './TodoView';
import type { NoteAttachment } from '@/db/schema';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

interface NewTodoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (item: TodoItem) => void;
}

export default function NewTodoModal({
  isOpen,
  onClose,
  onCreated,
}: NewTodoModalProps) {
  const [mounted, setMounted] = useState(false);
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>(['todo']);
  const [tagInput, setTagInput] = useState('');
  const [attachments, setAttachments] = useState<NoteAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-resize textarea height
  const adjustTextareaHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;

    const parent = el.parentElement;
    const parentScrollTop = parent?.scrollTop;

    el.style.height = 'auto';
    const isMobileScreen = typeof window !== 'undefined' ? window.innerWidth < 640 : false;
    const minH = isMobileScreen ? 180 : 220;
    const targetHeight = Math.max(el.scrollHeight, minH);
    el.style.height = `${targetHeight}px`;

    if (parent && parentScrollTop !== undefined) {
      parent.scrollTop = parentScrollTop;
    }
  }, []);

  useIsomorphicLayoutEffect(() => {
    if (isOpen) {
      adjustTextareaHeight();
    }
  }, [isOpen, adjustTextareaHeight]);

  useEffect(() => {
    if (!isOpen) return;
    const handleResize = () => adjustTextareaHeight();
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, adjustTextareaHeight]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        adjustTextareaHeight();
        textareaRef.current?.focus();
      }, 50);
    } else {
      setContent('');
      setTags(['todo']);
      setTagInput('');
      setAttachments([]);
      setIsUploading(false);
      setIsSubmitting(false);
      setIsEnhancing(false);
    }
  }, [isOpen, adjustTextareaHeight]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting && !isEnhancing) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, isEnhancing, onClose]);

  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      const originalUserSelect = document.body.style.userSelect;
      document.body.style.overflow = 'hidden';
      document.body.style.userSelect = 'none';
      return () => {
        document.body.style.overflow = originalOverflow;
        document.body.style.userSelect = originalUserSelect;
      };
    }
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  const formattedDate = (() => {
    try {
      const d = new Date();
      return format(d, 'EEEE, d MMMM yyyy • HH:mm', { locale: localeId }) + ' WIB';
    } catch {
      return 'Tugas Baru';
    }
  })();

  const handleAddTag = () => {
    const clean = tagInput
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .slice(0, 20);

    if (!clean) return;
    if (!tags.includes(clean)) {
      setTags((prev) => [...prev, clean]);
    }
    setTagInput('');
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags((prev) => prev.filter((t) => t !== tagToRemove));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.attachment) {
        setAttachments((prev) => [...prev, data.attachment]);
        toast.success(`File ${file.name} berhasil diunggah`);
      } else {
        toast.error(data.error || 'Gagal mengunggah file');
      }
    } catch {
      toast.error('Gagal terhubung ke server upload');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // AI Polish / Enhance task text
  const handleEnhance = async () => {
    const text = content.trim();
    if (!text || isEnhancing) {
      if (!text) toast.info('Ketik draft tugas terlebih dahulu');
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
        if (Array.isArray(data.tags) && data.tags.length > 0) {
          setTags((prev) => Array.from(new Set([...prev, ...data.tags])));
        }
        toast.success('Teks tugas diperjelas oleh AI');
        setTimeout(() => {
          adjustTextareaHeight();
          textareaRef.current?.focus();
        }, 50);
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
    const contentToSave = !/^\[[ xX]\]/.test(text) ? `[ ] ${text}` : text;
    const tempId = `temp-todo-${Date.now()}`;
    const now = new Date();

    const optimisticItem: TodoItem = {
      id: tempId,
      content: contentToSave,
      category: 'todo',
      specificTags: tags,
      source: 'web',
      isPinned: false,
      isProcessed: false,
      attachments: attachments.length > 0 ? attachments : undefined,
      createdAt: now.toISOString(),
    };

    onCreated(optimisticItem);
    onClose();

    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: contentToSave,
          category: 'todo',
          specificTags: tags,
          attachments: attachments.length > 0 ? attachments : undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.note) {
        toast.success('Tugas baru berhasil disimpan!');
      } else {
        toast.error(data.error || 'Gagal menyimpan tugas');
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

  return createPortal(
    <>
      {/* Full-screen Backdrop covering 100% viewport */}
      <div
        className="fixed inset-0 z-[9998] bg-black/75 backdrop-blur-sm select-none"
        style={{ top: 0, left: 0, right: 0, bottom: 0 }}
        aria-hidden="true"
      />

      {/* Modal Dialog Container */}
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 pointer-events-none select-none"
        style={{ top: 0, left: 0, right: 0, bottom: 0 }}
      >
        <div className="w-full max-w-2xl sm:max-w-3xl max-h-[92vh] sm:max-h-[88vh] rounded-2xl bg-canvas text-ink pointer-events-auto shadow-2xl flex flex-col overflow-hidden relative">
          {/* Header bar */}
          <div className="flex items-center justify-between px-6 pt-5 pb-2 shrink-0 select-none">
            <span className="text-caption-sm font-semibold text-body uppercase tracking-wider font-mono">
              Tugas Baru
            </span>

            <div className="flex items-center gap-2">
              {/* On Mobile: Enhance AI */}
              <button
                type="button"
                onClick={handleEnhance}
                disabled={isEnhancing || !content.trim()}
                className={`sm:hidden w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-colors ${
                  content.trim() && !isEnhancing
                    ? 'bg-surface-soft text-ink hover:bg-canvas'
                    : 'opacity-40 text-mute cursor-not-allowed'
                }`}
                title="AI enhance task"
                aria-label="AI enhance task"
              >
                {isEnhancing ? (
                  <Loader2 className="w-3.5 h-3.5 text-ink animate-spin" />
                ) : (
                  <div className="rotate-45 p-0.5 flex items-center justify-center">
                    <Sparkles className="w-3.5 h-3.5 -rotate-45" />
                  </div>
                )}
              </button>

              {/* On Mobile: Simpan button */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || !content.trim()}
                className={`sm:hidden h-8 px-3.5 rounded-full flex items-center justify-center gap-1 text-caption-xs font-semibold cursor-pointer transition-all ${
                  content.trim() && !isSubmitting
                    ? 'bg-primary text-on-primary hover:opacity-90 active:scale-95'
                    : 'bg-surface-soft text-mute cursor-not-allowed opacity-60'
                }`}
                title="Simpan Tugas"
                aria-label="Simpan tugas"
              >
                {isSubmitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Simpan</span>
                  </>
                )}
              </button>

              {/* Close Button: X */}
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-body hover:text-ink hover:bg-surface-soft cursor-pointer transition-colors"
                title="Tutup (Esc)"
                aria-label="Tutup modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal Body / Content */}
          <div className="flex-1 flex flex-col justify-between overflow-y-auto overflow-x-hidden px-6 pt-3 pb-8 space-y-6 overscroll-contain">
            <div className="space-y-6">
              {/* Textarea */}
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  const el = e.target;
                  el.style.height = 'auto';
                  const isMobile = window.innerWidth < 640;
                  const minH = isMobile ? 180 : 220;
                  el.style.height = `${Math.max(el.scrollHeight, minH)}px`;
                }}
                onKeyDown={handleKeyDown}
                placeholder="Tulis tugas baru... (misal: Follow-up penawaran klien, riset tren Q4)"
                className="w-full bg-transparent text-ink placeholder:text-mute text-body-md leading-relaxed resize-none focus:outline-none font-sans select-text min-h-[180px] sm:min-h-[220px] p-0 border-0 overflow-hidden block"
              />

              {/* Attachments if any */}
              {attachments && attachments.length > 0 && (
                <div className="pt-2 space-y-2 select-none">
                  <div className="flex flex-wrap gap-2">
                    {attachments.map((att: any, i: number) => (
                      <div
                        key={att.fileId || i}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-soft text-caption-sm text-ink max-w-full group"
                      >
                        {att.type === 'image' ? (
                          <ImageIcon className="w-4 h-4 text-mute shrink-0" />
                        ) : (
                          <FileText className="w-4 h-4 text-mute shrink-0" />
                        )}
                        <span className="truncate max-w-[180px] sm:max-w-xs font-mono">
                          {att.fileName || `Attachment-${i + 1}`}
                        </span>
                        <button
                          type="button"
                          onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                          className="text-mute hover:text-terminal-red cursor-pointer ml-1 p-0.5 rounded hover:bg-surface-soft/80"
                          title="Hapus lampiran"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Section */}
            <div>
              <div className="pt-6 pb-2 flex flex-wrap items-center justify-between gap-3 select-none">
                {/* Left grouping */}
                <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
                  {/* Category Pill */}
                  <span className="px-3.5 py-1.5 rounded-full bg-surface-soft text-ink text-xs sm:text-[13px] font-sans font-normal">
                    todo
                  </span>

                  {/* Attachment Button */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileChange}
                    className="hidden"
                    accept="image/*,.pdf,.doc,.docx,.txt"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="p-2 rounded-full text-mute hover:text-ink hover:bg-surface-soft cursor-pointer transition-colors disabled:opacity-50"
                    title="Unggah lampiran"
                  >
                    {isUploading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-mute" />
                    ) : (
                      <Paperclip className="w-4 h-4" />
                    )}
                  </button>

                  {/* Existing Tags Chips */}
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-surface-soft text-body hover:text-ink text-xs sm:text-[13px] font-sans font-normal transition-colors"
                    >
                      <span>#{tag}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="text-mute hover:text-terminal-red cursor-pointer ml-0.5"
                        title={`Hapus tag #${tag}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}

                  {/* Input inline to add new tag */}
                  <div className="inline-flex items-center">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={handleTagInputKeyDown}
                      placeholder="+ tag baru..."
                      className="px-3.5 py-1.5 rounded-full bg-surface-soft/60 hover:bg-surface-soft focus:bg-surface-soft text-xs sm:text-[13px] text-ink placeholder:text-mute font-sans focus:outline-none w-28 sm:w-32 transition-all font-normal"
                    />
                    {tagInput.trim() && (
                      <button
                        type="button"
                        onClick={handleAddTag}
                        className="ml-1 p-1 rounded-full text-mute hover:text-ink cursor-pointer text-xs"
                        title="Tambah tag"
                      >
                        +
                      </button>
                    )}
                  </div>
                </div>

                {/* Right grouping (Desktop only) */}
                <div className="hidden sm:flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleEnhance}
                    disabled={isEnhancing || !content.trim()}
                    className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center cursor-pointer transition-colors ${
                      content.trim() && !isEnhancing
                        ? 'bg-surface-soft text-ink hover:bg-canvas'
                        : 'opacity-40 text-mute cursor-not-allowed'
                    }`}
                    title="AI enhance task"
                    aria-label="AI enhance task"
                  >
                    {isEnhancing ? (
                      <Loader2 className="w-4 h-4 text-ink animate-spin" />
                    ) : (
                      <div className="rotate-45 p-0.5 flex items-center justify-center">
                        <Sparkles className="w-4 h-4 -rotate-45" />
                      </div>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting || !content.trim()}
                    className={`h-9 sm:h-10 px-4 sm:px-5 rounded-full flex items-center justify-center gap-1.5 text-caption-sm font-semibold cursor-pointer transition-all ${
                      content.trim() && !isSubmitting
                        ? 'bg-primary text-on-primary hover:opacity-90 active:scale-95'
                        : 'bg-surface-soft text-mute cursor-not-allowed opacity-60'
                    }`}
                    title="Simpan Tugas (Ctrl+Enter)"
                    aria-label="Simpan tugas"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Menyimpan...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Simpan</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Date & Time at the very bottom */}
              <div className="pt-3 pb-1 text-caption-xs text-mute font-mono select-none">
                <span>{formattedDate}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
