import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Pin,
  PinOff,
  Pencil,
  Trash2,
  Copy,
  Check,
  ExternalLink,
  FileIcon,
  ImageIcon,
  Loader2,
  Globe,
  KeyRound,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { toast } from 'sonner';
import type { NoteItem } from './NotesTimeline';

// Crisp Platform SVGs
function YoutubeIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function GithubIcon({ className = 'w-4 h-4' }: { className?: string }) {
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

function TwitterIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function LinkedinIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76c-.95 0-1.72-.77-1.72-1.72s.77-1.72 1.72-1.72 1.72.77 1.72 1.72-.77 1.72-1.72 1.72m1.39 9.74v-8.37H5.07v8.37h2.78z" />
    </svg>
  );
}

function InstagramIcon({ className = 'w-4 h-4' }: { className?: string }) {
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

function getUrlPlatformInfo(url: string) {
  let domain = '';
  try {
    domain = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    domain = url;
  }

  if (domain.includes('youtube.com') || domain.includes('youtu.be')) {
    return { domain, label: 'YouTube', icon: YoutubeIcon };
  }
  if (domain === 'github.com') {
    return { domain, label: 'GitHub', icon: GithubIcon };
  }
  if (domain === 'twitter.com' || domain === 'x.com') {
    return { domain, label: 'Twitter / X', icon: TwitterIcon };
  }
  if (domain.includes('linkedin.com')) {
    return { domain, label: 'LinkedIn', icon: LinkedinIcon };
  }
  if (domain.includes('instagram.com')) {
    return { domain, label: 'Instagram', icon: InstagramIcon };
  }
  return { domain, label: domain, icon: Globe };
}

interface NoteDetailModalProps {
  note: NoteItem | null;
  isOpen: boolean;
  isVault?: boolean;
  onClose: () => void;
  onEdit: (note: NoteItem) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string, isPinned: boolean) => void;
}

