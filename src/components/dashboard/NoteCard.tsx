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
} from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { extractBookmarkThumbnail } from '../../lib/utils';

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
  attachments?: any;
  createdAt: string | Date;
}

interface NoteCardProps {
  note: NoteCardItem;
  onDelete: (id: string) => void;
  onTagClick?: (tag: string) => void;
  onTogglePin?: (id: string, isPinned: boolean) => void;
  onEdit?: (note: NoteCardItem) => void;
  onClick?: (note: NoteCardItem) => void;
  className?: string;
  showDateTime?: boolean;
  showCategory?: boolean;
  variant?: 'default' | 'timeline';
  maxHeight?: string;
  showTags?: boolean;
}

export default function NoteCard({
  note,
  onDelete,
  onTagClick,
  onTogglePin,
  onEdit,
  onClick,
  className = '',
  showDateTime = false,
  showCategory = true,
  variant = 'default',
  maxHeight,
  showTags = true,
}: NoteCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
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
  const urls = Array.from(new Set(note.content.match(urlRegex) || []));

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

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/notes/${note.id}`, { method: 'DELETE' });
      if (res.ok) {
        onDelete(note.id);
      }
    } catch {
      setIsDeleting(false);
      setConfirmDelete(false);
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

  const isTimeline = variant === 'timeline';
  const effectiveMaxHeight = isMobile && isExpanded ? undefined : maxHeight;

  return (
    <div
      onClick={handleCardClick}
      className={
        isTimeline
          ? `group relative flex flex-col justify-between ${
              isExpanded && isMobile
                ? '!bg-zinc-100 !border !border-hairline-strong !p-3.5 !rounded-lg my-2 shadow-xs cursor-default select-text'
                : 'px-1 py-3.5 md:p-3.5 rounded-none md:rounded-lg border-0 border-b border-hairline last:border-b-0 md:border md:border-hairline md:last:border-b bg-transparent md:bg-canvas hover:border-b-hairline-strong md:hover:border-hairline-strong cursor-pointer select-none'
            } text-left break-inside-avoid mb-0 md:mb-3.5 w-full overflow-hidden transition-all ${className}`.trim()
          : `group relative flex flex-col justify-between p-3.5 rounded-lg border ${
              isExpanded && isMobile
                ? '!bg-zinc-100 border-hairline-strong shadow-xs cursor-default select-text'
                : 'border-hairline bg-canvas hover:border-hairline-strong cursor-pointer select-none'
            } text-left break-inside-avoid mb-3.5 w-full overflow-hidden transition-all ${className}`.trim()
      }
    >
      <div className="w-full max-w-full min-w-0">
        {/* Card Header: Category badge on left, Action buttons on right */}
        <div className={`flex items-center ${showCategory && note.category ? 'justify-between' : 'justify-end'} gap-1.5 mb-2.5 select-none`}>
          {showCategory && note.category && (
            <div className="flex items-center min-w-0">
              <span
                className={`px-2 py-0.5 rounded-full ${
                  isExpanded && isMobile
                    ? 'bg-zinc-100 border border-hairline-strong text-ink'
                    : 'bg-surface-soft text-ink'
                } text-[10px] font-sans uppercase tracking-wider font-medium truncate max-w-[180px]`}
              >
                {note.category}
              </span>
            </div>
          )}

          {/* Action Buttons Toolbar */}
          <div className="flex items-center gap-1 shrink-0 ml-auto">
            {/* Pin Button */}
            <button
              type="button"
              onClick={handleTogglePinInternal}
              disabled={isPinning}
              className={`p-1.5 rounded-full cursor-pointer transition-colors ${
                note.isPinned
                  ? 'text-primary bg-surface-soft'
                  : 'text-mute hover:text-ink hover:bg-surface-soft opacity-70 group-hover:opacity-100'
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

            {/* Salin (Copy) Button - visible when expanded on mobile */}
            {isExpanded && isMobile && (
              <button
                type="button"
                onClick={handleCopy}
                className="p-1.5 rounded-full text-mute hover:text-ink hover:bg-surface-soft cursor-pointer transition-colors"
                title="Salin isi catatan"
                aria-label="Salin catatan"
              >
                {copied ? <Check className="w-4 h-4 text-terminal-green" /> : <Copy className="w-4 h-4" />}
              </button>
            )}

            {/* Edit Button - visible when expanded on mobile */}
            {isExpanded && isMobile && onEdit && (
              <button
                type="button"
                onClick={handleEdit}
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
              onClick={handleDelete}
              disabled={isDeleting}
              className={`p-1.5 rounded-full cursor-pointer transition-colors ${
                confirmDelete
                  ? 'text-terminal-red bg-terminal-red/10'
                  : 'text-mute hover:text-terminal-red hover:bg-surface-soft opacity-70 group-hover:opacity-100'
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

            {/* Collapse Button - visible when expanded on mobile */}
            {isExpanded && isMobile && (
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
            )}
          </div>
        </div>

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
          className={`text-body-sm text-ink leading-relaxed break-words [overflow-wrap:anywhere] font-normal whitespace-pre-wrap ${
            isExpanded && isMobile ? 'select-text cursor-text' : 'select-none'
          } ${
            isExpanded && isMobile
              ? 'line-clamp-none'
              : isBookmark && thumbnail && !imgError
              ? 'line-clamp-3'
              : effectiveMaxHeight
              ? `overflow-hidden ${effectiveMaxHeight}`
              : 'line-clamp-none'
          }`}
        >
          {isBookmark ? cleanText : note.content}
        </div>

        {/* Bookmark OG Image Thumbnail (16:9, below notes, no extra border, no hover scale) */}
        {isBookmark && thumbnail && !imgError && (
          <div className="relative aspect-video w-full rounded-md overflow-hidden bg-surface-soft mt-2.5 shrink-0">
            <img
              src={thumbnail}
              alt="Bookmark thumbnail"
              loading="lazy"
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          </div>
        )}

        {/* Embedded URL Link Cards when expanded on mobile */}
        {isExpanded && isMobile && urls.length > 0 && (
          <div className="pt-3.5 flex flex-wrap gap-2 select-none">
            {urls.map((linkUrl) => {
              let domain = '';
              try {
                domain = new URL(linkUrl).hostname.replace('www.', '');
              } catch {
                domain = linkUrl;
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
                    {domain}
                  </span>
                </a>
              );
            })}
          </div>
        )}

        {/* Specific Tags when expanded on mobile (warna teks sama seperti date & time: text-mute) */}
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
          <div className="mt-3 flex items-center text-[11px] text-mute font-mono select-none">
            <span className="whitespace-nowrap">{format(new Date(note.createdAt), 'dd MMM yyyy, HH:mm')}</span>
          </div>
        )}
      </div>
    </div>
  );
}