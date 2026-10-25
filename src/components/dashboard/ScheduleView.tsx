import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Calendar as CalendarIcon,
  Plus,
  Trash2,
  Copy,
  Pencil,
  Loader2,
  CalendarDays,
  Pin,
  X,
} from 'lucide-react';
import {
  format,
  isSameMonth,
  isSameDay,
  parseISO,
} from 'date-fns';
import { id } from 'date-fns/locale';
import { toast } from 'sonner';
import { Button, SearchPill, Calendar } from '../ui';
import NoteCard from './NoteCard';
import EditNoteModal from './EditNoteModal';
import NoteDetailModal from './NoteDetailModal';
import NewScheduleModal from './NewScheduleModal';

export interface ScheduleItem {
  id: string;
  content: string;
  category: string;
  specificTags?: string[] | null;
  source?: string | null;
  isPinned?: boolean;
  targetDate?: string | Date | null;
  scheduleDates?: string[] | null;
  schedule?: {
    dates: string[];
    isRecurring: boolean;
    recurrenceRule?: {
      frequency: 'daily' | 'weekly' | 'monthly' | 'custom_interval';
      intervalDays?: number;
      daysOfWeek?: number[];
      dayOfMonth?: number;
      timeString?: string;
    };
  } | null;
  expenses?: Array<{ item: string; amount: number; currency: string }> | null;
  income?: Array<{ source: string; amount: number; currency: string }> | null;
  debt?: Array<{ type: 'payable' | 'receivable'; person: string; amount: number; notes?: string }> | null;
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

interface ScheduleViewProps {
  initialItems: ScheduleItem[];
  userName?: string | null;
}

export default function ScheduleView({ initialItems, userName }: ScheduleViewProps) {
  const [items, setItems] = useState<ScheduleItem[]>(initialItems);
  const [searchQuery, setSearchQuery] = useState('');

  const userLastName = useMemo(() => {
    if (!userName || !userName.trim()) return 'User';
    const parts = userName.trim().split(/\s+/);
    return parts[parts.length - 1];
  }, [userName]);
  
  // Calendar Navigation & Filter State
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);
  const [detailItem, setDetailItem] = useState<ScheduleItem | null>(null);
  const openedFromDetailRef = useRef(false);

  // Lock body scroll when any modal is open
  useEffect(() => {
    if (isCreateModalOpen || detailItem || editingItem) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isCreateModalOpen, detailItem, editingItem]);

  // Group schedules by YYYY-MM-DD
  const scheduleMap = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>();

    const addEntry = (key: string, item: ScheduleItem) => {
      const existing = map.get(key) || [];
      if (!existing.some((i) => i.id === item.id)) {
        existing.push(item);
        map.set(key, existing);
      }
    };

    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

    for (const item of items) {
      // 1. Map to createdAt date ONLY IF no explicit targetDate, scheduleDates, and not recurring
      const hasExplicitDates = Boolean(
        item.targetDate ||
        (Array.isArray(item.schedule?.dates) && item.schedule.dates.length > 0) ||
        (Array.isArray(item.scheduleDates) && item.scheduleDates.length > 0) ||
        item.schedule?.isRecurring
      );
      if (!hasExplicitDates) {
        const createdKey = format(new Date(item.createdAt), 'yyyy-MM-dd');
        addEntry(createdKey, item);
      }

      // 2. Map to targetDate if present
      if (item.targetDate) {
        const targetKey = format(new Date(item.targetDate), 'yyyy-MM-dd');
        addEntry(targetKey, item);
      }

      // 3. Map to all dates in schedule.dates or scheduleDates array
      const concreteDates = item.schedule?.dates || item.scheduleDates || [];
      if (Array.isArray(concreteDates)) {
        for (const dateStr of concreteDates) {
          if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            addEntry(dateStr, item);
          }
        }
      }