export default function NoteDetailModal({
  note,
  isOpen,
  isVault,
  onClose,
  onEdit,
  onDelete,
  onTogglePin,
}: NoteDetailModalProps) {
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isTogglingPin, setIsTogglingPin] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  // Extract explicit or mapped target dates for schedule visualization
  const targetDatesList = useMemo(() => {
    if (!note) return [];
    const datesSet = new Set<string>();
    if (Array.isArray(note.scheduleDates) && note.scheduleDates.length > 0) {
      for (const d of note.scheduleDates) if (d && typeof d === 'string') datesSet.add(d);
    }
    if (Array.isArray(note.schedule?.dates) && note.schedule.dates.length > 0) {
      for (const d of note.schedule.dates) if (d && typeof d === 'string') datesSet.add(d);
    }
    if (note.targetDate) {
      try {
        const d = note.targetDate instanceof Date ? note.targetDate : parseISO(String(note.targetDate));
        if (!isNaN(d.getTime())) datesSet.add(format(d, 'yyyy-MM-dd'));
      } catch {}
    }
    return Array.from(datesSet).sort();
  }, [note]);

  if (!isOpen || !note || !mounted) return null;

  const isVaultNote =
    Boolean(isVault) ||
    Boolean(note.vaultKey) ||
    note.category === 'vault' ||
    (Array.isArray(note.specificTags) &&
      note.specificTags.some((t: string) => t.toLowerCase() === 'vault'));

  const formattedDate = (() => {
    try {
      const d = new Date(note.createdAt);
      return format(d, 'EEEE, d MMMM yyyy • HH:mm', { locale: localeId }) + ' WIB';
    } catch {
      return note.createdAt;
    }
  })();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(note.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

    const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }

    // Optimistic instant delete
    onDelete(note.id);
    onClose();

    try {
      const res = await fetch(`/api/notes/${note.id}`, { method: 'DELETE' });
      if (!res.ok) {
        throw new Error('Gagal');
      }
    } catch {
      toast.error('Gagal menghapus catatan');
    }
  };

  const handlePinClick = async () => {
    setIsTogglingPin(true);
    const nextPinned = !note.isPinned;
    try {
      const res = await fetch(`/api/notes/${note.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPinned: nextPinned }),
      });
      if (res.ok) {
        onTogglePin(note.id, nextPinned);
      }
    } catch (e) {
      console.error('Failed to toggle pin', e);
    } finally {
      setIsTogglingPin(false);
    }
  };

  // Extract URLs from content to show link embed cards
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const urls = Array.from(new Set(note.content.match(urlRegex) || []));



  return createPortal(
    <>
      {/* Full-screen Backdrop covering 100% viewport - overlay click does NOT close modal */}
      <div
        className="fixed inset-0 z-[9998] bg-black/75 backdrop-blur-sm select-none"
        style={{ top: 0, left: 0, right: 0, bottom: 0 }}
        aria-hidden="true"
      />

      {/* Modal Dialog Container */}
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center px-4 py-8 sm:py-8 sm:px-6 pointer-events-none select-none"
        style={{ top: 0, left: 0, right: 0, bottom: 0, height: '100dvh' }}
      >
        <div className="w-full max-w-3xl sm:max-w-4xl min-h-[min(380px,80dvh)] sm:min-h-[440px] max-h-[80dvh] sm:max-h-[85dvh] flex flex-col rounded-2xl bg-canvas text-ink pointer-events-auto overflow-hidden my-auto shadow-2xl relative">
          {/* Top Bar: Title on left, Action icon buttons on right */}
          <div className="flex items-center justify-between px-6 pt-5 pb-2 bg-canvas shrink-0 select-none">
            <div className="flex items-center gap-2 text-caption-sm text-body font-mono">
              <span className="text-caption-sm font-semibold text-body uppercase tracking-wider font-mono">
                Detail Catatan
              </span>
            </div>

            <div className="flex items-center gap-1 sm:gap-1.5">
              {/* Pin / Unpin Button (di samping kiri tombol salin) */}
              <button
                type="button"
                onClick={handlePinClick}
                disabled={isTogglingPin}
                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center cursor-pointer transition-colors !border-0 ${
                  note.isPinned
                    ? 'text-primary bg-surface-soft hover:bg-surface-soft/80'
                    : 'text-body hover:text-ink hover:bg-surface-soft'
                }`}
                title={note.isPinned ? 'Lepas sematan (Unpin)' : 'Sematkan catatan (Pin)'}
                aria-label="Pin Button"
              >
                {isTogglingPin ? (
                  <Loader2 className="w-4.5 h-4.5 animate-spin" />
                ) : note.isPinned ? (
                  <PinOff className="w-4.5 h-4.5" />
                ) : (
                  <Pin className="w-4.5 h-4.5" />
                )}
              </button>

              {/* Copy Button */}
              <button
                type="button"
                onClick={handleCopy}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-body hover:text-ink hover:bg-surface-soft cursor-pointer transition-colors !border-0"
                title="Salin isi catatan"
                aria-label="Salin catatan"
              >
                {copied ? <Check className="w-4.5 h-4.5 text-terminal-green" /> : <Copy className="w-4.5 h-4.5" />}
              </button>

              {/* Edit Button */}
              <button
                type="button"
                onClick={() => {
                  onEdit(note);
                  onClose();
                }}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-body hover:text-ink hover:bg-surface-soft cursor-pointer transition-colors !border-0"
                title="Edit catatan"
                aria-label="Edit catatan"
              >
                <Pencil className="w-4.5 h-4.5" />
              </button>

              {/* Delete Button */}
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

              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-body hover:text-ink hover:bg-surface-soft cursor-pointer transition-colors ml-0.5 sm:ml-1 !border-0"
                title="Tutup detail catatan"
                aria-label="Tutup modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal Body: Scrollable with natural writing canvas, no divider */}
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
                    <span className="truncate">{note.vaultKey || 'Catatan Vault'}</span>
                  </div>
                </div>
              )}

              {/* Notes content */}
              <div className="text-body-md text-ink leading-relaxed whitespace-pre-wrap select-text font-sans">
                {note.content}
              </div>

              {/* File / Gambar / Thumbnail embed link section */}
              {(urls.length > 0 || (note.attachments && note.attachments.length > 0)) && (
                <div className="pt-6 space-y-3 select-none">
                  {/* Attachments if any */}
                  {note.attachments && note.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {note.attachments.map((att: any, i: number) => (
                        <div
                          key={att.fileId || i}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-soft text-caption-sm text-ink max-w-full"
                        >
                          {att.type === 'image' ? (
                            <ImageIcon className="w-4 h-4 text-mute shrink-0" />
                          ) : (
                            <FileIcon className="w-4 h-4 text-mute shrink-0" />
                          )}
                          <span className="truncate max-w-[200px] sm:max-w-xs font-mono">{att.fileName || `Attachment-${i + 1}`}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Embedded URL Link Cards with Platform Specific Icons */}
                  {urls.length > 0 && (
                    <div className="flex flex-wrap gap-2.5">
                      {urls.map((linkUrl, index) => {
                        const { domain, label, icon: PlatformIcon } = getUrlPlatformInfo(linkUrl);
                        

                        return (
                          <a
                            key={linkUrl}
                            href={linkUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-surface-soft hover:bg-surface border-0 transition-all group text-left max-w-full"
                          >
                            <div className="w-8 h-8 rounded-lg bg-canvas border-0 flex items-center justify-center shrink-0 text-body group-hover:text-ink">
                              <PlatformIcon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 pr-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-caption-sm font-semibold text-ink group-hover:underline truncate block">
                                  {label !== domain ? `${label} (${domain})` : domain}
                                </span>
                                
                              </div>
                              <span className="text-[11px] text-body truncate block font-mono max-w-[240px] sm:max-w-xs">
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
                  {note.category}
                </span>
                {note.specificTags &&
                  note.specificTags.map((tag) => (
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
                        {note.schedule?.isRecurring && (
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
        </div>
      </div>
    </>,
    document.body
  );
}
