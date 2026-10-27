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
  BookOpen,
  Sparkles,
  Share2,
  Eye,
  SlidersHorizontal,
} from 'lucide-react';
import { getUrlPlatformInfo, getLinkThumbnail, getLinkTitle } from '@/lib/platform-icons';
import { format, isThisMonth } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { toast } from 'sonner';
import { Button, SearchPill } from '../ui';
import NewBookmarkModal from './NewBookmarkModal';
import AskAiButton from './AskAiButton';
import AskAiModal from './AskAiModal';
import NoteDetailModal from './NoteDetailModal';
import BookmarkFilterModal from './BookmarkFilterModal';
import type { BookmarkType, BookmarkMeta } from '../../db/schema';

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
  bookmarkMeta?: BookmarkMeta | null;
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

export type PlatformType = 'youtube' | 'github' | 'twitter' | 'linkedin' | 'instagram' | 'reddit' | 'other';

interface ParsedBookmark {
  raw: BookmarkItem;
  url: string;
  domain: string;
  platform: PlatformType;
  title: string;
  favicon: string | null;
  caption?: string | null;
  readingStatus: 'unread' | 'reading' | 'read';
  readingTimeMin?: number;
  aiSummary?: string[];
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

function RedditIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.702zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.197-2.512-.73a.326.326 0 0 0-.232-.095z" />
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
        thumbnail = `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg`;
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

