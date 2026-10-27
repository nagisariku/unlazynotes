import { useState, useEffect, useRef, useLayoutEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Pin,
  PinOff,
  Pencil,
  Trash2,
  Copy,
  Check,
  FileIcon,
  ImageIcon,
  FileText,
  Loader2,
  Globe,
  KeyRound,
  Calendar as CalendarIcon,
  Sparkles,
  BookOpen,
  Eye,
  Clock,
  ChevronDown,
  Paperclip,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { toast } from 'sonner';
import { Calendar } from '../ui/Calendar';
import { getUrlPlatformInfo, getLinkThumbnail, isDomainUnsupportedForAi } from '@/lib/platform-icons';
import type { NoteItem } from './NotesTimeline';
import type { BookmarkMeta } from '@/db/schema';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export type ModalMode = 'view' | 'read' | 'edit';

function getSafeDomain(url?: string | null): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
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

export interface NoteDetailModalProps {
  note: NoteItem | null;
  isOpen: boolean;
  isVault?: boolean;
  initialMode?: ModalMode;
  initialReaderMode?: boolean;
  onClose: () => void;
  onEdit?: (note: NoteItem) => void;
  onSave?: (updatedNote: NoteItem) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string, isPinned: boolean) => void;
  onOpenReader?: (note: NoteItem) => void;
  onBookmarkUpdated?: (updatedNote: NoteItem) => void;
}

