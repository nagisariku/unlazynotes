import React, { useState, useMemo, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Lock,
  KeyRound,
  Shield,
  Plus,
  Loader2,
  Pin,
  PinOff,
  X,
  ChevronRight,
  ChevronUp,
  FileText,
  Copy,
  Check,
  Pencil,
  Trash2,
  Send,
  Sparkles,
} from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { toast } from 'sonner';
import { Button, SearchPill } from '../ui';
import NoteCard from './NoteCard';
import EditNoteModal from './EditNoteModal';
import NoteDetailModal from './NoteDetailModal';
import type { CredentialType } from '../../db/schema';

export const CREDENTIAL_MACRO_CONFIG: Array<{
  type: CredentialType;
  title: string;
  id: string;
}> = [
  { type: 'account', title: 'Akun & Layanan', id: 'section-account' },
  { type: 'network', title: 'Jaringan & Perangkat', id: 'section-network' },
  { type: 'identity_finance', title: 'Finansial & Identitas', id: 'section-identity-finance' },
  { type: 'license', title: 'Kunci & Lisensi', id: 'section-license' },
  { type: 'other', title: 'Kredensial & Akses Lainnya', id: 'section-other' },
];

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export interface VaultNoteItem {
  id: string;
  content: string;
  category: string;
  credentialType?: CredentialType | string | null;
  specificTags?: string[] | null;
  source?: string | null;
  isEncrypted: boolean;
  vaultKey?: string | null;
  isPinned?: boolean;
  attachments?: any;
  createdAt: string;
}

interface VaultViewProps {
  initialVaultNotes: VaultNoteItem[];
  userName?: string | null;
}

// Helper: classify note into vault vs credential
function isVaultItem(item: VaultNoteItem): boolean {
  if (item.category === 'vault') return true;
  if (Boolean(item.vaultKey)) return true;
  if (item.specificTags?.some((t) => t.toLowerCase() === 'vault')) return true;
  return false;
}

// Dedicated Compact Vault Tile:
// - Desktop: compact w-fit cell box (key text only, pin & delete actions, click opens in right pane)
// - Mobile: full-width horizontal divider row (click expands & reveals full note content)
interface VaultCompactTileProps {
  note: VaultNoteItem;
  isSelected?: boolean;
  onDelete: (id: string) => Promise<void> | void;
  onTogglePin: (id: string, isPinned: boolean) => Promise<void> | void;
  onEdit?: (note: VaultNoteItem) => void;
  onClick: (note: VaultNoteItem) => void;
}

