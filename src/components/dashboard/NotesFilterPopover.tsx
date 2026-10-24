import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Check } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { Button, Calendar } from '../ui';

export type TodoDateFilter = 'all' | 'today' | 'this_week';
export type AdminRoleFilter = 'all' | 'pro' | 'free' | 'admin';
export type FinanceDateFilter = 'this_month' | 'last_month' | 'all';

export interface FilterState {
  dateRange: 'all' | 'today' | 'this_week' | 'this_month' | 'custom';
  startDate: string;
  endDate: string;
  selectedCategories: string[];
  showOnlyUncategorized: boolean;
}

const DEFAULT_FULL_FILTERS: FilterState = {
  dateRange: 'all',
  startDate: '',
  endDate: '',
  selectedCategories: [],
  showOnlyUncategorized: false,
};

interface NotesFilterPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  // Full mode (Workspace)
  currentFilters?: FilterState;
  onApply?: (filters: FilterState) => void;
  onReset?: () => void;

  // Variant mode (Todo date-only)
  variant?: 'full' | 'todo' | 'admin' | 'finance';
  currentDateFilter?: TodoDateFilter;
  onApplyDateFilter?: (filter: TodoDateFilter) => void;

  // Variant mode (Admin user role-only)
  currentAdminFilter?: AdminRoleFilter;
  onApplyAdminFilter?: (filter: AdminRoleFilter) => void;

  // Variant mode (Finance date-only)
  currentFinanceFilter?: FinanceDateFilter;
  onApplyFinanceFilter?: (filter: FinanceDateFilter) => void;
}

const ALL_CATEGORIES = [
  'todo',
  'schedule',
  'finance',
  'draft',
  'bookmark',
  'reference',
  'random-yap',
  'others',
  'archived',
] as const;