export default function NoteDetailModal({
  note,
  isOpen,
  isVault,
  initialMode,
  initialReaderMode = false,
  onClose,
  onEdit,
  onSave,
  onDelete,
  onTogglePin,
  onOpenReader,
  onBookmarkUpdated,
}: NoteDetailModalProps) {
  const [mounted, setMounted] = useState(false);
  const [activeNote, setActiveNote] = useState<NoteItem | null>(note);

  // Active modal mode: 'view' | 'read' | 'edit'
  const determineInitialMode = (): ModalMode => {
    if (initialMode) return initialMode;
    if (initialReaderMode) return 'read';
    return 'view';
  };
  const [mode, setMode] = useState<ModalMode>(determineInitialMode());

  // Universal actions states
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTogglingPin, setIsTogglingPin] = useState(false);

  // Reader Mode states
  const [isProcessingAi, setIsProcessingAi] = useState(false);
  const [isTogglingReadStatus, setIsTogglingReadStatus] = useState(false);
  const [currentMeta, setCurrentMeta] = useState<BookmarkMeta | null>(note?.bookmarkMeta || null);

  // Edit Mode states
  const [editContent, setEditContent] = useState('');
  const [editCategory, setEditCategory] = useState<string>('others');
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [editVaultKey, setEditVaultKey] = useState('');
  const [editScheduleDates, setEditScheduleDates] = useState<string[]>([]);
  const [editIsRecurring, setEditIsRecurring] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => new Date());
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [editTags, setEditTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [editAttachments, setEditAttachments] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync activeNote and form values when note prop or isOpen changes
  useEffect(() => {
    if (note) {
      setActiveNote(note);
      setCurrentMeta(note.bookmarkMeta || null);
      setEditContent(note.content || '');
      setEditCategory(note.category || 'others');
      setEditVaultKey(note.vaultKey || '');
      setEditTags(note.specificTags || []);
      setEditAttachments(note.attachments || []);

      let parsedScheduleDates = Array.isArray((note as any).scheduleDates)
        ? (note as any).scheduleDates.filter((d: any) => typeof d === 'string')
        : [];
      if (parsedScheduleDates.length === 0 && (note as any).schedule?.dates) {
        parsedScheduleDates = (note as any).schedule.dates;
      }
      if (parsedScheduleDates.length === 0 && (note as any).targetDate) {
        const td =
          typeof (note as any).targetDate === 'string'
            ? (note as any).targetDate.split('T')[0]
            : (note as any).targetDate instanceof Date
            ? (note as any).targetDate.toISOString().split('T')[0]
            : '';
        if (td) parsedScheduleDates = [td];
      }
      setEditScheduleDates(parsedScheduleDates);
      setEditIsRecurring(Boolean((note as any)?.schedule?.isRecurring));

      setIsCategoryOpen(false);
      setIsDatePickerOpen(false);
      setTagInput('');
      setConfirmDelete(false);
    }
  }, [note?.id, isOpen]);

  // Sync mode when opening modal or when initial props change
  useEffect(() => {
    if (isOpen) {
      setMode(determineInitialMode());
      setConfirmDelete(false);
    }
  }, [isOpen, initialMode, initialReaderMode, note?.id]);

  // Sync currentMeta if parent updates note.bookmarkMeta
  useEffect(() => {
    if (note?.bookmarkMeta) {
      setCurrentMeta(note.bookmarkMeta);
    }
  }, [note?.bookmarkMeta]);

  // Auto-resize textarea height to exactly match content
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
    if (isOpen && mode === 'edit') {
      adjustTextareaHeight();
    }
  }, [isOpen, mode, editContent, adjustTextareaHeight]);

  useEffect(() => {
    if (!isOpen || mode !== 'edit') return;
    const handleResize = () => adjustTextareaHeight();
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, mode, adjustTextareaHeight]);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isOpen && mode === 'edit') {
      requestAnimationFrame(() => {
        adjustTextareaHeight();
        textareaRef.current?.focus();
      });
    }
  }, [mode, isOpen, adjustTextareaHeight]);

  // Sync calendar month when datepicker opens
  useEffect(() => {
    if (isDatePickerOpen) {
      if (editScheduleDates.length > 0) {
        try {
          const first = parseISO(editScheduleDates[0]);
          if (!isNaN(first.getTime())) {
            setCalendarMonth(first);
            return;
          }
        } catch {}
      }
      setCalendarMonth(new Date());
    }
  }, [isDatePickerOpen, editScheduleDates]);

  // Handle outside click for category dropdown
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

  // Handle Escape key
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
        if (mode === 'edit') {
          handleCancelEdit();
          return;
        }
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSaving, isEnhancing, isCategoryOpen, isDatePickerOpen, mode, onClose]);

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

  const targetNote = activeNote || note;

  // Extract schedule dates for view mode
  const targetDatesList = useMemo(() => {
    if (!targetNote) return [];
    const datesSet = new Set<string>();
    if (Array.isArray(targetNote.scheduleDates) && targetNote.scheduleDates.length > 0) {
      for (const d of targetNote.scheduleDates) if (d && typeof d === 'string') datesSet.add(d);
    }
    if (Array.isArray(targetNote.schedule?.dates) && targetNote.schedule.dates.length > 0) {
      for (const d of targetNote.schedule.dates) if (d && typeof d === 'string') datesSet.add(d);
    }
    if (targetNote.targetDate) {
      try {
        const d = targetNote.targetDate instanceof Date ? targetNote.targetDate : parseISO(String(targetNote.targetDate));
        if (!isNaN(d.getTime())) datesSet.add(format(d, 'yyyy-MM-dd'));
      } catch {}
    }
    return Array.from(datesSet).sort();
  }, [targetNote]);

  // Extract URLs from content to show link embed cards and check bookmark eligibility
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const urls = useMemo(() => {
    const activeText = mode === 'edit' ? editContent : targetNote?.content;
    if (!activeText) return [];
    const matched = Array.from(new Set(activeText.match(urlRegex) || []));
    if (currentMeta?.primaryUrl && !matched.includes(currentMeta.primaryUrl)) {
      return [currentMeta.primaryUrl, ...matched];
    }
    return matched;
  }, [targetNote?.content, editContent, mode, currentMeta?.primaryUrl]);

  // Social Media Post Caption (misal link dishare dari medsos dan punya caption di sana seperti tweet X/Twitter)
  const detailCaption = useMemo(() => {
    const cap = currentMeta?.caption || targetNote?.bookmarkMeta?.caption;
    if (!cap) return null;
    const trimmed = cap.trim();
    if (!trimmed || trimmed === targetNote?.content?.trim()) return null;
    if (/^video oleh/i.test(trimmed)) return null;
    return trimmed;
  }, [currentMeta?.caption, targetNote?.bookmarkMeta?.caption, targetNote?.content]);

  if (!isOpen || !targetNote || !mounted) return null;

  const isVaultNote =
    Boolean(isVault) ||
    Boolean(targetNote.vaultKey) ||
    targetNote.category === 'vault' ||
    editCategory === 'secure' ||
    (Array.isArray(targetNote.specificTags) &&
      targetNote.specificTags.some((t: string) => t.toLowerCase() === 'vault'));

  const formattedDate = (() => {
    try {
      const d = new Date(targetNote.createdAt);
      return format(d, 'EEEE, d MMMM yyyy • HH:mm', { locale: localeId }) + ' WIB';
    } catch {
      return targetNote.createdAt;
    }
  })();

  // Copy handler
  const handleCopy = async () => {
    try {
      const textToCopy = mode === 'edit' ? editContent : targetNote.content;
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Isi catatan disalin');
    } catch {
      toast.error('Gagal menyalin catatan');
    }
  };

  // Delete handler with 2-click confirmation
  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }

    setIsDeleting(true);
    onDelete(targetNote.id);
    onClose();

    try {
      const res = await fetch(`/api/notes/${targetNote.id}`, { method: 'DELETE' });
      if (!res.ok) {
        throw new Error('Gagal');
      }
    } catch {
      toast.error('Gagal menghapus catatan');
    } finally {
      setIsDeleting(false);
    }
  };

  // Pin handler
  const handlePinClick = async () => {
    setIsTogglingPin(true);
    const nextPinned = !targetNote.isPinned;
    try {
      const res = await fetch(`/api/notes/${targetNote.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPinned: nextPinned }),
      });
      if (res.ok) {
        onTogglePin(targetNote.id, nextPinned);
        setActiveNote((prev) => (prev ? { ...prev, isPinned: nextPinned } : null));
        toast.success(nextPinned ? 'Catatan disematkan ke atas' : 'Sematan catatan dilepas');
      }
    } catch (e) {
      console.error('Failed to toggle pin', e);
      toast.error('Gagal menyematkan catatan');
    } finally {
      setIsTogglingPin(false);
    }
  };

  // Eligibility check for Reader Mode
  const isBookmarkOrHasUrl =
    urls.length > 0 ||
    Boolean(currentMeta?.primaryUrl) ||
    targetNote?.category === 'bookmark';

  const isProcessedAi = Boolean(
    (Array.isArray(currentMeta?.aiSummary) && currentMeta.aiSummary.length > 0) ||
    currentMeta?.isContentExtracted
  );

  const targetAiUrl = currentMeta?.primaryUrl || urls[0] || '';
  const domainCheck = isDomainUnsupportedForAi(targetAiUrl);
  const isAiUnsupported = currentMeta?.isAiSupported === false || domainCheck.unsupported;
  const unsupportedReason =
    currentMeta?.unsupportedReason ||
    domainCheck.reason ||
    'URL ini tidak mendukung ekstraksi teks AI (dilindungi login atau media interaktif)';

  // AI Reader Trigger
  const handleTriggerAi = async () => {
    if (isProcessingAi || !targetNote) return;
    setIsProcessingAi(true);
    try {
      const res = await fetch(`/api/bookmarks/${targetNote.id}/read`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        const fallbackMeta: BookmarkMeta = {
          ...(currentMeta || {}),
          primaryUrl: targetAiUrl,
          domain:
            currentMeta?.domain ||
            (targetAiUrl
              ? (() => {
                  try {
                    return new URL(targetAiUrl).hostname.replace(/^www\./, '');
                  } catch {
                    return '';
                  }
                })()
              : ''),
          isAiSupported: false,
          unsupportedReason: data?.error || 'URL ini tidak mendukung ekstraksi teks AI',
        };
        setCurrentMeta(fallbackMeta);
        const updatedFallback = {
          ...targetNote,
          category: 'bookmark',
          isProcessed: true,
          bookmarkMeta: fallbackMeta,
        };
        setActiveNote(updatedFallback);
        onBookmarkUpdated?.(updatedFallback);
        onSave?.(updatedFallback);
        throw new Error(data.error || 'Gagal memproses dengan AI');
      }
      const updatedMeta: BookmarkMeta = data.bookmarkMeta;
      setCurrentMeta(updatedMeta);
      const updatedNote: NoteItem = {
        ...targetNote,
        category: 'bookmark',
        isProcessed: true,
        bookmarkMeta: updatedMeta,
      };
      setActiveNote(updatedNote);
      onBookmarkUpdated?.(updatedNote);
      onSave?.(updatedNote);
      setMode('read');
      toast.success('Berhasil diekstrak & diringkas AI');
    } catch (err: any) {
      console.error('Trigger AI error:', err);
      toast.error(err.message || 'Gagal memproses AI');
    } finally {
      setIsProcessingAi(false);
    }
  };

  // Toggle Read / Unread Status
  const handleToggleReadStatus = async () => {
    if (isTogglingReadStatus || !targetNote) return;
    setIsTogglingReadStatus(true);
    const nextStatus = currentMeta?.readingStatus === 'read' ? 'unread' : 'read';
    try {
      const res = await fetch(`/api/bookmarks/${targetNote.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal mengubah status baca');
      }
      const updatedMeta: BookmarkMeta = data.bookmarkMeta;
      setCurrentMeta(updatedMeta);
      const updated = {
        ...targetNote,
        bookmarkMeta: updatedMeta,
      };
      setActiveNote(updated);
      onBookmarkUpdated?.(updated);
      onSave?.(updated);
      toast.success(nextStatus === 'read' ? 'Ditandai sudah dibaca' : 'Ditandai belum dibaca');
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengubah status baca');
    } finally {
      setIsTogglingReadStatus(false);
    }
  };

  // Tag Management in Edit Mode
  const handleAddTag = () => {
    const clean = tagInput
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .slice(0, 20);

    if (!clean) return;

    if (!editTags.includes(clean)) {
      setEditTags((prev) => [...prev, clean]);
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
    setEditTags((prev) => prev.filter((t) => t !== tagToRemove));
  };

  // Attachment upload
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
        setEditAttachments((prev) => [...prev, data.attachment]);
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

  // AI Enhance Text
  const handleEnhanceText = async () => {
    if (editCategory === 'secure' || isVaultNote) return;
    const text = editContent.trim();
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
        setEditContent(data.enhancedText);
        if (data.category && (!editCategory || editCategory === 'others')) {
          setEditCategory(data.category);
        }
        if (Array.isArray(data.tags) && data.tags.length > 0) {
          setEditTags((prev) => Array.from(new Set([...prev, ...data.tags])));
        }
        if (data.category === 'schedule' && Array.isArray(data.scheduleDates) && data.scheduleDates.length > 0) {
          setEditScheduleDates(data.scheduleDates);
          if (data.schedule?.isRecurring) {
            setEditIsRecurring(true);
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

  // Cancel edit handler
  const handleCancelEdit = () => {
    if (targetNote) {
      setEditContent(targetNote.content || '');
      setEditCategory(targetNote.category || 'others');
      setEditVaultKey(targetNote.vaultKey || '');
      setEditTags(targetNote.specificTags || []);
      setEditAttachments(targetNote.attachments || []);
    }
    setMode('view');
  };

  // Save handler
  const handleSave = async () => {
    if (!editContent.trim() || isSaving) {
      if (!editContent.trim()) toast.error('Konten catatan tidak boleh kosong');
      return;
    }

    setIsSaving(true);
    try {
      const isSecure = editCategory === 'secure';
      const payload: Record<string, any> = {
        content: editContent.trim(),
        category: isSecure ? 'credential' : editCategory,
        specificTags: isVaultNote ? (editTags.length ? editTags : ['vault']) : editTags,
        attachments: editAttachments,
        vaultKey: isVaultNote || isSecure ? editVaultKey.trim() || null : undefined,
      };

      if (editCategory === 'schedule' || editScheduleDates.length > 0) {
        payload.schedule = {
          dates: editScheduleDates,
          isRecurring: editIsRecurring,
          recurrenceRule: (targetNote as any)?.schedule?.recurrenceRule || (editIsRecurring ? { frequency: 'weekly' } : undefined),
        };
        payload.scheduleDates = editScheduleDates;
        if (editScheduleDates.length > 0) {
          payload.targetDate = editScheduleDates[0];
        }
      }

      const res = await fetch(`/api/notes/${targetNote.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success || !data.note) {
        toast.error(data.error || 'Gagal menyimpan perubahan');
        return;
      }

      const savedNote: NoteItem = data.note;
      setActiveNote(savedNote);
      if (savedNote.bookmarkMeta) {
        setCurrentMeta(savedNote.bookmarkMeta);
      }
      onSave?.(savedNote);
      onBookmarkUpdated?.(savedNote);
      toast.success('Catatan berhasil diperbarui');
      setMode('view');
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
      {/* Full-screen Backdrop covering 100% viewport */}
      <div
        className="fixed inset-0 z-[9998] bg-black/75 select-none"
        style={{ top: 0, left: 0, right: 0, bottom: 0 }}
        aria-hidden="true"
      />

      {/* Modal Dialog Container */}
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center px-4 py-8 sm:py-8 sm:px-6 pointer-events-none select-none"
        style={{ top: 0, left: 0, right: 0, bottom: 0, height: '100dvh' }}
      >
        <div className="w-full max-w-3xl sm:max-w-4xl min-h-[min(380px,80dvh)] sm:min-h-[440px] max-h-[80dvh] sm:max-h-[85dvh] flex flex-col rounded-2xl bg-canvas text-ink pointer-events-auto overflow-hidden my-auto shadow-2xl relative">
          
          {/* Top Bar / Header: Title on left, Action icon buttons on right */}
          <div className="flex items-center justify-between px-6 pt-5 pb-2 bg-canvas shrink-0 select-none">
            <div className="flex items-center gap-2 text-caption-sm text-body font-mono min-w-0 mr-2">
              <span className="text-caption-sm font-semibold text-body uppercase tracking-wider font-mono truncate">
                {mode === 'edit'
                  ? 'Edit Catatan'
                  : mode === 'read'
                  ? 'Mode Baca'
                  : isVaultNote
                  ? 'Detail Catatan Vault'
                  : 'Detail Catatan'}
              </span>
            </div>

            {/* Standardized Header Action Buttons:
                [Mode Baca / Kembali] -> [Edit / Batal Edit] -> [Salin] -> [Pin] -> [Hapus] -> [Tutup (X)] */}
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              
              {/* 1. Mode Baca Button (Kondisional jika ada URL / bookmark) */}
              {isBookmarkOrHasUrl && (
                !isProcessedAi ? (
                  isAiUnsupported ? (
                    <button
                      type="button"
                      disabled={true}
                      className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-mute/30 cursor-not-allowed !border-0"
                      title={unsupportedReason}
                      aria-label={unsupportedReason}
                    >
                      <Sparkles className="w-4.5 h-4.5 text-mute/30" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleTriggerAi}
                      disabled={isProcessingAi}
                      className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-body hover:text-ink hover:bg-surface-soft cursor-pointer transition-colors !border-0"
                      title="Transkrip & Ringkas AI"
                      aria-label="Transkrip & Ringkas AI"
                    >
                      {isProcessingAi ? (
                        <Loader2 className="w-4.5 h-4.5 animate-spin text-primary" />
                      ) : (
                        <Sparkles className="w-4.5 h-4.5 text-primary" />
                      )}
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={() => setMode((prev) => (prev === 'read' ? 'view' : 'read'))}
                    className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center cursor-pointer transition-colors !border-0 ${
                      mode === 'read'
                        ? 'text-primary bg-surface-soft hover:bg-surface-soft/80'
                        : 'text-body hover:text-ink hover:bg-surface-soft'
                    }`}
                    title={mode === 'read' ? 'Kembali ke detail catatan' : 'Mode Baca (Transkrip & Ringkas AI)'}
                    aria-label="Mode Baca"
                  >
                    <BookOpen className="w-4.5 h-4.5" />
                  </button>
                )
              )}

              {/* 2. Edit / Batal Edit Button */}
              <button
                type="button"
                onClick={() => {
                  if (mode === 'edit') {
                    handleCancelEdit();
                  } else {
                    setMode('edit');
                  }
                }}
                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center cursor-pointer transition-colors !border-0 ${
                  mode === 'edit'
                    ? 'text-primary bg-surface-soft hover:bg-surface-soft/80'
                    : 'text-body hover:text-ink hover:bg-surface-soft'
                }`}
                title={mode === 'edit' ? 'Batal edit catatan' : 'Edit catatan'}
                aria-label={mode === 'edit' ? 'Batal edit' : 'Edit catatan'}
              >
                <Pencil className="w-4.5 h-4.5" />
              </button>

              {/* 3. Copy Button */}
              <button
                type="button"
                onClick={handleCopy}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-body hover:text-ink hover:bg-surface-soft cursor-pointer transition-colors !border-0"
                title="Salin isi catatan"
                aria-label="Salin catatan"
              >
                {copied ? <Check className="w-4.5 h-4.5 text-terminal-green" /> : <Copy className="w-4.5 h-4.5" />}
              </button>

              {/* 4. Pin / Unpin Button */}
              <button
                type="button"
                onClick={handlePinClick}
                disabled={isTogglingPin}
                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center cursor-pointer transition-colors !border-0 ${
                  targetNote.isPinned
                    ? 'text-primary bg-surface-soft hover:bg-surface-soft/80'
                    : 'text-body hover:text-ink hover:bg-surface-soft'
                }`}
                title={targetNote.isPinned ? 'Lepas sematan (Unpin)' : 'Sematkan catatan (Pin)'}
                aria-label="Pin Button"
              >
                {isTogglingPin ? (
                  <Loader2 className="w-4.5 h-4.5 animate-spin" />
                ) : targetNote.isPinned ? (
                  <PinOff className="w-4.5 h-4.5" />
                ) : (
                  <Pin className="w-4.5 h-4.5" />
                )}
              </button>

              {/* 5. Delete Button */}
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center cursor-pointer transition-colors !border-0 ${
                  confirmDelete
                    ? 'bg-terminal-red text-white hover:bg-terminal-red/90'
                    : 'text-body hover:text-terminal-red hover:bg-surface-soft'
                }`}
                title={confirmDelete ? 'Klik sekali lagi untuk menghapus' : 'Hapus catatan'}
                aria-label="Hapus catatan"
              >
                {isDeleting ? (
                  <Loader2 className="w-4.5 h-4.5 animate-spin" />
                ) : (
                  <Trash2 className="w-4.5 h-4.5" />
                )}
              </button>

              {/* Quick Save button on mobile header when in edit mode */}
              {mode === 'edit' && (
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving || !editContent.trim()}
                  className={`sm:hidden h-8 px-3 rounded-full flex items-center justify-center gap-1 text-caption-xs font-semibold cursor-pointer transition-all !border-0 ${
                    editContent.trim() && !isSaving
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
              )}

              {/* 6. Close (X) Button */}
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-body hover:text-ink hover:bg-surface-soft cursor-pointer transition-colors ml-0.5 sm:ml-1 !border-0"
                title="Tutup catatan (Esc)"
                aria-label="Tutup modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal Body: Switchable In-Place based on active mode */}
          {mode === 'read' ? (
            /* =========================================================================
               MODE 1: READ MODE (Ringkasan AI & Transkrip / Bacaan Lengkap)
               ========================================================================= */
            <div className="flex-1 flex flex-col justify-start overflow-y-auto overflow-x-hidden px-6 pt-3 pb-8 space-y-5 overscroll-contain">
              {/* Subheader: icon/source, minutes read, button 'tandai dibaca' */}
              <div className="flex items-center justify-between gap-3 select-none flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {currentMeta?.faviconUrl ? (
                      <img
                        src={currentMeta.faviconUrl}
                        alt=""
                        className="w-4 h-4 rounded-xs shrink-0 object-contain"
                        onError={(e) => ((e.target as HTMLElement).style.display = 'none')}
                      />
                    ) : (
                      <Globe className="w-4 h-4 text-mute shrink-0" />
                    )}
                    <span className="text-caption-sm font-mono text-mute truncate max-w-[150px] sm:max-w-xs">
                      {currentMeta?.domain || getSafeDomain(urls[0]) || 'Web'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-caption-xs text-mute font-mono shrink-0 pl-1">
                    <Clock className="w-3.5 h-3.5 text-mute" />
                    <span>{currentMeta?.readingTimeMin || 1} menit baca</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleToggleReadStatus}
                  disabled={isTogglingReadStatus}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-caption-sm font-medium text-body hover:text-ink bg-surface-soft hover:bg-hairline/60 cursor-pointer transition-colors !border-0 select-none"
                  title={currentMeta?.readingStatus === 'read' ? 'Ubah jadi belum dibaca' : 'Tandai sudah dibaca'}
                >
                  {isTogglingReadStatus ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : currentMeta?.readingStatus === 'read' ? (
                    <Check className="w-3.5 h-3.5 text-mute" />
                  ) : (
                    <Eye className="w-3.5 h-3.5 text-mute" />
                  )}
                  <span>{currentMeta?.readingStatus === 'read' ? 'Sudah Dibaca' : 'Tandai Dibaca'}</span>
                </button>
              </div>

              {/* Title & Author */}
              <div className="space-y-1">
                <h2 className="text-heading-md font-medium text-ink leading-snug font-sans select-text">
                  {currentMeta?.title || (urls[0] || 'Bacaan')}
                </h2>
                {currentMeta?.author && (
                  <p className="text-body-sm text-mute font-normal select-text">
                    Oleh {currentMeta.author}
                  </p>
                )}
              </div>

              {/* Ringkasan AI */}
              {Array.isArray(currentMeta?.aiSummary) && currentMeta.aiSummary.length > 0 && (
                <div className="p-4 sm:p-5 rounded-2xl bg-surface-soft space-y-3 select-none">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-mute shrink-0" />
                    <span className="text-caption-sm font-mono text-mute uppercase tracking-wider">
                      Ringkasan AI
                    </span>
                  </div>
                  <ul className="space-y-3">
                    {currentMeta.aiSummary.map((point: string, idx: number) => (
                      <li
                        key={idx}
                        className="flex items-start gap-3 text-body-sm sm:text-body-md text-ink leading-relaxed select-text font-sans"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-mute mt-2.5 shrink-0 select-none" />
                        <span className="flex-1">{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Bacaan / Transkrip Lengkap */}
              <div className="space-y-3 pt-6 sm:pt-8">
                <span className="text-caption-sm font-mono text-mute uppercase tracking-wider block select-none">
                  {currentMeta?.domain?.includes('youtube') || currentMeta?.primaryUrl?.includes('youtu')
                    ? 'Transkrip Lengkap'
                    : 'Bacaan Lengkap'}
                </span>
                <div className="text-body-sm sm:text-body-md text-ink leading-relaxed whitespace-pre-wrap select-text font-sans">
                  {currentMeta?.articleContent || currentMeta?.caption || targetNote.content}
                </div>
              </div>
            </div>
          ) : mode === 'edit' ? (
            /* =========================================================================
               MODE 2: EDIT MODE (In-Place Form: Textarea, Dropdown, Tags, Schedule, Save)
               ========================================================================= */
            <div className="flex-1 flex flex-col justify-between overflow-y-auto overflow-x-hidden px-6 pt-3 pb-8 space-y-6 overscroll-contain">
              <div className="space-y-6">
                {/* Vault Key input */}
                {(isVaultNote || editCategory === 'secure') && (
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <label className="text-body-sm sm:text-body-md font-mono text-body uppercase tracking-wider shrink-0 font-medium select-none">
                      Key
                    </label>
                    <div className="flex items-center gap-2 px-3 py-1.5 sm:py-2 rounded-lg bg-surface-soft w-full max-w-xs sm:max-w-sm">
                      <KeyRound className="w-4 h-4 text-mute shrink-0" />
                      <input
                        type="text"
                        value={editVaultKey}
                        onChange={(e) => setEditVaultKey(e.target.value)}
                        placeholder="Masukkan nama key / label vault..."
                        className="w-full bg-transparent text-ink text-body-sm font-semibold focus:outline-none placeholder:text-mute font-sans"
                      />
                    </div>
                  </div>
                )}

                {/* Textarea */}
                <textarea
                  ref={textareaRef}
                  value={editContent}
                  onChange={(e) => {
                    setEditContent(e.target.value);
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

                {/* Attachments */}
                {editAttachments && editAttachments.length > 0 && (
                  <div className="pt-2 space-y-2 select-none">
                    <div className="flex flex-wrap gap-2">
                      {editAttachments.map((att: any, i: number) => (
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
                            onClick={() => setEditAttachments((prev) => prev.filter((_, idx) => idx !== i))}
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

              {/* Bottom Section: Category, Attachment, Tags, Schedule, AI Enhance, Batal & Simpan */}
              <div>
                <div className="pt-6 pb-2 flex flex-wrap items-center justify-between gap-3 select-none">
                  {/* Left Controls */}
                  <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
                    {/* Category Dropdown */}
                    <div className="relative inline-flex items-center" ref={categoryDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setIsCategoryOpen((prev) => !prev)}
                        aria-haspopup="listbox"
                        aria-expanded={isCategoryOpen}
                        className="px-3.5 py-1.5 rounded-full bg-surface-soft hover:bg-surface-soft/80 text-ink text-xs sm:text-[13px] font-sans font-normal cursor-pointer inline-flex items-center gap-1.5 transition-all active:scale-95 !border-0"
                        title="Ubah Kategori"
                      >
                        <span>
                          {editCategory === 'others'
                            ? 'others'
                            : editCategory === 'secure'
                            ? 'secure 🔒'
                            : editCategory}
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
                          {ALL_CATEGORIES.map((cat) => {
                            const isSelected = editCategory.toLowerCase() === cat.toLowerCase();
                            return (
                              <button
                                key={cat}
                                type="button"
                                role="option"
                                aria-selected={isSelected}
                                onClick={() => {
                                  setEditCategory(cat);
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

                    {/* Attachment Upload Button */}
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
                      className="p-2 rounded-full text-mute hover:text-ink hover:bg-surface-soft cursor-pointer transition-colors disabled:opacity-50 !border-0"
                      title="Unggah lampiran"
                    >
                      {isUploading ? (
                        <Loader2 className="w-4 h-4 animate-spin text-mute" />
                      ) : (
                        <Paperclip className="w-4 h-4" />
                      )}
                    </button>

                    {/* Tag Chips */}
                    {editTags.map((tag) => (
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

                    {/* Add Tag Input */}
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

                    {/* Target Dates for Schedule category */}
                    {(editCategory === 'schedule' || editScheduleDates.length > 0) && (
                      <div className="inline-flex flex-wrap items-center gap-1.5">
                        {editScheduleDates.map((d) => (
                          <span
                            key={d}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-soft text-ink text-xs sm:text-[13px] font-mono font-normal transition-colors"
                          >
                            <CalendarIcon className="w-3.5 h-3.5 text-mute shrink-0" />
                            <span>{d}</span>
                            {editIsRecurring && (
                              <span className="text-[10px] text-primary uppercase font-bold tracking-wider ml-0.5">
                                (Rutin)
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => setEditScheduleDates((prev) => prev.filter((dt) => dt !== d))}
                              className="text-mute hover:text-terminal-red cursor-pointer ml-0.5"
                              title={`Hapus ${d}`}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </span>
                        ))}

                        <button
                          type="button"
                          onClick={() => setIsDatePickerOpen(true)}
                          className="px-3.5 py-1.5 rounded-full bg-surface-soft/60 hover:bg-surface-soft text-xs sm:text-[13px] text-ink font-sans font-normal inline-flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 !border-0"
                        >
                          <CalendarIcon className="w-3.5 h-3.5 text-mute shrink-0" />
                          <span>+ Target Date</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Right Actions: AI Enhance + Batal + Simpan (Desktop) */}
                  <div className="hidden sm:flex items-center gap-2 shrink-0">
                    {editCategory !== 'secure' && !isVaultNote && (
                      <button
                        type="button"
                        onClick={handleEnhanceText}
                        disabled={isEnhancing || !editContent.trim()}
                        className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center cursor-pointer transition-colors !border-0 ${
                          editContent.trim() && !isEnhancing
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
                      onClick={handleCancelEdit}
                      disabled={isSaving}
                      className="h-9 sm:h-10 px-4 rounded-full flex items-center justify-center text-caption-sm font-medium text-body hover:text-ink bg-surface-soft hover:bg-hairline/60 cursor-pointer transition-colors !border-0"
                    >
                      Batal
                    </button>

                    {/* Simpan Button */}
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={isSaving || !editContent.trim()}
                      className={`h-9 sm:h-10 px-5 rounded-full flex items-center justify-center gap-1.5 text-caption-sm font-semibold cursor-pointer transition-all !border-0 ${
                        editContent.trim() && !isSaving
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

                {/* Mobile Bottom Action Bar (Batal & Simpan) */}
                <div className="sm:hidden pt-3 flex items-center gap-2">
                  {editCategory !== 'secure' && !isVaultNote && (
                    <button
                      type="button"
                      onClick={handleEnhanceText}
                      disabled={isEnhancing || !editContent.trim()}
                      className="w-10 h-10 rounded-full flex items-center justify-center bg-surface-soft text-ink shrink-0 !border-0"
                      title="AI enhance text"
                    >
                      {isEnhancing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                    className="flex-1 h-10 rounded-full flex items-center justify-center text-caption-sm font-medium text-body bg-surface-soft hover:bg-hairline/60 cursor-pointer transition-colors !border-0"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving || !editContent.trim()}
                    className={`flex-1 h-10 rounded-full flex items-center justify-center gap-1.5 text-caption-sm font-semibold cursor-pointer transition-all !border-0 ${
                      editContent.trim() && !isSaving
                        ? 'bg-primary text-on-primary hover:opacity-90 active:scale-95'
                        : 'bg-surface-soft text-mute cursor-not-allowed opacity-60'
                    }`}
                  >
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Simpan</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Date & Time at the bottom */}
                <div className="pt-3 pb-1 text-caption-xs text-mute font-mono select-none">
                  <span>{formattedDate}</span>
                </div>
              </div>
            </div>
          ) : (
            /* =========================================================================
               MODE 3: VIEW MODE (Standard Detail View: Key, Text, Embeds, Tags, Date)
               ========================================================================= */
            <div className="flex-1 flex flex-col justify-between overflow-y-auto overflow-x-hidden px-6 pt-3 pb-8 space-y-6 overscroll-contain">
              <div className="space-y-6">
                {/* Field Key khusus notes Vault */}
                {isVaultNote && (
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <label className="text-body-sm sm:text-body-md font-mono text-body uppercase tracking-wider shrink-0 font-medium select-none">
                      Key
                    </label>
                    <div className="flex items-center gap-2 px-3 py-1.5 sm:py-2 rounded-lg bg-surface-soft text-ink text-body-sm font-semibold select-text w-full max-w-xs sm:max-w-sm">
                      <KeyRound className="w-4 h-4 text-mute shrink-0" />
                      <span className="truncate">{targetNote.vaultKey || 'Catatan Vault'}</span>
                    </div>
                  </div>
                )}

                {/* Notes content & Social Media Post Caption */}
                <div className="space-y-6 sm:space-y-7">
                  <div className="text-body-md text-ink leading-relaxed whitespace-pre-wrap select-text font-sans">
                    {targetNote.content}
                  </div>

                  {detailCaption && (
                    <div className="text-body-md text-ink leading-relaxed whitespace-pre-wrap select-text font-sans">
                      {detailCaption}
                    </div>
                  )}
                </div>

                {/* File / Gambar / Thumbnail embed link section */}
                {(urls.length > 0 || (targetNote.attachments && targetNote.attachments.length > 0)) && (
                  <div className="pt-6 space-y-3 select-none">
                    {/* Attachments if any */}
                    {targetNote.attachments && targetNote.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {targetNote.attachments.map((att: any, i: number) => (
                          <div
                            key={att.fileId || i}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-soft text-caption-sm text-ink max-w-full"
                          >
                            {att.type === 'image' ? (
                              <ImageIcon className="w-4 h-4 text-mute shrink-0" />
                            ) : (
                              <FileIcon className="w-4 h-4 text-mute shrink-0" />
                            )}
                            <span className="truncate max-w-[200px] sm:max-w-xs font-mono">
                              {att.fileName || `Attachment-${i + 1}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Embedded URL Link Cards with Platform Specific Icons & Thumbnails */}
                    {urls.length > 0 && (
                      <div className="flex flex-wrap gap-3">
                        {urls.map((linkUrl) => {
                          const { domain, label, icon: PlatformIcon } = getUrlPlatformInfo(linkUrl);
                          const thumbUrl = getLinkThumbnail(linkUrl, currentMeta);

                          return (
                            <a
                              key={linkUrl}
                              href={linkUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group flex flex-row sm:flex-col items-center sm:items-start gap-3 sm:gap-2.5 p-2.5 rounded-xl bg-surface-soft hover:bg-hairline/60 transition-all text-left w-full sm:max-w-[280px] !border-0 cursor-pointer select-none"
                            >
                              {thumbUrl ? (
                                <div className="relative w-24 sm:w-full rounded-lg overflow-hidden bg-canvas shrink-0">
                                  <img
                                    src={thumbUrl}
                                    alt={label}
                                    loading="lazy"
                                    className="w-full h-auto rounded-lg block group-hover:scale-[1.02] transition-transform duration-200"
                                    onError={(e) => {
                                      (e.target as HTMLElement).style.display = 'none';
                                    }}
                                  />
                                </div>
                              ) : (
                                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-canvas flex items-center justify-center shrink-0 text-mute group-hover:text-ink">
                                  <PlatformIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                                </div>
                              )}

                              <div className="min-w-0 flex-1 w-full">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <PlatformIcon className="w-3.5 h-3.5 text-mute shrink-0" />
                                  <span className="text-body-sm font-medium text-ink group-hover:underline truncate block">
                                    {label !== domain ? `${label} (${domain})` : domain}
                                  </span>
                                </div>
                                <span className="text-caption-xs text-mute font-mono line-clamp-2 break-all block leading-relaxed">
                                  {linkUrl}
                                </span>
                              </div>
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Tags placed at the bottom of the note content inside scrollable area (Hidden for Vault notes) */}
              {!isVaultNote && (
                <div className="pt-6 pb-2 flex flex-wrap items-center gap-2 select-none">
                  <span className="px-3.5 py-1.5 rounded-full bg-surface-soft text-ink text-xs sm:text-[13px] font-sans font-normal">
                    {targetNote.category}
                  </span>
                  {targetNote.specificTags &&
                    targetNote.specificTags.map((tag) => (
                      <span
                        key={tag}
                        className="px-3.5 py-1.5 rounded-full bg-surface-soft text-body hover:text-ink text-xs sm:text-[13px] font-sans font-normal"
                      >
                        #{tag}
                      </span>
                    ))}

                  {/* Target Dates for Schedule / Time-anchored notes */}
                  {targetDatesList.length > 0 &&
                    targetDatesList.map((dateStr) => {
                      let displayStr = dateStr;
                      try {
                        displayStr = format(parseISO(dateStr), 'd MMMM yyyy', { locale: localeId });
                      } catch {}
                      return (
                        <span
                          key={dateStr}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-surface-soft text-ink text-xs sm:text-[13px] font-mono font-normal"
                        >
                          <CalendarIcon className="w-3.5 h-3.5 text-mute shrink-0" />
                          <span>{displayStr}</span>
                          {targetNote.schedule?.isRecurring && (
                            <span className="text-[10px] text-primary uppercase font-bold tracking-wider ml-0.5">
                              (Rutin)
                            </span>
                          )}
                        </span>
                      );
                    })}
                </div>
              )}

              {/* Date & Time at the very bottom of notes content */}
              <div className="pt-3 pb-1 text-caption-xs text-mute font-mono select-none">
                <span>{formattedDate}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Datepicker Target Date Modal: Frontmost Layer */}
      {isDatePickerOpen && (
        <>
          <div
            className="fixed inset-0 z-[10001] bg-black/75 select-none pointer-events-auto"
            style={{ top: 0, left: 0, right: 0, bottom: 0 }}
            onClick={() => setIsDatePickerOpen(false)}
            aria-hidden="true"
          />

          <div
            className="fixed inset-0 z-[10002] flex items-center justify-center p-4 pointer-events-none select-none"
            style={{ top: 0, left: 0, right: 0, bottom: 0 }}
          >
            <div className="w-full max-w-sm sm:max-w-md rounded-2xl bg-canvas p-4 sm:p-5 text-ink pointer-events-auto shadow-2xl relative animate-in fade-in zoom-in-95 duration-100 flex flex-col gap-3">
              <div className="flex justify-center w-full">
                <Calendar
                  mode="multiple"
                  size="medium"
                  month={calendarMonth}
                  onMonthChange={setCalendarMonth}
                  selected={editScheduleDates
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
                      setEditScheduleDates([]);
                      return;
                    }
                    const formatted = Array.from(
                      new Set(dates.map((dt) => format(dt, 'yyyy-MM-dd')))
                    ).sort();
                    setEditScheduleDates(formatted);
                  }}
                />
              </div>

              <div className="flex items-center justify-between px-1 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs sm:text-caption-sm text-ink select-none font-medium">
                  <input
                    type="checkbox"
                    checked={editIsRecurring}
                    onChange={(e) => setEditIsRecurring(e.target.checked)}
                    className="w-4 h-4 rounded border-hairline text-primary focus:ring-primary/20 cursor-pointer accent-primary"
                  />
                  <span>Jadwal Rutin / Berulang (Habit)</span>
                </label>

                <button
                  type="button"
                  onClick={() => setIsDatePickerOpen(false)}
                  className="h-10 sm:h-11 px-7 rounded-full bg-primary text-on-primary text-body-sm font-semibold cursor-pointer hover:opacity-90 active:scale-95 transition-all shadow-xs !border-0"
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

export { NoteDetailModal as NoteModal };