      // 4. Project recurring schedule across active calendar month
      if (item.schedule?.isRecurring) {
        const rule = item.schedule.recurrenceRule || { frequency: 'weekly' };
        const anchor = concreteDates.length > 0
          ? parseISO(concreteDates[0])
          : (item.targetDate ? new Date(item.targetDate) : new Date(item.createdAt));
        const anchorDayOfWeek = !isNaN(anchor.getTime()) ? anchor.getDay() : 1;

        if (rule.frequency === 'daily') {
          const interval = rule.intervalDays && rule.intervalDays > 1 ? rule.intervalDays : 1;
          for (let d = 1; d <= totalDaysInMonth; d += interval) {
            const dateStr = format(new Date(year, month, d), 'yyyy-MM-dd');
            addEntry(dateStr, item);
          }
        } else if (rule.frequency === 'weekly' || !rule.frequency) {
          const targetDays = Array.isArray(rule.daysOfWeek) && rule.daysOfWeek.length > 0
            ? rule.daysOfWeek
            : [anchorDayOfWeek];
          for (let d = 1; d <= totalDaysInMonth; d++) {
            const dt = new Date(year, month, d);
            if (targetDays.includes(dt.getDay())) {
              addEntry(format(dt, 'yyyy-MM-dd'), item);
            }
          }
        } else if (rule.frequency === 'monthly') {
          const targetDay = rule.dayOfMonth && rule.dayOfMonth >= 1 && rule.dayOfMonth <= totalDaysInMonth
            ? rule.dayOfMonth
            : (!isNaN(anchor.getTime()) ? anchor.getDate() : 1);
          addEntry(format(new Date(year, month, targetDay), 'yyyy-MM-dd'), item);
        } else if (rule.frequency === 'custom_interval' && rule.intervalDays && rule.intervalDays > 0) {
          for (let d = 1; d <= totalDaysInMonth; d++) {
            const candidate = new Date(year, month, d);
            const diffTime = candidate.getTime() - anchor.getTime();
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays >= 0 && diffDays % rule.intervalDays === 0) {
              addEntry(format(candidate, 'yyyy-MM-dd'), item);
            }
          }
        }
      }
    }
    return map;
  }, [items, currentMonth]);

  // Toggle pin by item id and current status
  const handleTogglePinById = async (id: string, currentPinStatus: boolean) => {
    const newPinnedStatus = !currentPinStatus;

    // Optimistic UI update
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, isPinned: newPinnedStatus } : i))
    );

    try {
      const res = await fetch(`/api/notes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPinned: newPinnedStatus }),
      });

      if (!res.ok) throw new Error('Failed to update pin');
      toast.success(newPinnedStatus ? 'Jadwal disematkan ke atas' : 'Sematan jadwal dilepas');
    } catch {
      // Revert on error
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, isPinned: currentPinStatus } : i))
      );
      toast.error('Gagal memperbarui status pin');
    }
  };

  // Delete item by id
  const handleDeleteById = async (id: string) => {
    try {
      const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== id));
        if (detailItem?.id === id) setDetailItem(null);
        toast.success('Jadwal berhasil dihapus');
      } else {
        toast.error('Gagal menghapus jadwal');
      }
    } catch {
      toast.error('Terjadi kesalahan jaringan');
    }
  };

  // Toggle pin
  const handleTogglePin = async (e: React.MouseEvent, item: ScheduleItem) => {
    e.stopPropagation();
    const newPinnedStatus = !item.isPinned;

    // Optimistic UI update
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, isPinned: newPinnedStatus } : i))
    );

    try {
      const res = await fetch(`/api/notes/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPinned: newPinnedStatus }),
      });

      if (!res.ok) throw new Error('Failed to update pin');
      toast.success(newPinnedStatus ? 'Jadwal disematkan ke atas' : 'Sematan jadwal dilepas');
    } catch {
      // Revert on error
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, isPinned: item.isPinned } : i))
      );
      toast.error('Gagal memperbarui status pin');
    }
  };

  // Delete item
  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== id));
        if (detailItem?.id === id) setDetailItem(null);
        toast.success('Jadwal berhasil dihapus');
      } else {
        toast.error('Gagal menghapus jadwal');
      }
    } catch {
      toast.error('Terjadi kesalahan jaringan');
    }
  };

  // Copy text
  const handleCopy = (e: React.MouseEvent, text: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    toast.success('Teks jadwal disalin ke clipboard');
  };

  // Create new schedule item
  const handleCreate = async () => {
    const text = newContent.trim();
    if (!text || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: text,
          category: 'schedule',
          specificTags: ['schedule'],
        }),
      });

      const data = await res.json();
      if (res.ok && data.note) {
        setItems((prev) => [
          {
            id: data.note.id,
            content: data.note.content,
            category: data.note.category,
            specificTags: data.note.specificTags,
            source: data.note.source,
            isPinned: false,
            createdAt: data.note.createdAt,
          },
          ...prev,
        ]);
        setNewContent('');
        setIsCreateModalOpen(false);
        toast.success('Jadwal baru berhasil ditambahkan');
      } else {
        toast.error(data.error || 'Gagal menambahkan jadwal');
      }
    } catch {
      toast.error('Terjadi kesalahan jaringan');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered & sorted schedule cards
  const filteredItems = useMemo(() => {
    let result = items;

    // Filter by selected date if active
    if (selectedDate) {
      const key = format(selectedDate, 'yyyy-MM-dd');
      result = scheduleMap.get(key) || [];
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          item.content.toLowerCase().includes(q) ||
          item.specificTags?.some((t) => t.toLowerCase().includes(q))
      );
    }

    // Sort: Pinned first, then newest createdAt
    return [...result].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [items, selectedDate, searchQuery, scheduleMap]);

  return (
    <div className="w-full max-w-full px-4 sm:px-6 md:px-8 pb-32 sm:pb-8 md:pb-12 bg-canvas text-ink relative">
            {/* =========================================================================
          1. HEADER (Title & Subtitle)
          ========================================================================= */}
      <div className="pt-3.5 sm:pt-6 pb-2 sm:pb-3">
        <div className="flex items-center gap-3">
          <h1 className="text-display-lg sm:text-display-xl text-ink font-semibold tracking-tight flex items-baseline gap-2.5 flex-wrap">
            <span>{userLastName}</span>
            <span className="font-tangerine tangerine-bold text-[1.15em] leading-none inline-block">
              Schedule
            </span>
          </h1>
        </div>
        <p className="text-body-sm text-body mt-0.5">
          Visualisasi kalender kegiatan, agenda rapat, dan jadwal penting yang terpetakan otomatis.
        </p>
      </div>

      {/* =========================================================================
          2. CONTROLS ROW: Searchbox (Sticky on Mobile & Desktop across whole page, solid white background flush at top)
          ========================================================================= */}
      <div className="sticky top-0 z-20 bg-canvas -mx-4 px-4 sm:-mx-6 sm:px-6 md:-mx-8 md:px-8 py-2.5 flex items-center gap-2">
        <SearchPill
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari jadwal & agenda..."
        />
      </div>

      {/* =========================================================================
          3. SCHEDULE MAIN CONTENT: 2-COLUMN ON XL SCREENS (STICKY CALENDAR LEFT, NOTES RIGHT)
          On desktop (xl): Calendar is sticky at xl:top-14 (under searchbox).
          On mobile (<xl): Calendar scrolls naturally, while searchbox above remains sticky across entire page.
          ========================================================================= */}
      <div className="mt-4 sm:mt-5 flex flex-col xl:flex-row gap-6 xl:gap-8 items-start w-full">
        {/* Left Column: Calendar (Full-width on mobile/tablet, sticky on xl desktop) */}
        <div className="w-full xl:w-[480px] shrink-0 xl:sticky xl:top-14">
          <div className="p-4 sm:p-6 rounded-2xl border border-hairline bg-canvas w-full max-w-full overflow-x-auto no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <Calendar
              mode="single"
              size="medium"
              selected={selectedDate || undefined}
              onSelect={(date) => {
                if (selectedDate && date && isSameDay(selectedDate, date)) {
                  setSelectedDate(null);
                } else {
                  setSelectedDate(date ?? null);
                }
              }}
              month={currentMonth}
              onMonthChange={setCurrentMonth}
              weekStartsOn={1}
              locale={id}
              modifiers={{
                hasSchedule: (date) => scheduleMap.has(format(date, 'yyyy-MM-dd')),
              }}
              modifiersClassNames={{
                hasSchedule:
                  'relative after:content-[""] after:w-1.5 after:h-1.5 after:rounded-full after:bg-ink after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:pointer-events-none [&.rdp-selected]:after:bg-on-primary aria-selected:after:bg-on-primary',
              }}
              classNames={{
                month: 'flex flex-col w-full',
                month_grid: 'w-full table-fixed border-collapse border-spacing-0 rdp-month_grid',
                nav:
                  'flex items-center justify-between w-full absolute inset-x-0 top-0.5 px-2 z-10 pointer-events-none',
                month_caption:
                  'flex h-11 w-full items-center justify-center text-xl font-semibold text-ink tracking-tight capitalize mb-6',
                weekdays: 'table-row w-full',
                weekday:
                  'table-cell text-mute text-xs font-mono text-center h-9 align-middle uppercase tracking-wider',
                week: 'table-row w-full',
                day: 'table-cell p-0.5 sm:p-1 h-13 text-center align-middle relative text-body-sm',
                day_button:
                  'w-12 h-12 mx-auto rounded-full flex items-center justify-center text-body-sm cursor-pointer transition-colors text-ink hover:bg-surface-soft font-normal',
                today:
                  '[&>button]:!bg-hairline hover:[&>button]:!bg-hairline-strong [&>button]:!text-ink [&>button]:!ring-0 font-semibold',
                button_previous:
                  'h-10 w-10 rounded-full flex items-center justify-center p-0 border-0 bg-transparent hover:bg-surface-soft text-body hover:text-ink cursor-pointer pointer-events-auto transition-colors',
                button_next:
                  'h-10 w-10 rounded-full flex items-center justify-center p-0 border-0 bg-transparent hover:bg-surface-soft text-body hover:text-ink cursor-pointer pointer-events-auto transition-colors',
              }}
              className="p-0 sm:p-0 w-full"
            />
          </div>
        </div>

        {/* Right Column: Agenda and Schedule Notes Gallery */}
        <div className="flex-1 min-w-0 w-full space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl sm:text-2xl font-normal text-ink tracking-tight font-sans">
              {selectedDate
                ? `Agenda: ${format(selectedDate, 'd MMMM yyyy', { locale: id })}`
                : 'Agenda'}
            </h2>
          </div>

          {/* Schedule Notes List (Row view with horizontal line divider) */}
          {filteredItems.length > 0 ? (
            <div className="w-full flex flex-col">
              {filteredItems.map((item) => (
                <NoteCard
                  key={item.id}
                  note={item}
                  showDateTime={false}
                  showCategory={false}
                  variant="row"
                  onDelete={handleDeleteById}
                  onTogglePin={(id) => handleTogglePinById(id, Boolean(item.isPinned))}
                  onEdit={(n) => {
                    openedFromDetailRef.current = false;
                    setEditingItem(n as ScheduleItem);
                  }}
                  onClick={(n) => {
                    if (typeof window !== 'undefined' && window.innerWidth < 768) {
                      return; // In-place expansion on mobile, do not open detail modal
                    }
                    setDetailItem(n as ScheduleItem);
                  }}
                />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center pt-16 sm:pt-20 pb-16 text-center mx-auto max-w-md w-full">
              <div className="w-12 h-12 rounded-full bg-surface-soft flex items-center justify-center text-body mb-4">
                <CalendarIcon className="w-6 h-6" />
              </div>
              <h2 className="text-heading-lg text-ink font-semibold mb-2">
                Belum ada jadwal
              </h2>
              <p className="text-body-sm text-body max-w-sm leading-relaxed">
                Catat agenda pertama Anda dengan tombol Tambah Jadwal di bawah atau melalui bot Telegram.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center pt-16 sm:pt-20 pb-16 text-center mx-auto max-w-md w-full">
              <div className="w-12 h-12 rounded-full bg-surface-soft flex items-center justify-center text-body mb-4">
                <CalendarIcon className="w-6 h-6" />
              </div>
              <h2 className="text-heading-lg text-ink font-semibold mb-2">
                Tidak ada jadwal
              </h2>
              <p className="text-body-sm text-body max-w-sm leading-relaxed">
                {selectedDate
                  ? `Belum ada agenda pada tanggal ${format(selectedDate, 'd MMMM yyyy', { locale: id })}.`
                  : 'Tidak ada agenda jadwal yang cocok dengan filter pencarian Anda.'}
              </p>
            </div>
          )}
        </div>
      </div>

            {/* =========================================================================
          4. MODAL: CREATE NEW SCHEDULE (Using standard QuickComposer-style modal)
          ========================================================================= */}
      {isCreateModalOpen && (
        <NewScheduleModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          selectedDate={selectedDate}
          onCreated={(newItem) => {
            setItems((prev) => [newItem, ...prev]);
          }}
        />
      )}

      {/* =========================================================================
          5. MODAL: SCHEDULE NOTE DETAIL (Using standard NoteDetailModal)
          ========================================================================= */}
      {detailItem && (
        <NoteDetailModal
          isOpen={Boolean(detailItem)}
          note={detailItem}
          onClose={() => setDetailItem(null)}
          onEdit={(noteToEdit) => {
            const item = items.find((i) => i.id === noteToEdit.id) || (noteToEdit as ScheduleItem);
            openedFromDetailRef.current = true;
            setDetailItem(null);
            setEditingItem(item);
          }}
          onDelete={(id) => {
            setItems((prev) => prev.filter((i) => i.id !== id));
            setDetailItem(null);
            toast.success('Jadwal berhasil dihapus');
          }}
          onTogglePin={(id, isPinned) => {
            setItems((prev) =>
              prev.map((i) => (i.id === id ? { ...i, isPinned } : i))
            );
            if (detailItem && detailItem.id === id) {
              setDetailItem((prev) => (prev ? { ...prev, isPinned } : null));
            }
            toast.success(isPinned ? 'Jadwal disematkan ke atas' : 'Sematan jadwal dilepas');
          }}
        />
      )}

      {/* =========================================================================
          6. MODAL: EDIT NOTE MODAL
          ========================================================================= */}
      {editingItem && (
        <EditNoteModal
          isOpen={Boolean(editingItem)}
          note={editingItem}
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
              setDetailItem(itemToRestore);
            }
          }}
          onSave={(updated) => {
            openedFromDetailRef.current = false;
            setItems((prev) =>
              prev.map((i) => (i.id === updated.id ? { ...i, ...updated } : i))
            );
            setEditingItem(null);
            toast.success('Jadwal berhasil diperbarui');
          }}
        />
      )}

      {/* Floating Action Button: Add Schedule in bottom-right corner */}
      <button
        type="button"
        onClick={() => setIsCreateModalOpen(true)}
        className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-40 w-14 h-14 sm:w-auto sm:h-auto p-0 sm:py-3 sm:px-6 rounded-full bg-canvas text-ink border border-hairline shadow-md hover:bg-surface-soft active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
        title="Tambah Jadwal Baru"
        aria-label="Tambah Jadwal"
      >
        <span className="hidden sm:inline text-body-sm font-medium">Tambah Jadwal</span>
        <Plus className="w-7 h-7 sm:w-4.5 sm:h-4.5 text-ink" />
      </button>
    </div>
  );
}