export default function NotesFilterPopover({
  isOpen,
  onClose,
  currentFilters = DEFAULT_FULL_FILTERS,
  onApply,
  onReset,
  variant = 'full',
  currentDateFilter = 'all',
  onApplyDateFilter,
  currentAdminFilter = 'all',
  onApplyAdminFilter,
  currentFinanceFilter = 'this_month',
  onApplyFinanceFilter,
}: NotesFilterPopoverProps) {
  const [mounted, setMounted] = useState(false);
  const [draftFilters, setDraftFilters] = useState<FilterState>(currentFilters);
  const [draftDateFilter, setDraftDateFilter] = useState<TodoDateFilter>(currentDateFilter);
  const [draftAdminFilter, setDraftAdminFilter] = useState<AdminRoleFilter>(currentAdminFilter);
  const [draftFinanceFilter, setDraftFinanceFilter] = useState<FinanceDateFilter>(currentFinanceFilter);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync draft state whenever popover opens or currentFilters change
  useEffect(() => {
    if (isOpen) {
      if (variant === 'todo') {
        setDraftDateFilter(currentDateFilter);
      } else if (variant === 'admin') {
        setDraftAdminFilter(currentAdminFilter);
      } else if (variant === 'finance') {
        setDraftFinanceFilter(currentFinanceFilter);
      } else {
        setDraftFilters(currentFilters);
      }
    }
  }, [isOpen, currentFilters, currentDateFilter, currentAdminFilter, currentFinanceFilter, variant]);

  // Lock body scroll when modal is open to prevent page scrolling behind it
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Derived selected DateRange for RayUI DayPicker
  const selectedDateRange: DateRange | undefined = useMemo(() => {
    if (variant === 'todo') return undefined;
    if (!draftFilters.startDate && !draftFilters.endDate) return undefined;
    const from = draftFilters.startDate ? parseISO(draftFilters.startDate) : undefined;
    const to = draftFilters.endDate ? parseISO(draftFilters.endDate) : undefined;
    return {
      from: from && isValid(from) ? from : undefined,
      to: to && isValid(to) ? to : undefined,
    };
  }, [draftFilters.startDate, draftFilters.endDate, variant]);

  if (!isOpen || !mounted) return null;

  const handleCategoryToggle = (category: string) => {
    setDraftFilters((prev) => {
      const exists = prev.selectedCategories.includes(category);
      return {
        ...prev,
        selectedCategories: exists
          ? prev.selectedCategories.filter((c) => c !== category)
          : [...prev.selectedCategories, category],
      };
    });
  };

  const handleDateRangeSelect = (range: DateRange | undefined) => {
    if (!range) {
      setDraftFilters((prev) => ({
        ...prev,
        dateRange: 'all',
        startDate: '',
        endDate: '',
      }));
      return;
    }

    const startStr = range.from ? format(range.from, 'yyyy-MM-dd') : '';
    const endStr = range.to ? format(range.to, 'yyyy-MM-dd') : '';

    setDraftFilters((prev) => ({
      ...prev,
      dateRange: 'custom',
      startDate: startStr,
      endDate: endStr,
    }));
  };

  const handleApply = () => {
    if (variant === 'todo') {
      onApplyDateFilter?.(draftDateFilter);
    } else if (variant === 'admin') {
      onApplyAdminFilter?.(draftAdminFilter);
    } else if (variant === 'finance') {
      onApplyFinanceFilter?.(draftFinanceFilter);
    } else {
      onApply?.(draftFilters);
    }
    onClose();
  };

  const handleReset = () => {
    if (variant === 'todo') {
      setDraftDateFilter('all');
      onApplyDateFilter?.('all');
    } else if (variant === 'admin') {
      setDraftAdminFilter('all');
      onApplyAdminFilter?.('all');
    } else if (variant === 'finance') {
      setDraftFinanceFilter('this_month');
      onApplyFinanceFilter?.('this_month');
    } else {
      setDraftFilters(DEFAULT_FULL_FILTERS);
      if (onReset) {
        onReset();
      } else {
        onApply?.(DEFAULT_FULL_FILTERS);
      }
    }
    onClose();
  };

  const handleCancel = () => {
    if (variant === 'todo') {
      setDraftDateFilter(currentDateFilter);
    } else if (variant === 'admin') {
      setDraftAdminFilter(currentAdminFilter);
    } else if (variant === 'finance') {
      setDraftFinanceFilter(currentFinanceFilter);
    } else {
      setDraftFilters(currentFilters);
    }
    onClose();
  };

  const modalContent = (
    <>
      {/* Full-screen Backdrop covering 100% viewport */}
      <div
        className="fixed inset-0 z-[9998] bg-black/75 backdrop-blur-sm select-none"
        style={{ top: 0, left: 0, right: 0, bottom: 0 }}
        onClick={handleCancel}
        aria-hidden="true"
      />

      {/* Popover / Modal Dialog Container */}
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center md:justify-end md:pr-8 p-4 pointer-events-none select-none"
        style={{ top: 0, left: 0, right: 0, bottom: 0 }}
      >
        <div
          className="relative w-full max-w-[335px] md:w-[340px] max-h-[calc(100dvh-2rem)] md:max-h-[calc(100dvh-3rem)] flex flex-col rounded-2xl bg-canvas p-4 text-ink shadow-2xl pointer-events-auto overscroll-contain"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header - Stably pinned at top */}
          <div className="flex items-center justify-between pb-3 shrink-0">
            <h2 className="text-heading-md font-medium text-ink">
              {variant === 'todo'
                ? 'Filter ToDo'
                : variant === 'admin'
                ? 'Filter Pengguna'
                : variant === 'finance'
                ? 'Filter Keuangan'
                : 'Filter Catatan'}
            </h2>
            <button
              type="button"
              onClick={handleCancel}
              className="w-9 h-9 rounded-full flex items-center justify-center text-mute hover:text-ink hover:bg-surface-soft cursor-pointer !border-0"
              aria-label="Tutup filter"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          {variant === 'todo' ? (
            <div className="py-2 space-y-3">
              <p className="text-caption-sm text-body">
                Pilih rentang waktu tugas yang ingin ditampilkan:
              </p>

              <div className="space-y-2">
                {[
                  { id: 'all', label: 'All Time', desc: 'Semua tugas dari seluruh waktu' },
                  { id: 'today', label: 'Today', desc: 'Hanya tugas yang dibuat hari ini' },
                  { id: 'this_week', label: 'This Week', desc: 'Tugas yang dibuat minggu ini' },
                ].map((item) => {
                  const isSelected = draftDateFilter === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setDraftDateFilter(item.id as TodoDateFilter)}
                      className={`w-full py-2.5 px-3.5 rounded-xl !border-0 text-left cursor-pointer transition-colors flex items-center justify-between ${
                        isSelected
                          ? 'bg-primary text-on-primary'
                          : 'bg-surface-soft hover:bg-canvas text-ink'
                      }`}
                    >
                      <div>
                        <span className="text-body-sm font-medium block">{item.label}</span>
                        <span
                          className={`text-[11px] block mt-0.5 ${
                            isSelected ? 'text-on-primary/70' : 'text-body'
                          }`}
                        >
                          {item.desc}
                        </span>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-on-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : variant === 'admin' ? (
            <div className="py-2 space-y-3">
              <p className="text-caption-sm text-body">
                Pilih kategori akun pengguna yang ingin ditampilkan:
              </p>

              <div className="space-y-2">
                {[
                  { id: 'all', label: 'Semua', desc: 'Tampilkan seluruh pengguna terdaftar' },
                  { id: 'pro', label: 'Pro', desc: 'Pengguna paket langganan Pro aktif' },
                  { id: 'free', label: 'Free', desc: 'Pengguna paket standar / free' },
                  { id: 'admin', label: 'Admin', desc: 'Akun administrator pengelola sistem' },
                ].map((item) => {
                  const isSelected = draftAdminFilter === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setDraftAdminFilter(item.id as AdminRoleFilter)}
                      className={`w-full py-2.5 px-3.5 rounded-xl !border-0 text-left cursor-pointer transition-colors flex items-center justify-between ${
                        isSelected
                          ? 'bg-primary text-on-primary'
                          : 'bg-surface-soft hover:bg-canvas text-ink'
                      }`}
                    >
                      <div>
                        <span className="text-body-sm font-medium block">{item.label}</span>
                        <span
                          className={`text-[11px] block mt-0.5 ${
                            isSelected ? 'text-on-primary/70' : 'text-body'
                          }`}
                        >
                          {item.desc}
                        </span>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-on-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : variant === 'finance' ? (
            <div className="py-2 space-y-3">
              <p className="text-caption-sm text-body">
                Pilih periode riwayat transaksi keuangan:
              </p>

              <div className="space-y-2">
                {[
                  { id: 'this_month', label: 'Bulan Ini', desc: 'Transaksi pada bulan kalender aktif saat ini' },
                  { id: 'last_month', label: 'Bulan Lalu', desc: 'Transaksi pada 1 bulan sebelum bulan aktif' },
                  { id: 'all', label: 'Semua Waktu', desc: 'Seluruh riwayat catatan keuangan tanpa batas tanggal' },
                ].map((item) => {
                  const isSelected = draftFinanceFilter === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setDraftFinanceFilter(item.id as FinanceDateFilter)}
                      className={`w-full py-2.5 px-3.5 rounded-xl !border-0 text-left cursor-pointer transition-colors flex items-center justify-between ${
                        isSelected
                          ? 'bg-primary text-on-primary'
                          : 'bg-surface-soft hover:bg-canvas text-ink'
                      }`}
                    >
                      <div>
                        <span className="text-body-sm font-medium block">{item.label}</span>
                        <span
                          className={`text-[11px] block mt-0.5 ${
                            isSelected ? 'text-on-primary/70' : 'text-body'
                          }`}
                        >
                          {item.desc}
                        </span>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-on-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 space-y-4 pr-1 overscroll-contain">
              {/* Date Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-caption-sm font-medium text-ink block">
                    Date
                  </label>
                  {(draftFilters.startDate || draftFilters.endDate) && (
                    <button
                      type="button"
                      onClick={() =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          dateRange: 'all',
                          startDate: '',
                          endDate: '',
                        }))
                      }
                      className="text-[11px] text-body hover:text-ink cursor-pointer underline !border-0"
                    >
                      Reset
                    </button>
                  )}
                </div>

                {/* RayUI Date Picker / Range Date - Clean calendar without bottom helper row */}
                <div className="rounded-lg bg-canvas p-1">
                  <Calendar
                    mode="range"
                    selected={selectedDateRange}
                    onSelect={handleDateRangeSelect}
                  />
                </div>
              </div>

              {/* Category Section - Clean label without multiple select text and without clear button */}
              <div className="space-y-2">
                <label className="text-caption-sm font-medium text-ink block">
                  Category
                </label>

                <div className="flex flex-wrap gap-1.5">
                  {ALL_CATEGORIES.map((cat) => {
                    const isSelected = draftFilters.selectedCategories.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => handleCategoryToggle(cat)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-caption-sm font-mono tracking-wider cursor-pointer !border-0 transition-colors ${
                          isSelected
                            ? 'bg-primary text-on-primary'
                            : 'bg-surface-soft text-body hover:text-ink hover:bg-canvas'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 shrink-0" />}
                        <span>{cat}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Footer Actions - Stably pinned at bottom */}
          <div className="flex items-center justify-between pt-3 mt-1 shrink-0">
            <button
              type="button"
              onClick={handleReset}
              className="px-4 h-8 rounded-full text-caption-sm text-body hover:text-ink hover:bg-surface-soft cursor-pointer !border-0 transition-colors"
            >
              Reset
            </button>

            <Button
              type="button"
              variant="primary"
              onClick={handleApply}
              className="h-8 px-5 font-medium text-caption-sm !border-0"
            >
              Apply
            </Button>
          </div>
        </div>
      </div>
    </>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
}
