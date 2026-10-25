import { useState, useEffect, useMemo, useRef } from 'react';
import {
  SlidersHorizontal,
  ListChecks,
  FileText,
  Send,
  Bot,
  ChevronLeft,
  ChevronRight,
  Plus,
  Sparkles,
  Loader2,
  Archive,
  ArchiveRestore,
  Trash2,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import NoteCard from './NoteCard';
import NoteDetailModal from './NoteDetailModal';
import EditNoteModal from './EditNoteModal';
import QuickComposerModal from './QuickComposerModal';
import NotesFilterPopover, { type FilterState } from './NotesFilterPopover';
import { toast } from 'sonner';
import { Button, SearchPill, ConfirmDialog } from '../ui';

export interface FeatureCardItem {
  title: string;
  href?: string;
  onClick?: () => void;
  illustration?: string | React.ReactNode;
}

export interface NoteItem {
  id: string;
  content: string;
  category: string;
  specificTags?: string[] | null;
  source?: string | null;
  isEncrypted?: boolean;
  vaultKey?: string | null;
  isPinned?: boolean;
  isProcessed?: boolean;
  targetDate?: string | Date | null;
  scheduleDates?: string[] | null;
  schedule?: any;
  expenses?: any;
  income?: any;
  debt?: any;
  bookmarkType?: string | null;
  credentialType?: string | null;
  attachments?: any;
  expiresAt?: string | Date | null;
  isArchived?: boolean;
  createdAt: string;
}

export interface CategoryCounts {
  todo?: number;
  schedule?: number;
  bookmarks?: number;
  vault?: number;
}

interface NotesTimelineProps {
  initialNotes: NoteItem[];
  userName?: string | null;
  isTelegramConnected?: boolean;
  telegramConnectUrl?: string;
  categoryCounts?: CategoryCounts;
}

const DEFAULT_FILTERS: FilterState = {
  dateRange: 'all',
  startDate: '',
  endDate: '',
  selectedCategories: [],
  showOnlyUncategorized: false,
};

export default function NotesTimeline({
  initialNotes,
  userName,
  isTelegramConnected = false,
  telegramConnectUrl = 'https://t.me/unlazynotes_bot',
}: NotesTimelineProps) {
  // Security Invariant: Filter out credential / encrypted notes from Workspace ("Credentials not showed!")
  const [notes, setNotes] = useState<NoteItem[]>(() =>
    initialNotes.filter((n) => n.category !== 'credential' && !n.isEncrypted)
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Manage Mode / Bulk Cleaning States
  const [isManageMode, setIsManageMode] = useState(false);
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());
  const [isBulkLoading, setIsBulkLoading] = useState(false);

  // Quick Web Note Composer Modal State (textbox now a popup)
  const [isComposerOpen, setIsComposerOpen] = useState(false);

  // Note Detail & Edit Modal States
    const [telegramConnected, setTelegramConnected] = useState(isTelegramConnected);

  useEffect(() => {
    setTelegramConnected(isTelegramConnected);
  }, [isTelegramConnected]);

  // Auto-detect Telegram connection without manual page refresh
  useEffect(() => {
    if (telegramConnected) return;

    let isSubscribed = true;
    const checkTelegramStatus = async () => {
      try {
        const res = await fetch('/api/telegram/status');
        if (res.ok) {
          const data = await res.json();
          if (data.connected && isSubscribed) {
            setTelegramConnected(true);
            toast.success('Akun Telegram berhasil terhubung!');
          }
        }
      } catch {}
    };

    const onWindowFocus = () => {
      checkTelegramStatus();
    };
    window.addEventListener('focus', onWindowFocus);

    const interval = setInterval(checkTelegramStatus, 4000);

    return () => {
      isSubscribed = false;
      window.removeEventListener('focus', onWindowFocus);
      clearInterval(interval);
    };
  }, [telegramConnected]);

  const [selectedNoteForDetail, setSelectedNoteForDetail] = useState<NoteItem | null>(null);
  const [editingNote, setEditingNote] = useState<NoteItem | null>(null);
  const openedFromDetailRef = useRef(false);
  const [isSyncingAi, setIsSyncingAi] = useState(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);

  // Horizontal Carousel Ref & Handlers for Pinned Shelf
  const pinnedCarouselRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const hasDraggedRef = useRef(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    const el = pinnedCarouselRef.current;
    if (!el) return;
    isDraggingRef.current = true;
    hasDraggedRef.current = false;
    startXRef.current = e.pageX - el.offsetLeft;
    scrollLeftRef.current = el.scrollLeft;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const el = pinnedCarouselRef.current;
    if (!el) return;
    const x = e.pageX - el.offsetLeft;
    const walk = (x - startXRef.current) * 1.5;
    if (Math.abs(walk) > 5) {
      hasDraggedRef.current = true;
    }
    el.scrollLeft = scrollLeftRef.current - walk;
  };

  const handleMouseUpOrLeave = () => {
    isDraggingRef.current = false;
  };

  const handleCardClick = (note: NoteItem) => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return; // Do not open detail modal on mobile
    }
    if (hasDraggedRef.current) {
      hasDraggedRef.current = false;
      return;
    }
    setSelectedNoteForDetail(note);
  };

  const scrollPinned = (direction: 'left' | 'right') => {
    const el = pinnedCarouselRef.current;
    if (!el) return;
    const scrollAmount = Math.max(300, el.clientWidth * 0.7);
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  // Horizontal Carousel Ref & Handlers for Uncategorized Notes Shelf
  const uncategorizedCarouselRef = useRef<HTMLDivElement>(null);
  const isDraggingUncatRef = useRef(false);
  const startXUncatRef = useRef(0);
  const scrollLeftUncatRef = useRef(0);
  const hasDraggedUncatRef = useRef(false);

  const handleUncatMouseDown = (e: React.MouseEvent) => {
    const el = uncategorizedCarouselRef.current;
    if (!el) return;
    isDraggingUncatRef.current = true;
    hasDraggedUncatRef.current = false;
    startXUncatRef.current = e.pageX - el.offsetLeft;
    scrollLeftUncatRef.current = el.scrollLeft;
  };

  const handleUncatMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingUncatRef.current) return;
    const el = uncategorizedCarouselRef.current;
    if (!el) return;
    const x = e.pageX - el.offsetLeft;
    const walk = (x - startXUncatRef.current) * 1.5;
    if (Math.abs(walk) > 5) {
      hasDraggedUncatRef.current = true;
    }
    el.scrollLeft = scrollLeftUncatRef.current - walk;
  };

  const handleUncatMouseUpOrLeave = () => {
    isDraggingUncatRef.current = false;
  };

  const handleUncatCardClick = (note: NoteItem) => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return; // Do not open detail modal on mobile
    }
    if (hasDraggedUncatRef.current) {
      hasDraggedUncatRef.current = false;
      return;
    }
    setSelectedNoteForDetail(note);
  };

  const scrollUncategorized = (direction: 'left' | 'right') => {
    const el = uncategorizedCarouselRef.current;
    if (!el) return;
    const scrollAmount = Math.max(300, el.clientWidth * 0.7);
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  // Shortcut Feature Cards (Square 1:1, borderless, extensible for illustrations/visuals)
  const featureCards: FeatureCardItem[] = useMemo(() => [
    {
      title: 'Add new notes',
      onClick: () => setIsComposerOpen(true),
    },
    {
      title: 'To Do',
      href: '/dashboard/todo',
    },
    {
      title: 'Schedule',
      href: '/dashboard/schedule',
    },
    {
      title: 'Bookmarks',
      href: '/dashboard/bookmarks',
    },
    {
      title: 'Credentials',
      href: '/dashboard/vault',
    },
  ], []);

  // Global keyboard shortcut to open composer: 'c' or 'n' when not typing in an input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === 'c' || e.key === 'n' || e.key === '+') &&
        !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName) &&
        !isComposerOpen &&
        !selectedNoteForDetail &&
        !editingNote &&
        !isFilterOpen
      ) {
        e.preventDefault();
        setIsComposerOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isComposerOpen, selectedNoteForDetail, editingNote, isFilterOpen]);

  // Initialize filters from URL search params on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q') || '';
    const cat = params.get('category') || '';
    const cats = params.get('categories') || '';
    const range = (params.get('range') as any) || 'all';
    const start = params.get('startDate') || '';
    const end = params.get('endDate') || '';
    const uncategorized = params.get('uncategorized') === 'true';

    if (q) setSearchQuery(q);

    let parsedCategories: string[] = [];
    if (cats) {
      parsedCategories = cats.split(',').map((c) => c.trim()).filter(Boolean);
    } else if (cat) {
      parsedCategories = [cat];
    }

    setFilters({
      dateRange: ['all', 'today', 'this_week', 'this_month', 'custom'].includes(range)
        ? range
        : 'all',
      startDate: start,
      endDate: end,
      selectedCategories: parsedCategories,
      showOnlyUncategorized: uncategorized,
    });
  }, []);

  // Update browser URL query params whenever filters change
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set('q', searchQuery.trim());
    if (filters.selectedCategories.length > 0) {
      params.set('categories', filters.selectedCategories.join(','));
    }
    if (filters.showOnlyUncategorized) {
      params.set('uncategorized', 'true');
    }
    if (filters.dateRange !== 'all') {
      params.set('range', filters.dateRange);
    }
    if (filters.startDate) params.set('startDate', filters.startDate);
    if (filters.endDate) params.set('endDate', filters.endDate);

    const newUrl = params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname;
    window.history.replaceState(window.history.state, '', newUrl);
  }, [searchQuery, filters]);

  const handleDeleteNote = (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (selectedNoteForDetail?.id === id) {
      setSelectedNoteForDetail(null);
    }
    toast.success('Catatan berhasil dihapus');
  };

  const handleTagClick = (tag: string) => {
    setSearchQuery(tag);
    toast.info(`Memfilter catatan dengan #${tag}`);
  };

  const handleNoteUpdated = (updatedNote: NoteItem) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === updatedNote.id ? updatedNote : n))
    );
    if (selectedNoteForDetail?.id === updatedNote.id) {
      setSelectedNoteForDetail(updatedNote);
    }
  };

  const handleTogglePin = (id: string, isPinned: boolean) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isPinned } : n))
    );
    if (selectedNoteForDetail?.id === id) {
      setSelectedNoteForDetail((prev) => (prev ? { ...prev, isPinned } : null));
    }
    toast.success(isPinned ? 'Catatan dipin ke atas' : 'Pin catatan dilepas');
  };

  const handleToggleSelectNote = (id: string) => {
    setSelectedNoteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleBulkAction = (action: 'archive' | 'restore' | 'delete') => {
    if (selectedNoteIds.size === 0 || isBulkLoading) return;

    if (action === 'delete') {
      setIsBulkDeleteModalOpen(true);
      return;
    }

    executeBulkAction(action);
  };

  const executeBulkAction = async (action: 'archive' | 'restore' | 'delete') => {
    if (selectedNoteIds.size === 0 || isBulkLoading) return;
    const noteIds = Array.from(selectedNoteIds);

    setIsBulkLoading(true);
    const toastId = toast.loading(
      action === 'archive'
        ? 'Mengarsipkan catatan...'
        : action === 'restore'
        ? 'Memulihkan catatan...'
        : 'Menghapus catatan...'
    );

    // Optimistic UI update
    const backupNotes = [...notes];
    setNotes((prev) => prev.filter((n) => !selectedNoteIds.has(n.id)));
    setSelectedNoteIds(new Set());
    setIsBulkDeleteModalOpen(false);

    try {
      const res = await fetch('/api/notes/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, noteIds }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal memproses aksi massal');
      }

      toast.success(
        action === 'archive'
          ? `${data.count} catatan berhasil diarsipkan`
          : action === 'restore'
          ? `${data.count} catatan berhasil dipulihkan`
          : `${data.count} catatan berhasil dihapus permanen`,
        { id: toastId }
      );
    } catch (err: any) {
      console.error('Bulk action error:', err);
      setNotes(backupNotes); // Revert on error
      toast.error(err.message || 'Gagal mengeksekusi aksi massal', { id: toastId });
    } finally {
      setIsBulkLoading(false);
    }
  };

  // Called when a new note is optimistically created from QuickComposerModal
  const handleNoteCreatedFromModal = (newNote: NoteItem) => {
    setNotes((prev) => [newNote, ...prev]);
  };

  const handleRestoreNote = (restoredNote: any) => {
    setNotes((prev) => [
      {
        ...restoredNote,
        createdAt:
          typeof restoredNote.createdAt === 'string'
            ? restoredNote.createdAt
            : new Date(restoredNote.createdAt).toISOString(),
      } as NoteItem,
      ...prev,
    ]);
  };

  const handleNoteSyncedWithReal = (tempId: string, realNote: NoteItem) => {
    setNotes((prev) => prev.map((n) => (n.id === tempId ? realNote : n)));
  };

  // Sync and auto-categorize uncategorized notes via AI pipeline
  const handleSyncWithAi = async () => {
    if (isSyncingAi) return;
    setIsSyncingAi(true);
    const toastId = toast.loading('Menghubungkan ke AI untuk mengkategorikan catatan...');

    try {
      const res = await fetch('/api/notes/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal sinkronisasi catatan dengan AI');
      }

      if (data.updatedCount > 0 && Array.isArray(data.updatedNotes)) {
        const updatedMap = new Map<string, NoteItem>(
          data.updatedNotes.map((n: NoteItem) => [n.id, n])
        );

        setNotes((prev) =>
          prev.map((n) => (updatedMap.has(n.id) ? updatedMap.get(n.id)! : n))
        );

        toast.success(
          `${data.updatedCount} catatan berhasil disinkronisasi & dikategorikan oleh AI`,
          { id: toastId }
        );
      } else {
        toast.info(
          'Semua catatan telah sinkron. Tidak ada kategori baru yang perlu diperbarui.',
          { id: toastId }
        );
      }
    } catch (err: any) {
      console.error('AI Sync error:', err);
      toast.error(err.message || 'Gagal sinkronisasi dengan AI', { id: toastId });
    } finally {
      setIsSyncingAi(false);
    }
  };

  // Filter notes client-side
  const filteredNotes = useMemo(() => {
    return notes.filter((n) => {
      // 1. Search Query Multi-token Matching
      if (searchQuery.trim()) {
        const queryTokens = searchQuery
          .toLowerCase()
          .split(/\s+/)
          .filter(Boolean);

        const contentLower = n.content.toLowerCase();
        const categoryLower = n.category.toLowerCase();
        const tagsLower = (n.specificTags || []).map((t) => t.toLowerCase());

        const isMatch = queryTokens.every((token) => {
          if (token.startsWith('#')) {
            const cleanTag = token.substring(1);
            return tagsLower.some((t) => t.includes(cleanTag));
          }
          return (
            contentLower.includes(token) ||
            categoryLower.includes(token) ||
            tagsLower.some((t) => t.includes(token))
          );
        });

        if (!isMatch) return false;
      }

      // 2. Category & Archive Filter
      const isArchivedSelected = filters.selectedCategories.includes('archived');
      if (isArchivedSelected) {
        if (!n.isArchived) return false;
        const otherCats = filters.selectedCategories.filter((c) => c !== 'archived');
        if (otherCats.length > 0 && !otherCats.includes(n.category)) {
          return false;
        }
      } else {
        if (n.isArchived) return false;
        if (filters.selectedCategories.length > 0) {
          if (!filters.selectedCategories.includes(n.category)) {
            return false;
          }
        }
      }

      // 4. Date range filter
      if (filters.dateRange !== 'all') {
        const noteDate = new Date(n.createdAt);
        const now = new Date();

        if (filters.dateRange === 'custom') {
          if (filters.startDate) {
            const start = new Date(filters.startDate);
            if (noteDate < start) return false;
          }
          if (filters.endDate) {
            const end = new Date(filters.endDate);
            end.setHours(23, 59, 59, 999);
            if (noteDate > end) return false;
          }
        } else {
          const diffMs = now.getTime() - noteDate.getTime();
          const diffDays = diffMs / (1000 * 60 * 60 * 24);

          if (filters.dateRange === 'today' && diffDays > 1) return false;
          if (filters.dateRange === 'this_week' && diffDays > 7) return false;
          if (filters.dateRange === 'this_month' && diffDays > 30) return false;
        }
      }

      return true;
    });
  }, [notes, searchQuery, filters, isManageMode]);

  // Helper to determine if note is uncategorized
  const isUncategorizedNote = (note: NoteItem) => {
    if (note.isProcessed) {
      return note.category === 'uncategorized';
    }
    const cat = (note.category || '').toLowerCase().trim();
    return cat === 'others' || cat === 'uncategorized' || cat === '';
  };

  // Group filtered notes into Pinned section, Uncategorized section, and Date groups along timeline axis
  const { pinnedNotes, uncategorizedNotes, dateGroups } = useMemo(() => {
    const pinned: NoteItem[] = [];
    const uncategorized: NoteItem[] = [];
    const unpinned: NoteItem[] = [];

    for (const note of filteredNotes) {
      if (note.isPinned) {
        pinned.push(note);
      } else {
        unpinned.push(note);
      }

      if (isUncategorizedNote(note)) {
        uncategorized.push(note);
      }
    }

    // Helper to check if a date is today
    const isDateToday = (d: Date) => {
      const now = new Date();
      return (
        d.getDate() === now.getDate() &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear()
      );
    };

    // Group unpinned notes by date (with 'Today' label for today's notes)
    const groups: { dateKey: string; notes: NoteItem[] }[] = [];
    const groupMap = new Map<string, NoteItem[]>();

    for (const note of unpinned) {
      const noteDate = new Date(note.createdAt);
      const dateKey = isDateToday(noteDate) ? 'Today' : format(noteDate, 'EEE, d MMM');
      if (!groupMap.has(dateKey)) {
        groupMap.set(dateKey, []);
      }
      groupMap.get(dateKey)!.push(note);
    }

    for (const [dateKey, list] of groupMap.entries()) {
      groups.push({ dateKey, notes: list });
    }

    return { pinnedNotes: pinned, uncategorizedNotes: uncategorized, dateGroups: groups };
  }, [filteredNotes]);

  const activeFilterCount =
    filters.selectedCategories.length +
    (filters.dateRange !== 'all' ? 1 : 0);

  const clearAllFilters = () => {
    setSearchQuery('');
    setFilters(DEFAULT_FILTERS);
  };

  // Dynamic time-based greeting: Good Morning / Afternoon / Evening
  const dynamicGreeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Good Morning';
    if (hour >= 12 && hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  const userLastName = useMemo(() => {
    if (!userName || !userName.trim()) return 'User';
    const parts = userName.trim().split(/\s+/);
    return parts[parts.length - 1];
  }, [userName]);

  return (
    <div className="w-full max-w-full px-4 sm:px-6 md:px-8 pb-32 sm:pb-12 bg-canvas text-ink relative">
            {/* Top Header Row: Workspace Title & Connect Telegram */}
      <div className="pt-3.5 sm:pt-6 pb-2 sm:pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-display-lg sm:text-display-xl text-ink font-semibold tracking-tight flex items-baseline gap-2.5 flex-wrap">
          <span>{userLastName}</span>
          <span className="font-tangerine tangerine-bold text-[1.15em] leading-none inline-block">
            Workspace
          </span>
        </h1>

        {/* Right: Hubungkan Telegram / Buka Bot button */}
        <div className="flex items-center gap-3 self-start sm:self-center shrink-0">
          {!telegramConnected && (
            <span className="text-body-sm text-ink font-medium">
              Hubungkan Telegram
            </span>
          )}
          <a
            href={telegramConnectUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block"
          >
            <Button variant="secondary" className="gap-2 h-10 px-5 font-semibold rounded-full cursor-pointer text-body-sm">
              <Send className="w-4 h-4" />
              <span>{telegramConnected ? 'Buka Bot' : 'Hubungkan'}</span>
            </Button>
          </a>
        </div>
      </div>

      {/* Section: Greeting & Feature Cards (One unified section with space from heading 'Workspace') */}
      <div className="mt-4 sm:mt-5 mb-5 sm:mb-6">
        <div>
          <p className="text-3xl sm:text-4xl md:text-5xl font-normal tracking-tight text-ink">
            {dynamicGreeting}
          </p>
          <p className="text-body-sm text-body font-normal mt-1 sm:mt-1.5">
            Organisir ide, to-do list, tautan, dan draf secara instan.
          </p>
        </div>

        {/* Shortcut Feature Cards: Responsive fluid grid that keeps cards prominent across all screens */}
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5 gap-2 md:gap-2.5 lg:gap-3 w-full max-w-full 2xl:max-w-[140rem] mt-5">
          {featureCards.map((card) => {
            const cardClasses =
              "w-full aspect-square rounded-2xl sm:rounded-3xl bg-surface-soft hover:bg-hairline/60 flex flex-col items-center justify-center p-4 sm:p-6 2xl:p-8 cursor-pointer text-center select-none transition-all";

            const cardInner = (
              <>
                {card.illustration && (
                  <div className="mb-2 max-w-[60%] max-h-[60%] flex items-center justify-center">
                    {typeof card.illustration === 'string' ? (
                      <img src={card.illustration} alt={card.title} className="max-w-full max-h-full object-contain" />
                    ) : (
                      card.illustration
                    )}
                  </div>
                )}
                <span className="text-body-md sm:text-heading-xs md:text-heading-sm font-semibold text-ink">
                  {card.title}
                </span>
              </>
            );

            if (card.onClick) {
              return (
                <button
                  key={card.title}
                  type="button"
                  onClick={card.onClick}
                  className={cardClasses}
                >
                  {cardInner}
                </button>
              );
            }

            return (
              <a
                key={card.title}
                href={card.href}
                className={cardClasses}
              >
                {cardInner}
              </a>
            );
          })}
        </div>
      </div>

      {/* Section: Action & Controls Row (Sticky on Mobile & Desktop, solid white background flush at top) */}
      <div className="sticky top-0 z-20 bg-canvas -mx-4 px-4 sm:-mx-6 sm:px-6 md:-mx-8 md:px-8 py-2.5">
        <div className="flex items-center justify-between gap-2 w-full">
          {/* Left: Button 'Pilih Semua' (Only in Manage Mode) */}
          {isManageMode ? (
            <button
              type="button"
              onClick={() => {
                if (selectedNoteIds.size === filteredNotes.length && filteredNotes.length > 0) {
                  setSelectedNoteIds(new Set());
                } else {
                  setSelectedNoteIds(new Set(filteredNotes.map((n) => n.id)));
                }
              }}
              className="h-10 px-3.5 sm:px-4 rounded-full text-caption-sm sm:text-body-sm font-medium bg-surface-soft hover:bg-hairline/60 text-ink cursor-pointer transition-colors whitespace-nowrap shrink-0 !border-0"
            >
              {selectedNoteIds.size === filteredNotes.length && filteredNotes.length > 0
                ? 'Batal Pilih'
                : 'Pilih Semua'}
            </button>
          ) : (
            <div />
          )}

          {/* Right side: Kelola Catatan Toggle Icon Button + Searchbox + Filter button */}
          <div className="flex items-center gap-2 shrink-0 ml-auto">
            {/* Kelola Catatan Toggle Button (Icon only, proper icon, no label, no emoji) */}
            <button
              type="button"
              onClick={() => {
                setIsManageMode(!isManageMode);
                setSelectedNoteIds(new Set());
              }}
              className={`w-10 h-10 rounded-full flex items-center justify-center cursor-pointer shrink-0 transition-colors !border-0 ${
                isManageMode
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-soft text-ink hover:bg-canvas'
              }`}
              title={isManageMode ? 'Selesai kelola' : 'Kelola catatan'}
              aria-label="Toggle kelola catatan"
            >
              <ListChecks className="w-4.5 h-4.5" />
            </button>

            {/* Searchbox */}
            <SearchPill
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
            />

            {/* Filter button -> toggle filter menu */}
            <button
              type="button"
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`w-10 h-10 rounded-full flex items-center justify-center cursor-pointer shrink-0 relative transition-colors ${
                isFilterOpen || activeFilterCount > 0
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-soft text-ink hover:bg-canvas'
              }`}
              title="Filter catatan"
              aria-label="Toggle filter menu"
            >
              <SlidersHorizontal className="w-4.5 h-4.5" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-terminal-yellow text-primary font-bold text-[9px] flex items-center justify-center font-sans">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Filter Popover Component */}
        <NotesFilterPopover
          isOpen={isFilterOpen}
          onClose={() => setIsFilterOpen(false)}
          currentFilters={filters}
          onApply={(newFilters) => setFilters(newFilters)}
          onReset={() => setFilters(DEFAULT_FILTERS)}
        />
      </div>

      {/* Section: Pinned Shelf (Horizontal scroll carousel with natural content-based height) */}
      {pinnedNotes.length > 0 && (
        <div className="mt-8 sm:mt-10 w-full space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl sm:text-2xl font-normal text-ink tracking-tight font-sans">
                Pinned
              </h2>
              <p className="text-body-sm text-body mt-0.5">
                Catatan penting yang disematkan agar selalu mudah diakses.
              </p>
            </div>
            {/* Scroll navigation buttons for desktop mouse users */}
            {pinnedNotes.length > 1 && (
              <div className="hidden sm:flex items-center gap-1.5 self-end">
                <button
                  type="button"
                  onClick={() => scrollPinned('left')}
                  className="w-8 h-8 rounded-full bg-surface-soft hover:bg-canvas text-ink flex items-center justify-center cursor-pointer transition-colors"
                  title="Scroll ke kiri"
                  aria-label="Scroll left"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollPinned('right')}
                  className="w-8 h-8 rounded-full bg-surface-soft hover:bg-canvas text-ink flex items-center justify-center cursor-pointer transition-colors"
                  title="Scroll ke kanan"
                  aria-label="Scroll right"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div
            ref={pinnedCarouselRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUpOrLeave}
            onMouseLeave={handleMouseUpOrLeave}
            className="w-full overflow-x-auto flex items-start gap-3.5 pb-2.5 pt-0.5 cursor-grab active:cursor-grabbing select-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          >
            {pinnedNotes.map((note) => {
              const isWide = note.category === 'draft' || note.category === 'reference';
              const cardMaxWidthClass = isWide
                ? 'max-w-[340px] sm:max-w-[420px] md:max-w-[500px]'
                : 'max-w-[260px] sm:max-w-[300px] md:max-w-[340px]';

              return (
                <div
                  key={note.id}
                  className={`w-fit min-w-[180px] sm:min-w-[200px] ${cardMaxWidthClass} shrink-0 self-start transition-all`}
                >
                  <NoteCard
                    note={note}
                    showDateTime={true}
                    maxHeight="max-h-56"
                    isSelectable={isManageMode}
                    isSelected={selectedNoteIds.has(note.id)}
                    onToggleSelect={handleToggleSelectNote}
                    onDelete={handleDeleteNote}
                    onRestore={handleRestoreNote}
                    onTagClick={handleTagClick}
                    onTogglePin={handleTogglePin}
                    onEdit={(n) => {
                      openedFromDetailRef.current = false;
                      setEditingNote(n as NoteItem);
                    }}
                    onClick={() => handleCardClick(note)}
                    className="mb-0 h-auto"
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Section: Uncategorized Notes Shelf (Horizontal scroll carousel matching Pinned) */}
      {uncategorizedNotes.length > 0 && (
        <div className="mt-8 sm:mt-10 w-full space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
              <div>
                <h2 className="text-xl sm:text-2xl font-normal text-ink tracking-tight font-sans">
                  Uncategorized Notes
                </h2>
                <p className="text-body-sm text-body mt-0.5">
                  Koleksi catatan yang belum ditentukan kategorinya.
                </p>
              </div>

              <button
                type="button"
                onClick={handleSyncWithAi}
                disabled={isSyncingAi}
                className="inline-flex items-center gap-2 px-4 h-9 rounded-full bg-surface-soft hover:bg-surface-soft/80 text-ink text-body-sm font-medium disabled:opacity-50 cursor-pointer transition-colors select-none"
                title="Sinkronisasi dan kategorisasikan catatan secara otomatis menggunakan AI"
              >
                {isSyncingAi ? (
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                ) : (
                  <Sparkles className="w-4 h-4 text-primary" />
                )}
                <span>{isSyncingAi ? 'Syncing...' : 'Sync with AI'}</span>
              </button>
            </div>

            {/* Scroll navigation buttons for desktop mouse users */}
            {uncategorizedNotes.length > 1 && (
              <div className="hidden sm:flex items-center gap-1.5 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => scrollUncategorized('left')}
                  className="w-8 h-8 rounded-full bg-surface-soft hover:bg-canvas text-ink flex items-center justify-center cursor-pointer transition-colors"
                  title="Scroll ke kiri"
                  aria-label="Scroll left"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollUncategorized('right')}
                  className="w-8 h-8 rounded-full bg-surface-soft hover:bg-canvas text-ink flex items-center justify-center cursor-pointer transition-colors"
                  title="Scroll ke kanan"
                  aria-label="Scroll right"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div
            ref={uncategorizedCarouselRef}
            onMouseDown={handleUncatMouseDown}
            onMouseMove={handleUncatMouseMove}
            onMouseUp={handleUncatMouseUpOrLeave}
            onMouseLeave={handleUncatMouseUpOrLeave}
            className="w-full overflow-x-auto flex items-start gap-3.5 pb-2.5 pt-0.5 cursor-grab active:cursor-grabbing select-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          >
            {uncategorizedNotes.map((note) => {
              const isWide = note.category === 'draft' || note.category === 'reference';
              const cardMaxWidthClass = isWide
                ? 'max-w-[340px] sm:max-w-[420px] md:max-w-[500px]'
                : 'max-w-[260px] sm:max-w-[300px] md:max-w-[340px]';

              return (
                <div
                  key={note.id}
                  className={`w-fit min-w-[180px] sm:min-w-[200px] ${cardMaxWidthClass} shrink-0 self-start transition-all`}
                >
                  <NoteCard
                    note={note}
                    showDateTime={true}
                    showCategory={false}
                    maxHeight="max-h-56"
                    isSelectable={isManageMode}
                    isSelected={selectedNoteIds.has(note.id)}
                    onToggleSelect={handleToggleSelectNote}
                    onDelete={handleDeleteNote}
                    onRestore={handleRestoreNote}
                    onTagClick={handleTagClick}
                    onTogglePin={handleTogglePin}
                    onEdit={(n) => {
                      openedFromDetailRef.current = false;
                      setEditingNote(n as NoteItem);
                    }}
                    onClick={() => handleUncatCardClick(note)}
                    className="mb-0 h-auto"
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Section: Timeline / Main Workspace Notes Content Area (Generous gap to timeline) */}
      <div className="mt-10 sm:mt-14 w-full">
        <div className="mb-3 sm:mb-4">
          <h2 className="text-xl sm:text-2xl font-normal text-ink tracking-tight font-sans">
            Notes Collection
          </h2>
          <p className="text-body-sm text-body mt-0.5">
            Seluruh linimasa catatan, ide, draf, dan tautan tersimpan.
          </p>
        </div>

        {notes.length === 0 ? (
          /* Wireframe 1 Empty State: "Belum ada catatan" + description */
          <div className="flex flex-col items-center justify-center pt-16 sm:pt-20 pb-16 text-center mx-auto max-w-md">
            <div className="w-12 h-12 rounded-full bg-surface-soft flex items-center justify-center text-body mb-4">
              <Bot className="w-6 h-6" />
            </div>
            <h2 className="text-heading-lg text-ink font-semibold mb-2">
              Belum ada catatan
            </h2>
            <p className="text-body-sm text-body max-w-sm leading-relaxed">
              Tulis catatan pertama Anda dengan tombol New Note di bawah atau melalui bot Telegram.
            </p>
          </div>
        ) : filteredNotes.length === 0 ? (
          /* Empty Search/Filter Result State */
          <div className="flex flex-col items-center justify-center pt-12 pb-16 text-center mx-auto max-w-md">
            <div className="w-12 h-12 rounded-full bg-surface-soft flex items-center justify-center text-body mb-4">
              <FileText className="w-6 h-6" />
            </div>
            <h2 className="text-heading-lg text-ink font-semibold mb-2">
              Tidak ada catatan yang cocok
            </h2>
            <p className="text-body-sm text-body max-w-sm leading-relaxed mb-5">
              Coba sesuaikan kata kunci pencarian atau ubah parameter filter Anda.
            </p>
            <Button onClick={clearAllFilters} variant="secondary">
              Bersihkan Filter
            </Button>
          </div>
        ) : (
          /* Timeline Vertical Track with Date Groups */
          <div className="relative pl-0 w-full max-w-full">
            <div className="space-y-10 sm:space-y-12">
              {dateGroups.map((group, groupIdx) => {
                const isLastItem = groupIdx === dateGroups.length - 1;

                return (
                  <div
                    key={group.dateKey}
                    className="relative flex flex-col md:flex-row items-start gap-3 md:gap-5"
                  >
                    {/* Connecting spine segment (stops at the last timeline item - no trailing line) */}
                    {!isLastItem && (
                      <div className="hidden md:block absolute left-[111px] top-[16px] -bottom-[56px] w-0.5 bg-hairline pointer-events-none" />
                    )}

                    {/* Timeline Axis Date Label (Rata kanan, no dot & no line on mobile, enlarged font) */}
                    <div className="w-full md:w-28 shrink-0 flex items-center justify-end text-right text-ink pt-1 md:pr-4 relative pb-1 md:pb-0">
                      {/* Bullet node on timeline (Desktop only) */}
                      <div
                        className={`hidden md:block absolute -right-[5px] top-[11px] w-2.5 h-2.5 rounded-full z-10 ${
                          group.dateKey === 'Today' ? 'bg-primary' : 'bg-hairline-strong'
                        }`}
                      />
                      <span
                        className={`text-xl md:text-body-md font-semibold whitespace-nowrap tracking-tight ${
                          group.dateKey === 'Today' ? 'text-ink font-sans' : 'text-body font-mono'
                        }`}
                      >
                        {group.dateKey}
                      </span>
                    </div>

                    {/* Right Cards Masonry Gallery (Option A: rigid-width ~320px & instant wrap to new row) */}
                    <div className="flex-1 w-full min-w-0 max-w-[90rem] columns-1 md:columns-[300px] md:[column-width:300px] lg:columns-[320px] lg:[column-width:320px] gap-3.5 [column-gap:0.875rem]">
                      {group.notes.map((note) => (
                        <NoteCard
                          key={note.id}
                          note={note}
                          variant="timeline"
                          maxHeight="max-h-64"
                          isSelectable={isManageMode}
                          isSelected={selectedNoteIds.has(note.id)}
                          onToggleSelect={handleToggleSelectNote}
                          onDelete={handleDeleteNote}
                          onRestore={handleRestoreNote}
                          onTagClick={handleTagClick}
                          onTogglePin={handleTogglePin}
                          onEdit={(n) => {
                      openedFromDetailRef.current = false;
                      setEditingNote(n as NoteItem);
                    }}
                          onClick={(n) => {
                            if (typeof window !== 'undefined' && window.innerWidth < 768) {
                              return; // Do not open detail modal on mobile
                            }
                            setSelectedNoteForDetail(n as NoteItem);
                          }}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

            {/* Quick Composer Modal Popup matching wireframe 2 */}
      <QuickComposerModal
        isOpen={isComposerOpen}
        onClose={() => setIsComposerOpen(false)}
        onNoteCreated={handleNoteCreatedFromModal}
        onNoteSynced={handleNoteSyncedWithReal}
      />

      {/* Notes Detail Modal */}
      <NoteDetailModal
        note={selectedNoteForDetail}
        isOpen={Boolean(selectedNoteForDetail)}
        onClose={() => setSelectedNoteForDetail(null)}
        onEdit={(n) => {
          openedFromDetailRef.current = true;
          setSelectedNoteForDetail(null);
          setEditingNote(n);
        }}
        onDelete={handleDeleteNote}
        onTogglePin={handleTogglePin}
      />

      {/* Edit Note Modal */}
      <EditNoteModal
        note={editingNote}
        isOpen={Boolean(editingNote)}
        onClose={() => {
          setEditingNote(null);
          openedFromDetailRef.current = false;
        }}
        onCancel={() => {
          const noteToRestore = editingNote;
          const wasFromDetail = openedFromDetailRef.current;
          setEditingNote(null);
          openedFromDetailRef.current = false;
          if (noteToRestore && wasFromDetail) {
            setSelectedNoteForDetail(noteToRestore);
          }
        }}
        onSave={(updatedNote) => {
          openedFromDetailRef.current = false;
          handleNoteUpdated(updatedNote);
        }}
      />

      {/* Floating Action Button: Add Note in bottom-right corner */}
      <button
        type="button"
        onClick={() => setIsComposerOpen(true)}
        className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-40 w-14 h-14 sm:w-auto sm:h-auto p-0 sm:py-3 sm:px-6 rounded-full bg-canvas text-ink border border-hairline shadow-md hover:bg-surface-soft active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
        title="Tambah Catatan Baru"
        aria-label="New Note"
      >
        <span className="hidden sm:inline text-body-sm font-medium">New Note</span>
        <Plus className="w-7 h-7 sm:w-4.5 sm:h-4.5 text-ink" />
      </button>

      {/* Floating Bottom Toolbar for Bulk Manage (Design System: Paper-white, hairline border, standard typography) */}
      {isManageMode && selectedNoteIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-canvas text-ink border border-hairline shadow-lg rounded-full px-3.5 sm:px-5 py-2 flex items-center gap-2 sm:gap-3 select-none max-w-[calc(100vw-2rem)]">
          <span className="text-body-sm text-body font-normal whitespace-nowrap pl-1 pr-1 flex items-center gap-1">
            <strong className="text-ink font-semibold">{selectedNoteIds.size}</strong>
            <span className="hidden sm:inline">dipilih</span>
          </span>
          <div className="flex items-center gap-1.5 sm:gap-2">
            {filters.selectedCategories.includes('archived') ? (
              <button
                type="button"
                disabled={isBulkLoading}
                onClick={() => handleBulkAction('restore')}
                className="h-9 w-9 sm:w-auto sm:px-4 rounded-full flex items-center justify-center gap-1.5 text-button-md font-medium bg-primary text-on-primary hover:bg-ink-deep active:scale-95 cursor-pointer disabled:opacity-50 transition-all !border-0"
                title="Pulihkan Semua"
                aria-label="Pulihkan Semua"
              >
                {isBulkLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArchiveRestore className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">Pulihkan Semua</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={isBulkLoading}
                onClick={() => handleBulkAction('archive')}
                className="h-9 w-9 sm:w-auto sm:px-4 rounded-full flex items-center justify-center gap-1.5 text-button-md font-medium bg-primary text-on-primary hover:bg-ink-deep active:scale-95 cursor-pointer disabled:opacity-50 transition-all !border-0"
                title="Arsipkan Semua"
                aria-label="Arsipkan Semua"
              >
                {isBulkLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Archive className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">Arsipkan Semua</span>
              </button>
            )}
            <button
              type="button"
              disabled={isBulkLoading}
              onClick={() => handleBulkAction('delete')}
              className="h-9 w-9 sm:w-auto sm:px-4 rounded-full flex items-center justify-center gap-1.5 text-button-md font-medium bg-surface-soft hover:bg-terminal-red/10 hover:text-terminal-red text-ink active:scale-95 cursor-pointer disabled:opacity-50 transition-all !border-0"
              title="Hapus Permanen"
              aria-label="Hapus Permanen"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Hapus Permanen</span>
            </button>
            <button
              type="button"
              disabled={isBulkLoading}
              onClick={() => setSelectedNoteIds(new Set())}
              className="h-9 w-9 sm:w-auto sm:px-3 rounded-full flex items-center justify-center gap-1 text-button-md font-medium text-body hover:text-ink hover:bg-surface-soft active:scale-95 cursor-pointer transition-all !border-0"
              title="Batal"
              aria-label="Batal"
            >
              <X className="w-4 h-4" />
              <span className="hidden sm:inline text-caption-sm">Batal</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
