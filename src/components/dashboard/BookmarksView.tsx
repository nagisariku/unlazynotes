import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Bookmark,
  Download,
  ExternalLink,
  Trash2,
  Copy,
  Check,
  Plus,
  Pin,
  PinOff,
  Pencil,
  ChevronRight,
  ChevronUp,
  Globe,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { toast } from 'sonner';
import { Button, SearchPill } from '../ui';
import NewBookmarkModal from './NewBookmarkModal';
import EditNoteModal from './EditNoteModal';
import NoteDetailModal from './NoteDetailModal';
import type { BookmarkType } from '../../db/schema';

export const BOOKMARK_MACRO_CONFIG: Array<{
  type: BookmarkType;
  title: string;
  id: string;
}> = [
  { type: 'tech_dev', title: 'Tech & Dev', id: 'section-tech-dev' },
  { type: 'media_social', title: 'Media & Sosial', id: 'section-media-social' },
  { type: 'work_docs', title: 'Dokumen & Kerja', id: 'section-work-docs' },
  { type: 'places', title: 'Tempat & Lokasi', id: 'section-places' },
  { type: 'shopping', title: 'Belanja & Produk', id: 'section-shopping' },
  { type: 'reading_other', title: 'Bacaan & Lainnya', id: 'section-reading-other' },
];

export interface BookmarkItem {
  id: string;
  content: string;
  category?: string;
  bookmarkType?: BookmarkType | string | null;
  specificTags?: string[] | null;
  source?: string | null;
  isPinned?: boolean;
  attachments?: Array<{
    fileId: string;
    type: 'image' | 'file';
    mimeType?: string;
    fileName?: string;
    sizeBytes?: number;
    localPath?: string;
  }> | null;
  createdAt: string;
}

interface BookmarksViewProps {
  initialBookmarks: BookmarkItem[];
  userName?: string | null;
}

export type PlatformType = 'youtube' | 'github' | 'twitter' | 'linkedin' | 'instagram' | 'other';

interface ParsedBookmark {
  raw: BookmarkItem;
  url: string;
  domain: string;
  platform: PlatformType;
  thumbnail: string | null;
  notes: string;
}

// Crisp Platform SVGs
function YoutubeIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function GithubIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

function TwitterIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function LinkedinIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76c-.95 0-1.72-.77-1.72-1.72s.77-1.72 1.72-1.72 1.72.77 1.72 1.72-.77 1.72-1.72 1.72m1.39 9.74v-8.37H5.07v8.37h2.78z" />
    </svg>
  );
}

function InstagramIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

// Helper to parse URL, platform, thumbnail, and notes from bookmark content
function parseBookmark(item: BookmarkItem): ParsedBookmark {
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const urls = Array.from(item.content.matchAll(urlRegex), (m) => m[0]);
  const primaryUrl = urls[0] || '';

  let domain = '';
  if (primaryUrl) {
    try {
      domain = new URL(primaryUrl).hostname.toLowerCase().replace(/^www\./, '');
    } catch {
      domain = primaryUrl;
    }
  }

  let platform: PlatformType = 'other';
  let thumbnail: string | null = null;

  if (primaryUrl) {
    // 1. YouTube
    if (domain.includes('youtube.com') || domain.includes('youtu.be')) {
      platform = 'youtube';
      const m = primaryUrl.match(
        /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/
      );
      if (m && m[1]) {
        thumbnail = `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg`;
      }
    }
    // 2. GitHub
    else if (domain === 'github.com') {
      platform = 'github';
      const m = primaryUrl.match(/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/);
      if (m && m[1] && m[2] && m[1] !== 'topics' && m[1] !== 'search') {
        thumbnail = `https://opengraph.githubassets.com/1/${m[1]}/${m[2]}`;
      }
    }
    // 3. Twitter / X
    else if (domain === 'twitter.com' || domain === 'x.com') {
      platform = 'twitter';
    }
    // 4. LinkedIn
    else if (domain.includes('linkedin.com')) {
      platform = 'linkedin';
    }
    // 5. Instagram
    else if (domain.includes('instagram.com')) {
      platform = 'instagram';
    }
    // 6. Direct image file URL
    else if (/\.(jpeg|jpg|gif|png|webp|svg)(\?.*)?$/i.test(primaryUrl)) {
      thumbnail = primaryUrl;
    }
  }

  // Check attachments for image thumbnail fallback
  if (!thumbnail && item.attachments && item.attachments.length > 0) {
    const imgAtt = item.attachments.find((a) => a.type === 'image');
    if (imgAtt?.localPath) {
      thumbnail = imgAtt.localPath;
    }
  }

  const notesText = item.content;

  return {
    raw: item,
    url: primaryUrl,
    domain,
    platform,
    thumbnail,
    notes: item.content || 'Catatan bookmark',
  };
}

