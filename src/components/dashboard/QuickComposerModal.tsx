import { useState, useEffect, useRef, useLayoutEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Check,
  Sparkles,
  Loader2,
  ChevronDown,
  KeyRound,
  Paperclip,
  ImageIcon,
  FileText,
} from 'lucide-react';
import {
  format,
  parseISO,
  isBefore,
  startOfDay,
  startOfToday,
  addDays,
  getDaysInMonth,
} from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { toast } from 'sonner';
import { Calendar } from '../ui/Calendar';
import type { NoteItem } from './NotesTimeline';
import type { NoteAttachment } from '@/db/schema';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export type RecurrenceType = 'once' | 'weekly' | 'monthly';

interface QuickComposerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNoteCreated: (note: NoteItem) => void;
  onNoteSynced?: (tempId: string, realNote: NoteItem) => void;
  initialCategory?: string;
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

export default function QuickComposerModal({
  isOpen,
  onClose,
  onNoteCreated,
  onNoteSynced,
  initialCategory,
}: QuickComposerModalProps) {
  const [mounted, setMounted] = useState(false);
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<string>(initialCategory || '');
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [vaultKey, setVaultKey] = useState('');

  // Schedule specific states
  const [selectedAnchorDate, setSelectedAnchorDate] = useState<Date>(() => startOfToday());
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>('once');
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => startOfToday());

  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [attachments, setAttachments] = useState<NoteAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const keyInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const prevOpenRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isSchedule = category === 'schedule';

  // Auto-resize textarea height to match its content dynamically
  const adjustTextareaHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;

    const parent = el.parentElement;
    const parentScrollTop = parent?.scrollTop;

    el.style.height = 'auto';
    const isMobileScreen = typeof window !== 'undefined' ? window.innerWidth < 640 : false;
    const minH = isMobileScreen ? 140 : 180;
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

  // Adjust textarea height whenever category mode changes without resetting form
  useEffect(() => {
    if (isOpen) {
      adjustTextareaHeight();
    }
  }, [isSchedule, isOpen, adjustTextareaHeight]);

  // Reset states and auto-focus ONLY when modal transitions from closed to open
  useEffect(() => {
    if (isOpen && !prevOpenRef.current) {
      const today = startOfToday();
      setContent('');
      setCategory(initialCategory || '');
      setIsCategoryOpen(false);
      setVaultKey('');
      setSelectedAnchorDate(today);
      setRecurrenceType('once');
      setCalendarMonth(today);
      setTags([]);
      setTagInput('');
      setAttachments([]);
      setIsUploading(false);
      setIsSubmitting(false);
      setIsEnhancing(false);

      setTimeout(() => {
        adjustTextareaHeight();
        textareaRef.current?.focus();
      }, 50);
    }
    prevOpenRef.current = isOpen;
  }, [isOpen, initialCategory, adjustTextareaHeight]);

  // Schedule picker date selection
  const handlePickerDateSelect = (
    _dates: Date[] | undefined,
    triggerDate: Date
  ) => {
    if (!triggerDate) return;
    const today = startOfToday();
    if (isBefore(startOfDay(triggerDate), today)) {
      return; // Past dates are gated
    }
    setSelectedAnchorDate(startOfDay(triggerDate));
  };

  // Projected dates for highlighting inside the Calendar
  const calendarSelectedDates = useMemo<Date[]>(() => {
    if (!selectedAnchorDate) return [];
    const anchor = startOfDay(selectedAnchorDate);

    if (recurrenceType === 'once') {
      return [anchor];
    }

    if (recurrenceType === 'weekly') {
      const dates: Date[] = [];
      let curr = new Date(anchor);
      for (let i = 0; i < 52; i++) {
        dates.push(new Date(curr));
        curr = addDays(curr, 7);
      }
      return dates;
    }

    if (recurrenceType === 'monthly') {
      const dates: Date[] = [];
      const anchorDay = anchor.getDate();
      const startY = anchor.getFullYear();
      const startM = anchor.getMonth();
      for (let i = 0; i < 24; i++) {
        const mDate = new Date(startY, startM + i, 1);
        const maxDays = getDaysInMonth(mDate);
        if (anchorDay <= maxDays) {
          dates.push(new Date(mDate.getFullYear(), mDate.getMonth(), anchorDay));
        }
      }
      return dates;
    }

    return [anchor];
  }, [selectedAnchorDate, recurrenceType]);

  // Handle Escape key to close dropdowns or modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting && !isEnhancing) {
        if (isCategoryOpen) {
          setIsCategoryOpen(false);
          return;
        }
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, isEnhancing, isCategoryOpen, onClose]);

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

  if (!isOpen || !mounted) return null;

  const formattedDate = (() => {
    try {
      const d = isSchedule ? selectedAnchorDate : new Date();
      return format(d, 'EEEE, d MMMM yyyy • HH:mm', { locale: localeId }) + ' WIB';
    } catch {
      return isSchedule ? 'Jadwal Baru' : 'Catatan Baru';
    }
  })();

  // Add Tag
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

  // Enhance AI
  const handleEnhanceText = async () => {
    const text = content.trim();
    if (!text || isEnhancing) {
      if (!text) toast.info('Ketik catatan terlebih dahulu');
      return;
    }

    setIsEnhancing(true);
    try {
      const res = await fetch('/api/notes/enhance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-timezone': Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jakarta',
        },
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
        if (data.category === 'schedule') {
          if (Array.isArray(data.scheduleDates) && data.scheduleDates.length > 0) {
            try {
              const parsed = parseISO(data.scheduleDates[0]);
              if (!isNaN(parsed.getTime()) && !isBefore(startOfDay(parsed), startOfToday())) {
                setSelectedAnchorDate(startOfDay(parsed));
                setCalendarMonth(startOfDay(parsed));
              }
            } catch {}
          }
          if (data.schedule?.isRecurring) {
            const freq = data.schedule?.recurrenceRule?.frequency;
            setRecurrenceType(freq === 'monthly' ? 'monthly' : 'weekly');
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

  // Submit / Simpan Note
  const handleSubmit = async () => {
    const text = content.trim();
    if (!text || isSubmitting) return;

    setIsSubmitting(true);
    const tempId = `temp-${Date.now()}`;
    const now = new Date();
    const isSecure = category === 'secure';
    const isUncategorized = !category && tags.length === 0;

    const anchorDate = selectedAnchorDate;
    const anchorStr = format(anchorDate, 'yyyy-MM-dd');
    const isRec = recurrenceType !== 'once';
    const recurrenceRule = recurrenceType === 'weekly'
      ? { frequency: 'weekly' as const, daysOfWeek: [anchorDate.getDay()] }
      : recurrenceType === 'monthly'
      ? { frequency: 'monthly' as const, dayOfMonth: anchorDate.getDate() }
      : undefined;

    const optimisticNote: NoteItem = {
      id: tempId,
      content: text,
      category: isSecure ? 'credential' : (category || 'others'),
      specificTags: tags,
      source: 'web',
      isPinned: false,
      isProcessed: !isUncategorized,
      isEncrypted: isSecure,
      vaultKey: isSecure && vaultKey.trim() ? vaultKey.trim() : null,
      targetDate: isSchedule ? anchorStr : undefined,
      scheduleDates: isSchedule ? [anchorStr] : undefined,
      schedule: isSchedule ? {
        dates: [anchorStr],
        isRecurring: isRec,
        recurrenceRule,
      } : undefined,
      attachments: attachments.length > 0 ? attachments : undefined,
      createdAt: now.toISOString(),
    };

    // Optimistically update timeline and close modal
    onNoteCreated(optimisticNote);
    onClose();

    try {
      const payload: Record<string, any> = {
        content: text,
        category: isSecure ? 'credential' : (category || undefined),
        isEncrypted: isSecure,
        vaultKey: isSecure && vaultKey.trim() ? vaultKey.trim() : undefined,
        specificTags: tags.length > 0 ? tags : undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
      };

      if (isSchedule) {
        payload.schedule = {
          dates: [anchorStr],
          isRecurring: isRec,
          recurrenceRule,
        };
        payload.scheduleDates = [anchorStr];
        payload.targetDate = anchorStr;
      }

      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-timezone': Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jakarta',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.note) {
        onNoteSynced?.(tempId, data.note);
        if (data.note.category === 'credential' || data.note.isEncrypted) {
          toast.success('Catatan kredensial tersimpan aman di Vault');
        } else if (!data.note.isProcessed) {
          toast.success('Tersimpan di Uncategorized Notes! Siap di-sync AI');
        } else {
          toast.success(`Tersimpan! Dikategorikan sebagai ${data.note.category}`);
        }
      } else {
        toast.error(data.error || 'Gagal menyimpan catatan');
      }
    } catch {
      toast.error('Gagal terhubung ke server');
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
        className="fixed inset-0 z-[9998] bg-black/75 select-none"
        style={{ top: 0, left: 0, right: 0, bottom: 0 }}
        aria-hidden="true"
      />

      {/* Modal Dialog Container: Dynamic width without layout jump */}
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 md:p-6 pointer-events-none select-none"
        style={{ top: 0, left: 0, right: 0, bottom: 0, height: '100dvh' }}
      >
        <div
          className={`w-full ${
            isSchedule
              ? 'max-w-2xl md:max-w-4xl lg:max-w-5xl max-h-[92dvh]'
              : 'max-w-3xl sm:max-w-4xl max-h-[85dvh]'
          } min-h-[min(380px,80dvh)] sm:min-h-[440px] flex flex-col rounded-2xl bg-canvas text-ink pointer-events-auto overflow-hidden my-auto shadow-2xl relative`}
        >
          {/* Top Bar / Header without horizontal divider */}
          <div className="flex items-center justify-between px-6 pt-5 pb-2 bg-canvas shrink-0 select-none">
            <div className="flex items-center gap-2 text-caption-sm text-body font-mono min-w-0">
              <span className="text-caption-sm font-semibold text-body uppercase tracking-wider font-mono">
                {isSchedule ? 'Jadwal Baru' : 'Catatan Baru'}
              </span>
            </div>

            {/* Close Button: X */}
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-8 h-8 rounded-full flex items-center justify-center text-body hover:text-ink hover:bg-surface-soft cursor-pointer transition-colors"
              title="Tutup (Esc)"
              aria-label="Tutup modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body / Content: Single unified node structure so textarea NEVER remounts */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 pt-3 pb-2 overscroll-contain">
            <div className={`flex flex-col ${isSchedule ? 'md:flex-row items-stretch gap-6 lg:gap-8' : ''}`}>
              {/* Left Column (or full width if not schedule): Always holds textarea, key, attachments, tags */}
              <div className="flex-1 flex flex-col justify-between min-w-0 space-y-4">
                <div className="space-y-4 flex-1">
                  {/* Field Key khusus notes secure */}
                  {category === 'secure' && (
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

                  {/* Notes content textarea (persistent, never remounts) */}
                  <textarea
                    ref={textareaRef}
                    value={content}
                    onChange={(e) => {
                      setContent(e.target.value);
                      const el = e.target;
                      el.style.height = 'auto';
                      const isMobile = window.innerWidth < 640;
                      const minH = isMobile ? 140 : 180;
                      el.style.height = `${Math.max(el.scrollHeight, minH)}px`;
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      category === 'secure'
                        ? 'Tulis catatan rahasia yang ingin dienkripsi...'
                        : isSchedule
                        ? 'Tulis agenda jadwal baru...'
                        : 'Tulis catatan atau kirim link apapun...'
                    }
                    className="w-full bg-transparent text-ink placeholder:text-mute text-body-md leading-relaxed resize-none focus:outline-none font-sans select-text min-h-[140px] sm:min-h-[180px] p-0 border-0 overflow-hidden block"
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

                {/* Actions row: Category + Attachment + Tags */}
                <div className="pt-4 flex flex-wrap items-center gap-2 select-none">
                  {/* Category Dropdown */}
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
                        {!category
                          ? 'Uncategorized'
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
                        className="absolute bottom-full left-0 mb-2 w-44 sm:w-48 max-h-44 sm:max-h-48 overflow-y-auto rounded-xl border border-hairline bg-canvas shadow-xl py-1 z-30 flex flex-col overscroll-contain animate-in fade-in zoom-in-95 duration-100"
                      >
                        <button
                          type="button"
                          role="option"
                          aria-selected={!category}
                          onClick={() => {
                            setCategory('');
                            setIsCategoryOpen(false);
                          }}
                          className={`w-full px-3.5 py-1.5 text-left text-xs sm:text-[13px] font-sans font-normal flex items-center justify-between cursor-pointer transition-colors ${
                            !category
                              ? 'bg-surface-soft text-ink font-medium'
                              : 'text-body hover:text-ink hover:bg-surface-soft/60'
                          }`}
                        >
                          <span>Uncategorized</span>
                          {!category && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                        </button>
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
                                if (cat === 'schedule') {
                                  const today = startOfToday();
                                  setSelectedAnchorDate((prev) => (prev && !isBefore(startOfDay(prev), today) ? prev : today));
                                  setCalendarMonth((prev) => (prev && !isBefore(startOfDay(prev), today) ? prev : today));
                                }
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
              </div>

              {/* Right Column (Desktop) / Below (Mobile): ONLY shown when isSchedule */}
              {isSchedule && (
                <div className="w-full md:w-[310px] lg:w-[340px] shrink-0 flex flex-col items-center justify-center border-t md:border-t-0 md:border-l border-hairline pt-5 md:pt-0 md:pl-5 lg:pl-6 space-y-3">
                  {/* 1. Date Picker Calendar */}
                  <div className="w-full flex justify-center">
                    <Calendar
                      mode="multiple"
                      size="medium"
                      month={calendarMonth}
                      onMonthChange={setCalendarMonth}
                      disabled={{ before: startOfToday() }}
                      selected={calendarSelectedDates}
                      onSelect={handlePickerDateSelect}
                    />
                  </div>

                  {/* 2. Recurrence Tabs Option: Directly below Calendar */}
                  <div className="w-full flex justify-center pt-1 pb-1">
                    <div className="inline-flex items-center p-1 rounded-full bg-surface-soft shrink-0 select-none">
                      <button
                        type="button"
                        onClick={() => setRecurrenceType('once')}
                        className={`px-3 sm:px-3.5 py-1.5 rounded-full text-caption-sm font-medium cursor-pointer transition-colors !border-0 ${
                          recurrenceType === 'once'
                            ? 'bg-canvas text-ink shadow-xs font-semibold'
                            : 'text-body hover:text-ink'
                        }`}
                      >
                        Sekali
                      </button>
                      <button
                        type="button"
                        onClick={() => setRecurrenceType('weekly')}
                        className={`px-3 sm:px-3.5 py-1.5 rounded-full text-caption-sm font-medium cursor-pointer transition-colors !border-0 ${
                          recurrenceType === 'weekly'
                            ? 'bg-canvas text-ink shadow-xs font-semibold'
                            : 'text-body hover:text-ink'
                        }`}
                      >
                        Setiap Minggu
                      </button>
                      <button
                        type="button"
                        onClick={() => setRecurrenceType('monthly')}
                        className={`px-3 sm:px-3.5 py-1.5 rounded-full text-caption-sm font-medium cursor-pointer transition-colors !border-0 ${
                          recurrenceType === 'monthly'
                            ? 'bg-canvas text-ink shadow-xs font-semibold'
                            : 'text-body hover:text-ink'
                        }`}
                      >
                        Setiap Bulan
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Action Footer without horizontal divider */}
          <div className="px-6 pb-6 pt-3 flex flex-wrap items-center justify-between gap-3 select-none bg-canvas shrink-0">
            {/* Left: Formatted Date / Hint */}
            <div className="text-caption-xs text-mute font-mono hidden sm:block">
              <span>{formattedDate}</span>
            </div>

            {/* Right: AI Enhance + Batal + Simpan */}
            <div className="flex items-center justify-end gap-2.5 sm:gap-3 w-full sm:w-auto ml-auto">
              {/* AI Enhance Button */}
              {category !== 'secure' && (
                <button
                  type="button"
                  onClick={handleEnhanceText}
                  disabled={isEnhancing || !content.trim()}
                  className={`w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-colors ${
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

              {/* Batal Button */}
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-3 py-2 text-body-sm text-body hover:text-ink font-medium cursor-pointer transition-colors !border-0 bg-transparent disabled:opacity-50"
              >
                Batal
              </button>

              {/* Simpan Button */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || !content.trim()}
                className={`h-9 sm:h-10 px-5 sm:px-6 rounded-full flex items-center justify-center gap-1.5 text-caption-sm font-semibold cursor-pointer transition-all ${
                  content.trim() && !isSubmitting
                    ? 'bg-primary text-on-primary hover:opacity-90 active:scale-95 shadow-xs'
                    : 'bg-surface-soft text-mute cursor-not-allowed opacity-60'
                }`}
                title="Simpan (Ctrl+Enter)"
                aria-label="Simpan catatan"
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
        </div>
      </div>
    </>,
    document.body
  );
}
