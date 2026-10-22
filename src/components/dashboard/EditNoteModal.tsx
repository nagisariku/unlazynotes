import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { X, Check, Loader2, ChevronDown, ImageIcon, FileText, KeyRound } from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { toast } from 'sonner';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

interface EditNoteModalProps {
  note: {
    id: string;
    content: string;
    category: string;
    specificTags?: string[] | null;
    vaultKey?: string | null;
    createdAt?: string | Date;
    attachments?: any;
  } | null;
  isOpen: boolean;
  isVault?: boolean;
  onClose: () => void;
  onCancel?: () => void;
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
  isVault,
  onClose,
  onCancel,
  onSave,
}: EditNoteModalProps) {
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<string>('others');
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [vaultKey, setVaultKey] = useState('');
  const [attachments, setAttachments] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      onClose();
    }
  };

  // Auto-resize textarea height to exactly match its content (expanding or shrinking dynamically)
  const adjustTextareaHeight = () => {
    const el = textareaRef.current;
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
    if (isOpen && note) {
      adjustTextareaHeight();
    }
  }, [content, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleResize = () => adjustTextareaHeight();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen]);

  useEffect(() => {
    if (note && isOpen) {
      setContent(note.content);
      setCategory(note.category || 'others');
      setVaultKey(note.vaultKey || '');
      setIsCategoryOpen(false);
      setTags(note.specificTags || []);
      setAttachments(note.attachments || []);
      setTagInput('');
      requestAnimationFrame(() => {
        adjustTextareaHeight();
        textareaRef.current?.focus();
      });
    }
  }, [note, isOpen]);

  // Handle Escape key to close dropdown or modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSaving) {
        if (isCategoryOpen) {
          setIsCategoryOpen(false);
          return;
        }
        handleCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSaving, isCategoryOpen, onCancel, onClose]);

  // Handle click outside category dropdown
  useEffect(() => {
    if (!isCategoryOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        categoryDropdownRef.current &&
        !categoryDropdownRef.current.contains(e.target as Node)
      ) {
        setIsCategoryOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isCategoryOpen]);

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

  if (!isOpen || !note) return null;

  const formattedDate = (() => {
    if (!note.createdAt) return 'Edit Catatan';
    try {
      const d = new Date(note.createdAt);
      return format(d, 'EEEE, d MMMM yyyy • HH:mm', { locale: localeId }) + ' WIB';
    } catch {
      return String(note.createdAt);
    }
  })();

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

  const isVaultNote =
    Boolean(isVault) ||
    Boolean(note?.vaultKey) ||
    note?.category === 'vault' ||
    (Array.isArray(note?.specificTags) &&
      note.specificTags.some((t: string) => t.toLowerCase() === 'vault'));

  const handleSave = async () => {
    if (!content.trim() || isSaving) {
      if (!content.trim()) toast.error('Konten catatan tidak boleh kosong');
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
          specificTags: isVaultNote ? [] : tags,
          attachments,
          vaultKey: isVaultNote ? vaultKey.trim() || null : undefined,
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

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <>
      {/* Full-screen Backdrop covering 100% viewport */}
      <div
        className="fixed inset-0 w-screen h-screen min-h-[100dvh] z-50 bg-black/40 backdrop-blur-xs select-none"
        style={{ top: 0, left: 0, right: 0, bottom: 0, minHeight: '100dvh' }}
        onClick={handleCancel}
        aria-hidden="true"
      />

      {/* Modal Dialog Container: Geometry matching NoteDetailModal with responsive safe min-height */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8 sm:py-8 sm:px-6 pointer-events-none select-none"
        style={{ top: 0, left: 0, right: 0, bottom: 0, height: '100dvh' }}
      >
        <div className="w-full max-w-3xl sm:max-w-4xl min-h-[min(380px,80dvh)] sm:min-h-[440px] max-h-[80dvh] sm:max-h-[85dvh] flex flex-col rounded-xl border border-hairline bg-canvas text-ink pointer-events-auto overflow-hidden my-auto shadow-xl">
          {/* Top Bar: date & time on left, Batalkan, Save & Close buttons on right */}
          <div className="flex items-center justify-between px-6 pt-5 pb-2 bg-canvas shrink-0 select-none">
            <div className="flex items-center gap-2 text-caption-sm text-body font-mono min-w-0 mr-2">
              <span className="truncate">{formattedDate}</span>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* Batalkan Button: Kembali ke view detail mode */}
              <button
                type="button"
                onClick={handleCancel}
                disabled={isSaving}
                className="h-9 sm:h-10 px-3.5 sm:px-4 rounded-full flex items-center justify-center text-caption-sm font-medium text-body hover:text-ink hover:bg-surface-soft cursor-pointer transition-colors disabled:opacity-50"
                title="Batalkan dan kembali ke detail catatan"
                aria-label="Batalkan edit catatan"
              >
                <span>Batalkan</span>
              </button>

              {/* Save Button */}
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || !content.trim()}
                className={`h-9 sm:h-10 px-4 sm:px-5 rounded-full flex items-center justify-center gap-1.5 text-caption-sm font-semibold cursor-pointer transition-all ${
                  content.trim() && !isSaving
                    ? 'bg-primary text-on-primary hover:opacity-90 active:scale-95'
                    : 'bg-surface-soft text-mute cursor-not-allowed opacity-60'
                }`}
                title="Simpan Perubahan (Ctrl+Enter)"
                aria-label="Simpan catatan"
              >
                {isSaving ? (
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

              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-body hover:text-ink hover:bg-surface-soft cursor-pointer transition-colors disabled:opacity-50"
                title="Tutup (Esc)"
                aria-label="Tutup modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal Body: Scrollable with natural writing canvas, matching NoteDetailModal */}
          <div className="flex-1 flex flex-col justify-between overflow-y-auto px-6 pt-3 pb-8 space-y-6 overscroll-contain">
            <div className="space-y-6">
              {/* Field Key khusus notes Vault */}
              {isVaultNote && (
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <label className="text-body-sm sm:text-body-md font-mono text-body uppercase tracking-wider shrink-0 font-medium select-none">
                    Key
                  </label>
                  <div className="flex items-center gap-2 px-3 py-1.5 sm:py-2 rounded-lg border border-hairline bg-canvas w-full max-w-xs sm:max-w-sm">
                    <KeyRound className="w-4 h-4 text-mute shrink-0" />
                    <input
                      type="text"
                      value={vaultKey}
                      onChange={(e) => setVaultKey(e.target.value)}
                      placeholder="Masukkan nama key / label vault..."
                      className="w-full bg-transparent text-ink text-body-sm font-semibold focus:outline-none placeholder:text-mute font-sans"
                    />
                  </div>
                </div>
              )}

              {/* Notes content textarea: auto-resizing, borderless, matching detail view text typography */}
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={handleTextareaKeyDown}
                placeholder="Tulis konten catatan..."
                className="w-full bg-transparent text-ink placeholder:text-mute text-body-md leading-relaxed resize-none focus:outline-none font-sans select-text min-h-[180px] sm:min-h-[220px] p-0 border-0 overflow-hidden block"
              />

              {/* Attachments if any (with delete support) */}
              {attachments && attachments.length > 0 && (
                <div className="pt-2 space-y-2 select-none">
                  <div className="flex flex-wrap gap-2">
                    {attachments.map((att: any, i: number) => (
                      <div
                        key={att.fileId || i}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-soft text-caption-sm text-ink max-w-full group"
                      >
                        {att.type === 'image' ? (
                          <ImageIcon className="w-4 h-4 text-mute shrink-0" />
                        ) : (
                          <FileText className="w-4 h-4 text-mute shrink-0" />
                        )}
                        <span className="truncate max-w-[180px] sm:max-w-xs font-mono">
                          {att.fileName || `Attachment-${i + 1}`}
                        </span>
                        <button
                          type="button"
                          onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                          className="text-mute hover:text-terminal-red cursor-pointer ml-1 p-0.5 rounded hover:bg-surface-soft/80"
                          title="Hapus lampiran"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Tags & Category placed at the very bottom of the note content inside scrollable area (Hidden for Vault notes) */}
            {!isVaultNote && (
              <div className="pt-6 pb-2 flex flex-wrap items-center gap-2 select-none">
                {/* Custom Category Dropdown Select */}
                <div className="relative inline-flex items-center" ref={categoryDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsCategoryOpen((prev) => !prev)}
                    aria-haspopup="listbox"
                    aria-expanded={isCategoryOpen}
                    className="px-3.5 py-1.5 rounded-full bg-surface-soft hover:bg-surface-soft/80 text-ink text-xs sm:text-[13px] font-sans font-medium uppercase tracking-wider cursor-pointer inline-flex items-center gap-1.5 transition-all border border-transparent hover:border-hairline active:scale-95"
                    title="Ubah Kategori"
                  >
                    <span>{category}</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-mute transition-transform duration-200 ${
                        isCategoryOpen ? 'rotate-180 text-ink' : ''
                      }`}
                    />
                  </button>

                  {isCategoryOpen && (
                    <div
                      role="listbox"
                      aria-label="Daftar Kategori"
                      className="absolute bottom-full left-0 mb-2 w-44 sm:w-48 max-h-44 sm:max-h-48 overflow-y-auto rounded-xl border border-hairline bg-canvas/95 backdrop-blur-md shadow-xl py-1 z-30 flex flex-col overscroll-contain animate-in fade-in zoom-in-95 duration-100"
                    >
                      {ALL_CATEGORIES.map((cat) => {
                        const isSelected = category.toLowerCase() === cat.toLowerCase();
                        return (
                          <button
                            key={cat}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => {
                              setCategory(cat);
                              setIsCategoryOpen(false);
                            }}
                            className={`w-full px-3.5 py-1.5 text-left text-xs sm:text-[13px] font-sans font-medium uppercase tracking-wider flex items-center justify-between cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-surface-soft text-ink font-semibold'
                                : 'text-body hover:text-ink hover:bg-surface-soft/60'
                            }`}
                          >
                            <span>{cat}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Existing Tags Chips */}
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-surface-soft text-body hover:text-ink text-xs sm:text-[13px] font-sans font-medium transition-colors"
                  >
                    <span>#{tag}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="text-mute hover:text-terminal-red cursor-pointer ml-0.5"
                      title={`Hapus tag #${tag}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}

                {/* Input inline to add new tag */}
                <div className="inline-flex items-center">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleTagInputKeyDown}
                    placeholder="+ tag baru..."
                    className="px-3.5 py-1.5 rounded-full bg-surface-soft/60 hover:bg-surface-soft focus:bg-surface-soft text-xs sm:text-[13px] text-ink placeholder:text-mute font-sans focus:outline-none w-28 sm:w-32 transition-all"
                  />
                  {tagInput.trim() && (
                    <button
                      type="button"
                      onClick={handleAddTag}
                      className="ml-1 p-1 rounded-full text-mute hover:text-ink cursor-pointer text-xs"
                      title="Tambah tag"
                    >
                      +
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