interface BookmarkCardProps {
  bm: ParsedBookmark;
  onDelete: (id: string) => Promise<void> | void;
  onTogglePin: (item: BookmarkItem) => Promise<void> | void;
  onEdit: (item: BookmarkItem) => void;
  onClick: (item: BookmarkItem) => void;
  onTagClick?: (tag: string) => void;
}

function BookmarkCard({
  bm,
  onDelete,
  onTogglePin,
  onEdit,
  onClick,
  onTagClick,
}: BookmarkCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPinning, setIsPinning] = useState(false);
  const [imgError, setImgError] = useState(false);
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

  const handleCardClick = () => {
    const currentIsMobile = typeof window !== 'undefined' ? window.innerWidth < 768 : isMobile;
    const selection = typeof window !== 'undefined' ? window.getSelection() : null;
    if (selection && selection.toString().trim().length > 0) {
      return;
    }
    if (currentIsMobile) {
      setIsExpanded((prev) => !prev);
    } else {
      onClick(bm.raw);
    }
  };

  const handleTogglePinInternal = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPinning) return;
    setIsPinning(true);
    try {
      await onTogglePin(bm.raw);
    } finally {
      setIsPinning(false);
    }
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
      await onDelete(bm.raw.id);
    } finally {
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  };

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(bm.raw.content);
      setCopied(true);
      toast.success('Isi bookmark disalin ke clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleEditInternal = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(bm.raw);
  };

  const formattedDate = useMemo(() => {
    try {
      const d = new Date(bm.raw.createdAt);
      return format(d, 'EEEE, d MMMM yyyy • HH:mm', { locale: localeId }) + ' WIB';
    } catch {
      return String(bm.raw.createdAt);
    }
  }, [bm.raw.createdAt]);

  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const urls = useMemo(() => {
    const matched = Array.from(new Set(bm.raw.content.match(urlRegex) || []));
    if (bm.url && !matched.includes(bm.url)) {
      return [bm.url, ...matched];
    }
    return matched.length > 0 ? matched : (bm.url ? [bm.url] : []);
  }, [bm.raw.content, bm.url]);

  const hasThumbnail = Boolean(bm.thumbnail) && !imgError;

  return (
    <div
      onClick={handleCardClick}
      className={`group relative text-left break-inside-avoid [break-inside:avoid-column] transition-all overflow-hidden ${
        isExpanded && isMobile
          ? '!bg-zinc-100 !border !border-hairline-strong !p-3.5 !rounded-lg my-2 shadow-xs cursor-default select-text'
          : 'px-1 py-3.5 md:p-3.5 rounded-none md:rounded-2xl border-0 border-b border-hairline last:border-b-0 md:border md:border-hairline md:last:border-b bg-transparent md:bg-canvas hover:border-b-hairline-strong md:hover:border-hairline-strong cursor-pointer select-none mb-0 md:mb-4'
      }`.trim()}
    >
      {/* DESKTOP VIEW (md: and up) */}
      <div className="hidden md:flex flex-col justify-between w-full h-full">
        {/* Desktop Notes Content & Thumbnail */}
        <div className="flex flex-col flex-1 justify-start min-w-0">
          <p
            className={`text-body-sm font-normal text-ink leading-relaxed break-words [overflow-wrap:anywhere] select-none ${
              hasThumbnail ? 'line-clamp-4' : 'line-clamp-6'
            }`}
          >
            {bm.notes}
          </p>

          {/* Desktop Thumbnail Below Notes */}
          {hasThumbnail && (
            <div className="relative shrink-0 w-full aspect-video rounded-lg overflow-hidden bg-surface-soft mt-3">
              <img
                src={bm.thumbnail!}
                alt={bm.notes}
                loading="lazy"
                className="w-full h-full object-cover"
                onError={() => setImgError(true)}
              />
            </div>
          )}
        </div>

        {/* Desktop Bottom Toolbar (visible on hover) */}
        <div
          className={`flex items-center justify-between gap-1.5 mt-2.5 pt-0.5 select-none min-h-[26px] ${
            confirmDelete
              ? 'opacity-100'
              : 'opacity-0 group-hover:opacity-100'
          } transition-opacity duration-150`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Left: Category / Bookmark Badge */}
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            {bm.raw.category && (
              <span className="px-2 py-0.5 rounded-full bg-surface-soft text-ink text-[10px] font-sans uppercase tracking-wider font-medium truncate max-w-[180px]">
                {bm.raw.category}
              </span>
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1 shrink-0 ml-auto">
            {/* Pin Button */}
            <button
              type="button"
              onClick={handleTogglePinInternal}
              disabled={isPinning}
              className={`p-1.5 rounded-full cursor-pointer transition-colors !border-0 ${
                bm.raw.isPinned
                  ? 'text-primary bg-surface-soft !border-0'
                  : 'text-mute hover:text-ink hover:bg-surface-soft !border-0'
              }`}
              title={bm.raw.isPinned ? 'Lepas Pin' : 'Pin Bookmark'}
              aria-label="Pin Button"
            >
              {isPinning ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : bm.raw.isPinned ? (
                <PinOff className="w-3.5 h-3.5 fill-current" />
              ) : (
                <Pin className="w-3.5 h-3.5" />
              )}
            </button>

            {/* Delete Button */}
            <button
              type="button"
              onClick={handleDeleteInternal}
              disabled={isDeleting}
              className={`p-1.5 rounded-full cursor-pointer transition-colors !border-0 ${
                confirmDelete
                  ? 'bg-terminal-red text-white hover:bg-terminal-red/90 !border-0'
                  : 'text-mute hover:text-terminal-red hover:bg-surface-soft !border-0'
              }`}
              title={confirmDelete ? 'Klik sekali lagi untuk hapus' : 'Hapus bookmark'}
              aria-label="Delete Button"
            >
              {isDeleting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* MOBILE VIEW (< md) */}
      <div className="flex md:hidden flex-col w-full">
        {/* If EXPANDED on Mobile */}
        {isExpanded && isMobile ? (
          <div className="w-full flex flex-col">
            {/* Expanded Header: Date only */}
            <div className="text-[11px] text-mute font-mono mb-2.5 select-none">
              {formattedDate}
            </div>

            {/* Row with text on left, small OG thumbnail on top right */}
            <div className="flex flex-row items-start justify-between gap-3 w-full">
              {/* Full Notes Content */}
              <div
                onClick={(e) => e.stopPropagation()}
                className="flex-1 min-w-0 text-body-sm text-ink leading-relaxed break-words [overflow-wrap:anywhere] font-normal whitespace-pre-wrap select-text cursor-text line-clamp-none"
              >
                {bm.notes}
              </div>

              {/* Small OG thumbnail on the right, positioned at the top */}
              {hasThumbnail && (
                <div className="relative shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden bg-surface-soft self-start">
                  <img
                    src={bm.thumbnail!}
                    alt={bm.notes}
                    loading="lazy"
                    className="w-full h-full object-cover"
                    onError={() => setImgError(true)}
                  />
                </div>
              )}
            </div>

            {/* Embedded URL links when expanded */}
            {urls.length > 0 && (
              <div className="pt-3 flex flex-wrap gap-2 select-none" onClick={(e) => e.stopPropagation()}>
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
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-soft border border-hairline-strong hover:bg-canvas text-left max-w-full group"
                    >
                      <ExternalLink className="w-3 h-3 text-mute shrink-0 group-hover:text-ink" />
                      <span className="text-[11px] font-medium text-ink group-hover:underline truncate max-w-[200px]">
                        {domain}
                      </span>
                    </a>
                  );
                })}
              </div>
            )}

            {/* Specific Tags / Hashtags when expanded (warna teks sama seperti date & time: text-mute) */}
            {bm.raw.specificTags && bm.raw.specificTags.length > 0 && (
                <div className="pt-2.5 flex flex-wrap items-center gap-2 select-none" onClick={(e) => e.stopPropagation()}>
                  {bm.raw.specificTags.map((tag) => (
                    <span
                      key={tag}
                      onClick={() => onTagClick?.(tag)}
                      className="text-caption-sm text-mute hover:text-ink font-sans font-medium cursor-pointer transition-colors"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Expanded Bottom Toolbar */}
              <div
                className="flex items-center justify-between gap-1.5 mt-2.5 pt-0.5 select-none"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                  {bm.raw.category && (
                    <span className="px-2 py-0.5 rounded-full bg-zinc-100 border border-hairline-strong text-ink text-[10px] font-sans uppercase tracking-wider font-medium truncate max-w-[180px]">
                      {bm.raw.category}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0 ml-auto">
                  {/* Pin Button */}
                  <button
                    type="button"
                    onClick={handleTogglePinInternal}
                    disabled={isPinning}
                    className={`p-1.5 rounded-full cursor-pointer transition-colors !border-0 ${
                      bm.raw.isPinned
                        ? 'text-primary bg-surface-soft !border-0'
                        : 'text-mute hover:text-ink hover:bg-surface-soft !border-0'
                    }`}
                    title={bm.raw.isPinned ? 'Lepas Pin' : 'Pin Bookmark'}
                    aria-label="Pin Button"
                  >
                    {isPinning ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : bm.raw.isPinned ? (
                      <PinOff className="w-3.5 h-3.5 fill-current" />
                    ) : (
                      <Pin className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {/* Copy Button */}
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="p-1.5 rounded-full text-mute hover:text-ink hover:bg-surface-soft cursor-pointer transition-colors !border-0"
                    title="Salin isi bookmark"
                    aria-label="Salin bookmark"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-terminal-green" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>

                  {/* Edit Button (Opens Edit Modal) */}
                  <button
                    type="button"
                    onClick={handleEditInternal}
                    className="p-1.5 rounded-full text-mute hover:text-ink hover:bg-surface-soft cursor-pointer transition-colors !border-0"
                    title="Edit bookmark"
                    aria-label="Edit bookmark"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>

                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={handleDeleteInternal}
                    disabled={isDeleting}
                    className={`p-1.5 rounded-full cursor-pointer transition-colors !border-0 ${
                      confirmDelete
                        ? 'bg-terminal-red text-white hover:bg-terminal-red/90 !border-0'
                        : 'text-mute hover:text-terminal-red hover:bg-surface-soft !border-0'
                    }`}
                    title={confirmDelete ? 'Klik sekali lagi untuk hapus' : 'Hapus bookmark'}
                    aria-label="Delete Button"
                  >
                    {isDeleting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {/* Collapse Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsExpanded(false);
                    }}
                    className="p-1.5 rounded-full text-mute hover:text-ink hover:bg-surface-soft cursor-pointer transition-colors !border-0"
                    title="Ciutkan bookmark"
                    aria-label="Ciutkan bookmark"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
          /* If COLLAPSED on Mobile */
          <div className="flex flex-row items-start justify-between gap-3 w-full">
            {/* Left Column: notes text clamped + toolbar */}
            <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch">
              <p className="text-body-sm font-normal text-ink leading-relaxed break-words [overflow-wrap:anywhere] select-none line-clamp-3">
                {bm.notes}
              </p>

              {/* Mobile Toolbar */}
              <div
                className="flex items-center gap-1 mt-2.5 -ml-1 select-none shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Pin Button */}
                <button
                  type="button"
                  onClick={handleTogglePinInternal}
                  disabled={isPinning}
                  className={`p-1.5 rounded-full cursor-pointer transition-all ${
                    bm.raw.isPinned
                      ? 'text-primary bg-surface-soft !border-0'
                      : 'text-mute hover:text-ink hover:bg-surface-soft !border-0'
                  }`}
                  title={bm.raw.isPinned ? 'Lepas Pin' : 'Pin Bookmark'}
                  aria-label="Pin Button"
                >
                  {isPinning ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : bm.raw.isPinned ? (
                    <PinOff className="w-3.5 h-3.5 fill-current" />
                  ) : (
                    <Pin className="w-3.5 h-3.5" />
                  )}
                </button>

                {/* Delete Button */}
                <button
                  type="button"
                  onClick={handleDeleteInternal}
                  disabled={isDeleting}
                  className={`p-1.5 rounded-full cursor-pointer transition-all ${
                    confirmDelete
                      ? 'bg-terminal-red text-white hover:bg-terminal-red/90 !border-0'
                      : 'text-mute hover:text-terminal-red hover:bg-surface-soft !border-0'
                  }`}
                  title={confirmDelete ? 'Klik sekali lagi untuk hapus' : 'Hapus bookmark'}
                  aria-label="Delete Button"
                >
                  {isDeleting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Small OG image thumbnail on top right */}
            {hasThumbnail && (
              <div className="relative shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden bg-surface-soft self-start">
                <img
                  src={bm.thumbnail!}
                  alt={bm.notes}
                  loading="lazy"
                  className="w-full h-full object-cover"
                  onError={() => setImgError(true)}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function BookmarksView({ initialBookmarks, userName }: BookmarksViewProps) {
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>(initialBookmarks);
  const [activeTocKey, setActiveTocKey] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const topContentRef = useRef<HTMLDivElement>(null);
  const isUserClickingRef = useRef(false);

  const [selectedBookmarkForDetail, setSelectedBookmarkForDetail] = useState<BookmarkItem | null>(null);
  const openedFromDetailRef = useRef(false);

  const userLastName = useMemo(() => {
    if (!userName || !userName.trim()) return 'User';
    const parts = userName.trim().split(/\s+/);
    return parts[parts.length - 1];
  }, [userName]);

  // Modals state
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BookmarkItem | null>(null);

  // Expanded platform sections
  const [expandedPlatforms, setExpandedPlatforms] = useState<Record<string, boolean>>({});

  // Parse all bookmarks
  const parsedList = useMemo(() => {
    return bookmarks.map(parseBookmark);
  }, [bookmarks]);

  // Filtered bookmarks based on search query
  const filteredList = useMemo(() => {
    return parsedList.filter((b) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesContent = b.raw.content.toLowerCase().includes(q);
        const matchesDomain = b.domain.toLowerCase().includes(q);
        const matchesTags = b.raw.specificTags?.some((t) =>
          t.toLowerCase().includes(q)
        );
        return matchesContent || matchesDomain || matchesTags;
      }
      return true;
    });
  }, [parsedList, searchQuery]);

  // Pinned Bookmarks
  const pinnedBookmarks = useMemo(() => {
    return filteredList.filter((b) => Boolean(b.raw.isPinned));
  }, [filteredList]);

  // Curated showcase gallery sections purely based on AI note.bookmarkType
  const curatedSections = useMemo(() => {
    return BOOKMARK_MACRO_CONFIG.map((conf) => {
      const items = filteredList.filter((b) => {
        const itemType = b.raw.bookmarkType || 'reading_other';
        return itemType === conf.type;
      });
      return {
        key: conf.type,
        title: conf.title,
        items,
        Icon: Bookmark,
        id: conf.id,
      };
    }).filter((sec) => sec.items.length > 0);
  }, [filteredList]);

  // Compact TOC Items (Max 6–8 items synchronized with showcase sections)
  const tocItems = useMemo(() => {
    const items: Array<{
      key: string;
      label: string;
      count: number;
      Icon: React.ComponentType<{ className?: string }> | null;
      id: string;
    }> = [];

    // 1. Semua
    items.push({
      key: 'all',
      label: 'Semua',
      count: filteredList.length,
      Icon: null,
      id: 'section-all',
    });

    // 2. Pinned
    if (pinnedBookmarks.length > 0) {
      items.push({
        key: 'pinned',
        label: 'Pinned',
        count: pinnedBookmarks.length,
        Icon: Pin,
        id: 'section-pinned',
      });
    }

    // 3. Curated Sections
    curatedSections.forEach((sec) => {
      items.push({
        key: sec.key,
        label: sec.title,
        count: sec.items.length,
        Icon: sec.Icon,
        id: sec.id,
      });
    });

    return items;
  }, [filteredList.length, pinnedBookmarks.length, curatedSections]);

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
    const observer = new IntersectionObserver(
      (entries) => {
        if (isUserClickingRef.current) return;

        // If top anchor is in view, activate 'all'
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

    const sectionEls = document.querySelectorAll('[data-bookmark-section]');
    sectionEls.forEach((el) => observer.observe(el));

    if (topContentRef.current) {
      observer.observe(topContentRef.current);
    }

    return () => observer.disconnect();
  }, [tocItems]);

  // Actions
  const handleTogglePin = async (item: BookmarkItem) => {
    const nextPinned = !item.isPinned;
    setBookmarks((prev) =>
      prev.map((b) => (b.id === item.id ? { ...b, isPinned: nextPinned } : b))
    );

    try {
      const res = await fetch(`/api/notes/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPinned: nextPinned }),
      });
      if (!res.ok) throw new Error();
      toast.success(nextPinned ? 'Bookmark disematkan' : 'Semat dilepas');
    } catch {
      setBookmarks((prev) =>
        prev.map((b) => (b.id === item.id ? { ...b, isPinned: item.isPinned } : b))
      );
      toast.error('Gagal memperbarui pin');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setBookmarks((prev) => prev.filter((b) => b.id !== id));
        toast.success('Bookmark berhasil dihapus');
      } else {
        toast.error('Gagal menghapus bookmark');
      }
    } catch {
      toast.error('Terjadi kesalahan jaringan');
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Tautan disalin ke clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleExpand = (platformKey: string) => {
    setExpandedPlatforms((prev) => ({
      ...prev,
      [platformKey]: !prev[platformKey],
    }));
  };

  // Section Grid Helper
  const renderSection = (
    title: string,
    items: ParsedBookmark[],
    platformKey: string,
    sectionId: string,
    IconComponent?: React.ComponentType<{ className?: string }> | null,
    showAddCard = false
  ) => {
    if (items.length === 0 && !showAddCard) return null;

    const isExpanded = Boolean(expandedPlatforms[platformKey]);
    const displayItems = isExpanded ? items : items.slice(0, 5);
    const hasMore = items.length > 5;

    return (
      <div id={sectionId} data-bookmark-section className="space-y-3.5 scroll-mt-6 sm:scroll-mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-xl sm:text-2xl font-normal text-ink tracking-tight font-sans">
            {title}
          </h2>

          {hasMore && (
            <button
              type="button"
              onClick={() => toggleExpand(platformKey)}
              className="text-caption-sm text-body hover:text-ink font-mono cursor-pointer flex items-center gap-1 transition-colors"
            >
              <span>{isExpanded ? 'Tampilkan Lebih Sedikit' : 'Lihat Semua'}</span>
              <ChevronRight
                className={`w-3.5 h-3.5 transition-transform duration-200 ${ isExpanded ? 'rotate-90' : '' }`}
              />
            </button>
          )}
        </div>

        <div className="w-full max-w-[1760px] flex flex-col gap-0 md:block md:columns-[280px] md:[column-width:280px] lg:columns-[310px] lg:[column-width:310px] md:gap-4 [column-gap:0.875rem] md:[column-gap:1rem]">
          {displayItems.map((bm) => (
            <BookmarkCard
              key={bm.raw.id}
              bm={bm}
              onDelete={handleDelete}
              onTogglePin={handleTogglePin}
              onTagClick={(tag) => setSearchQuery(tag)}
              onEdit={(item) => {
                openedFromDetailRef.current = false;
                setEditingItem(item);
              }}
              onClick={(item) => {
                setSelectedBookmarkForDetail(item);
              }}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-full px-4 sm:px-6 md:px-8 pb-32 sm:pb-8 md:pb-12 bg-canvas text-ink relative">
      {/* 1. Header: Title, Export Button, and Subtitle */}
      <div className="pt-3.5 sm:pt-6 pb-2 sm:pb-3">
        <div className="flex items-center gap-3">
          <h1 className="text-display-lg sm:text-display-xl text-ink font-semibold tracking-tight flex items-baseline gap-2.5 flex-wrap">
            <span>{userLastName}</span>
            <span className="font-tangerine tangerine-bold text-[1.15em] leading-none inline-block">
              Bookmarks
            </span>
          </h1>

          {bookmarks.length > 0 && (
            <a
              href="/api/bookmarks/export"
              download="unlazynotes-bookmarks.html"
              className="ml-2 hidden sm:inline-flex"
            >
              <Button
                variant="secondary"
                className="rounded-full text-caption-sm gap-1.5 h-8 px-3"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export HTML</span>
              </Button>
            </a>
          )}
        </div>
        <p className="text-body-sm text-body mt-0.5">
          Koleksi tautan penting, repositori, artikel, dan referensi multimedia tersimpan.
        </p>
      </div>

      {/* 2. Controls Row: Searchbox (Sticky on Mobile & Desktop, solid white background flush at top) */}
      <div className="sticky top-0 z-20 bg-canvas -mx-4 px-4 sm:-mx-6 sm:px-6 md:-mx-8 md:px-8 py-2.5 flex items-center gap-2">
        <SearchPill
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari bookmark & tautan..."
        />
      </div>

      {/* Main Layout: Left Filter Sidebar + Right Content Area */}
      <div className="mt-4 sm:mt-5">
      {bookmarks.length === 0 ? (
        <div className="flex flex-col items-center justify-center pt-16 sm:pt-20 pb-16 text-center mx-auto max-w-md w-full">
          <div className="w-12 h-12 rounded-full bg-surface-soft flex items-center justify-center text-body mb-4">
            <Bookmark className="w-6 h-6" />
          </div>
          <h2 className="text-heading-lg text-ink font-semibold mb-2">
            Belum ada bookmark
          </h2>
          <p className="text-body-sm text-body max-w-sm leading-relaxed">
            Simpan tautan penting pertama Anda dengan tombol Add Bookmark di bawah atau melalui bot Telegram.
          </p>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 items-start w-full">
          {/* Left Column: TOC (Sticky on Mobile & Desktop below sticky searchbox) */}
          <div className="w-[calc(100%+2rem)] sm:w-48 shrink-0 sticky top-14 sm:top-16 z-10 sm:z-auto bg-canvas sm:bg-transparent -mx-4 px-4 sm:mx-0 sm:px-0 py-1.5 sm:py-0 self-start">
            <div className="flex sm:flex-col gap-1 overflow-x-auto sm:overflow-visible pb-1 sm:pb-0 items-start sm:items-end no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden pr-4 sm:pr-0">
              {tocItems.map((item) => {
                const IconComponent = item.Icon;
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
                    {IconComponent && <IconComponent className="w-3.5 h-3.5 shrink-0" />}
                    <span>{item.label}</span>
                    <span className="text-xs sm:text-[13px] font-mono opacity-85 tabular-nums">
                      {item.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Main Content Area */}
          <div ref={topContentRef} id="section-all" data-bookmark-section className="flex-1 min-w-0 w-full space-y-8">
            {/* 1. Section Pinned matching wireframe */}
            {pinnedBookmarks.length > 0 && (
              <div id="section-pinned" data-bookmark-section className="space-y-3.5 scroll-mt-6 sm:scroll-mt-8">
                <h2 className="text-xl sm:text-2xl font-normal text-ink tracking-tight font-sans">
                  Pinned
                </h2>

                <div className="w-full max-w-[1760px] flex flex-col gap-0 md:block md:columns-[280px] md:[column-width:280px] lg:columns-[310px] lg:[column-width:310px] md:gap-4 [column-gap:0.875rem] md:[column-gap:1rem]">
                  {pinnedBookmarks.map((bm) => (
                    <BookmarkCard
                      key={bm.raw.id}
                      bm={bm}
                      onDelete={handleDelete}
                      onTogglePin={handleTogglePin}
                      onTagClick={(tag) => setSearchQuery(tag)}
                      onEdit={(item) => {
                        openedFromDetailRef.current = false;
                        setEditingItem(item);
                      }}
                      onClick={(item) => {
                        setSelectedBookmarkForDetail(item);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Dynamic Curated Sections */}
            {curatedSections.map((sec) =>
              renderSection(sec.title, sec.items, sec.key, sec.id, sec.Icon)
            )}

            {/* Empty Search Result when no bookmarks match query */}
            {filteredList.length === 0 && (
              <div className="flex flex-col items-center justify-center pt-16 sm:pt-20 pb-16 text-center mx-auto max-w-md w-full">
                <div className="w-12 h-12 rounded-full bg-surface-soft flex items-center justify-center text-body mb-4">
                  <Bookmark className="w-6 h-6" />
                </div>
                <h2 className="text-heading-lg text-ink font-semibold mb-2">
                  Tidak ada bookmark yang cocok
                </h2>
                <p className="text-body-sm text-body max-w-sm leading-relaxed">
                  {searchQuery
                    ? `Tidak ada bookmark yang cocok dengan kata kunci "${searchQuery}".`
                    : 'Tidak ada bookmark tersimpan.'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
      </div>

      {/* New Bookmark Modal */}
      {isNewModalOpen && (
        <NewBookmarkModal
          isOpen={isNewModalOpen}
          onClose={() => setIsNewModalOpen(false)}
          onCreated={(newItem) => {
            setBookmarks((prev) => [newItem, ...prev]);
          }}
        />
      )}

      {/* Note Detail Modal (Desktop View) */}
      {selectedBookmarkForDetail && (
        <NoteDetailModal
          isOpen={Boolean(selectedBookmarkForDetail)}
          note={{
            id: selectedBookmarkForDetail.id,
            content: selectedBookmarkForDetail.content,
            category: selectedBookmarkForDetail.category || 'bookmark',
            specificTags: selectedBookmarkForDetail.specificTags,
            source: selectedBookmarkForDetail.source,
            isPinned: selectedBookmarkForDetail.isPinned,
            attachments: selectedBookmarkForDetail.attachments,
            createdAt: selectedBookmarkForDetail.createdAt,
          }}
          onClose={() => setSelectedBookmarkForDetail(null)}
          onEdit={() => {
            openedFromDetailRef.current = true;
            const target = selectedBookmarkForDetail;
            setSelectedBookmarkForDetail(null);
            setEditingItem(target);
          }}
          onDelete={(id) => {
            handleDelete(id);
            setSelectedBookmarkForDetail(null);
          }}
          onTogglePin={(id, isPinned) => {
            setBookmarks((prev) =>
              prev.map((b) => (b.id === id ? { ...b, isPinned } : b))
            );
            setSelectedBookmarkForDetail((prev) =>
              prev && prev.id === id ? { ...prev, isPinned } : prev
            );
          }}
        />
      )}

      {/* Edit Note Modal */}
      {editingItem && (
        <EditNoteModal
          isOpen={Boolean(editingItem)}
          note={{
            id: editingItem.id,
            content: editingItem.content,
            category: 'bookmark',
            specificTags: editingItem.specificTags,
          }}
          onClose={() => {
            openedFromDetailRef.current = false;
            setEditingItem(null);
          }}
          onCancel={() => {
            const prev = editingItem;
            setEditingItem(null);
            if (openedFromDetailRef.current && prev) {
              setSelectedBookmarkForDetail(prev);
            }
            openedFromDetailRef.current = false;
          }}
          onSave={(updated) => {
            setBookmarks((prev) =>
              prev.map((b) => (b.id === updated.id ? { ...b, ...updated } : b))
            );
            setEditingItem(null);
            openedFromDetailRef.current = false;
            toast.success('Bookmark berhasil diperbarui');
          }}
        />
      )}

      {/* Floating Action Button: Add Bookmark in bottom-right corner */}
      <button
        type="button"
        onClick={() => setIsNewModalOpen(true)}
        className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-40 w-14 h-14 sm:w-auto sm:h-auto p-0 sm:py-3 sm:px-6 rounded-full bg-canvas text-ink border border-hairline shadow-md hover:bg-surface-soft active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
        title="Tambah Bookmark Baru"
        aria-label="Add Bookmark"
      >
        <span className="hidden sm:inline text-body-sm font-medium">Add Bookmark</span>
        <Plus className="w-7 h-7 sm:w-4.5 sm:h-4.5 text-ink" />
      </button>
    </div>
  );
}
