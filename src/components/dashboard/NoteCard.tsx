import { useState } from 'react';
import { Copy, Check, Trash2, ExternalLink, Calendar, Tag, Pencil, Lock, Eye, EyeOff, Loader2, Send } from 'lucide-react';
import { format } from 'date-fns';

interface NoteCardProps {
  note: {
    id: string;
    content: string;
    category: string;
    specificTags?: string[] | null;
    source?: string | null;
    isEncrypted?: boolean;
    vaultKey?: string | null;
    createdAt: string | Date;
  };
  onDelete: (id: string) => void;
  onCopySuccess?: (content: string) => void;
  onTagClick?: (tag: string) => void;
  onEdit?: (note: NoteCardProps['note']) => void;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'random-yap': { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' },
  draft: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20' },
  bookmark: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20' },
  todo: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
  schedule: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
  finance: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  credential: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20' },
  reference: { bg: 'bg-teal-500/10', text: 'text-teal-400', border: 'border-teal-500/20' },
  others: { bg: 'bg-zinc-500/10', text: 'text-zinc-400', border: 'border-zinc-500/20' },
};

export default function NoteCard({ note, onDelete, onCopySuccess, onTagClick, onEdit }: NoteCardProps) {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Private Vault On-demand Decryption States
  const [isRevealed, setIsRevealed] = useState(false);
  const [decryptedText, setDecryptedText] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);

  const colors = CATEGORY_COLORS[note.category] || CATEGORY_COLORS.others;
  const isLong = note.content.length > 200 || note.content.split('\n').length > 4;

  const handleToggleReveal = async () => {
    if (isRevealed) {
      setIsRevealed(false);
      return;
    }
    if (decryptedText !== null) {
      setIsRevealed(true);
      return;
    }
    setIsDecrypting(true);
    try {
      const res = await fetch(`/api/notes/${note.id}/decrypt`);
      const data = await res.json();
      if (res.ok && data.content) {
        setDecryptedText(data.content);
        setIsRevealed(true);
      }
    } catch (e) {
      console.error('Failed to decrypt note', e);
    } finally {
      setIsDecrypting(false);
    }
  };

  const handleCopy = async () => {
    try {
      let textToCopy = note.content;
      if (note.isEncrypted) {
        if (decryptedText) {
          textToCopy = decryptedText;
        } else {
          const res = await fetch(`/api/notes/${note.id}/decrypt`);
          const data = await res.json();
          if (res.ok && data.content) {
            textToCopy = data.content;
            setDecryptedText(data.content);
          }
        }
      }

      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      if (onCopySuccess) onCopySuccess(textToCopy);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
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

  // Detect URLs inside content (only if not encrypted)
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const detectedUrls = note.isEncrypted ? [] : Array.from(note.content.matchAll(urlRegex), (m) => m[0]);

  return (
    <div className="p-3.5 sm:p-5 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 hover:border-zinc-700/80 transition-all flex flex-col justify-between group">
      <div>
        {/* Header: Date & Category Chip & Vault Badge */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2.5">
          <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-zinc-500">
            <Calendar className="w-3.5 h-3.5" />
            <span>{format(new Date(note.createdAt), 'dd MMM yyyy, HH:mm')}</span>
            {note.source?.toLowerCase() === 'telegram' && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-sky-500/10 text-sky-400 text-[10px] font-medium"
                title="Tersinkron otomatis via Telegram"
              >
                <Send className="w-2.5 h-2.5" />
                <span>Telegram</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {note.isEncrypted && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-rose-500/30 bg-rose-500/10 text-rose-300 text-[10px] sm:text-xs font-semibold tracking-wider">
                <Lock className="w-3 h-3 text-rose-400" />
                <span>Private Vault{note.vaultKey ? `: ${note.vaultKey}` : ''}</span>
              </span>
            )}
            <span
              className={`px-2.5 py-0.5 rounded-full border text-[10px] sm:text-xs font-semibold uppercase tracking-wider ${colors.bg} ${colors.text} ${colors.border}`}
            >
              {note.category}
            </span>
          </div>
        </div>

        {/* Content Body: Masked for Encrypted Vault */}
        {note.isEncrypted ? (
          <div className="mb-4">
            <div className="p-3 rounded-xl border border-rose-500/20 bg-rose-950/20 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Lock className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span className="text-xs font-medium text-rose-300">
                    {note.vaultKey ? `Kunci: ${note.vaultKey}` : 'Private Encrypted Secret'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleToggleReveal}
                  disabled={isDecrypting}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors cursor-pointer shrink-0 border border-zinc-700/60"
                  title={isRevealed ? 'Sembunyikan Rahasia' : 'Buka Rahasia Vault'}
                >
                  {isDecrypting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
                  ) : isRevealed ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Tutup</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5 text-rose-400" />
                      <span>Intip Rahasia</span>
                    </>
                  )}
                </button>
              </div>

              {isRevealed ? (
                <div className="p-2.5 rounded-lg bg-zinc-950/80 border border-zinc-800 text-xs font-mono text-rose-200 leading-relaxed whitespace-pre-wrap break-all select-all">
                  {decryptedText || 'Memuat...'}
                </div>
              ) : (
                <div className="text-zinc-500 font-mono text-xs tracking-widest select-none py-1">
                  ••••••••••••••••••••••••••••••••••••
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-zinc-200 text-sm leading-relaxed mb-4 whitespace-pre-wrap break-words font-normal">
            {isLong && !isExpanded ? `${note.content.substring(0, 200)}...` : note.content}

            {isLong && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="ml-2 text-indigo-400 hover:text-indigo-300 font-medium text-xs underline cursor-pointer"
              >
                {isExpanded ? 'Tutup' : 'Selengkapnya'}
              </button>
            )}
          </div>
        )}

        {/* Open Direct Links if URL detected */}
        {detectedUrls.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {detectedUrls.map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-cyan-500/20 bg-cyan-500/10 text-cyan-300 text-xs font-medium hover:bg-cyan-500/20 transition-colors max-w-full"
              >
                <ExternalLink className="w-3 h-3 shrink-0" />
                <span className="truncate max-w-[190px] sm:max-w-xs">{url}</span>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Footer: Tags & Actions */}
      <div className="pt-3 border-t border-zinc-800/60 flex items-center justify-between gap-2 text-xs">
        {/* Specific Tags (Clickable Filter Buttons) */}
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          {note.specificTags && note.specificTags.length > 0 ? (
            note.specificTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onTagClick) onTagClick(tag);
                }}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-800/80 hover:bg-indigo-600/20 text-zinc-400 hover:text-indigo-300 border border-transparent hover:border-indigo-500/30 text-[11px] transition-all cursor-pointer group/tag"
                title={`Filter catatan dengan #${tag}`}
              >
                <Tag className="w-2.5 h-2.5 group-hover/tag:text-indigo-400" />
                <span>#{tag}</span>
              </button>
            ))
          ) : (
            <span className="text-zinc-600 text-[11px]">No specific tags</span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onEdit && onEdit(note)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-indigo-300 hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Edit Catatan & Tag"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleCopy}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Copy Text"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className={`p-1.5 rounded-lg transition-colors ${
              confirmDelete
                ? 'bg-rose-500 text-white font-medium text-[11px] px-2'
                : 'text-zinc-400 hover:text-rose-400 hover:bg-zinc-800'
            }`}
            title={confirmDelete ? 'Klik sekali lagi untuk konfirmasi hapus' : 'Delete Note'}
          >
            {confirmDelete ? 'Hapus?' : <Trash2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}

