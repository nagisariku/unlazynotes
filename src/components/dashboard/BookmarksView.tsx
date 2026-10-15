import { useState } from 'react';
import { Bookmark, Download, ExternalLink, Calendar, Trash2, Copy, Check } from 'lucide-react';
import { format } from 'date-fns';
import { Toaster, toast } from 'sonner';

interface BookmarkItem {
  id: string;
  content: string;
  specificTags?: string[] | null;
  source?: string | null;
  createdAt: string;
}

interface BookmarksViewProps {
  initialBookmarks: BookmarkItem[];
}

export default function BookmarksView({ initialBookmarks }: BookmarksViewProps) {
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>(initialBookmarks);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setBookmarks((prev) => prev.filter((b) => b.id !== id));
        toast.success('Bookmark berhasil dihapus');
      }
    } catch {}
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Tautan disalin ke clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto p-3.5 sm:p-8">
      <Toaster position="bottom-right" theme="dark" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            <span>Bookmarks</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              {bookmarks.length}
            </span>
          </h1>
          <p className="text-zinc-400 text-xs mt-1">
            Seluruh tautan artikel, video, dan referensi bacaan yang disimpan.
          </p>
        </div>

        {/* Export Button */}
        {bookmarks.length > 0 && (
          <a
            href="/api/bookmarks/export"
            download="unlazynotes-bookmarks.html"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition-all shadow-lg shadow-cyan-600/20 w-full sm:w-auto"
          >
            <Download className="w-4 h-4" />
            <span>Export to Browser (HTML)</span>
          </a>
        )}
      </div>

      {/* Bookmarks Grid */}
      {bookmarks.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {bookmarks.map((b) => {
            const urlRegex = /(https?:\/\/[^\s]+)/gi;
            const urls = Array.from(b.content.matchAll(urlRegex), (m) => m[0]);
            const primaryUrl = urls[0] || b.content;
            const title = b.content.replace(urlRegex, '').trim() || primaryUrl;

            return (
              <div
                key={b.id}
                className="p-4 sm:p-5 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 hover:border-zinc-700/80 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3 text-xs">
                    <span className="text-zinc-500 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {format(new Date(b.createdAt), 'dd MMM yyyy')}
                    </span>
                    {b.source && (
                      <span className="px-2 py-0.5 rounded-full border border-cyan-500/20 bg-cyan-500/10 text-cyan-400 text-[11px] font-bold uppercase tracking-wider">
                        {b.source}
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-semibold text-zinc-100 mb-2 leading-snug line-clamp-2">
                    {title}
                  </h3>

                  {urls.length <= 1 ? (
                    <a
                      href={primaryUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium break-all max-w-full truncate mb-4"
                    >
                      <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{primaryUrl}</span>
                    </a>
                  ) : (
                    <div className="space-y-1.5 mb-4 max-h-32 overflow-y-auto">
                      {urls.map((u, i) => (
                        <a
                          key={i}
                          href={u}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium break-all max-w-full truncate block"
                        >
                          <ExternalLink className="w-3 h-3 shrink-0" />
                          <span className="truncate">{u}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-zinc-800/60 flex items-center justify-between gap-2 text-xs">
                  <div className="flex flex-wrap gap-1">
                    {b.specificTags?.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-400 text-[11px]"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleCopy(b.id, primaryUrl)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                      title="Copy URL"
                    >
                      {copiedId === b.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(b.id)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 transition-colors"
                      title="Delete Bookmark"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-20 text-center rounded-3xl border border-dashed border-zinc-800 bg-zinc-900/20 max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center text-zinc-400 mx-auto mb-4">
            <Bookmark className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-zinc-200 mb-1">Belum Ada Bookmark</h3>
          <p className="text-zinc-500 text-xs max-w-sm mx-auto mb-4">
            Kirimkan tautan artikel atau video ke bot Telegram Anda. AI akan otomatis mengelompokkannya di sini!
          </p>
        </div>
      )}
    </div>
  );
}
