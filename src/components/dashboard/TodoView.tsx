import { useState, useMemo, useEffect, useRef } from 'react';
import {
  CheckSquare,
  Plus,
  SlidersHorizontal,
} from 'lucide-react';
import { format, isToday, isThisWeek } from 'date-fns';
import { Toaster, toast } from 'sonner';
import { SearchPill } from '../ui';
import NoteCard from './NoteCard';
import NoteDetailModal from './NoteDetailModal';
import NewTodoModal from './NewTodoModal';
import EditNoteModal from './EditNoteModal';
import NotesFilterPopover, { type TodoDateFilter } from './NotesFilterPopover';

export interface TodoItem {
  id: string;
  content: string;
  category: string;
  specificTags?: string[] | null;
  source?: string | null;
  isPinned?: boolean;
  isProcessed?: boolean;
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

interface TodoViewProps {
  initialItems: TodoItem[];
  userName?: string | null;
}

export default function TodoView({ initialItems, userName }: TodoViewProps) {
  const [items, setItems] = useState<TodoItem[]>(initialItems);
  const [dateFilter, setDateFilter] = useState<TodoDateFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const userLastName = useMemo(() => {
    if (!userName || !userName.trim()) return 'User';
    const parts = userName.trim().split(/\s+/);
    return parts[parts.length - 1];
  }, [userName]);

  // Modals state
  const [selectedDetailItem, setSelectedDetailItem] = useState<TodoItem | null>(null);
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TodoItem | null>(null);
  const openedFromDetailRef = useRef(false);

  // Sorting helper: Pinned first, then newest createdAt
  const sortTodos = (list: TodoItem[]) => {
    return [...list].sort((a, b) => {
      if (Boolean(a.isPinned) !== Boolean(b.isPinned)) {
        return a.isPinned ? -1 : 1;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  };

  // Toggle Pin
  const handleTogglePinState = async (id: string, nextPinned: boolean) => {
    setItems((prev) =>
      sortTodos(prev.map((i) => (i.id === id ? { ...i, isPinned: nextPinned } : i)))
    );

    if (selectedDetailItem?.id === id) {
      setSelectedDetailItem((prev) => (prev ? { ...prev, isPinned: nextPinned } : null));
    }

    try {
      const res = await fetch(`/api/notes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPinned: nextPinned }),
      });

      if (!res.ok) throw new Error('Gagal toggle pin');
      toast.success(nextPinned ? 'Tugas disematkan ke atas 📌' : 'Semat dilepas');
    } catch {
      setItems((prev) =>
        sortTodos(prev.map((i) => (i.id === id ? { ...i, isPinned: !nextPinned } : i)))
      );
      if (selectedDetailItem?.id === id) {
        setSelectedDetailItem((prev) => (prev ? { ...prev, isPinned: !nextPinned } : null));
      }
      toast.error('Gagal memperbarui status pin');
    }
  };

  // Delete
  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== id));
        if (selectedDetailItem?.id === id) {
          setSelectedDetailItem(null);
        }
        toast.success('Tugas berhasil dihapus');
      } else {
        toast.error('Gagal menghapus tugas');
      }
    } catch {
      toast.error('Gagal menghapus tugas');
    }
  };

  // Callback after task created from modal
  const handleTaskCreated = (newTask: TodoItem) => {
    setItems((prev) => sortTodos([newTask, ...prev]));
    toast.success('Tugas baru berhasil ditambahkan');
  };

  // Callback after task edited
  const handleTaskUpdated = (updatedNote: any) => {
    setItems((prev) =>
      sortTodos(
        prev.map((i) =>
          i.id === updatedNote.id ? { ...i, ...updatedNote } : i
        )
      )
    );
    if (selectedDetailItem?.id === updatedNote.id) {
      setSelectedDetailItem((prev) =>
        prev ? { ...prev, ...updatedNote } : null
      );
    }
  };

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Date filter
      if (dateFilter === 'today') {
        if (!isToday(new Date(item.createdAt))) return false;
      } else if (dateFilter === 'this_week') {
        if (!isThisWeek(new Date(item.createdAt), { weekStartsOn: 1 })) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const contentMatch = item.content.toLowerCase().includes(query);
        const tagMatch = item.specificTags?.some((t) => t.toLowerCase().includes(query));
        return contentMatch || tagMatch;
      }

      return true;
    });
  }, [items, dateFilter, searchQuery]);

  return (
    <div className="w-full max-w-full px-4 sm:px-6 md:px-8 pb-36 sm:pb-8 md:pb-12 bg-canvas text-ink relative">
      <Toaster position="bottom-right" />

      {/* 1. Top Header (Title and Subtitle) */}
      <div className="pt-3.5 sm:pt-6 pb-2 sm:pb-3">
        <div className="flex items-center gap-3">
          <h1 className="text-display-lg sm:text-display-xl text-ink font-semibold tracking-tight flex items-baseline gap-2.5 flex-wrap">
            <span>{userLastName}</span>
            <span className="font-tangerine tangerine-bold text-[1.15em] leading-none inline-block">
              ToDo
            </span>
          </h1>
        </div>
        <p className="text-body-sm text-body mt-0.5">
          Daftar tugas, rencana aksi, dan checklist prioritas harian Anda.
        </p>
      </div>

      {/* 2. Controls Row: Searchbox + Filter button (Sticky on Mobile & Desktop, solid white background flush at top) */}
      <div className="sticky top-0 z-20 bg-canvas -mx-4 px-4 sm:-mx-6 sm:px-6 md:-mx-8 md:px-8 py-2.5 flex items-center gap-2">
        <SearchPill
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari tugas & checklist..."
        />

        {/* Filter button -> toggle filter popup modal */}
        <button
          type="button"
          onClick={() => setIsFilterOpen(!isFilterOpen)}
          className={`w-10 h-10 rounded-full flex items-center justify-center cursor-pointer shrink-0 relative transition-colors ${
            isFilterOpen || dateFilter !== 'all'
              ? 'bg-primary text-on-primary'
              : 'bg-surface-soft text-ink hover:bg-canvas'
          }`}
          title="Filter tugas"
          aria-label="Toggle filter menu"
        >
          <SlidersHorizontal className="w-4.5 h-4.5" />
          {dateFilter !== 'all' && (
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-terminal-yellow border border-canvas" />
          )}
        </button>
      </div>

      {/* Main Area: List of Todo Notes (Matching Schedule & Workspace Gallery) */}
      <div className="w-full space-y-4 mt-4 sm:mt-5">
        <h2 className="text-xl sm:text-2xl font-normal text-ink tracking-tight font-sans">
          Daftar Tugas
        </h2>

        {/* List of Todo Notes Masonry Grid using standard NoteCard */}
        {filteredItems.length > 0 ? (
          <div className="w-full columns-1 md:columns-[300px] md:[column-width:300px] lg:columns-[320px] lg:[column-width:320px] gap-3.5 [column-gap:0.875rem] max-w-full lg:max-w-5xl xl:max-w-[90rem] 2xl:max-w-[105rem]">
            {filteredItems.map((item) => (
              <NoteCard
                key={item.id}
                note={item}
                showDateTime={true}
                showCategory={false}
                variant="timeline"
                maxHeight="max-h-64"
                onDelete={handleDelete}
                onTogglePin={(id, isPinned) => handleTogglePinState(id, isPinned)}
                onEdit={(n) => {
                  openedFromDetailRef.current = false;
                  setEditingItem(n as TodoItem);
                }}
                onClick={(n) => {
                  if (typeof window !== 'undefined' && window.innerWidth < 768) {
                    return; // In-place expansion on mobile, do not open detail modal
                  }
                  setSelectedDetailItem(n as TodoItem);
                }}
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-16 sm:pt-20 pb-16 text-center mx-auto max-w-md w-full">
            <div className="w-12 h-12 rounded-full bg-surface-soft flex items-center justify-center text-body mb-4">
              <CheckSquare className="w-6 h-6" />
            </div>
            <h2 className="text-heading-lg text-ink font-semibold mb-2">
              Belum ada tugas
            </h2>
            <p className="text-body-sm text-body max-w-sm leading-relaxed">
              Tulis tugas pertama Anda dengan tombol New Task di bawah atau melalui bot Telegram.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center pt-16 sm:pt-20 pb-16 text-center mx-auto max-w-md w-full">
            <div className="w-12 h-12 rounded-full bg-surface-soft flex items-center justify-center text-body mb-4">
              <CheckSquare className="w-6 h-6" />
            </div>
            <h2 className="text-heading-lg text-ink font-semibold mb-2">
              Tidak ada tugas yang ditemukan
            </h2>
            <p className="text-body-sm text-body max-w-sm leading-relaxed">
              {searchQuery.trim()
                ? `Tidak ada tugas yang cocok dengan "${searchQuery}".`
                : `Tidak ada tugas pada filter "${dateFilter === 'today' ? 'Hari ini' : 'Minggu ini'}".`}
            </p>
          </div>
        )}
      </div>

      {/* Filter Popover Modal (Reusable component matching Workspace) */}
      <NotesFilterPopover
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        variant="todo"
        currentDateFilter={dateFilter}
        onApplyDateFilter={(newFilter) => setDateFilter(newFilter)}
      />

      {/* Notes Detail Modal matching Workspace, Schedule, Bookmarks, and Vault */}
      {selectedDetailItem && (
        <NoteDetailModal
          isOpen={Boolean(selectedDetailItem)}
          note={selectedDetailItem}
          onClose={() => setSelectedDetailItem(null)}
          onEdit={(n) => {
            openedFromDetailRef.current = true;
            setSelectedDetailItem(null);
            setEditingItem(n as TodoItem);
          }}
          onDelete={(id) => {
            handleDelete(id);
            setSelectedDetailItem(null);
          }}
          onTogglePin={(id, isPinned) => {
            handleTogglePinState(id, isPinned);
          }}
        />
      )}

      {/* New Task Modal */}
      {isNewTaskOpen && (
        <NewTodoModal
          isOpen={isNewTaskOpen}
          onClose={() => setIsNewTaskOpen(false)}
          onCreated={handleTaskCreated}
        />
      )}

      {/* Edit Note Modal */}
      {editingItem && (
        <EditNoteModal
          note={editingItem}
          isOpen={Boolean(editingItem)}
          onClose={() => {
            setEditingItem(null);
            openedFromDetailRef.current = false;
          }}
          onCancel={() => {
            const itemToRestore = editingItem;
            const wasFromDetail = openedFromDetailRef.current;
            setEditingItem(null);
            openedFromDetailRef.current = false;
            if (itemToRestore && wasFromDetail) {
              setSelectedDetailItem(itemToRestore);
            }
          }}
          onSave={(updatedNote) => {
            openedFromDetailRef.current = false;
            handleTaskUpdated(updatedNote);
            setEditingItem(null);
            toast.success('Tugas berhasil diperbarui');
          }}
        />
      )}

      {/* Floating Action Button: New Task */}
      <button
        type="button"
        onClick={() => setIsNewTaskOpen(true)}
        className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-40 w-14 h-14 sm:w-auto sm:h-auto p-0 sm:py-3 sm:px-6 rounded-full bg-canvas text-ink border border-hairline shadow-md hover:bg-surface-soft active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
        title="Tambah Tugas Baru"
        aria-label="New Task"
      >
        <span className="hidden sm:inline text-body-sm font-medium">New Task</span>
        <Plus className="w-7 h-7 sm:w-4.5 sm:h-4.5 text-ink" />
      </button>
    </div>
  );
}