function VaultCompactTile({
  note,
  isSelected = false,
  onDelete,
  onTogglePin,
  onEdit,
  onClick,
}: VaultCompactTileProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPinning, setIsPinning] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (!mobile) setIsExpanded(false);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleTileClick = () => {
    const currentIsMobile = typeof window !== 'undefined' ? window.innerWidth < 1024 : isMobile;
    const selection = typeof window !== 'undefined' ? window.getSelection() : null;
    if (selection && selection.toString().trim().length > 0) {
      return;
    }

    if (currentIsMobile) {
      setIsExpanded((prev) => !prev);
    } else {
      onClick(note);
    }
  };

  const handleTogglePinInternal = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPinning) return;
    setIsPinning(true);
    try {
      await onTogglePin(note.id, !note.isPinned);
    } finally {
      setIsPinning(false);
    }
  };

  const handleCopyInternal = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(note.content);
      setCopied(true);
      toast.success('Isi catatan disalin');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Gagal menyalin');
    }
  };

  const handleEditInternal = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.(note);
  };

  const handleDeleteInternal = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    setIsDeleting(true);
    try {
      await onDelete(note.id);
    } finally {
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  };

  const displayKey = note.vaultKey?.trim() || note.content.slice(0, 30).trim() || 'Catatan Vault';

  if (isExpanded && isMobile) {
    return (
      <div
        onClick={handleTileClick}
        className="group relative flex flex-col justify-between w-full !bg-zinc-100 !border !border-hairline-strong !p-3 !rounded-lg my-1.5 shadow-xs cursor-default select-text transition-all"
      >
        {/* Top Header: Key name on left, Actions on right */}
        <div className="flex items-center justify-between gap-1.5 select-none">
          <span className="text-body-sm font-semibold text-ink truncate mr-2">
            {displayKey}
          </span>

          <div
            className="flex items-center gap-1 shrink-0 ml-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Pin Button */}
            <button
              type="button"
              onClick={handleTogglePinInternal}
              disabled={isPinning}
              className={`p-1.5 rounded-full cursor-pointer transition-colors ${
                note.isPinned
                  ? 'text-primary bg-surface-soft opacity-100'
                  : 'text-mute hover:text-ink hover:bg-surface-soft opacity-70'
              }`}
              title={note.isPinned ? 'Lepas Pin' : 'Pin Catatan'}
              aria-label="Pin Button"
            >
              {isPinning ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : note.isPinned ? (
                <PinOff className="w-4 h-4 fill-current" />
              ) : (
                <Pin className="w-4 h-4" />
              )}
            </button>

            {/* Copy Button */}
            <button
              type="button"
              onClick={handleCopyInternal}
              className="p-1.5 rounded-full text-mute hover:text-ink hover:bg-surface-soft cursor-pointer transition-colors"
              title="Salin isi catatan"
              aria-label="Salin catatan"
            >
              {copied ? (
                <Check className="w-4 h-4 text-terminal-green" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>

            {/* Edit Button */}
            {onEdit && (
              <button
                type="button"
                onClick={handleEditInternal}
                className="p-1.5 rounded-full text-mute hover:text-ink hover:bg-surface-soft cursor-pointer transition-colors"
                title="Edit catatan"
                aria-label="Edit catatan"
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}

            {/* Delete Button */}
            <button
              type="button"
              onClick={handleDeleteInternal}
              disabled={isDeleting}
              className={`p-1.5 rounded-full cursor-pointer transition-colors ${
                confirmDelete
                  ? 'text-terminal-red bg-terminal-red/10'
                  : 'text-mute hover:text-terminal-red hover:bg-surface-soft opacity-70'
              }`}
              title={confirmDelete ? 'Klik sekali lagi untuk hapus' : 'Hapus catatan'}
              aria-label="Delete Button"
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </button>

            {/* Collapse Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(false);
              }}
              className="p-1.5 rounded-full text-mute hover:text-ink hover:bg-surface-soft cursor-pointer transition-colors"
              title="Ciutkan catatan"
              aria-label="Ciutkan catatan"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Revealed Full Note Content (No divider line) */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="text-body-sm text-ink leading-relaxed break-words whitespace-pre-wrap select-text mt-2 pt-0"
        >
          {note.content}
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={handleTileClick}
      className={`group relative flex lg:inline-flex items-center justify-between w-full lg:w-fit lg:max-w-full px-2.5 py-2 lg:py-0 lg:h-10 lg:px-3 rounded-xl lg:rounded-lg border-0 lg:border border-hairline bg-canvas/40 lg:bg-canvas hover:bg-surface-soft cursor-pointer select-none text-left transition-all lg:shrink-0 ${
        isSelected ? 'lg:!border-ink lg:!bg-surface-soft lg:ring-1 lg:ring-ink lg:shadow-xs' : ''
      }`}
    >
      {/* Key text only - no icon */}
      <span
        className="text-body-sm font-medium text-ink truncate flex-1 lg:flex-initial max-w-[240px] lg:max-w-xs mr-2"
        title={displayKey}
      >
        {displayKey}
      </span>

      {/* Action buttons: Pin & Delete */}
      <div
        className="flex items-center gap-0.5 shrink-0 ml-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Pin Button */}
        <button
          type="button"
          onClick={handleTogglePinInternal}
          disabled={isPinning}
          className={`p-1.5 lg:p-1 rounded-md cursor-pointer transition-colors ${
            note.isPinned
              ? 'text-primary bg-surface-soft opacity-100'
              : 'text-mute hover:text-ink hover:bg-surface-soft opacity-60 group-hover:opacity-100'
          }`}
          title={note.isPinned ? 'Lepas Pin' : 'Pin Catatan'}
          aria-label="Pin Button"
        >
          {isPinning ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : note.isPinned ? (
            <PinOff className="w-4 h-4 fill-current" />
          ) : (
            <Pin className="w-4 h-4" />
          )}
        </button>

        {/* Delete Button */}
        <button
          type="button"
          onClick={handleDeleteInternal}
          disabled={isDeleting}
          className={`p-1.5 lg:p-1 rounded-md cursor-pointer transition-colors ${
            confirmDelete
              ? 'text-terminal-red bg-terminal-red/10'
              : 'text-mute hover:text-terminal-red hover:bg-surface-soft opacity-60 group-hover:opacity-100'
          }`}
          title={confirmDelete ? 'Klik sekali lagi untuk hapus' : 'Hapus catatan'}
          aria-label="Delete Button"
        >
          {isDeleting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Trash2 className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
}

export default function VaultView({ initialVaultNotes, userName }: VaultViewProps) {
  const [vaultNotes, setVaultNotes] = useState<VaultNoteItem[]>(initialVaultNotes);
  const [activeSection, setActiveSection] = useState<'credential' | 'vault'>('credential');
  const [activeTocKey, setActiveTocKey] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const topContentRef = useRef<HTMLDivElement>(null);
  const isUserClickingRef = useRef(false);

  const userLastName = useMemo(() => {
    if (!userName || !userName.trim()) return 'User';
    const parts = userName.trim().split(/\s+/);
    return parts[parts.length - 1];
  }, [userName]);

  // Expanded sections state for "Lihat Semua"
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  // Create Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newVaultKey, setNewVaultKey] = useState('');
  const [newSecretContent, setNewSecretContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const keyInputRef = useRef<HTMLInputElement>(null);
  const createTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea height for create modal
  const adjustCreateTextareaHeight = () => {
    const el = createTextareaRef.current;
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
  };

  useIsomorphicLayoutEffect(() => {
    if (isCreateModalOpen) {
      adjustCreateTextareaHeight();
    }
  }, [newSecretContent, isCreateModalOpen]);

  useEffect(() => {
    if (!isCreateModalOpen) return;
    const handleResize = () => adjustCreateTextareaHeight();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isCreateModalOpen]);

  useEffect(() => {
    if (isCreateModalOpen) {
      setTimeout(() => {
        adjustCreateTextareaHeight();
        if (activeSection === 'vault') {
          keyInputRef.current?.focus();
        } else {
          createTextareaRef.current?.focus();
        }
      }, 50);
    } else {
      setNewVaultKey('');
      setNewSecretContent('');
      setIsSubmitting(false);
    }
  }, [isCreateModalOpen, activeSection]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isCreateModalOpen && !isSubmitting) {
        setIsCreateModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCreateModalOpen, isSubmitting]);

  // Detail Modal State (Desktop click)
  const [selectedNoteForDetail, setSelectedNoteForDetail] = useState<VaultNoteItem | null>(null);

  // Edit Modal State
  const [editingItem, setEditingItem] = useState<VaultNoteItem | null>(null);

  // Lock body scroll when any modal is open
  useEffect(() => {
    if (isCreateModalOpen || editingItem || selectedNoteForDetail) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isCreateModalOpen, editingItem, selectedNoteForDetail]);

  // Desktop Master-Detail Pane States for Vault (Supports multi-item selection & search auto-display)
  const [selectedVaultItemIds, setSelectedVaultItemIds] = useState<string[]>([]);
  const [editingPaneNoteId, setEditingPaneNoteId] = useState<string | null>(null);
  const [paneEditKey, setPaneEditKey] = useState('');
  const [paneEditContent, setPaneEditContent] = useState('');
  const [isPaneSaving, setIsPaneSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  // Reset activeTocKey to 'all' and clear pane selection when switching sections
  const handleSectionSwitch = (section: 'credential' | 'vault') => {
    setActiveSection(section);
    setActiveTocKey('all');
    setSelectedVaultItemIds([]);
    setEditingPaneNoteId(null);
  };

  const handleSelectVaultItem = (note: VaultNoteItem) => {
    if (searchQuery.trim().length > 0) {
      setSelectedVaultItemIds((prev) =>
        prev.includes(note.id) ? prev.filter((id) => id !== note.id) : [...prev, note.id]
      );
      return;
    }
    setSelectedVaultItemIds((prev) =>
      prev.includes(note.id) ? prev.filter((id) => id !== note.id) : [...prev, note.id]
    );
  };

  const handleRemoveFromSelection = (id: string) => {
    setSelectedVaultItemIds((prev) => prev.filter((itemId) => itemId !== id));
    if (editingPaneNoteId === id) {
      setEditingPaneNoteId(null);
    }
  };

  const handlePaneCopy = async (note: VaultNoteItem) => {
    try {
      await navigator.clipboard.writeText(note.content);
      setCopiedId(note.id);
      toast.success('Isi catatan vault disalin');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('Gagal menyalin');
    }
  };

  const handleStartPaneEdit = (note: VaultNoteItem) => {
    setPaneEditKey(note.vaultKey || '');
    setPaneEditContent(note.content);
    setEditingPaneNoteId(note.id);
  };

  const handleCancelPaneEdit = () => {
    setEditingPaneNoteId(null);
    setPaneEditKey('');
    setPaneEditContent('');
  };

  const handleSavePaneEdit = async (noteId: string) => {
    if (isPaneSaving) return;
    if (!paneEditContent.trim()) {
      toast.error('Konten catatan tidak boleh kosong');
      return;
    }

    setIsPaneSaving(true);
    const keyVal = paneEditKey.trim() || null;
    const contentVal = paneEditContent.trim();

    try {
      const res = await fetch(`/api/notes/${noteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: contentVal,
          category: 'vault',
          specificTags: [],
          vaultKey: keyVal,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success || !data.note) {
        toast.error(data.error || 'Gagal menyimpan perubahan');
        return;
      }

      setVaultNotes((prev) =>
        prev.map((n) =>
          n.id === noteId ? { ...n, content: contentVal, vaultKey: keyVal } : n
        )
      );

      setEditingPaneNoteId(null);
      toast.success('Catatan vault berhasil diperbarui');
    } catch {
      toast.error('Terjadi kesalahan jaringan');
    } finally {
      setIsPaneSaving(false);
    }
  };

  const handlePaneDelete = async (note: VaultNoteItem) => {
    if (confirmDeleteId !== note.id) {
      setConfirmDeleteId(note.id);
      setTimeout(() => setConfirmDeleteId((prev) => (prev === note.id ? null : prev)), 3000);
      return;
    }

    setIsDeletingId(note.id);
    try {
      await handleDeleteNote(note.id);
      handleRemoveFromSelection(note.id);
    } finally {
      setIsDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const handlePaneTogglePin = async (note: VaultNoteItem) => {
    await handleTogglePin(note.id, !note.isPinned);
  };

  // 1. Filter notes belonging to active section
  const sectionNotes = useMemo(() => {
    return vaultNotes.filter((note) => {
      if (activeSection === 'vault') {
        return isVaultItem(note);
      }
      return !isVaultItem(note);
    });
  }, [vaultNotes, activeSection]);

  // 2. Filtered notes based on search query
  const filteredList = useMemo(() => {
    return sectionNotes.filter((note) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesKey = note.vaultKey?.toLowerCase().includes(q);
        const matchesTags = note.specificTags?.some((t) => t.toLowerCase().includes(q));
        const matchesContent = note.content.toLowerCase().includes(q);
        return Boolean(matchesKey || matchesTags || matchesContent);
      }
      return true;
    });
  }, [sectionNotes, searchQuery]);

  // Derived notes to display in the right-hand sidebar (auto-display on search or multi-selection)
  const displayedVaultNotes = useMemo(() => {
    if (searchQuery.trim().length > 0) {
      return filteredList;
    }
    return vaultNotes.filter((n) => selectedVaultItemIds.includes(n.id));
  }, [searchQuery, filteredList, vaultNotes, selectedVaultItemIds]);

  const isTileSelected = (noteId: string) => {
    if (searchQuery.trim().length > 0) {
      return filteredList.some((n) => n.id === noteId);
    }
    return selectedVaultItemIds.includes(noteId);
  };

  // 3. Pinned notes
  const pinnedNotes = useMemo(() => {
    return filteredList.filter((n) => Boolean(n.isPinned));
  }, [filteredList]);

  // 3b. Unpinned notes
  const unpinnedNotes = useMemo(() => {
    return filteredList.filter((n) => !n.isPinned);
  }, [filteredList]);

  // 6. Curated showcase gallery sections (Pure AI semantic credentialType or Vault)
  const curatedSections = useMemo(() => {
    if (activeSection === 'vault') {
      const otherNotes = unpinnedNotes;
      if (otherNotes.length > 0) {
        return [
          {
            key: 'other',
            title: 'Catatan Lainnya',
            items: otherNotes,
            id: 'section-other',
          },
        ];
      }
      return [];
    }

    // Credential: Pure Semantic AI Sub-type Grouping
    return CREDENTIAL_MACRO_CONFIG.map((conf) => {
      const items = filteredList.filter((note) => {
        const itemType = note.credentialType || 'other';
        return itemType === conf.type;
      });
      return {
        key: conf.type,
        title: conf.title,
        items,
        id: conf.id,
      };
    }).filter((sec) => sec.items.length > 0);
  }, [filteredList, unpinnedNotes, activeSection]);

  // 7. Compact TOC Items (Max 6–8 items synchronized with showcase sections)
  const tocItems = useMemo(() => {
    const items: Array<{
      key: string;
      label: string;
      count: number;
      id: string;
    }> = [];

    // 1. Semua
    items.push({
      key: 'all',
      label: 'Semua',
      count: filteredList.length,
      id: 'section-all',
    });

    // 2. Pinned
    if (pinnedNotes.length > 0) {
      items.push({
        key: 'pinned',
        label: 'Pinned',
        count: pinnedNotes.length,
        id: 'section-pinned',
      });
    }

    // 3. Curated Sections
    curatedSections.forEach((sec) => {
      items.push({
        key: sec.key,
        label: sec.title,
        count: sec.items.length,
        id: sec.id,
      });
    });

    return items;
  }, [filteredList.length, pinnedNotes.length, curatedSections]);

  // TOC click handler with smooth scrolling
  const handleTocClick = (itemKey: string, targetId: string) => {
    setActiveTocKey(itemKey);
    isUserClickingRef.current = true;
    setTimeout(() => {
      isUserClickingRef.current = false;
    }, 800);

    if (targetId === 'section-all') {
      topContentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    const targetEl = document.getElementById(targetId);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // ScrollSpy with IntersectionObserver to highlight active TOC item on scroll
  useEffect(() => {
    if (activeSection !== 'credential') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (isUserClickingRef.current) return;

        const allVisible = entries.find((e) => e.target.id === 'section-all' && e.isIntersecting);
        if (allVisible) {
          setActiveTocKey('all');
          return;
        }

        const visibleSection = entries.find(
          (e) => e.target.id !== 'section-all' && e.isIntersecting
        );
        if (visibleSection) {
          const found = tocItems.find((t) => t.id === visibleSection.target.id);
          if (found) {
            setActiveTocKey(found.key);
          }
        }
      },
      {
        rootMargin: '-10% 0px -65% 0px',
        threshold: 0,
      }
    );

    const sectionEls = document.querySelectorAll('[data-vault-section]');
    sectionEls.forEach((el) => observer.observe(el));

    if (topContentRef.current) {
      observer.observe(topContentRef.current);
    }

    return () => observer.disconnect();
  }, [tocItems]);

  // Actions
  const handleTogglePin = async (id: string, nextPinned: boolean) => {
    setVaultNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isPinned: nextPinned } : n))
    );

    try {
      const res = await fetch(`/api/notes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPinned: nextPinned }),
      });

      if (!res.ok) throw new Error('Failed to update pin');
      toast.success(nextPinned ? 'Catatan disematkan' : 'Sematan dilepas');
    } catch {
      setVaultNotes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isPinned: !nextPinned } : n))
      );
      toast.error('Gagal memperbarui sematan');
    }
  };

  const handleDeleteNote = async (id: string) => {
    try {
      const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setVaultNotes((prev) => prev.filter((n) => n.id !== id));
        setSelectedVaultItemIds((prev) => prev.filter((itemId) => itemId !== id));
        if (editingPaneNoteId === id) {
          setEditingPaneNoteId(null);
        }
        toast.success('Catatan berhasil dihapus');
      } else {
        toast.error('Gagal menghapus catatan');
      }
    } catch {
      toast.error('Terjadi kesalahan jaringan');
    }
  };

  const handleCreateKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleCreate();
    }
  };

  const handleCreate = async () => {
    const isVault = activeSection === 'vault';
    const key = isVault ? newVaultKey.trim() : '';
    const secret = newSecretContent.trim();
    if (!secret || isSubmitting) return;

    setIsSubmitting(true);
    const baseTags = isVault ? [] : ['credential'];
    const finalCategory = isVault ? 'vault' : 'credential';

    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: secret,
          category: finalCategory,
          isEncrypted: true,
          vaultKey: isVault && key ? key : undefined,
          specificTags: baseTags,
        }),
      });

      const data = await res.json();
      if (res.ok && data.note) {
        const newNoteItem: VaultNoteItem = {
          id: data.note.id,
          content: secret,
          category: data.note.category,
          specificTags: isVault ? [] : data.note.specificTags,
          source: data.note.source,
          isEncrypted: true,
          vaultKey: isVault && key ? key : undefined,
          isPinned: false,
          createdAt: data.note.createdAt,
        };
        setVaultNotes((prev) => [newNoteItem, ...prev]);
        if (isVault) {
          setSelectedVaultItemIds((prev) => [newNoteItem.id, ...prev]);
        }
        setNewVaultKey('');
        setNewSecretContent('');
        setIsCreateModalOpen(false);
        toast.success(
          `Berhasil disimpan ke ${isVault ? 'Vault' : 'Credential'}!`
        );
      } else {
        toast.error(data.error || 'Gagal menyimpan');
      }
    } catch {
      toast.error('Terjadi kesalahan jaringan');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleSectionExpand = (sectionKey: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  // Render note card for Credential section (standard timeline NoteCard)
  const renderCardItem = (note: VaultNoteItem) => {
    return (
      <NoteCard
        key={note.id}
        note={{
          ...note,
          createdAt: note.createdAt,
        }}
        variant="timeline"
        showDateTime={false}
        showTags={true}
        showCategory={false}
        onDelete={handleDeleteNote}
        onTogglePin={(id, isPinned) => handleTogglePin(id, isPinned)}
        onEdit={(n) => {
          setEditingItem(n as VaultNoteItem);
        }}
        onClick={(n) => {
          setSelectedNoteForDetail(n as VaultNoteItem);
        }}
      />
    );
  };

  // Section Grid Helper matching Bookmarks Showcase Layout
  const renderCardSection = (
    title: string,
    items: VaultNoteItem[],
    sectionKey: string,
    sectionId: string
  ) => {
    if (items.length === 0) return null;

    const isExpanded = Boolean(expandedSections[sectionKey]);
    const displayItems = isExpanded ? items : items.slice(0, 5);
    const hasMore = items.length > 5;

    return (
      <div
        key={sectionKey}
        id={sectionId}
        data-vault-section
        className="space-y-3.5 scroll-mt-6 sm:scroll-mt-8"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl sm:text-2xl font-normal text-ink tracking-tight font-sans">
            {title}
          </h2>

          {hasMore && (
            <button
              type="button"
              onClick={() => toggleSectionExpand(sectionKey)}
              className="text-caption-sm text-body hover:text-ink font-mono cursor-pointer flex items-center gap-1"
            >
              <span>{isExpanded ? 'Tampilkan Lebih Sedikit' : 'Lihat Semua'}</span>
              <ChevronRight
                className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              />
            </button>
          )}
        </div>

        <div className="w-full max-w-[1760px] columns-1 md:columns-[280px] md:[column-width:280px] lg:columns-[310px] lg:[column-width:310px] gap-3.5 md:gap-4 [column-gap:0.875rem] md:[column-gap:1rem]">
          {displayItems.map((note) => renderCardItem(note))}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-full flex flex-col lg:flex-row min-w-0 bg-canvas text-ink relative overflow-hidden">


      {/* =========================================================================
          LEFT / MIDDLE COLUMN: Main Content Space (Header, Controls, Notes List)
          ========================================================================= */}
      <div className="flex-1 min-w-0 h-full overflow-y-auto px-4 sm:px-6 md:px-8 pb-32 sm:pb-8 md:pb-12">
        {/* 1. Header: Title and Subtitle */}
        <div className="pt-3.5 sm:pt-6 pb-2 sm:pb-3">
          <div className="flex items-center gap-3">
            <h1 className="text-display-lg sm:text-display-xl text-ink font-semibold tracking-tight flex items-baseline gap-2.5 flex-wrap">
              <span>{userLastName}</span>
              <span className="font-tangerine tangerine-bold text-[1.15em] leading-none inline-block">
                {activeSection === 'vault' ? 'Vault' : 'Credentials'}
              </span>
            </h1>
          </div>
          <p className="text-body-sm text-body mt-0.5">
            {activeSection === 'vault'
              ? 'Brankas terenkripsi AES-256-GCM untuk dokumen, recovery keys, dan catatan sensitif Anda.'
              : 'Penyimpanan terenkripsi aman untuk akun bank, crypto wallet, API keys, dan kata sandi.'}
          </p>
        </div>

        {/* 2. Controls Row: Segmented Control (Radio) + Searchbox (Sticky on Mobile & Desktop, solid white background flush at top) */}
        <div className="sticky top-0 z-20 bg-canvas -mx-4 px-4 sm:-mx-6 sm:px-6 md:-mx-8 md:px-8 py-2.5 flex items-center gap-2 sm:gap-2.5 flex-nowrap">
          {/* Segmented Radio Button Control */}
          <div className="inline-flex items-center p-1 rounded-full border border-hairline bg-surface-soft shrink-0">
            <button
              type="button"
              role="radio"
              aria-checked={activeSection === 'credential'}
              onClick={() => handleSectionSwitch('credential')}
              className={`px-3 sm:px-4 py-1.5 rounded-full text-caption-sm font-medium cursor-pointer transition-colors ${
                activeSection === 'credential'
                  ? 'bg-canvas text-ink shadow-xs font-semibold'
                  : 'text-body hover:text-ink'
              }`}
            >
              Credential
            </button>

            <button
              type="button"
              role="radio"
              aria-checked={activeSection === 'vault'}
              onClick={() => handleSectionSwitch('vault')}
              className={`px-3 sm:px-4 py-1.5 rounded-full text-caption-sm font-medium cursor-pointer transition-colors ${
                activeSection === 'vault'
                  ? 'bg-canvas text-ink shadow-xs font-semibold'
                  : 'text-body hover:text-ink'
              }`}
            >
              Vault
            </button>
          </div>

          {/* Search Box */}
          <SearchPill
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            wrapperClassName="flex-1 min-w-0 sm:flex-initial sm:w-72 md:w-80"
            placeholder={
              activeSection === 'credential'
                ? 'Cari kredensial & rahasia...'
                : 'Cari catatan vault...'
            }
          />
        </div>

        {/* 3. Main Content: Empty State, Vault Compact Grid View, or Credential Split View */}
        <div className="mt-4 sm:mt-5">
        {sectionNotes.length === 0 ? (
          /* Empty State when no notes exist in active section (Centered, No TOC) */
          <div className="flex flex-col items-center justify-center pt-16 sm:pt-20 pb-16 text-center mx-auto max-w-md w-full">
            <div className="w-12 h-12 rounded-full bg-surface-soft flex items-center justify-center text-body mb-4">
              {activeSection === 'vault' ? (
                <Lock className="w-6 h-6" />
              ) : (
                <KeyRound className="w-6 h-6" />
              )}
            </div>
            <h2 className="text-heading-lg text-ink font-semibold mb-2">
              Belum ada catatan {activeSection === 'vault' ? 'vault' : 'credential'}
            </h2>
            <p className="text-body-sm text-body max-w-sm leading-relaxed">
              {activeSection === 'vault'
                ? 'Simpan catatan terenkripsi, kunci pemulihan, atau dokumen rahasia Anda dengan tombol Tambah Vault di bawah.'
                : 'Simpan akun bank, token API, atau kata sandi penting Anda dengan tombol Tambah Credential di bawah.'}
            </p>
          </div>
        ) : activeSection === 'vault' ? (
          /* =====================================================================
             VAULT VIEW: Tiles List (Single-column on mobile, flex-wrap on desktop)
             ===================================================================== */
          <div className="w-full space-y-6">
            {filteredList.length === 0 ? (
              /* Search / Filter Empty Result */
              <div className="flex flex-col items-center justify-center pt-16 sm:pt-20 pb-16 text-center mx-auto max-w-md w-full">
                <div className="w-12 h-12 rounded-full bg-surface-soft flex items-center justify-center text-body mb-4">
                  <FileText className="w-6 h-6" />
                </div>
                <h2 className="text-heading-lg text-ink font-semibold mb-2">
                  Tidak ada catatan yang cocok
                </h2>
                <p className="text-body-sm text-body max-w-sm leading-relaxed">
                  Tidak ditemukan catatan vault dengan kata kunci &quot;{searchQuery}&quot;.
                </p>
              </div>
            ) : pinnedNotes.length > 0 ? (
              <div className="space-y-6">
                {/* Pinned Section */}
                <div className="space-y-2.5">
                  <span className="text-body-sm font-medium text-ink block">Pinned</span>
                  <div className="w-full flex flex-col lg:flex-row lg:flex-wrap items-stretch lg:items-center gap-0 lg:gap-2.5">
                    {pinnedNotes.map((note) => (
                      <VaultCompactTile
                        key={note.id}
                        note={note}
                        isSelected={isTileSelected(note.id)}
                        onDelete={handleDeleteNote}
                        onTogglePin={handleTogglePin}
                        onEdit={(n) => setEditingItem(n)}
                        onClick={(n) => handleSelectVaultItem(n)}
                      />
                    ))}
                  </div>
                </div>

                {/* Unpinned Section */}
                {unpinnedNotes.length > 0 && (
                  <div className="space-y-2.5">
                    <span className="text-body-sm font-medium text-ink block">Semua Vault</span>
                    <div className="w-full flex flex-col lg:flex-row lg:flex-wrap items-stretch lg:items-center gap-0 lg:gap-2.5">
                      {unpinnedNotes.map((note) => (
                        <VaultCompactTile
                          key={note.id}
                          note={note}
                          isSelected={isTileSelected(note.id)}
                          onDelete={handleDeleteNote}
                          onTogglePin={handleTogglePin}
                          onEdit={(n) => setEditingItem(n)}
                          onClick={(n) => handleSelectVaultItem(n)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full flex flex-col lg:flex-row lg:flex-wrap items-stretch lg:items-center gap-0 lg:gap-2.5">
                {filteredList.map((note) => (
                  <VaultCompactTile
                    key={note.id}
                    note={note}
                    isSelected={isTileSelected(note.id)}
                    onDelete={handleDeleteNote}
                    onTogglePin={handleTogglePin}
                    onEdit={(n) => setEditingItem(n)}
                    onClick={(n) => handleSelectVaultItem(n)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          /* =====================================================================
             CREDENTIAL VIEW: TOC Sidebar + Curated Showcase Sections
             ===================================================================== */
          <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 items-start w-full">
            {/* =====================================================================
                LEFT COLUMN: TOC (Sticky on Mobile & Desktop below sticky controls row)
                ===================================================================== */}
            <div className="w-[calc(100%+2rem)] sm:w-48 shrink-0 sticky top-14 sm:top-16 z-10 sm:z-auto bg-canvas sm:bg-transparent -mx-4 px-4 sm:mx-0 sm:px-0 py-1.5 sm:py-0 self-start">
              <div className="flex sm:flex-col gap-1 overflow-x-auto sm:overflow-visible pb-1 sm:pb-0 items-start sm:items-end no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden pr-4 sm:pr-0">
                {tocItems.map((item) => {
                  const isActive = activeTocKey === item.key;

                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => handleTocClick(item.key, item.id)}
                      className={`py-1.5 px-3 rounded-full text-body-sm font-normal cursor-pointer flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                        isActive
                          ? 'bg-primary text-on-primary'
                          : 'text-body hover:text-ink hover:bg-surface-soft'
                      }`}
                    >
                      <span>{item.label}</span>
                      <span className="text-xs sm:text-[13px] font-mono opacity-85 tabular-nums">
                        {item.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* =====================================================================
                RIGHT COLUMN: MAIN CONTENT SPACE (Matching BookmarksView structure)
                ===================================================================== */}
            <div
              ref={topContentRef}
              id="section-all"
              data-vault-section
              className="flex-1 min-w-0 w-full space-y-8"
            >
              {/* 1. Section Pinned (if any pinned notes exist) */}
              {pinnedNotes.length > 0 && (
                <div
                  id="section-pinned"
                  data-vault-section
                  className="space-y-3.5 scroll-mt-6 sm:scroll-mt-8"
                >
                  <h2 className="text-xl sm:text-2xl font-normal text-ink tracking-tight font-sans">
                    Pinned
                  </h2>

                  <div className="w-full max-w-[1760px] columns-1 md:columns-[280px] md:[column-width:280px] lg:columns-[310px] lg:[column-width:310px] gap-3.5 md:gap-4 [column-gap:0.875rem] md:[column-gap:1rem]">
                    {pinnedNotes.map((note) => renderCardItem(note))}
                  </div>
                </div>
              )}

              {/* 2. Curated Sections */}
              {curatedSections.map((sec) =>
                renderCardSection(sec.title, sec.items, sec.key, sec.id)
              )}

              {/* 3. Search / Filter Empty Result */}
              {filteredList.length === 0 && (
                <div className="flex flex-col items-center justify-center pt-16 sm:pt-20 pb-16 text-center mx-auto max-w-md w-full">
                  <div className="w-12 h-12 rounded-full bg-surface-soft flex items-center justify-center text-body mb-4">
                    <FileText className="w-6 h-6" />
                  </div>
                  <h2 className="text-heading-lg text-ink font-semibold mb-2">
                    Tidak ada catatan yang cocok
                  </h2>
                  <p className="text-body-sm text-body max-w-sm leading-relaxed">
                    {searchQuery
                      ? `Tidak ditemukan catatan dengan kata kunci "${searchQuery}".`
                      : 'Tidak ada catatan pada kategori ini.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
        </div>
      </div>

      {/* =========================================================================
          RIGHT COLUMN: DEDICATED FULL-HEIGHT VAULT SIDEBAR (Desktop Only)
          Clean canvas, no top header banner, no footer, borderless content
          ========================================================================= */}
      {activeSection === 'vault' && (
        <aside className="hidden lg:flex flex-col w-[420px] xl:w-[480px] 2xl:w-[540px] h-full border-l border-hairline bg-canvas shrink-0 select-none">
          {displayedVaultNotes.length > 0 ? (
            /* Multi-item or Search Result List with Vertical Scroll */
            <div className="flex-1 overflow-y-auto py-4 select-text divide-y divide-hairline">
              {displayedVaultNotes.map((note) => {
                const isEditingThisNote = editingPaneNoteId === note.id;
                const isCopied = copiedId === note.id;
                const isConfirmDeleting = confirmDeleteId === note.id;
                const isDeletingThis = isDeletingId === note.id;

                return (
                  <div key={note.id} className="px-5 py-3.5 first:pt-0 last:pb-0 space-y-2.5">
                    {/* Top Actions Row */}
                    <div className="flex items-center justify-end gap-1.5">
                      {!isEditingThisNote ? (
                        <>
                          {/* Pin Button */}
                          <button
                            type="button"
                            onClick={() => handlePaneTogglePin(note)}
                            className={`p-1.5 rounded-md cursor-pointer transition-colors ${
                              note.isPinned
                                ? 'text-primary bg-surface-soft'
                                : 'text-mute hover:text-ink hover:bg-surface-soft'
                            }`}
                            title={note.isPinned ? 'Lepas Pin' : 'Pin Catatan'}
                            aria-label="Pin Catatan"
                          >
                            {note.isPinned ? (
                              <PinOff className="w-4.5 h-4.5 fill-current" />
                            ) : (
                              <Pin className="w-4.5 h-4.5" />
                            )}
                          </button>

                          {/* Copy Button */}
                          <button
                            type="button"
                            onClick={() => handlePaneCopy(note)}
                            className="p-1.5 rounded-md text-mute hover:text-ink hover:bg-surface-soft cursor-pointer transition-colors"
                            title="Salin isi catatan"
                            aria-label="Salin isi catatan"
                          >
                            {isCopied ? (
                              <Check className="w-4.5 h-4.5 text-terminal-green" />
                            ) : (
                              <Copy className="w-4.5 h-4.5" />
                            )}
                          </button>

                          {/* Edit Button */}
                          <button
                            type="button"
                            onClick={() => handleStartPaneEdit(note)}
                            className="p-1.5 rounded-md text-mute hover:text-ink hover:bg-surface-soft cursor-pointer transition-colors"
                            title="Edit catatan"
                            aria-label="Edit catatan"
                          >
                            <Pencil className="w-4.5 h-4.5" />
                          </button>

                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={() => handlePaneDelete(note)}
                            disabled={isDeletingThis}
                            className={`p-1.5 rounded-md cursor-pointer transition-colors ${
                              isConfirmDeleting
                                ? 'text-terminal-red bg-terminal-red/10'
                                : 'text-mute hover:text-terminal-red hover:bg-surface-soft'
                            }`}
                            title={isConfirmDeleting ? 'Klik sekali lagi untuk hapus' : 'Hapus catatan'}
                            aria-label="Hapus catatan"
                          >
                            {isDeletingThis ? (
                              <Loader2 className="w-4.5 h-4.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-4.5 h-4.5" />
                            )}
                          </button>

                          {/* Close / Unselect Button */}
                          <button
                            type="button"
                            onClick={() => handleRemoveFromSelection(note.id)}
                            className="p-1.5 rounded-md text-mute hover:text-ink hover:bg-surface-soft cursor-pointer transition-colors ml-1"
                            title="Tutup dari panel"
                            aria-label="Tutup dari panel"
                          >
                            <X className="w-4.5 h-4.5" />
                          </button>
                        </>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleCancelPaneEdit}
                            disabled={isPaneSaving}
                            className="px-3 py-1 rounded-lg border border-hairline text-body-sm font-medium text-body hover:text-ink hover:bg-surface-soft cursor-pointer transition-colors"
                          >
                            Batalkan
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSavePaneEdit(note.id)}
                            disabled={isPaneSaving}
                            className="px-3.5 py-1 rounded-lg bg-primary text-on-primary text-body-sm font-medium hover:opacity-90 cursor-pointer transition-opacity flex items-center gap-1.5 shadow-xs"
                          >
                            {isPaneSaving ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Menyimpan...</span>
                              </>
                            ) : (
                              'Simpan'
                            )}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Item Body: View vs Edit */}
                    {isEditingThisNote ? (
                      <div className="space-y-2.5">
                        {/* Key Input: Key icon + borderless input (no box, no label) */}
                        <div className="flex items-center gap-2">
                          <KeyRound className="w-4 h-4 text-mute shrink-0" />
                          <input
                            type="text"
                            value={paneEditKey}
                            onChange={(e) => setPaneEditKey(e.target.value)}
                            placeholder="Key / Identifier (misal: AWS_SECRET_KEY)"
                            className="w-full bg-transparent border-0 p-0 text-body-md font-mono text-ink leading-relaxed focus:outline-none focus:ring-0 placeholder:text-mute/50"
                            autoFocus
                          />
                        </div>

                        {/* Secret Content Textarea: Borderless on canvas (no box, no label) */}
                        <textarea
                          value={paneEditContent}
                          onChange={(e) => setPaneEditContent(e.target.value)}
                          placeholder="Masukkan data atau rahasia yang ingin disimpan..."
                          className="w-full bg-transparent border-0 p-0 text-body-sm font-mono text-ink leading-relaxed focus:outline-none focus:ring-0 resize-y min-h-[140px] placeholder:text-mute/50"
                        />
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {/* Key Display: Key icon beside key value (no label) */}
                        <div className="flex items-center gap-2 text-body-md font-normal text-ink font-mono break-words leading-relaxed">
                          <KeyRound className="w-4 h-4 text-mute shrink-0" />
                          <span className="select-text">{note.vaultKey?.trim() || 'Tanpa Key'}</span>
                        </div>

                        {/* Secret Content Display (no label, borderless) */}
                        <div className="font-mono text-body-sm text-ink leading-relaxed break-words whitespace-pre-wrap select-text selection:bg-primary/20">
                          {note.content}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* EMPTY STATE: Clean space when no items selected or matching search */
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 select-none">
              <div className="w-14 h-14 rounded-2xl bg-surface-soft flex items-center justify-center text-mute mb-4">
                <KeyRound className="w-6 h-6 stroke-[1.5]" />
              </div>
              <h3 className="text-body-md font-semibold text-ink mb-1.5">
                Ruang Catatan Vault
              </h3>
              <p className="text-body-sm text-mute max-w-[280px] leading-relaxed">
                Pilih satu atau beberapa item di sebelah kiri untuk melihat detail catatan atau cari kata kunci untuk menampilkan langsung.
              </p>
            </div>
          )}
        </aside>
      )}

      {/* =========================================================================
          4. MODAL: CREATE NEW SECRET NOTE (CREDENTIAL OR VAULT)
          ========================================================================= */}
      {isCreateModalOpen && typeof document !== 'undefined' && createPortal(
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
                  {activeSection === 'vault' ? 'Catatan Vault Baru' : 'Kredensial Baru'}
                </span>

                <div className="flex items-center gap-2">
                  {/* On Mobile: Simpan button */}
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={isSubmitting || !newSecretContent.trim()}
                    className={`sm:hidden h-8 px-3.5 rounded-full flex items-center justify-center gap-1 text-caption-xs font-semibold cursor-pointer transition-all ${
                      newSecretContent.trim() && !isSubmitting
                        ? 'bg-primary text-on-primary hover:opacity-90 active:scale-95'
                        : 'bg-surface-soft text-mute cursor-not-allowed opacity-60'
                    }`}
                    title={activeSection === 'vault' ? 'Simpan Catatan Vault' : 'Simpan Catatan Kredensial'}
                    aria-label="Simpan catatan"
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
                    onClick={() => setIsCreateModalOpen(false)}
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
                  {/* Extra field Key ONLY for Vault */}
                  {activeSection === 'vault' && (
                    <div className="flex items-center gap-2.5 sm:gap-3">
                      <label className="text-body-sm sm:text-body-md font-mono text-body uppercase tracking-wider shrink-0 font-medium select-none">
                        Key
                      </label>
                      <div className="flex items-center gap-2 px-3 py-1.5 sm:py-2 rounded-lg bg-surface-soft w-full max-w-xs sm:max-w-sm">
                        <KeyRound className="w-4 h-4 text-mute shrink-0" />
                        <input
                          ref={keyInputRef}
                          type="text"
                          value={newVaultKey}
                          onChange={(e) => setNewVaultKey(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              createTextareaRef.current?.focus();
                            }
                          }}
                          placeholder="Masukkan nama key / label vault..."
                          className="w-full bg-transparent text-ink text-body-sm font-semibold focus:outline-none placeholder:text-mute font-sans"
                        />
                      </div>
                    </div>
                  )}

                  {/* Textarea: natural writing canvas without borders */}
                  <textarea
                    ref={createTextareaRef}
                    value={newSecretContent}
                    onChange={(e) => {
                      setNewSecretContent(e.target.value);
                      const el = e.target;
                      el.style.height = 'auto';
                      const isMobile = window.innerWidth < 640;
                      const minH = isMobile ? 180 : 220;
                      el.style.height = `${Math.max(el.scrollHeight, minH)}px`;
                    }}
                    onKeyDown={handleCreateKeyDown}
                    placeholder={
                      activeSection === 'vault'
                        ? 'Tulis isi catatan rahasia yang ingin dienkripsi...'
                        : 'Tulis isi catatan kredensial...'
                    }
                    className="w-full bg-transparent text-ink placeholder:text-mute text-body-md leading-relaxed resize-none focus:outline-none font-sans select-text min-h-[180px] sm:min-h-[220px] p-0 border-0 overflow-hidden block"
                  />
                </div>

                {/* Bottom Section */}
                <div>
                  <div className="pt-6 pb-2 flex flex-wrap items-center justify-between gap-3 select-none">
                    {/* Left grouping */}
                    <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
                      {/* Category Pill */}
                      <span className="px-3.5 py-1.5 rounded-full bg-surface-soft text-ink text-xs sm:text-[13px] font-sans font-normal">
                        {activeSection === 'vault' ? 'vault' : 'credential'}
                      </span>
                    </div>

                    {/* Right grouping (Desktop only) */}
                    <div className="hidden sm:flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleCreate}
                        disabled={isSubmitting || !newSecretContent.trim()}
                        className={`h-9 sm:h-10 px-4 sm:px-5 rounded-full flex items-center justify-center gap-1.5 text-caption-sm font-semibold cursor-pointer transition-all ${
                          newSecretContent.trim() && !isSubmitting
                            ? 'bg-primary text-on-primary hover:opacity-90 active:scale-95'
                            : 'bg-surface-soft text-mute cursor-not-allowed opacity-60'
                        }`}
                        title={activeSection === 'vault' ? 'Simpan Catatan Vault (Ctrl+Enter)' : 'Simpan Catatan Kredensial (Ctrl+Enter)'}
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

                  {/* Date & Time at the very bottom */}
                  <div className="pt-3 pb-1 text-caption-xs text-mute font-mono select-none">
                    <span>
                      {format(new Date(), 'EEEE, d MMMM yyyy • HH:mm', { locale: localeId }) + ' WIB'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* =========================================================================
          5. MODAL: NOTE DETAIL (Desktop click to view detail)
          ========================================================================= */}
      {selectedNoteForDetail && (
        <NoteDetailModal
          isOpen={Boolean(selectedNoteForDetail)}
          note={{
            ...selectedNoteForDetail,
            createdAt: selectedNoteForDetail.createdAt,
          }}
          isVault={isVaultItem(selectedNoteForDetail)}
          onClose={() => setSelectedNoteForDetail(null)}
          onEdit={(n) => {
            setSelectedNoteForDetail(null);
            setEditingItem(n as VaultNoteItem);
          }}
          onDelete={(id) => {
            handleDeleteNote(id);
            setSelectedNoteForDetail(null);
          }}
          onTogglePin={(id, isPinned) => {
            handleTogglePin(id, isPinned);
          }}
        />
      )}

      {/* =========================================================================
          6. MODAL: EDIT NOTE
          ========================================================================= */}
      {editingItem && (
        <EditNoteModal
          isOpen={Boolean(editingItem)}
          note={editingItem}
          isVault={isVaultItem(editingItem)}
          onClose={() => setEditingItem(null)}
          onSave={(updated) => {
            setVaultNotes((prev) =>
              prev.map((n) => (n.id === updated.id ? { ...n, ...updated } : n))
            );
            setEditingItem(null);
            toast.success('Catatan berhasil diperbarui');
          }}
        />
      )}

      {/* Floating Action Button: Add Credential / Vault in bottom-right corner */}
      <button
        type="button"
        onClick={() => setIsCreateModalOpen(true)}
        className={`fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-40 w-14 h-14 sm:w-auto sm:h-auto p-0 sm:py-3 sm:px-6 rounded-full bg-canvas text-ink border border-hairline shadow-md hover:bg-surface-soft active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer ${
          activeSection === 'vault' ? 'lg:right-[444px] xl:right-[504px] 2xl:right-[564px]' : ''
        }`}
        title={activeSection === 'credential' ? 'Tambah Credential' : 'Tambah Vault'}
        aria-label={activeSection === 'credential' ? 'Tambah Credential' : 'Tambah Vault'}
      >
        <span className="hidden sm:inline text-body-sm font-medium">
          {activeSection === 'credential' ? 'Tambah Credential' : 'Tambah Vault'}
        </span>
        <Plus className="w-7 h-7 sm:w-4.5 sm:h-4.5 text-ink" />
      </button>
    </div>
  );
}
