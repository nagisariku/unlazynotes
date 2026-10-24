import { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Check,
  Sparkles,
  Loader2,
  ChevronDown,
  KeyRound,
  Calendar as CalendarIcon,
  Paperclip,
  ImageIcon,
  FileText,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { toast } from 'sonner';
import { Calendar } from '../ui/Calendar';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

interface EditNoteModalProps {
  note: {
    id: string;
    content: string;
    category: string;
    specificTags?: string[] | null;
    vaultKey?: string | null;
    createdAt?: string | Date;
    attachments?: any;
    scheduleDates?: string[] | null;
    targetDate?: string | Date | null;
  } | null;
  isOpen: boolean;
  isVault?: boolean;
  onClose: () => void;
  onCancel?: () => void;
  onSave: (updatedNote: any) => void;
}

const ALL_CATEGORIES = [
  'others',
  'todo',
  'schedule',
  'finance',
  'draft',
  'bookmark',
  'credential',
  'reference',
  'random-yap',
  'secure',
] as const;

export default function EditNoteModal({
  note,
  isOpen,
  isVault,
  onClose,
  onSave,
}: EditNoteModalProps) {
  const [mounted, setMounted] = useState(false);
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<string>('others');
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [vaultKey, setVaultKey] = useState('');
  const [scheduleDates, setScheduleDates] = useState<string[]>([]);
  const [isRecurring, setIsRecurring] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => new Date());
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [attachments, setAttachments] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const keyInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-resize textarea height to exactly match its content (expanding or shrinking dynamically)
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
    if (isOpen && note) {
      adjustTextareaHeight();
    }
  }, [isOpen, note, adjustTextareaHeight]);

  useEffect(() => {
    if (!isOpen) return;
    const handleResize = () => adjustTextareaHeight();
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, adjustTextareaHeight]);

  useEffect(() => {
    if (note && isOpen) {
      setContent(note.content || '');
      setCategory(note.category || 'others');
      setVaultKey(note.vaultKey || '');
      setIsCategoryOpen(false);
      setTags(note.specificTags || []);
      setAttachments(note.attachments || []);
      let parsedScheduleDates = Array.isArray((note as any).scheduleDates)
        ? (note as any).scheduleDates.filter((d: any) => typeof d === 'string')
        : [];
      if (parsedScheduleDates.length === 0 && (note as any).schedule?.dates) {
        parsedScheduleDates = (note as any).schedule.dates;
      }
      if (parsedScheduleDates.length === 0 && (note as any).targetDate) {
        const td = typeof (note as any).targetDate === 'string'
          ? (note as any).targetDate.split('T')[0]
          : (note as any).targetDate instanceof Date
          ? (note as any).targetDate.toISOString().split('T')[0]
          : '';
        if (td) parsedScheduleDates = [td];
      }
      setScheduleDates(parsedScheduleDates);
      setIsRecurring(Boolean((note as any)?.schedule?.isRecurring));
      setIsDatePickerOpen(false);
      setTagInput('');
      setIsUploading(false);
      setIsSaving(false);
      setIsEnhancing(false);
      requestAnimationFrame(() => {
        adjustTextareaHeight();
        textareaRef.current?.focus();
      });
    }
  }, [note, isOpen]);

  // When datepicker opens, sync calendarMonth to first schedule date if available
  useEffect(() => {
    if (isDatePickerOpen) {
      if (scheduleDates.length > 0) {
        try {
          const first = parseISO(scheduleDates[0]);
          if (!isNaN(first.getTime())) {
            setCalendarMonth(first);
            return;
          }
        } catch {}
      }
      setCalendarMonth(new Date());
    }
  }, [isDatePickerOpen]);

  // Handle Escape key to close dropdown or modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSaving && !isEnhancing) {
        if (isDatePickerOpen) {
          setIsDatePickerOpen(false);
          return;
        }
        if (isCategoryOpen) {
          setIsCategoryOpen(false);
          return;
        }
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSaving, isEnhancing, isCategoryOpen, isDatePickerOpen, onClose]);

  // Handle click outside category dropdown
  useEffect(() => {
    if (!isCategoryOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        categoryDropdownRef.current &&
        !categoryDropdownRef.current.contains(e.target as Node)
      ) {
        setIsCategoryOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isCategoryOpen]);

  // Lock body scroll and selection when modal is open
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

  if (!isOpen || !note || !mounted) return null;

  const formattedDate = (() => {
    if (!note.createdAt) return 'Catatan';
    try {
      const d = new Date(note.createdAt);
      return format(d, 'EEEE, d MMMM yyyy • HH:mm', { locale: localeId }) + ' WIB';
    } catch {
      return String(note.createdAt);
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

  const isVaultNote =
    Boolean(isVault) ||
    category === 'secure' ||
    Boolean(note?.vaultKey) ||
    note?.category === 'vault' ||
    (Array.isArray(note?.specificTags) &&
      note.specificTags.some((t: string) => t.toLowerCase() === 'vault'));

  // File Upload
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

  // AI Enhance Text Handler
  const handleEnhanceText = async () => {
    if (category === 'secure' || isVaultNote) return;
    const text = content.trim();
    if (!text || isEnhancing) {
      if (!text) toast.info('Tuliskan draf teks catatan terlebih dahulu');
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
        if (data.category && (!category || category === 'others')) {
          setCategory(data.category);
        }
        if (Array.isArray(data.tags) && data.tags.length > 0) {
          setTags((prev) => Array.from(new Set([...prev, ...data.tags])));
        }
        if (data.category === 'schedule' && Array.isArray(data.scheduleDates) && data.scheduleDates.length > 0) {
          setScheduleDates(data.scheduleDates);
          if (data.schedule?.isRecurring) {
            setIsRecurring(true);
          }
        }
        toast.success('Teks & kategori berhasil dirapikan AI');
        requestAnimationFrame(() => {
          adjustTextareaHeight();
          textareaRef.current?.focus();
        });
      } else {
        toast.error(data.error || 'Gagal merapikan teks');
      }
    } catch {
      toast.error('Gagal terhubung ke AI service');
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleSave = async () => {
    if (!content.trim() || isSaving) {
      if (!content.trim()) toast.error('Konten catatan tidak boleh kosong');
      return;
    }

    setIsSaving(true);
    try {
      const isSecure = category === 'secure';
      const payload: Record<string, any> = {
        content: content.trim(),
        category: isSecure ? 'credential' : category,
        specificTags: isVaultNote ? (tags.length ? tags : ['vault']) : tags,
        attachments,
        vaultKey: isVaultNote || isSecure ? vaultKey.trim() || null : undefined,
      };

      if (category === 'schedule' || scheduleDates.length > 0) {
        payload.schedule = {
          dates: scheduleDates,
          isRecurring,
          recurrenceRule: (note as any)?.schedule?.recurrenceRule || (isRecurring ? { frequency: 'weekly' } : undefined),
        };
        payload.scheduleDates = scheduleDates;
        if (scheduleDates.length > 0) {
          payload.targetDate = scheduleDates[0];
        }
      }

      const res = await fetch(`/api/notes/${note.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success || !data.note) {
        toast.error(data.error || 'Gagal menyimpan perubahan');
        return;
      }

      onSave(data.note);
      toast.success('Catatan berhasil diperbarui');
      onClose();
    } catch {
      toast.error('Terjadi kesalahan jaringan');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
  };

  return createPortal(
    <>
      {/* Full-screen Backdrop covering 100% viewport - overlay click does NOT close modal */}
      <div
        className="fixed inset-0 z-[9998] bg-black/75 backdrop-blur-sm select-none"
        style={{ top: 0, left: 0, right: 0, bottom: 0 }}
        aria-hidden="true"
      />

      {/* Modal Dialog Container: Geometry matching QuickComposerModal */}
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center px-4 py-8 sm:py-8 sm:px-6 pointer-events-none select-none"
        style={{ top: 0, left: 0, right: 0, bottom: 0, height: '100dvh' }}
      >
        <div className="w-full max-w-3xl sm:max-w-4xl min-h-[min(380px,80dvh)] sm:min-h-[440px] max-h-[80dvh] sm:max-h-[85dvh] flex flex-col rounded-2xl bg-canvas text-ink pointer-events-auto overflow-hidden my-auto shadow-2xl relative">
          {/* Top Bar / Head */}
          <div className="flex items-center justify-between px-6 pt-5 pb-2 bg-canvas shrink-0 select-none">
            <div className="flex items-center gap-2 text-caption-sm text-body font-mono min-w-0 mr-2">
              <span className="text-caption-sm font-semibold text-body uppercase tracking-wider font-mono">
                Edit Catatan
              </span>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* On Mobile: Enhance AI button placed at the top (no border) */}
              {category !== 'secure' && !isVaultNote && (
                <button
                  type="button"
                  onClick={handleEnhanceText}
                  disabled={isEnhancing || !content.trim()}
                  className={`sm:hidden w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-colors ${
                    content.trim() && !isEnhancing
                      ? 'bg-surface-soft text-ink hover:bg-canvas'
                      : 'opacity-40 text-mute cursor-not-allowed'
                  }`}
                  title="AI enhance text"
                  aria-label="AI enhance text"
                >
                  {isEnhancing ? (
                    <Loader2 className="w-3.5 h-3.5 text-ink animate-spin" />
                  ) : (
                    <div className="rotate-45 p-0.5 flex items-center justify-center">
                      <Sparkles className="w-3.5 h-3.5 -rotate-45" />
                    </div>
                  )}
                </button>
              )}

              {/* On Mobile: Simpan button placed at the top (no border) */}
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || !content.trim()}
                className={`sm:hidden h-8 px-3.5 rounded-full flex items-center justify-center gap-1 text-caption-xs font-semibold cursor-pointer transition-all ${
                  content.trim() && !isSaving
                    ? 'bg-primary text-on-primary hover:opacity-90 active:scale-95'
                    : 'bg-surface-soft text-mute cursor-not-allowed opacity-60'
                }`}
                title="Simpan Catatan"
                aria-label="Simpan catatan"
              >
                {isSaving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Simpan</span>
                  </>
                )}
              </button>

              {/* Close Button: X (no border) */}
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-body hover:text-ink hover:bg-surface-soft cursor-pointer transition-colors"
                title="Tutup (Esc)"
                aria-label="Tutup modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal Body / Content: Scrollable with natural writing canvas, no divider */}
          <div className="flex-1 flex flex-col justify-between overflow-y-auto overflow-x-hidden px-6 pt-3 pb-8 space-y-6 overscroll-contain">
            <div className="space-y-6">
              {/* Field Key khusus notes Vault / secure */}
              {(isVaultNote || category === 'secure') && (
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <label className="text-body-sm sm:text-body-md font-mono text-body uppercase tracking-wider shrink-0 font-medium select-none">
                    Key
                  </label>
                  <div className="flex items-center gap-2 px-3 py-1.5 sm:py-2 rounded-lg bg-surface-soft w-full max-w-xs sm:max-w-sm">
                    <KeyRound className="w-4 h-4 text-mute shrink-0" />
                    <input
                      ref={keyInputRef}
                      type="text"
                      value={vaultKey}
                      onChange={(e) => setVaultKey(e.target.value)}
                      placeholder="Masukkan nama key / label vault..."
                      className="w-full bg-transparent text-ink text-body-sm font-semibold focus:outline-none placeholder:text-mute font-sans"
                    />
                  </div>
                </div>
              )}

              {/* Notes content textarea: auto-resizing, borderless, matching detail view text typography */}
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
                onKeyDown={handleTextareaKeyDown}
                placeholder="Tulis konten catatan..."
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

            {/* Bottom Section: Actions row and Date/Time at the very bottom */}
            <div>
              {/* Actions row: Category + Attachment + Tags + (if schedule) Target Dates on left, AI Enhance + Simpan on right */}
              <div className="pt-6 pb-2 flex flex-wrap items-center justify-between gap-3 select-none">
                {/* Left grouping */}
                <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
                  {/* Category Dropdown Select (font normal, not bold, no uppercase, no border) */}
                  <div className="relative inline-flex items-center" ref={categoryDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setIsCategoryOpen((prev) => !prev)}
                      aria-haspopup="listbox"
                      aria-expanded={isCategoryOpen}
                      className="px-3.5 py-1.5 rounded-full bg-surface-soft hover:bg-surface-soft/80 text-ink text-xs sm:text-[13px] font-sans font-normal cursor-pointer inline-flex items-center gap-1.5 transition-all active:scale-95"
                      title="Ubah Kategori"
                    >
                      <span>
                        {category === 'others'
                          ? 'others'
                          : category === 'secure'
                          ? 'secure 🔒'
                          : category}
                      </span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-mute transition-transform duration-200 ${
                          isCategoryOpen ? 'rotate-180 text-ink' : ''
                        }`}
                      />
                    </button>

                    {isCategoryOpen && (
                      <div
                        role="listbox"
                        aria-label="Daftar Kategori"
                        className="absolute bottom-full left-0 mb-2 w-44 sm:w-48 max-h-44 sm:max-h-48 overflow-y-auto rounded-xl border border-hairline bg-canvas/95 backdrop-blur-md shadow-xl py-1 z-30 flex flex-col overscroll-contain animate-in fade-in zoom-in-95 duration-100"
                      >
                        {ALL_CATEGORIES.map((cat) => {
                          const isSelected = category.toLowerCase() === cat.toLowerCase();
                          return (
                            <button
                              key={cat}
                              type="button"
                              role="option"
                              aria-selected={isSelected}
                              onClick={() => {
                                setCategory(cat);
                                setIsCategoryOpen(false);
                              }}
                              className={`w-full px-3.5 py-1.5 text-left text-xs sm:text-[13px] font-sans font-normal flex items-center justify-between cursor-pointer transition-colors ${
                                isSelected
                                  ? 'bg-surface-soft text-ink font-medium'
                                  : 'text-body hover:text-ink hover:bg-surface-soft/60'
                              }`}
                            >
                              <span>{cat === 'secure' ? 'secure 🔒' : cat}</span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Attachment Button: Icon only, no border */}
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

                  {/* Target Dates for Schedule category or any note with scheduleDates */}
                  {(category === 'schedule' || scheduleDates.length > 0) && (
                    <div className="inline-flex flex-wrap items-center gap-1.5">
                      {scheduleDates.map((d) => (
                        <span
                          key={d}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-soft text-ink text-xs sm:text-[13px] font-mono font-normal transition-colors"
                        >
                          <CalendarIcon className="w-3.5 h-3.5 text-mute shrink-0" />
                          <span>{d}</span>
                          {isRecurring && (
                            <span className="text-[10px] text-primary uppercase font-bold tracking-wider ml-0.5">
                              (Rutin)
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => setScheduleDates((prev) => prev.filter((dt) => dt !== d))}
                            className="text-mute hover:text-terminal-red cursor-pointer ml-0.5"
                            title={`Hapus ${d}`}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      ))}

                      {/* + Target Date button (no border, font normal) */}
                      <button
                        type="button"
                        onClick={() => setIsDatePickerOpen(true)}
                        className="px-3.5 py-1.5 rounded-full bg-surface-soft/60 hover:bg-surface-soft text-xs sm:text-[13px] text-ink font-sans font-normal inline-flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                      >
                        <CalendarIcon className="w-3.5 h-3.5 text-mute shrink-0" />
                        <span>+ Target Date</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Right grouping (Desktop only): AI Enhance + Simpan button (no border) */}
                <div className="hidden sm:flex items-center gap-2 shrink-0">
                  {category !== 'secure' && !isVaultNote && (
                    <button
                      type="button"
                      onClick={handleEnhanceText}
                      disabled={isEnhancing || !content.trim()}
                      className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center cursor-pointer transition-colors ${
                        content.trim() && !isEnhancing
                          ? 'bg-surface-soft text-ink hover:bg-canvas'
                          : 'opacity-40 text-mute cursor-not-allowed'
                      }`}
                      title="AI enhance text"
                      aria-label="AI enhance text"
                    >
                      {isEnhancing ? (
                        <Loader2 className="w-4 h-4 text-ink animate-spin" />
                      ) : (
                        <div className="rotate-45 p-0.5 flex items-center justify-center">
                          <Sparkles className="w-4 h-4 -rotate-45" />
                        </div>
                      )}
                    </button>
                  )}

                  {/* Simpan Button (no border) */}
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving || !content.trim()}
                    className={`h-9 sm:h-10 px-4 sm:px-5 rounded-full flex items-center justify-center gap-1.5 text-caption-sm font-semibold cursor-pointer transition-all ${
                      content.trim() && !isSaving
                        ? 'bg-primary text-on-primary hover:opacity-90 active:scale-95'
                        : 'bg-surface-soft text-mute cursor-not-allowed opacity-60'
                    }`}
                    title="Simpan Catatan (Ctrl+Enter)"
                    aria-label="Simpan catatan"
                  >
                    {isSaving ? (
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

              {/* Date & Time at the very bottom of notes content */}
              <div className="pt-3 pb-1 text-caption-xs text-mute font-mono select-none">
                <span>{formattedDate}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Datepicker Target Date Modal: Compact & Generous Content on Frontmost Layer */}
      {isDatePickerOpen && (
        <>
          {/* High z-index backdrop overlay */}
          <div
            className="fixed inset-0 z-[10001] bg-black/75 backdrop-blur-sm select-none pointer-events-auto"
            style={{ top: 0, left: 0, right: 0, bottom: 0 }}
            onClick={() => setIsDatePickerOpen(false)}
            aria-hidden="true"
          />

          {/* Centered Modal on frontmost layer */}
          <div
            className="fixed inset-0 z-[10002] flex items-center justify-center p-4 pointer-events-none select-none"
            style={{ top: 0, left: 0, right: 0, bottom: 0 }}
          >
            <div className="w-full max-w-sm sm:max-w-md rounded-2xl bg-canvas p-4 sm:p-5 text-ink pointer-events-auto shadow-2xl relative animate-in fade-in zoom-in-95 duration-100 flex flex-col gap-3">
              {/* Calendar with larger content & working month nav */}
              <div className="flex justify-center w-full">
                <Calendar
                  mode="multiple"
                  size="medium"
                  month={calendarMonth}
                  onMonthChange={setCalendarMonth}
                  selected={scheduleDates
                    .map((d) => {
                      try {
                        return parseISO(d);
                      } catch {
                        return null;
                      }
                    })
                    .filter((d): d is Date => d !== null && !isNaN(d.getTime()))}
                  onSelect={(dates) => {
                    if (!dates || dates.length === 0) {
                      setScheduleDates([]);
                      return;
                    }
                    const formatted = Array.from(
                      new Set(dates.map((dt) => format(dt, 'yyyy-MM-dd')))
                    ).sort();
                    setScheduleDates(formatted);
                  }}
                />
              </div>

              {/* Recurring / Habit Checkbox & enlarged 'Selesai' button */}
              <div className="flex items-center justify-between px-1 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs sm:text-caption-sm text-ink select-none font-medium">
                  <input
                    type="checkbox"
                    checked={isRecurring}
                    onChange={(e) => setIsRecurring(e.target.checked)}
                    className="w-4 h-4 rounded border-hairline text-primary focus:ring-primary/20 cursor-pointer accent-primary"
                  />
                  <span>Jadwal Rutin / Berulang (Habit)</span>
                </label>

                <button
                  type="button"
                  onClick={() => setIsDatePickerOpen(false)}
                  className="h-10 sm:h-11 px-7 rounded-full bg-primary text-on-primary text-body-sm font-semibold cursor-pointer hover:opacity-90 active:scale-95 transition-all shadow-xs"
                >
                  Selesai
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>,
    document.body
  );
}
