import { useState, useEffect, useMemo } from 'react';
import {
  Trash2,
  Pin,
  PinOff,
  Loader2,
  Copy,
  Check,
  Pencil,
  ChevronUp,
  ExternalLink,
  FileIcon,
  ImageIcon,
  Globe,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { id as localeId } from 'date-fns/locale';
import { extractBookmarkThumbnail } from '../../lib/utils';
import type { BookmarkMeta } from '@/db/schema';
import {
  getUrlPlatformInfo,
  getLinkThumbnail,
  getLinkTitle,
} from '../../lib/platform-icons';

export interface NoteCardItem {
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
  bookmarkMeta?: BookmarkMeta | null;
  credentialType?: string | null;
  attachments?: any;
  expiresAt?: string | Date | null;
  isArchived?: boolean;
  createdAt: string | Date;
}

interface NoteCardProps {
  note: NoteCardItem;
  onDelete: (id: string) => void;
  onRestore?: (note: NoteCardItem) => void;
  onTagClick?: (tag: string) => void;
  onTogglePin?: (id: string, isPinned: boolean) => void;
  onEdit?: (note: NoteCardItem) => void;
  onClick?: (note: NoteCardItem) => void;
  onOpenReader?: (note: NoteCardItem) => void;
  onSyncAi?: (note: NoteCardItem) => void;
  isSyncingAi?: boolean;
  isSyncDisabled?: boolean;
  className?: string;
  showDateTime?: boolean;
  showCategory?: boolean;
  variant?: 'default' | 'timeline' | 'row';
  maxHeight?: string;
  showTags?: boolean;
  isSelectable?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
}

export default function NoteCard({
  note,
  onDelete,
  onRestore,
  onTagClick,
  onTogglePin,
  onEdit,
  onClick,
  onOpenReader,
  onSyncAi,
  isSyncingAi = false,
  isSyncDisabled = false,
  className = '',
  showDateTime = false,
  showCategory = true,
  variant = 'default',
  maxHeight,
  showTags = true,
  isSelectable = false,
  isSelected = false,
  onToggleSelect,
}: NoteCardProps) {
  const [isDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPinning, setIsPinning] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const formattedDate = (() => {
    try {
      const d = new Date(note.createdAt);
      return format(d, 'EEEE, d MMMM yyyy • HH:mm', { locale: localeId }) + ' WIB';
    } catch {
      return String(note.createdAt);
    }
  })();

  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const urls = useMemo(() => Array.from(new Set(note.content.match(urlRegex) || [])), [note.content]);

  const isBookmark =
    note.category?.toLowerCase() === 'bookmark' || note.category?.toLowerCase() === 'bookmarks';

  const { thumbnail, cleanText } = useMemo(() => {
    if (!isBookmark) {
      return { thumbnail: null, cleanText: note.content, primaryUrl: '' };
    }
    return extractBookmarkThumbnail(note.content, note.attachments);
  }, [isBookmark, note.content, note.attachments]);

  const [imgError, setImgError] = useState(false);
  useEffect(() => {
    setImgError(false);
  }, [thumbnail]);

  const domain = useMemo(() => {
    if (note.bookmarkMeta?.domain) return note.bookmarkMeta.domain;
    if (urls[0]) {
      try {
        return new URL(urls[0]).hostname.replace(/^www\./, '');
      } catch {
        return urls[0];
      }
    }
    return '';
  }, [note.bookmarkMeta?.domain, urls]);

  const favicon = useMemo(() => {
    if (note.bookmarkMeta?.faviconUrl) return note.bookmarkMeta.faviconUrl;
    if (domain) return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    return null;
  }, [note.bookmarkMeta?.faviconUrl, domain]);

  const isAiProcessed = Boolean(
    (Array.isArray(note.bookmarkMeta?.aiSummary) && note.bookmarkMeta.aiSummary.length > 0) ||
    note.bookmarkMeta?.isContentExtracted
  );

  const textWithoutUrls = useMemo(() => {
    return (note.content || '').replace(urlRegex, '').trim();
  }, [note.content]);

  const isPureLink = urls.length > 0 && textWithoutUrls.length === 0;
  const hasThumbnail = Boolean(thumbnail && !imgError);
  const metaTitle = note.bookmarkMeta?.title;
  const hasRichPreview = Boolean(hasThumbnail || (metaTitle && metaTitle !== urls[0]));
  const shouldShowUserNotes = !(isPureLink && hasRichPreview);
  const rawUserNotes = textWithoutUrls || (isPureLink && !hasRichPreview ? note.content : '');
  const linkCaption = note.bookmarkMeta?.caption?.trim() || null;

  const compactUserNotes = useMemo(() => {
    return (rawUserNotes || '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  }, [rawUserNotes]);

  const compactLinkCaption = useMemo(() => {
    return (linkCaption || '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  }, [linkCaption]);

  const compactContent = useMemo(() => {
    const text = isBookmark ? cleanText : note.content;
    return (text || '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  }, [isBookmark, cleanText, note.content]);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    // Optimistic delete: remove instantly from UI
    onDelete(note.id);
    try {
      const res = await fetch(`/api/notes/${note.id}`, { method: 'DELETE' });
      if (!res.ok) {
        throw new Error('Gagal menghapus');
      }
    } catch {
      onRestore?.(note);
      toast.error('Gagal menghapus catatan');
    }
  };

  const handleTogglePinInternal = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPinning) return;
    setIsPinning(true);
    const nextPinned = !note.isPinned;
    try {
      const res = await fetch(`/api/notes/${note.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPinned: nextPinned }),
      });
      if (res.ok && onTogglePin) {
        onTogglePin(note.id, nextPinned);
      }
    } catch (err) {
      console.error('Failed to toggle pin', err);
    } finally {
      setIsPinning(false);
    }
  };

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(note.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEdit) {
      onEdit(note);
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (isSelectable) {
      e.stopPropagation();
      onToggleSelect?.(note.id);
      return;
    }

    const currentIsMobile = typeof window !== 'undefined' ? window.innerWidth < 768 : isMobile;

    // If user is selecting/blocking text, do NOT collapse or trigger click
    const selection = typeof window !== 'undefined' ? window.getSelection() : null;
    if (selection && selection.toString().trim().length > 0) {
      return;
    }

    if (currentIsMobile) {
      // Toggle expansion directly in-place on mobile
      setIsExpanded((prev) => !prev);
    } else {
      if (onClick) {
        onClick(note);
      }
    }
  };

  const isRow = variant === 'row';
  const isTimeline = variant === 'timeline';
  const effectiveMaxHeight = isMobile && isExpanded ? undefined : maxHeight;

  // Helper render baris attachment link (Thumbnail + Judul berdampingan kanan-kiri)
  const renderLinkAttachmentRows = () => (
    <div className="flex flex-col gap-2 mb-2 select-none">
      {urls.map((linkUrl, index) => {
        const { label, domain: linkDomain, icon: PlatformIcon } = getUrlPlatformInfo(linkUrl);
        const thumbUrl = getLinkThumbnail(linkUrl, note.bookmarkMeta) || (urls.length === 1 ? thumbnail : null);
        const itemTitle = getLinkTitle(linkUrl, note.bookmarkMeta);
        const linkTitle =
          itemTitle ||
          (urls.length === 1 && metaTitle && metaTitle !== linkUrl
            ? metaTitle
            : index === 0 && metaTitle && metaTitle !== linkUrl
            ? metaTitle
            : label);

        return (
          <a
            key={index}
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-2.5 p-2 rounded-xl bg-surface-soft hover:bg-hairline/60 active:scale-[0.98] transition-all text-left w-full !border-0 cursor-pointer"
            title={`Buka ${label}`}
          >
            {thumbUrl ? (
              <div className="relative w-16 h-12 rounded-md overflow-hidden bg-canvas shrink-0">
                <img
                  src={thumbUrl}
                  alt={linkTitle}
                  loading="lazy"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-md bg-canvas flex items-center justify-center shrink-0 text-mute">
                <PlatformIcon className="w-4 h-4" />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <PlatformIcon className="w-3.5 h-3.5 text-mute shrink-0" />
                <span className="text-body-sm font-medium text-ink truncate block">
                  {linkTitle}
                </span>
              </div>
              <span className="text-caption-xs text-mute font-mono truncate block mt-0.5">
                {linkDomain || label}
              </span>
            </div>
          </a>
        );
      })}
    </div>
  );

  // Helper render toolbar aksi yang 100% konsisten untuk semua jenis kartu (Bookmark maupun non-bookmark)
  const renderActionToolbar = () => {
    if (isSelectable) return null;

    const hasUrls = urls.length > 0 || isBookmark;
    const canShowReader = ((isExpanded && isMobile) || !isMobile) && hasUrls && onOpenReader;
    const isUncategorized = note.category === 'others' || note.isProcessed === false;
    const canShowAction = (isExpanded && isMobile) || !isMobile;
    const isSyncButtonDisabled = isSyncDisabled || isSyncingAi;

    return (
      <div className="flex items-center gap-1 shrink-0 ml-auto">
        {/* 0. Sync AI Single-Note (Kondisional: catatan belum dikategorikan) */}
        {isUncategorized && onSyncAi && canShowAction && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (isSyncButtonDisabled) return;
              onSyncAi(note);
            }}
            disabled={isSyncButtonDisabled}
            className="p-1.5 rounded-full text-mute hover:text-primary hover:bg-surface-soft cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-mute disabled:hover:bg-transparent transition-colors !border-0"
            title={
              isSyncingAi
                ? 'Sedang memproses catatan ini dengan AI...'
                : isSyncButtonDisabled
                ? 'Sedang ada proses sinkronisasi AI yang berjalan...'
                : 'Kategorisasikan catatan ini dengan AI'
            }
            aria-label="Kategorisasi AI"
          >
            {isSyncingAi ? (
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            ) : (
              <Sparkles className="w-4 h-4 text-primary" />
            )}
          </button>
        )}

        {/* 1. Mode Baca (Kondisional: jika catatan memiliki URL/link) */}
        {canShowReader && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenReader(note);
            }}
            className="p-1.5 rounded-full text-mute hover:text-ink hover:bg-surface-soft cursor-pointer transition-colors !border-0"
            title="Buka Mode Baca (Ringkasan AI & Transkrip)"
            aria-label="Mode Baca"
          >
            <BookOpen className="w-4 h-4" />
          </button>
        )}

        {/* 2. Salin (Universal di semua catatan) */}
        {canShowAction && (
          <button
            type="button"
            onClick={handleCopy}
            className="p-1.5 rounded-full text-mute hover:text-ink hover:bg-surface-soft cursor-pointer transition-colors !border-0"
            title="Salin isi catatan"
            aria-label="Salin catatan"
          >
            {copied ? <Check className="w-4 h-4 text-terminal-green" /> : <Copy className="w-4 h-4" />}
          </button>
        )}

        {/* 3. Edit (Universal di semua catatan jika onEdit tersedia) */}
        {canShowAction && onEdit && (
          <button
            type="button"
            onClick={handleEdit}
            className="p-1.5 rounded-full text-mute hover:text-ink hover:bg-surface-soft cursor-pointer transition-colors !border-0"
            title="Edit catatan"
            aria-label="Edit catatan"
          >
            <Pencil className="w-4 h-4" />
          </button>
        )}

        {/* 4. Pin (Universal di semua catatan) */}
        <button
          type="button"
          onClick={handleTogglePinInternal}
          disabled={isPinning}
          className={`p-1.5 rounded-full cursor-pointer transition-colors !border-0 ${
            note.isPinned
              ? 'text-primary bg-surface-soft !border-0'
              : 'text-mute hover:text-ink hover:bg-surface-soft !border-0'
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

        {/* 5. Hapus (Universal di semua catatan) */}
        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting}
          className={`p-1.5 rounded-full cursor-pointer transition-colors !border-0 ${
            confirmDelete
              ? 'bg-terminal-red text-white hover:bg-terminal-red/90 !border-0'
              : 'text-mute hover:text-terminal-red hover:bg-surface-soft !border-0'
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

        {/* 6. Ciutkan (Khusus Mobile saat kartu Expanded) */}
        {isExpanded && isMobile && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(false);
            }}
            className="p-1.5 rounded-full text-mute hover:text-ink hover:bg-surface-soft cursor-pointer transition-colors !border-0"
            title="Ciutkan catatan"
            aria-label="Ciutkan catatan"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  };

  return (
    <div
      onClick={handleCardClick}
      className={
        isRow
          ? `group relative flex flex-col justify-between ${
              isSelected ? '!ring-2 !ring-primary !border-primary bg-primary/5' : ''
            } ${
              isExpanded && isMobile
                ? '!bg-zinc-100 !border !border-hairline-strong !p-3.5 !rounded-lg my-2 shadow-xs cursor-default select-text'
                : 'px-1 sm:px-2 py-3.5 rounded-none border-0 border-b border-hairline last:border-b-0 bg-transparent hover:bg-surface-soft/40 cursor-pointer select-none mb-0'
            } text-left break-inside-avoid w-full overflow-hidden transition-all ${className}`.trim()
          : isTimeline
          ? `group relative flex flex-col justify-between ${
              isSelected ? '!ring-2 !ring-primary !border-primary bg-primary/5' : ''
            } ${
              isExpanded && isMobile
                ? '!bg-zinc-100 !border !border-hairline-strong !p-3.5 !rounded-lg my-2 shadow-xs cursor-default select-text'
                : 'px-1 py-3.5 md:p-3.5 rounded-none md:rounded-lg border-0 border-b border-hairline last:border-b-0 md:border md:border-hairline md:last:border-b bg-transparent md:bg-canvas hover:border-b-hairline-strong md:hover:border-hairline-strong cursor-pointer select-none mb-0 md:mb-3.5'
            } text-left break-inside-avoid mb-0 md:mb-3.5 w-full overflow-hidden transition-all ${className}`.trim()
          : `group relative flex flex-col justify-between p-3.5 rounded-lg border ${
              isSelected ? '!ring-2 !ring-primary !border-primary bg-primary/5' : ''
            } ${
              isExpanded && isMobile
                ? '!bg-zinc-100 border-hairline-strong shadow-xs cursor-default select-text'
                : 'border-hairline bg-canvas hover:border-hairline-strong cursor-pointer select-none'
            } text-left break-inside-avoid mb-3.5 w-full overflow-hidden transition-all ${className}`.trim()
      }
    >
      {isBookmark ? (
        /* =================== BOOKMARK CARD RENDERING (MATCHING BOOKMARKSVIEW) =================== */
        <div className="w-full max-w-full min-w-0 flex flex-col justify-between flex-1">
          <div className="w-full max-w-full min-w-0">
            {/* Checkbox if selectable (Manage Mode) */}
            {isSelectable && (
              <div
                className="cursor-pointer p-0.5 mb-2 -ml-0.5 flex items-center justify-start select-none"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSelect?.(note.id);
                }}
              >
                <input
                  type="checkbox"
                  checked={Boolean(isSelected)}
                  onChange={() => {}}
                  className="w-4 h-4 rounded border-hairline-strong text-primary accent-primary cursor-pointer align-middle"
                />
              </div>
            )}

            {/* Date and Time displayed at top when expanded on mobile */}
            {isExpanded && isMobile && (
              <div className="text-[11px] text-mute font-mono mb-2.5 select-none">
                {formattedDate}
              </div>
            )}

            {/* 1. Top row: Favicon + domain on left, Badge read & Badge AI on right */}
            <div className="flex items-center justify-between gap-2 mb-2 select-none">
              <div className="flex items-center gap-1.5 min-w-0">
                {favicon ? (
                  <img
                    src={favicon}
                    alt=""
                    className="w-4 h-4 rounded-xs shrink-0 object-contain"
                    onError={(e) => ((e.target as HTMLElement).style.display = 'none')}
                  />
                ) : (
                  <Globe className="w-4 h-4 text-mute shrink-0" />
                )}
                <span className="text-[11px] font-mono text-mute truncate max-w-[150px]">
                  {domain}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Badge Read: icon only (ONLY if read, neutral color, Check icon, w-4 h-4, hidden on mobile by default) */}
                {note.bookmarkMeta?.readingStatus === 'read' && (!isMobile || isExpanded) && (
                  <div
                    title="Sudah dibaca"
                    className="flex items-center justify-center text-mute"
                  >
                    <Check className="w-4 h-4 text-mute" />
                  </div>
                )}

                {/* Badge AI: icon only, right next to read/unread, only if transcribed/summarized, hidden on mobile by default */}
                {isAiProcessed && (!isMobile || isExpanded) && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenReader?.(note);
                    }}
                    title="Buka Mode Baca (Ringkasan AI & Transkrip)"
                    className="flex items-center justify-center text-mute hover:text-ink cursor-pointer p-0.5 rounded-full hover:bg-surface-soft !border-0"
                  >
                    <Sparkles className="w-4 h-4 text-mute hover:text-ink" />
                  </button>
                )}
              </div>
            </div>

            {/* 2. User Notes: dipadetin tanpa break line di card, kembalikan format asli saat expanded di mobile atau modal desktop */}
            {shouldShowUserNotes && rawUserNotes && (
              <p
                onClick={(e) => {
                  if (isExpanded && isMobile) e.stopPropagation();
                }}
                className={`text-body-sm text-ink leading-relaxed break-words [overflow-wrap:anywhere] font-normal ${
                  isExpanded && isMobile
                    ? 'line-clamp-none select-text cursor-text whitespace-pre-wrap'
                    : 'line-clamp-6 select-none whitespace-normal'
                } mb-2.5`}
              >
                {isExpanded && isMobile ? rawUserNotes : compactUserNotes}
              </p>
            )}

            {/* 3. Link Caption: dipadetin tanpa break line di card, kembalikan format asli saat expanded di mobile atau modal desktop */}
            {linkCaption && (
              <p
                onClick={(e) => {
                  if (isExpanded && isMobile) e.stopPropagation();
                }}
                className={`text-body-sm text-ink leading-relaxed break-words [overflow-wrap:anywhere] font-normal ${
                  isExpanded && isMobile
                    ? 'line-clamp-none select-text cursor-text whitespace-pre-wrap'
                    : 'line-clamp-6 select-none whitespace-normal'
                } mb-2.5`}
              >
                {isExpanded && isMobile ? linkCaption : compactLinkCaption}
              </p>
            )}

            {/* 4. Desktop View */}
            <div className="hidden sm:block">
              {urls.length > 1 ? (
                /* Multi-link: samakan dengan tampilan mobile (thumbnail, judul, thumbnail, judul) */
                renderLinkAttachmentRows()
              ) : (
                /* 1 link: thumbnail aspect-video, judul, dan direct link buttons */
                <>
                  {hasThumbnail && (
                    <div className="relative shrink-0 w-full aspect-video rounded-lg overflow-hidden bg-surface-soft mb-2">
                      <img
                        src={thumbnail!}
                        alt={metaTitle || note.content}
                        loading="lazy"
                        className="w-full h-full object-cover"
                        onError={() => setImgError(true)}
                      />
                    </div>
                  )}

                  {metaTitle && metaTitle !== urls[0] && (
                    <h4 className="text-body-sm font-medium text-ink line-clamp-2 leading-snug mb-2">
                      {metaTitle}
                    </h4>
                  )}

                  {urls.length > 0 && (
                    <div
                      className="flex flex-wrap gap-2 pt-0.5 mb-2 select-none"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {urls.map((linkUrl, index) => {
                        const { label, icon: PlatformIcon } = getUrlPlatformInfo(linkUrl);
                        return (
                          <a
                            key={index}
                            href={linkUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-fit inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-soft hover:bg-hairline/60 active:scale-[0.98] text-ink font-medium text-xs transition-all group/btn !border-0"
                            title={`Buka ${label}`}
                          >
                            <PlatformIcon className="w-3.5 h-3.5 text-mute group-hover/btn:text-ink transition-colors shrink-0" />
                            <span className="font-medium">{label}</span>
                          </a>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* 5. Mobile View: Attachment Row Mode (Thumbnail dan Title kanan-kiri) */}
            <div className="sm:hidden">
              {urls.length > 0 ? (
                renderLinkAttachmentRows()
              ) : (
                metaTitle && metaTitle !== urls[0] && (
                  <h4 className="text-body-sm font-medium text-ink line-clamp-2 leading-snug mb-2">
                    {metaTitle}
                  </h4>
                )
              )}
            </div>

            {/* Specific Tags when expanded on mobile */}
            {showTags && isExpanded && isMobile && note.specificTags && note.specificTags.length > 0 && (
              <div className="pt-2.5 flex flex-wrap items-center gap-2 select-none">
                {note.specificTags.map((tag) => (
                  <span
                    key={tag}
                    onClick={(e) => {
                      if (onTagClick) {
                        e.stopPropagation();
                        onTagClick(tag);
                      }
                    }}
                    className="text-caption-sm text-mute hover:text-ink font-sans font-medium cursor-pointer transition-colors"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Bottom Toolbar: Category badge on left, Standard Action buttons on right */}
          <div
            className={`flex items-center justify-between gap-1.5 mt-2.5 pt-0.5 select-none min-h-[26px] ${
              (isExpanded && isMobile) || confirmDelete
                ? 'opacity-100'
                : 'opacity-0 group-hover:opacity-100'
            } transition-opacity duration-150`}
          >
            {/* Left: Category badge & Temp badge */}
            <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
              {showCategory && note.category && (
                <span
                  className={`px-2 py-0.5 rounded-full ${
                    isExpanded && isMobile
                      ? 'bg-zinc-100 border border-hairline-strong text-ink'
                      : 'bg-surface-soft text-ink'
                  } text-[10px] font-sans uppercase tracking-wider font-medium truncate max-w-[180px]`}
                >
                  {note.category}
                </span>
              )}
              {note.expiresAt && (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${
                    isExpanded && isMobile
                      ? 'bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  } text-[10px] font-mono font-medium`}
                >
                  ⏳ Temp
                </span>
              )}
            </div>

            {/* Right: Action Buttons Toolbar (Unified & Standardized) */}
            {renderActionToolbar()}
          </div>
        </div>
      ) : (
        /* =================== STANDARD NOTE CARD RENDERING =================== */
        <div className="w-full max-w-full min-w-0 flex flex-col justify-between flex-1">
          <div className="w-full max-w-full min-w-0">
            {/* Checkbox if selectable (Manage Mode) */}
            {isSelectable && (
              <div
                className="cursor-pointer p-0.5 mb-2 -ml-0.5 flex items-center justify-start select-none"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSelect?.(note.id);
                }}
              >
                <input
                  type="checkbox"
                  checked={Boolean(isSelected)}
                  onChange={() => {}}
                  className="w-4 h-4 rounded border-hairline-strong text-primary accent-primary cursor-pointer align-middle"
                />
              </div>
            )}

            {/* Date and Time displayed at top when expanded on mobile */}
            {isExpanded && isMobile && (
              <div className="text-[11px] text-mute font-mono mb-2.5 select-none">
                {formattedDate}
              </div>
            )}

            {/* Notes Content: fully revealed without max height when expanded on mobile, selectable */}
            <div
              onClick={(e) => {
                if (isExpanded && isMobile) {
                  e.stopPropagation();
                }
              }}
              className={`text-body-sm text-ink leading-relaxed break-words [overflow-wrap:anywhere] font-normal ${
                isExpanded && isMobile
                  ? 'select-text cursor-text whitespace-pre-wrap line-clamp-none'
                  : 'select-none whitespace-normal'
              } ${
                isExpanded && isMobile
                  ? 'line-clamp-none'
                  : effectiveMaxHeight
                  ? `overflow-hidden ${effectiveMaxHeight}`
                  : 'line-clamp-none'
              }`}
            >
              {isExpanded && isMobile ? note.content : compactContent}
            </div>

            {/* Embedded URL Link Cards when expanded on mobile */}
            {isExpanded && isMobile && urls.length > 0 && (
              <div className="pt-3.5 flex flex-wrap gap-2 select-none">
                {urls.map((linkUrl) => {
                  let linkDomain = '';
                  try {
                    linkDomain = new URL(linkUrl).hostname.replace('www.', '');
                  } catch {
                    linkDomain = linkUrl;
                  }
                  return (
                    <a
                      key={linkUrl}
                      href={linkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${
                        isExpanded && isMobile
                          ? 'bg-zinc-100 border border-hairline-strong hover:bg-zinc-200'
                          : 'bg-canvas border border-hairline hover:border-hairline-strong'
                      } group text-left max-w-full`}
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-mute shrink-0 group-hover:text-ink" />
                      <span className="text-[11px] font-medium text-ink group-hover:underline truncate max-w-[200px]">
                        {linkDomain}
                      </span>
                    </a>
                  );
                })}
              </div>
            )}

            {/* Specific Tags when expanded on mobile */}
            {showTags && isExpanded && isMobile && note.specificTags && note.specificTags.length > 0 && (
              <div className="pt-2.5 flex flex-wrap items-center gap-2 select-none">
                {note.specificTags.map((tag) => (
                  <span
                    key={tag}
                    onClick={(e) => {
                      if (onTagClick) {
                        e.stopPropagation();
                        onTagClick(tag);
                      }
                    }}
                    className="text-caption-sm text-mute hover:text-ink font-sans font-medium cursor-pointer transition-colors"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* Attachments when expanded on mobile */}
            {isExpanded && isMobile && note.attachments && note.attachments.length > 0 && (
              <div className="pt-3 flex flex-wrap gap-2 select-none">
                {note.attachments.map((att: any, i: number) => (
                  <div
                    key={att.fileId || i}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ${
                      isExpanded && isMobile
                        ? 'bg-zinc-100 border border-hairline-strong'
                        : 'bg-canvas border border-hairline'
                    } text-[11px] text-ink max-w-full font-mono`}
                  >
                    {att.type === 'image' ? (
                      <ImageIcon className="w-3.5 h-3.5 text-mute shrink-0" />
                    ) : (
                      <FileIcon className="w-3.5 h-3.5 text-mute shrink-0" />
                    )}
                    <span className="truncate max-w-[180px]">{att.fileName || `Attachment-${i + 1}`}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Optional Date and Time at bottom (e.g. for pinned notes when NOT expanded) */}
            {showDateTime && !isExpanded && note.createdAt && (
              <div className="mt-2.5 flex items-center text-[11px] text-mute font-mono select-none">
                <span className="whitespace-nowrap">{format(new Date(note.createdAt), 'dd MMM yyyy, HH:mm')}</span>
              </div>
            )}
          </div>

          {/* Card Bottom: Category badge on left, Standard Action buttons on right */}
          <div
            className={`flex items-center justify-between gap-1.5 mt-2.5 pt-0.5 select-none min-h-[26px] ${
              (isExpanded && isMobile) || confirmDelete
                ? 'opacity-100'
                : 'opacity-0 group-hover:opacity-100'
            } transition-opacity duration-150`}
          >
            {/* Left: Category badge & Temp badge */}
            <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
              {showCategory && note.category && (
                <span
                  className={`px-2 py-0.5 rounded-full ${
                    isExpanded && isMobile
                      ? 'bg-zinc-100 border border-hairline-strong text-ink'
                      : 'bg-surface-soft text-ink'
                  } text-[10px] font-sans uppercase tracking-wider font-medium truncate max-w-[180px]`}
                >
                  {note.category}
                </span>
              )}
              {note.expiresAt && (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${
                    isExpanded && isMobile
                      ? 'bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  } text-[10px] font-mono font-medium`}
                >
                  ⏳ Temp
                </span>
              )}
            </div>

            {/* Right: Action Buttons Toolbar (Unified & Standardized) */}
            {renderActionToolbar()}
          </div>
        </div>
      )}
    </div>
  );
}
