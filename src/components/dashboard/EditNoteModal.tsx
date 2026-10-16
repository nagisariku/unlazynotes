import { useState, useEffect } from 'react';
import { X, Tag, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';

interface EditNoteModalProps {
  note: {
    id: string;
    content: string;
    category: string;
    specificTags?: string[] | null;
  } | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedNote: any) => void;
}

const ALL_CATEGORIES = [
  'todo',
  'finance',
  'schedule',
  'bookmark',
  'draft',
  'credential',
  'reference',
  'random-yap',
  'others',
] as const;

export default function EditNoteModal({
  note,
  isOpen,
  onClose,
  onSave,
}: EditNoteModalProps) {
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<string>('others');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (note) {
      setContent(note.content);
      setCategory(note.category);
      setTags(note.specificTags || []);
      setTagInput('');
    }
  }, [note, isOpen]);

  if (!isOpen || !note) return null;

  const handleAddTag = () => {
    const clean = tagInput
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .slice(0, 20);

    if (!clean) return;

    if (!tags.includes(clean)) {
      setTags((prev) => [...prev, clean]);
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
    setTags((prev) => prev.filter((t) => t !== tagToRemove));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      toast.error('Konten catatan tidak boleh kosong');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/notes/${note.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content.trim(),
          category,
          specificTags: tags,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success || !data.note) {
        toast.error(data.error || 'Gagal menyimpan perubahan');
        return;
      }

      onSave(data.note);
      toast.success('Catatan berhasil diperbarui');
      onClose();
    } catch {
      toast.error('Terjadi kesalahan jaringan');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-zinc-800 bg-zinc-950 p-5 sm:p-7 shadow-2xl text-zinc-100 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-zinc-100 flex items-center gap-2">
              <span>Edit Catatan</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Perbarui teks, kategori, atau tag spesifik catatan Anda.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleFormSubmit} className="space-y-4">
          {/* Content */}
          <div>
            <label className="text-xs font-medium text-zinc-300 block mb-1.5">
              Konten Catatan
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              placeholder="Tulis konten catatan..."
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900/60 text-zinc-100 placeholder-zinc-500 text-xs sm:text-sm focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/50 resize-y leading-relaxed"
            />
          </div>

          {/* Category Dropdown */}
          <div>
            <label className="text-xs font-medium text-zinc-300 block mb-1.5">
              Kategori
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-200 text-xs sm:text-sm focus:outline-none focus:border-indigo-500/60 cursor-pointer"
            >
              {ALL_CATEGORIES.map((cat) => (
                <option key={cat} value={cat} className="bg-zinc-900 text-zinc-200">
                  {cat.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Specific Tags */}
          <div>
            <label className="text-xs font-medium text-zinc-300 block mb-1.5">
              Specific Tags
            </label>
            
            {/* Existing Tag Chips */}
            <div className="flex flex-wrap items-center gap-1.5 mb-2 min-h-6">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800 border border-zinc-700/80 text-zinc-300 text-xs"
                >
                  <Tag className="w-3 h-3 text-indigo-400" />
                  <span>#{tag}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="text-zinc-500 hover:text-rose-400 cursor-pointer transition-colors"
                    title={`Hapus tag #${tag}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {tags.length === 0 && (
                <span className="text-xs text-zinc-600 italic">Belum ada specific tags</span>
              )}
            </div>

            {/* Input Tag */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagInputKeyDown}
                placeholder="Ketik tag lalu tekan Enter atau koma..."
                className="flex-1 px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900/60 text-zinc-200 placeholder-zinc-500 text-xs focus:outline-none focus:border-indigo-500/60"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors cursor-pointer"
              >
                + Tambah
              </button>
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">
              Gunakan huruf kecil dan tanda hubung (-) tanpa spasi.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSaving || !content.trim()}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Simpan Perubahan</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