  const favicon = (item.bookmarkMeta?.faviconUrl) || (domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64` : null);
  const title = item.bookmarkMeta?.title || (primaryUrl ? domain : 'Catatan');

  return {
    raw: item,
    url: primaryUrl,
    domain,
    platform,
    title,
    thumbnail: item.bookmarkMeta?.imageUrl || thumbnail,
    favicon,
    caption: item.bookmarkMeta?.caption || null,
    readingStatus: item.bookmarkMeta?.readingStatus || 'unread',
    readingTimeMin: item.bookmarkMeta?.readingTimeMin,
    aiSummary: item.bookmarkMeta?.aiSummary,
    notes: item.content || '',
  };
}

interface BookmarkCardProps {
  bm: ParsedBookmark;
  onDelete: (id: string) => Promise<void> | void;
  onTogglePin: (item: BookmarkItem) => Promise<void> | void;
  onEdit: (item: BookmarkItem) => void;
  onClick: (item: BookmarkItem) => void;
  onOpenReader?: (item: BookmarkItem) => void;
  onTagClick?: (tag: string) => void;
}

function BookmarkCard({
  bm,
  onDelete,
  onTogglePin,
  onEdit,
  onClick,
  onOpenReader,
  onTagClick,
}: BookmarkCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPinning, setIsPinning] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleCardClick = (e: React.MouseEvent) => {
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

  const formattedDate = useMemo(() => {
    try {
      const d = new Date(bm.raw.createdAt);
      return format(d, 'EEEE, d MMMM yyyy • HH:mm', { locale: localeId }) + ' WIB';
    } catch {
      return String(bm.raw.createdAt);
    }
  }, [bm.raw.createdAt]);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(bm.raw.content);
    setCopied(true);
    toast.success('Isi bookmark disalin');
    setTimeout(() => setCopied(false), 2000);
  };

  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const urls = useMemo(() => {
    const matched = Array.from(new Set(bm.raw.content.match(urlRegex) || []));
    if (bm.url && !matched.includes(bm.url)) {
      return [bm.url, ...matched];
    }
    return matched.length > 0 ? matched : (bm.url ? [bm.url] : []);
  }, [bm.raw.content, bm.url]);

  const hasThumbnail = Boolean(bm.thumbnail) && !imgError;

  // User notes text
  const rawUserNotes = (bm.notes || bm.raw.content || '').trim();
  const textWithoutLinks = rawUserNotes.replace(urlRegex, '').trim();
  const isUserNotesOnlyLink = textWithoutLinks.length === 0;

  // Link caption (khusus postingan medsos seperti teks tweet X/Twitter, Reddit selftext)
  const linkCaption = useMemo(() => {
    // YouTube tidak memiliki postingan caption (hanya title/author)
    const isYoutube = bm.domain.includes('youtube.com') || bm.domain.includes('youtu.be');
    if (isYoutube) return null;

    const metaCap = bm.caption || bm.raw.bookmarkMeta?.caption;
    if (!metaCap) return null;
    const trimmed = metaCap.trim();
    if (!trimmed || trimmed === rawUserNotes) return null;
    // Jangan sertakan teks sintetis seperti "Video oleh..."
    if (/^video oleh/i.test(trimmed)) return null;
    return trimmed;
  }, [bm.caption, bm.raw.bookmarkMeta, bm.domain, rawUserNotes]);

  // Jika user cuma share link doang:
  // - Kalau ada caption medsos: link-nya TIDAK perlu ditampilkan (cukup caption medsos).
  // - Kalau TIDAK ada caption medsos:
  //   - Jika ada thumbnail: sembunyikan teks link mentah (karena thumbnail & judul sudah mewakili).
  //   - Jika tidak ada thumbnail (pure link text): tampilkan teks link yang user share.
  // Jika user menulis catatan sendiri: selalu tampilkan catatan user.
  const shouldShowUserNotes = isUserNotesOnlyLink
    ? (!linkCaption && !hasThumbnail)
    : Boolean(rawUserNotes);

  const compactUserNotes = useMemo(() => {
    return rawUserNotes.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  }, [rawUserNotes]);

  const compactLinkCaption = useMemo(() => {
    if (!linkCaption) return null;
    return linkCaption.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  }, [linkCaption]);

  const isAiProcessed = Boolean(
    (bm.aiSummary && bm.aiSummary.length > 0) ||
    bm.raw.bookmarkMeta?.isContentExtracted
  );

  // Helper render baris attachment link (Thumbnail + Judul berdampingan kanan-kiri)
  const renderLinkAttachmentRows = () => (
    <div className="flex flex-col gap-2 mb-2 select-none">
      {urls.map((linkUrl, index) => {
        const { label, domain: linkDomain, icon: PlatformIcon } = getUrlPlatformInfo(linkUrl);
        const thumbUrl = getLinkThumbnail(linkUrl, bm.raw.bookmarkMeta) || (urls.length === 1 ? bm.thumbnail : null);
        const metaTitle = getLinkTitle(linkUrl, bm.raw.bookmarkMeta);
        const linkTitle =
          metaTitle ||
          (urls.length === 1 && bm.title && bm.title !== bm.url
            ? bm.title
            : index === 0 && bm.title && bm.title !== bm.url
            ? bm.title
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

  return (
    <div
      onClick={handleCardClick}
      className={`group relative text-left break-inside-avoid [break-inside:avoid-column] transition-all overflow-hidden ${
        isExpanded && isMobile
          ? '!bg-zinc-100 !border !border-hairline-strong !p-3.5 !rounded-lg my-2 shadow-xs cursor-default select-text'
          : 'px-1 py-3.5 md:p-3.5 rounded-none md:rounded-2xl border-0 border-b border-hairline last:border-b-0 md:border md:border-hairline bg-transparent md:bg-canvas hover:border-b-hairline-strong md:hover:border-hairline-strong cursor-pointer select-none mb-0 md:mb-4 shadow-none md:shadow-2xs'
      } flex flex-col justify-between`}
    >
      <div className="flex flex-col flex-1 justify-start min-w-0">
        {/* Date and Time displayed at top when expanded on mobile */}
        {isExpanded && isMobile && (
          <div className="text-[11px] text-mute font-mono mb-2.5 select-none">
            {formattedDate}
          </div>
        )}

        {/* 1. Top row: icon/source on left, badge read and badge AI on right */}
        <div className="flex items-center justify-between gap-2 mb-2 select-none">
          <div className="flex items-center gap-1.5 min-w-0">
            {bm.favicon ? (
              <img
                src={bm.favicon}
                alt=""
                className="w-4 h-4 rounded-xs shrink-0 object-contain"
                onError={(e) => ((e.target as HTMLElement).style.display = 'none')}
              />
            ) : (
              <Globe className="w-4 h-4 text-mute shrink-0" />
            )}
            <span className="text-[11px] font-mono text-mute truncate max-w-[150px]">
              {bm.domain}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Badge Read: icon only (ONLY if read, neutral color, Check icon, w-4 h-4, hidden on mobile by default) */}
            {bm.readingStatus === 'read' && (!isMobile || isExpanded) && (
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
                  onOpenReader?.(bm.raw);
                }}
                title="Buka Mode Baca (Ringkasan AI & Transkrip)"
                className="flex items-center justify-center text-mute hover:text-ink cursor-pointer p-0.5 rounded-full hover:bg-surface-soft !border-0"
              >
                <Sparkles className="w-4 h-4 text-mute hover:text-ink" />
              </button>
            )}
          </div>
        </div>

        {/* 2. User Notes / Captions: dipadetin tanpa break line di card, kembalikan format asli saat expanded di mobile atau modal desktop */}
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
            /* Link dua atau lebih: samakan dengan tampilan mobile (thumbnail, judul, thumbnail, judul) */
            renderLinkAttachmentRows()
          ) : (
            /* 1 link: thumbnail aspect-video, judul, dan direct link buttons */
            <>
              {hasThumbnail && (
                <div className="relative shrink-0 w-full aspect-video rounded-lg overflow-hidden bg-surface-soft mb-2">
                  <img
                    src={bm.thumbnail!}
                    alt={bm.title || bm.notes}
                    loading="lazy"
                    className="w-full h-full object-cover"
                    onError={() => setImgError(true)}
                  />
                </div>
              )}

              {bm.title && bm.title !== bm.url && (
                <h4 className="text-body-sm font-medium text-ink line-clamp-2 leading-snug mb-2">
                  {bm.title}
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
            bm.title && bm.title !== bm.url && (
              <h4 className="text-body-sm font-medium text-ink line-clamp-2 leading-snug mb-2">
                {bm.title}
              </h4>
            )
          )}
        </div>
      </div>

      {/* 6. Bottom toolbar: reveal on hover on desktop, or when expanded on mobile */}
      <div
        className={`flex items-center justify-end gap-1 mt-1 pt-0.5 select-none min-h-[26px] transition-opacity duration-150 ${
          (isExpanded && isMobile) || confirmDelete || isPinning
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none md:pointer-events-auto md:group-hover:opacity-100'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mode Baca Button */}
        {((isExpanded && isMobile) || !isMobile) && (isAiProcessed || urls.length > 0) && onOpenReader && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenReader(bm.raw);
            }}
            className="p-1.5 rounded-full text-mute hover:text-ink hover:bg-surface-soft cursor-pointer transition-colors !border-0"
            title="Buka Mode Baca (Ringkasan AI & Transkrip)"
            aria-label="Mode Baca"
          >
            <BookOpen className="w-4 h-4" />
          </button>
        )}

        {/* Copy Button */}
        {((isExpanded && isMobile) || !isMobile) && (
          <button
            type="button"
            onClick={handleCopy}
            className="p-1.5 rounded-full text-mute hover:text-ink hover:bg-surface-soft cursor-pointer transition-colors !border-0"
            title="Salin isi bookmark"
            aria-label="Salin bookmark"
          >
            {copied ? <Check className="w-4 h-4 text-terminal-green" /> : <Copy className="w-4 h-4" />}
          </button>
        )}

        {/* Edit Button */}
        {((isExpanded && isMobile) || !isMobile) && onEdit && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(bm.raw);
            }}
            className="p-1.5 rounded-full text-mute hover:text-ink hover:bg-surface-soft cursor-pointer transition-colors !border-0"
            title="Edit bookmark"
            aria-label="Edit bookmark"
          >
            <Pencil className="w-4 h-4" />
          </button>
        )}

        {/* Pin Button */}
        <button
          type="button"
          onClick={handleTogglePinInternal}
          disabled={isPinning}
          className={`p-1.5 rounded-full cursor-pointer transition-colors !border-0 ${
            bm.raw.isPinned
              ? 'text-primary bg-surface-soft'
              : 'text-mute hover:text-ink hover:bg-surface-soft'
          }`}
          title={bm.raw.isPinned ? 'Lepas Pin' : 'Pin Bookmark'}
          aria-label="Pin Button"
        >
          {isPinning ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : bm.raw.isPinned ? (
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
          className={`p-1.5 rounded-full cursor-pointer transition-colors !border-0 ${
            confirmDelete
              ? 'bg-terminal-red text-white hover:bg-terminal-red/90'
              : 'text-mute hover:text-terminal-red hover:bg-surface-soft'
          }`}
          title={confirmDelete ? 'Klik sekali lagi untuk hapus' : 'Hapus bookmark'}
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
            className="p-1.5 rounded-full text-mute hover:text-ink hover:bg-surface-soft cursor-pointer transition-colors !border-0"
            title="Ciutkan catatan"
            aria-label="Ciutkan catatan"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function BookmarksView({ initialBookmarks, userName }: BookmarksViewProps) {
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>(initialBookmarks);
  const [dateFilter, setDateFilter] = useState<'this_month' | 'all'>('this_month');
  const [activeTocKey, setActiveTocKey] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const topContentRef = useRef<HTMLDivElement>(null);
  const isUserClickingRef = useRef(false);

  const [activeBookmarkModal, setActiveBookmarkModal] = useState<BookmarkItem | null>(null);
  const [modalMode, setModalMode] = useState<'view' | 'read' | 'edit'>('view');
  const [defaultNewBookmarkContent, setDefaultNewBookmarkContent] = useState<string>('');
  const [readingStatusFilter, setReadingStatusFilter] = useState<'all' | 'unread'>('all');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  const handleOpenDetail = (item: BookmarkItem) => {
    setActiveBookmarkModal(item);
    setModalMode('view');
  };

  const handleOpenReader = (item: BookmarkItem) => {
    setActiveBookmarkModal(item);
    setModalMode('read');
  };

  const handleOpenEdit = (item: BookmarkItem) => {
    setActiveBookmarkModal(item);
    setModalMode('edit');
  };

  const userLastName = useMemo(() => {
    if (!userName || !userName.trim()) return 'User';
    const parts = userName.trim().split(/\s+/);
    return parts[parts.length - 1];
  }, [userName]);

  // Modals state
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isAskAiOpen, setIsAskAiOpen] = useState(false);

  // Auto-open new modal if launched via Share Target or Bookmarklet (?new_url=... or ?url=...)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const incomingUrl = params.get('url') || params.get('new_url');
      const incomingText = params.get('text') || params.get('title');
      if (incomingUrl) {
        const combined = incomingText ? `${incomingUrl}\n\n${incomingText}` : incomingUrl;
        setDefaultNewBookmarkContent(combined);
        setIsNewModalOpen(true);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  const handleCopyBookmarklet = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://unlazynotes.com';
    const code = `javascript:(function(){const u=encodeURIComponent(window.location.href);const t=encodeURIComponent(document.title);window.open('${origin}/dashboard/bookmarks?url='+u+'&text='+t,'_blank');})();`;
    navigator.clipboard.writeText(code);
    toast.success('Bookmarklet disalin! Tambahkan bookmarklet ini ke browser bar kamu.');
  };

  // Expanded platform sections
  const [expandedPlatforms, setExpandedPlatforms] = useState<Record<string, boolean>>({});

  // Parse all bookmarks
  const parsedList = useMemo(() => {
    return bookmarks.map(parseBookmark);
  }, [bookmarks]);

  // Filtered bookmarks based on date filter & search query
  const filteredList = useMemo(() => {
    return parsedList.filter((b) => {
      // 1. Date filter (Bulan Ini vs Semua Waktu)
      if (dateFilter === 'this_month') {
        const itemDate = new Date(b.raw.createdAt);
        if (!isThisMonth(itemDate)) return false;
      }

      // 2. Reading Status filter
      if (readingStatusFilter === 'unread' && b.readingStatus === 'read') {
        return false;
      }

      // 3. Platform filter
      if (platformFilter !== 'all') {
        if (platformFilter === 'youtube' && b.platform !== 'youtube') return false;
        if (platformFilter === 'twitter' && b.platform !== 'twitter') return false;
        if (platformFilter === 'github' && b.platform !== 'github') return false;
        if (platformFilter === 'reddit' && !b.domain.includes('reddit.com')) return false;
        if (platformFilter === 'other') {
          if (b.platform === 'youtube' || b.platform === 'twitter' || b.platform === 'github' || b.domain.includes('reddit.com')) {
            return false;
          }
        }
      }

      // 4. Category filter
      if (categoryFilter !== 'all') {
        const itemType = b.raw.bookmarkType || 'reading_other';
        if (itemType !== categoryFilter) return false;
      }

      // 5. Search query
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
  }, [parsedList, dateFilter, readingStatusFilter, platformFilter, categoryFilter, searchQuery]);

  // Active filter count for mobile filter badge
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (dateFilter === 'all') count++;
    if (readingStatusFilter === 'unread') count++;
    if (platformFilter !== 'all') count++;
    if (categoryFilter !== 'all') count++;
    return count;
  }, [dateFilter, readingStatusFilter, platformFilter, categoryFilter]);

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

  // Platform TOC Items (Synchronized with platform filter)
  const platformTocItems = useMemo(() => {
    const baseList = parsedList.filter((b) => {
      if (dateFilter === 'this_month') {
        const itemDate = new Date(b.raw.createdAt);
        if (!isThisMonth(itemDate)) return false;
      }
      if (readingStatusFilter === 'unread' && b.readingStatus === 'read') return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesContent = b.raw.content.toLowerCase().includes(q);
        const matchesDomain = b.domain.toLowerCase().includes(q);
        const matchesTags = b.raw.specificTags?.some((t) => t.toLowerCase().includes(q));
        if (!matchesContent && !matchesDomain && !matchesTags) return false;
      }
      return true;
    });

    const isPlatformMatch = (b: ParsedBookmark, pf: string) => {
      if (pf === 'all') return true;
      if (pf === 'youtube') return b.platform === 'youtube';
      if (pf === 'twitter') return b.platform === 'twitter';
      if (pf === 'github') return b.platform === 'github';
      if (pf === 'reddit') return b.domain.includes('reddit.com');
      if (pf === 'other') {
        return (
          b.platform !== 'youtube' &&
          b.platform !== 'twitter' &&
          b.platform !== 'github' &&
          !b.domain.includes('reddit.com')
        );
      }
      return true;
    };

    const platforms: Array<{
      key: string;
      label: string;
      Icon: React.ComponentType<{ className?: string }> | null;
    }> = [
      { key: 'all', label: 'Semua Platform', Icon: null },
      { key: 'youtube', label: 'YouTube', Icon: YoutubeIcon },
      { key: 'twitter', label: 'X (Twitter)', Icon: TwitterIcon },
      { key: 'github', label: 'GitHub', Icon: GithubIcon },
      { key: 'reddit', label: 'Reddit', Icon: RedditIcon },
      { key: 'other', label: 'Web & Artikel', Icon: Globe },
    ];

    return platforms.map((p) => ({
      key: p.key,
      label: p.label,
      count: baseList.filter((b) => isPlatformMatch(b, p.key)).length,
      Icon: p.Icon,
    }));
  }, [parsedList, dateFilter, readingStatusFilter, searchQuery]);

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
              onOpenReader={handleOpenReader}
              onEdit={handleOpenEdit}
              onClick={handleOpenDetail}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-full px-4 sm:px-6 md:px-8 pb-32 sm:pb-8 md:pb-12 bg-canvas text-ink relative">
      {/* 1. Header: Title, Export Button, and Subtitle */}
      <div className="pt-3.5 sm:pt-6 pb-2 sm:pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-display-lg sm:text-display-xl text-ink font-semibold tracking-tight flex items-baseline gap-2.5 flex-wrap">
              <span>{userLastName}</span>
              <span className="font-tangerine tangerine-bold text-[1.15em] leading-none inline-block">
                Bookmarks
              </span>
            </h1>

            {bookmarks.length > 0 && (
              <div className="inline-flex items-center gap-2">
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
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleCopyBookmarklet}
                  className="hidden sm:inline-flex rounded-full text-caption-sm gap-1.5 h-8 px-3 cursor-pointer"
                  title="Salin 1-Click Bookmarklet untuk Browser"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Bookmarklet</span>
                </Button>
              </div>
            )}
          </div>
          <p className="text-body-sm text-body mt-0.5">
            Koleksi tautan penting, repositori, artikel, dan referensi multimedia tersimpan.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-center shrink-0">
          <AskAiButton onClick={() => setIsAskAiOpen(true)} label="Ask Bookmark" />
        </div>
      </div>

      {/* 2. Controls Row: Searchbox + Mobile Filter Button + Desktop Filter Tabs */}
      <div className="sticky top-0 z-20 bg-canvas -mx-4 px-4 sm:-mx-6 sm:px-6 md:-mx-8 md:px-8 py-2.5 flex flex-col gap-2.5">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap">
          <SearchPill
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari bookmark & tautan..."
            wrapperClassName="flex-1 min-w-0 sm:flex-initial sm:w-72 md:w-80"
          />

          {/* Mobile Filter Button -> Opens Mobile Filter Pop-up Modal */}
          <button
            type="button"
            onClick={() => setIsFilterModalOpen(true)}
            className={`sm:hidden w-10 h-10 rounded-full flex items-center justify-center cursor-pointer shrink-0 relative transition-colors ${
              isFilterModalOpen || activeFilterCount > 0
                ? 'bg-primary text-on-primary'
                : 'bg-surface-soft text-ink hover:bg-canvas'
            }`}
            title="Filter bookmark"
            aria-label="Filter bookmark"
          >
            <SlidersHorizontal className="w-4.5 h-4.5" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-terminal-yellow text-primary font-bold text-[9px] flex items-center justify-center font-sans">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Option Tabs: Bulan Ini vs Semua Waktu (Desktop Only) */}
          <div className="hidden sm:inline-flex items-center p-1 rounded-full bg-surface-soft shrink-0">
            <button
              type="button"
              onClick={() => setDateFilter('this_month')}
              className={`px-3 sm:px-4 py-1.5 rounded-full text-caption-sm font-medium cursor-pointer transition-colors !border-0 ${
                dateFilter === 'this_month'
                  ? 'bg-canvas text-ink shadow-xs font-semibold'
                  : 'text-body hover:text-ink'
              }`}
            >
              Bulan Ini
            </button>
            <button
              type="button"
              onClick={() => setDateFilter('all')}
              className={`px-3 sm:px-4 py-1.5 rounded-full text-caption-sm font-medium cursor-pointer transition-colors !border-0 ${
                dateFilter === 'all'
                  ? 'bg-canvas text-ink shadow-xs font-semibold'
                  : 'text-body hover:text-ink'
              }`}
            >
              Semua Waktu
            </button>
          </div>

          {/* Reading Status Filter Tabs (Desktop Only: Semua vs Belum Dibaca) */}
          <div className="hidden sm:inline-flex items-center p-1 rounded-full bg-surface-soft shrink-0">
            <button
              type="button"
              onClick={() => setReadingStatusFilter('all')}
              className={`px-3 py-1.5 rounded-full text-caption-sm font-medium cursor-pointer transition-colors !border-0 ${
                readingStatusFilter === 'all'
                  ? 'bg-canvas text-ink shadow-xs font-semibold'
                  : 'text-body hover:text-ink'
              }`}
            >
              Semua
            </button>
            <button
              type="button"
              onClick={() => setReadingStatusFilter('unread')}
              className={`px-3 py-1.5 rounded-full text-caption-sm font-medium cursor-pointer transition-colors !border-0 ${
                readingStatusFilter === 'unread'
                  ? 'bg-canvas text-ink shadow-xs font-semibold'
                  : 'text-body hover:text-ink'
              }`}
            >
              Belum Dibaca
            </button>
          </div>
        </div>
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
          {/* Left Column: TOC (Desktop only, hidden on mobile) */}
          <div className="hidden sm:block sm:w-48 shrink-0 sticky top-14 sm:top-16 z-10 self-start space-y-3 sm:space-y-5">
            {/* 1. Platform ToC (di atas ToC Kategori) */}
            <div className="space-y-1">
              <div className="hidden sm:block text-[11px] font-semibold text-body uppercase tracking-wider text-right pr-3 select-none">
                Platform
              </div>
              <div className="flex sm:flex-col gap-1 overflow-x-auto sm:overflow-visible pb-1 sm:pb-0 items-start sm:items-end no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden pr-4 sm:pr-0">
                {platformTocItems.map((item) => {
                  const IconComponent = item.Icon;
                  const isActive = platformFilter === item.key;

                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setPlatformFilter(item.key)}
                      className={`py-1.5 px-2.5 sm:px-3 text-body-sm cursor-pointer flex items-center gap-1.5 whitespace-nowrap transition-colors border-b-2 ${
                        isActive
                          ? 'border-ink text-ink font-semibold'
                          : 'border-transparent text-body hover:text-ink font-medium'
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

            {/* 2. Category ToC (di bawah ToC Platform, tanpa penanda background hitam) */}
            <div className="space-y-1 sm:pt-3">
              <div className="hidden sm:block text-[11px] font-semibold text-body uppercase tracking-wider text-right pr-3 select-none">
                Kategori
              </div>
              <div className="flex sm:flex-col gap-1 overflow-x-auto sm:overflow-visible pb-1 sm:pb-0 items-start sm:items-end no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden pr-4 sm:pr-0">
                {tocItems.map((item) => {
                  const IconComponent = item.Icon;

                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => handleTocClick(item.key, item.id)}
                      className="py-1.5 px-3 rounded-full text-body-sm font-normal cursor-pointer flex items-center gap-1.5 whitespace-nowrap transition-colors text-body hover:text-ink hover:bg-surface-soft !border-0"
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
                      onOpenReader={handleOpenReader}
                      onEdit={handleOpenEdit}
                      onClick={handleOpenDetail}
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
                    : dateFilter === 'this_month'
                    ? 'Tidak ada bookmark tersimpan pada bulan ini.'
                    : 'Tidak ada bookmark tersimpan.'}
                </p>
                {dateFilter === 'this_month' && !searchQuery && (
                  <button
                    type="button"
                    onClick={() => setDateFilter('all')}
                    className="mt-4 px-4 py-2 rounded-full bg-surface-soft hover:bg-canvas text-ink text-body-sm font-medium transition-colors cursor-pointer !border-0"
                  >
                    Tampilkan Semua Waktu
                  </button>
                )}
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

      {/* Unified Note Modal */}
      {activeBookmarkModal && (
        <NoteDetailModal
          isOpen={Boolean(activeBookmarkModal)}
          initialMode={modalMode}
          note={{
            id: activeBookmarkModal.id,
            content: activeBookmarkModal.content,
            category: activeBookmarkModal.category || 'bookmark',
            bookmarkType: activeBookmarkModal.bookmarkType,
            bookmarkMeta: activeBookmarkModal.bookmarkMeta,
            specificTags: activeBookmarkModal.specificTags,
            source: activeBookmarkModal.source,
            isPinned: activeBookmarkModal.isPinned,
            attachments: activeBookmarkModal.attachments,
            createdAt: activeBookmarkModal.createdAt,
          }}
          onClose={() => {
            setActiveBookmarkModal(null);
          }}
          onDelete={(id) => {
            handleDelete(id);
            setActiveBookmarkModal(null);
          }}
          onTogglePin={(id, isPinned) => {
            setBookmarks((prev) =>
              prev.map((b) => (b.id === id ? { ...b, isPinned } : b))
            );
            setActiveBookmarkModal((prev) =>
              prev && prev.id === id ? { ...prev, isPinned } : prev
            );
          }}
          onSave={(updated) => {
            setBookmarks((prev) =>
              prev.map((b) => (b.id === updated.id ? { ...b, ...updated } : b))
            );
            setActiveBookmarkModal((prev) =>
              prev && prev.id === updated.id ? { ...prev, ...updated } : prev
            );
          }}
          onBookmarkUpdated={(updated) => {
            setBookmarks((prev) =>
              prev.map((b) => (b.id === updated.id ? { ...b, bookmarkMeta: updated.bookmarkMeta } : b))
            );
            setActiveBookmarkModal((prev) =>
              prev && prev.id === updated.id ? { ...prev, bookmarkMeta: updated.bookmarkMeta } : prev
            );
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
      {/* Dedicated Ask AI Modal */}
      <AskAiModal
        isOpen={isAskAiOpen}
        onClose={() => setIsAskAiOpen(false)}
        category="bookmark"
        placeholder="Tanya tautan penting, artikel, repositori, atau bacaan..."
        contextTitle="Bookmark & Tautan"
      />

      {/* Mobile Filter Modal Pop-up */}
      <BookmarkFilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        currentFilters={{
          dateRange: dateFilter,
          readingStatus: readingStatusFilter,
          platform: platformFilter,
          category: categoryFilter,
        }}
        onApply={(newFilters) => {
          setDateFilter(newFilters.dateRange);
          setReadingStatusFilter(newFilters.readingStatus);
          setPlatformFilter(newFilters.platform);
          setCategoryFilter(newFilters.category);
        }}
        onReset={() => {
          setDateFilter('this_month');
          setReadingStatusFilter('all');
          setPlatformFilter('all');
          setCategoryFilter('all');
        }}
      />
    </div>
  );
}
