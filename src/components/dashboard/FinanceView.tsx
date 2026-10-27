import { useState, useMemo, useEffect } from 'react';
import {
  TrendingDown,
  TrendingUp,
  SlidersHorizontal,
  HandCoins,
  Scale,
  Check,
  ExternalLink,
  Plus,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { format, isThisMonth, subMonths } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { toast } from 'sonner';
import { SearchPill } from '../ui';
import NoteDetailModal from './NoteDetailModal';
import QuickComposerModal from './QuickComposerModal';
import AskAiButton from './AskAiButton';
import AskAiModal from './AskAiModal';
import NotesFilterPopover, { type FinanceDateFilter } from './NotesFilterPopover';
import type { NoteItem } from './NotesTimeline';
import type { ExpenseEntry, IncomeEntry, DebtEntry } from '@/db/schema';

export interface FinanceNoteItem extends NoteItem {
  expenses?: ExpenseEntry[] | null;
  income?: IncomeEntry[] | null;
  debt?: DebtEntry[] | null;
}

interface FinanceViewProps {
  initialNotes: FinanceNoteItem[];
  userName?: string | null;
}

interface FlatTransaction {
  id: string;
  noteId: string;
  type: 'expense' | 'income';
  title: string;
  amount: number;
  currency: string;
  date: Date;
  tags: string[];
  rawNote: FinanceNoteItem;
}

interface FlatDebt {
  id: string;
  noteId: string;
  debtIndex: number;
  type: 'payable' | 'receivable';
  person: string;
  amount: number;
  notes?: string;
  isSettled: boolean;
  date: Date;
  tags: string[];
  rawNote: FinanceNoteItem;
}

interface ProcessedChartItem {
  label: string;
  value: number;
}

/**
 * Komponen Grafik Interaktif untuk Expenses & Income matching AdminChartCard
 */
function FinanceChartCard({
  title,
  icon: Icon,
  dataGroup,
  accentColor = 'var(--color-primary)',
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  dataGroup: {
    daily: ProcessedChartItem[];
    weekly: ProcessedChartItem[];
    monthly: ProcessedChartItem[];
  };
  accentColor?: string;
}) {
  const [interval, setInterval] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const currentPoints = useMemo(() => {
    return dataGroup[interval] || [];
  }, [dataGroup, interval]);

  const totalSum = useMemo(() => {
    return currentPoints.reduce((acc, p) => acc + p.value, 0);
  }, [currentPoints]);

  return (
    <div className="p-4 sm:p-5 rounded-xl border border-hairline bg-canvas flex flex-col justify-between space-y-3 hover:border-hairline-strong transition-all">
      {/* Header Grafik & Interval Toggle Buttons */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {Icon && <Icon className="w-4.5 h-4.5 text-mute shrink-0" />}
            <h3 className="text-body-strong font-medium text-ink truncate font-sans">{title}</h3>
          </div>

          {/* Mode View Tabs: Daily, Weekly, Monthly */}
          <div className="inline-flex items-center p-1 rounded-full bg-surface-soft shrink-0">
            {(['daily', 'weekly', 'monthly'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setInterval(mode)}
                className={`px-2.5 py-0.5 rounded-full text-caption-xs font-sans capitalize cursor-pointer transition-colors ${
                  interval === mode
                    ? 'bg-primary text-on-primary font-medium'
                    : 'text-body hover:text-ink'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Rangkuman Total Periode Terpilih */}
      <div className="flex items-baseline justify-between pt-0.5 text-caption-xs text-body font-sans">
        <span className="capitalize">Total ({interval})</span>
        <span className="font-semibold text-ink tabular-nums text-caption-sm font-sans">
          Rp {totalSum.toLocaleString('id-ID')}
        </span>
      </div>

      {/* Responsive Recharts Container */}
      <div className="w-full h-48 select-none pt-1">
        {isMounted ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={currentPoints} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-hairline)" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: 'var(--color-mute)', fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10, fill: 'var(--color-mute)', fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
                tickFormatter={(val: number) => {
                  if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
                  if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
                  return String(val);
                }}
              />
              <Tooltip
                cursor={{ fill: 'var(--color-surface-soft)', radius: 4 }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload as ProcessedChartItem;
                    return (
                      <div className="rounded-lg border border-hairline bg-canvas p-2 shadow-sm text-caption-xs font-sans">
                        <p className="font-semibold text-ink">{data.label}</p>
                        <p className="text-body font-sans text-caption-xs mt-0.5 tabular-nums">
                          Rp {Number(data.value).toLocaleString('id-ID')}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="value" fill={accentColor} radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="w-full h-full bg-surface-soft/40 animate-pulse rounded-lg" />
        )}
      </div>

    </div>
  );
}

export default function FinanceView({ initialNotes, userName }: FinanceViewProps) {
  const [notesList, setNotesList] = useState<FinanceNoteItem[]>(initialNotes);
  const [searchQuery, setSearchQuery] = useState('');
  // Data default yang ditampilkan: data bulan aktif (this_month)
  const [dateFilter, setDateFilter] = useState<FinanceDateFilter>('this_month');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Modals
  const [activeFinanceModal, setActiveFinanceModal] = useState<NoteItem | null>(null);
  const [modalMode, setModalMode] = useState<'view' | 'read' | 'edit'>('view');

  const handleOpenDetail = (note: NoteItem) => {
    setActiveFinanceModal(note);
    setModalMode('view');
  };
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAskAiOpen, setIsAskAiOpen] = useState(false);

  const handleNoteCreated = (newNote: NoteItem) => {
    setNotesList((prev) => [newNote as FinanceNoteItem, ...prev]);
  };

  const userLastName = useMemo(() => {
    if (!userName || !userName.trim()) return 'User';
    const parts = userName.trim().split(/\s+/);
    return parts[parts.length - 1];
  }, [userName]);

  // Flatten transactions (expenses and income)
  const allTransactions: FlatTransaction[] = useMemo(() => {
    const list: FlatTransaction[] = [];
    for (const note of notesList) {
      const noteDate = new Date(note.createdAt);
      if (Array.isArray(note.expenses)) {
        for (let i = 0; i < note.expenses.length; i++) {
          const exp = note.expenses[i];
          if (exp.amount > 0) {
            list.push({
              id: `${note.id}-exp-${i}`,
              noteId: note.id,
              type: 'expense',
              title: exp.item || 'Pengeluaran',
              amount: exp.amount,
              currency: exp.currency || 'IDR',
              date: noteDate,
              tags: note.specificTags || [],
              rawNote: note,
            });
          }
        }
      }

      if (Array.isArray(note.income)) {
        for (let i = 0; i < note.income.length; i++) {
          const inc = note.income[i];
          if (inc.amount > 0) {
            list.push({
              id: `${note.id}-inc-${i}`,
              noteId: note.id,
              type: 'income',
              title: inc.source || 'Pemasukan',
              amount: inc.amount,
              currency: inc.currency || 'IDR',
              date: noteDate,
              tags: note.specificTags || [],
              rawNote: note,
            });
          }
        }
      }
    }
    return list.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [notesList]);

  // Flatten debts with explicit debtIndex & isSettled tracking
  const allDebts: FlatDebt[] = useMemo(() => {
    const list: FlatDebt[] = [];
    for (const note of notesList) {
      const noteDate = new Date(note.createdAt);
      if (Array.isArray(note.debt)) {
        for (let i = 0; i < note.debt.length; i++) {
          const d = note.debt[i];
          if (d.amount > 0) {
            list.push({
              id: `${note.id}-debt-${i}`,
              noteId: note.id,
              debtIndex: i,
              type: d.type === 'payable' ? 'payable' : 'receivable',
              person: d.person || 'Seseorang',
              amount: d.amount,
              notes: d.notes,
              isSettled: Boolean(d.isSettled || false),
              date: noteDate,
              tags: note.specificTags || [],
              rawNote: note,
            });
          }
        }
      }
    }
    return list.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [notesList]);

  // Filter helper: check date by this_month, last_month, or all
  const matchesDateFilter = (itemDate: Date) => {
    if (dateFilter === 'this_month') {
      return isThisMonth(itemDate);
    }
    if (dateFilter === 'last_month') {
      const lastMonth = subMonths(new Date(), 1);
      return (
        itemDate.getFullYear() === lastMonth.getFullYear() &&
        itemDate.getMonth() === lastMonth.getMonth()
      );
    }
    return true; // 'all'
  };

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    return allTransactions.filter((tx) => {
      if (!matchesDateFilter(tx.date)) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = tx.title.toLowerCase().includes(q);
        const matchTags = tx.tags.some((t) => t.toLowerCase().includes(q));
        const matchContent = tx.rawNote.content.toLowerCase().includes(q);
        return matchTitle || matchTags || matchContent;
      }
      return true;
    });
  }, [allTransactions, dateFilter, searchQuery]);

  // Split into separate Expenses & Income lists
  const filteredExpenses = useMemo(() => {
    return filteredTransactions.filter((t) => t.type === 'expense');
  }, [filteredTransactions]);

  const filteredIncome = useMemo(() => {
    return filteredTransactions.filter((t) => t.type === 'income');
  }, [filteredTransactions]);

  // Filter debts
  const filteredDebts = useMemo(() => {
    return allDebts.filter((d) => {
      if (!matchesDateFilter(d.date)) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchPerson = d.person.toLowerCase().includes(q);
        const matchNotes = d.notes ? d.notes.toLowerCase().includes(q) : false;
        const matchTags = d.tags.some((t) => t.toLowerCase().includes(q));
        const matchContent = d.rawNote.content.toLowerCase().includes(q);
        return matchPerson || matchNotes || matchTags || matchContent;
      }
      return true;
    });
  }, [allDebts, dateFilter, searchQuery]);

  // Split into separate Piutang (Receivable) & Utang (Payable) lists
  const filteredReceivables = useMemo(() => {
    return filteredDebts.filter((d) => d.type === 'receivable');
  }, [filteredDebts]);

  const filteredPayables = useMemo(() => {
    return filteredDebts.filter((d) => d.type === 'payable');
  }, [filteredDebts]);

  // KPI Calculations (Saat ditandai lunas, nominal tidak lagi dihitung sebagai utang/piutang aktif)
  const totalExpenses = useMemo(() => {
    return filteredExpenses.reduce((acc, t) => acc + t.amount, 0);
  }, [filteredExpenses]);

  const totalIncome = useMemo(() => {
    return filteredIncome.reduce((acc, t) => acc + t.amount, 0);
  }, [filteredIncome]);

  const netCashflow = totalIncome - totalExpenses;

  const totalReceivable = useMemo(() => {
    return filteredReceivables
      .filter((d) => !d.isSettled)
      .reduce((acc, d) => acc + d.amount, 0);
  }, [filteredReceivables]);

  const totalPayable = useMemo(() => {
    return filteredPayables
      .filter((d) => !d.isSettled)
      .reduce((acc, d) => acc + d.amount, 0);
  }, [filteredPayables]);

  // 1-Click Toggle Status Lunas / Belum Lunas
  const handleToggleDebtSettled = async (d: FlatDebt) => {
    const targetNote = notesList.find((n) => n.id === d.noteId);
    if (!targetNote || !Array.isArray(targetNote.debt)) return;

    const nextSettled = !d.isSettled;
    const updatedDebt = targetNote.debt.map((item, idx) =>
      idx === d.debtIndex ? { ...item, isSettled: nextSettled } : item
    );

    // Optimistic UI update
    setNotesList((prev) =>
      prev.map((n) => (n.id === d.noteId ? { ...n, debt: updatedDebt } : n))
    );

    try {
      const res = await fetch(`/api/notes/${d.noteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ debtIndex: d.debtIndex, isSettled: nextSettled }),
      });
      if (!res.ok) throw new Error();
      toast.success(
        nextSettled
          ? `Catatan pinjaman ${d.person} ditandai lunas`
          : `Catatan pinjaman ${d.person} ditandai belum lunas`
      );
    } catch {
      // Rollback
      setNotesList((prev) =>
        prev.map((n) => (n.id === d.noteId ? { ...n, debt: targetNote.debt } : n))
      );
      toast.error('Gagal memperbarui status pinjaman');
    }
  };

  // Build TimeSeries Buckets for Recharts
  const chartData = useMemo(() => {
    const now = new Date();

    // 1. Daily: Last 7 Days
    const dailyBuckets = [];
    for (let i = 6; i >= 0; i--) {
      const start = new Date(now);
      start.setDate(start.getDate() - i);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      const label = format(start, 'd MMM', { locale: localeId });
      dailyBuckets.push({ start, end, label });
    }

    // 2. Weekly: Last 4 Weeks
    const weeklyBuckets = [];
    for (let i = 3; i >= 0; i--) {
      const end = new Date(now);
      end.setDate(end.getDate() - i * 7);
      const start = new Date(end);
      start.setDate(start.getDate() - 7);
      const label = i === 0 ? 'Mgg Ini' : `Mgg -${i}`;
      weeklyBuckets.push({ start, end, label });
    }

    // 3. Monthly: Last 6 Months
    const monthlyBuckets = [];
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
      const label = format(start, 'MMM', { locale: localeId });
      monthlyBuckets.push({ start, end, label });
    }

    const expensesDaily = dailyBuckets.map((b) => {
      const sum = allTransactions
        .filter((t) => t.type === 'expense' && t.date >= b.start && t.date <= b.end)
        .reduce((acc, t) => acc + t.amount, 0);
      return { label: b.label, value: sum };
    });

    const expensesWeekly = weeklyBuckets.map((b) => {
      const sum = allTransactions
        .filter((t) => t.type === 'expense' && t.date >= b.start && t.date <= b.end)
        .reduce((acc, t) => acc + t.amount, 0);
      return { label: b.label, value: sum };
    });

    const expensesMonthly = monthlyBuckets.map((b) => {
      const sum = allTransactions
        .filter((t) => t.type === 'expense' && t.date >= b.start && t.date <= b.end)
        .reduce((acc, t) => acc + t.amount, 0);
      return { label: b.label, value: sum };
    });

    const incomeDaily = dailyBuckets.map((b) => {
      const sum = allTransactions
        .filter((t) => t.type === 'income' && t.date >= b.start && t.date <= b.end)
        .reduce((acc, t) => acc + t.amount, 0);
      return { label: b.label, value: sum };
    });

    const incomeWeekly = weeklyBuckets.map((b) => {
      const sum = allTransactions
        .filter((t) => t.type === 'income' && t.date >= b.start && t.date <= b.end)
        .reduce((acc, t) => acc + t.amount, 0);
      return { label: b.label, value: sum };
    });

    const incomeMonthly = monthlyBuckets.map((b) => {
      const sum = allTransactions
        .filter((t) => t.type === 'income' && t.date >= b.start && t.date <= b.end)
        .reduce((acc, t) => acc + t.amount, 0);
      return { label: b.label, value: sum };
    });

    return {
      expenses: {
        daily: expensesDaily,
        weekly: expensesWeekly,
        monthly: expensesMonthly,
      },
      income: {
        daily: incomeDaily,
        weekly: incomeWeekly,
        monthly: incomeMonthly,
      },
    };
  }, [allTransactions]);

  const handleDeleteNote = (id: string) => {
    setNotesList((prev) => prev.filter((n) => n.id !== id));
  };

  const handleTogglePin = (id: string, isPinned: boolean) => {
    setNotesList((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isPinned } : n))
    );
  };

  return (
    <div className="w-full max-w-[1680px] 2xl:max-w-[1760px] px-4 sm:px-6 md:px-8 pb-32 sm:pb-12 bg-canvas text-ink relative">
      {/* 1. Header (Matching Todo, Workspace & Admin Style) */}
      <div className="pt-3.5 sm:pt-6 pb-2 sm:pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-display-lg sm:text-display-xl text-ink font-semibold tracking-tight flex items-baseline gap-2.5 flex-wrap font-sans">
              <span>{userLastName}</span>
              <span className="font-tangerine tangerine-bold text-[1.15em] leading-none inline-block">
                Finance
              </span>
            </h1>
          </div>
          <p className="text-body-sm text-body mt-0.5 font-sans">
            Ringkasan arus kas keuangan, analitik pengeluaran, pemasukan, dan buku pinjaman.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-center shrink-0">
          <AskAiButton onClick={() => setIsAskAiOpen(true)} label="Ask Finance" />
        </div>
      </div>

      {/* 2. Controls Row: Searchbox + Filter button (Sticky on Mobile & Desktop, solid white background flush at top) */}
      <div className="sticky top-0 z-20 bg-canvas -mx-4 px-4 sm:-mx-6 sm:px-6 md:-mx-8 md:px-8 py-2.5 !mt-0 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <SearchPill
            wrapperClassName="flex-1 sm:w-72 md:w-80"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari transaksi, item, nama..."
          />

          <button
            type="button"
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={`w-10 h-10 rounded-full flex items-center justify-center cursor-pointer shrink-0 relative transition-colors ${
              isFilterOpen || dateFilter !== 'this_month'
                ? 'bg-primary text-on-primary'
                : 'bg-surface-soft text-ink hover:bg-canvas'
            }`}
            title="Filter periode transaksi (Bulan Ini, Bulan Lalu, Semua Waktu)"
            aria-label="Toggle filter menu"
          >
            <SlidersHorizontal className="w-4.5 h-4.5" />
            {dateFilter !== 'this_month' && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-terminal-yellow border-2 border-canvas" />
            )}
          </button>
        </div>
      </div>

      {/* 3. Summary Stat Cards & Visual Analytics */}
      <div className="space-y-4 mt-6 sm:mt-8 max-w-5xl">
        <h2 className="text-heading-md font-semibold text-ink font-sans">
          Ringkasan Keuangan
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Pengeluaran */}
          <div className="p-4 sm:p-4.5 min-h-[105px] rounded-xl border border-hairline bg-canvas flex flex-col justify-between hover:border-hairline-strong transition-all">
            <div className="flex items-center justify-between text-body">
              <span className="text-caption-xs text-body uppercase font-sans tracking-wider font-medium">
                Pengeluaran
              </span>
              <TrendingDown className="w-4 h-4 text-mute" />
            </div>
            <div className="mt-3">
              <span className="text-heading-lg font-sans font-semibold text-ink tabular-nums block truncate">
                Rp {totalExpenses.toLocaleString('id-ID')}
              </span>
            </div>
          </div>

          {/* Card 2: Pemasukan */}
          <div className="p-4 sm:p-4.5 min-h-[105px] rounded-xl border border-hairline bg-canvas flex flex-col justify-between hover:border-hairline-strong transition-all">
            <div className="flex items-center justify-between text-body">
              <span className="text-caption-xs text-body uppercase font-sans tracking-wider font-medium">
                Pemasukan
              </span>
              <TrendingUp className="w-4 h-4 text-mute" />
            </div>
            <div className="mt-3">
              <span className="text-heading-lg font-sans font-semibold text-ink tabular-nums block truncate">
                Rp {totalIncome.toLocaleString('id-ID')}
              </span>
            </div>
          </div>

          {/* Card 3: Net Cashflow */}
          <div className="p-4 sm:p-4.5 min-h-[105px] rounded-xl border border-hairline bg-canvas flex flex-col justify-between hover:border-hairline-strong transition-all">
            <div className="flex items-center justify-between text-body">
              <span className="text-caption-xs text-body uppercase font-sans tracking-wider font-medium">
                Net Cashflow
              </span>
              <Scale className="w-4 h-4 text-mute" />
            </div>
            <div className="mt-3">
              <span className="text-heading-lg font-sans font-semibold text-ink tabular-nums block truncate">
                {netCashflow >= 0 ? '+' : ''}Rp {netCashflow.toLocaleString('id-ID')}
              </span>
            </div>
          </div>

          {/* Card 4: Buku Pinjaman (Hanya menghitung yang belum lunas) */}
          <div className="p-4 sm:p-4.5 min-h-[105px] rounded-xl border border-hairline bg-canvas flex flex-col justify-between hover:border-hairline-strong transition-all">
            <div className="flex items-center justify-between text-body">
              <span className="text-caption-xs text-body uppercase font-sans tracking-wider font-medium">
                Buku Pinjaman
              </span>
              <HandCoins className="w-4 h-4 text-mute" />
            </div>
            <div className="mt-2 text-caption-xs text-body space-y-1 font-sans">
              <div className="flex justify-between items-center">
                <span>Piutang (Tagih):</span>
                <span className="font-semibold text-terminal-green font-sans tabular-nums">
                  Rp {totalReceivable.toLocaleString('id-ID')}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Utang (Bayar):</span>
                <span className="font-semibold text-terminal-red font-sans tabular-nums">
                  Rp {totalPayable.toLocaleString('id-ID')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Visual Analytics: 2 Interactive Recharts Cards (directly below the 4 stat cards, without separate section title) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          <FinanceChartCard
            title="Pengeluaran (Expenses)"
            icon={TrendingDown}
            accentColor="var(--color-primary)"
            dataGroup={chartData.expenses}
          />
          <FinanceChartCard
            title="Pemasukan (Income)"
            icon={TrendingUp}
            accentColor="var(--color-primary)"
            dataGroup={chartData.income}
          />
        </div>
      </div>

      {/* 5. Section: Arus Kas (Dipecah jadi 2 tabel terpisah: Pengeluaran & Pemasukan, compact, tanpa divider row) */}
      <div className="mt-6 sm:mt-8 space-y-3 w-full max-w-6xl xl:max-w-7xl 2xl:max-w-[1560px]">
        <h2 className="text-heading-md font-semibold text-ink font-sans">
          Arus Kas
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          {/* Tabel 1: Pengeluaran (Expenses) */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-0.5">
              <TrendingDown className="w-4 h-4 text-mute shrink-0" />
              <h3 className="text-caption-sm font-semibold text-ink font-sans">
                Pengeluaran
              </h3>
            </div>

            <div className="rounded-xl border border-hairline bg-canvas overflow-hidden flex flex-col">

            <div className="overflow-x-auto max-h-[440px] overflow-y-auto">
              <table className="w-full text-left text-caption-sm relative font-sans">
                <thead className="sticky top-0 z-10 bg-surface-soft text-body text-caption-xs font-sans font-medium border-b border-hairline">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold w-28 whitespace-nowrap">Tanggal</th>
                    <th className="py-2.5 px-3 font-semibold">Deskripsi</th>
                    <th className="py-2.5 px-3 font-semibold text-right w-32 whitespace-nowrap">Nominal</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-mute text-caption-sm">
                        Tidak ada pengeluaran pada periode ini.
                      </td>
                    </tr>
                  ) : (
                    filteredExpenses.map((tx) => (
                      <tr
                        key={tx.id}
                        className="hover:bg-surface-soft/60 transition-colors"
                      >
                        <td className="py-2.5 px-3 text-caption-sm text-body font-sans tabular-nums whitespace-nowrap align-top">
                          {format(tx.date, 'd MMM yyyy', { locale: localeId })}
                        </td>
                        <td className="py-2.5 px-3 text-caption-sm font-medium text-ink align-top">
                          <div className="break-words [overflow-wrap:anywhere] whitespace-normal leading-relaxed">
                            <span>{tx.title}</span>
                            <button
                              type="button"
                              onClick={() => handleOpenDetail(tx.rawNote)}
                              className="inline-flex items-center justify-center p-0.5 ml-1.5 rounded text-mute hover:text-ink hover:bg-surface-soft cursor-pointer align-middle transition-colors"
                              title="Lihat catatan asli"
                              aria-label="Lihat catatan asli"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-sans text-caption-sm font-medium tabular-nums whitespace-nowrap text-ink align-top">
                          Rp {tx.amount.toLocaleString('id-ID')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          </div>

          {/* Tabel 2: Pemasukan (Income) */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-0.5">
              <TrendingUp className="w-4 h-4 text-mute shrink-0" />
              <h3 className="text-caption-sm font-semibold text-ink font-sans">
                Pemasukan
              </h3>
            </div>

            <div className="rounded-xl border border-hairline bg-canvas overflow-hidden flex flex-col">

            <div className="overflow-x-auto max-h-[440px] overflow-y-auto">
              <table className="w-full text-left text-caption-sm relative font-sans">
                <thead className="sticky top-0 z-10 bg-surface-soft text-body text-caption-xs font-sans font-medium border-b border-hairline">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold w-28 whitespace-nowrap">Tanggal</th>
                    <th className="py-2.5 px-3 font-semibold">Deskripsi</th>
                    <th className="py-2.5 px-3 font-semibold text-right w-32 whitespace-nowrap">Nominal</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIncome.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-mute text-caption-sm">
                        Tidak ada pemasukan pada periode ini.
                      </td>
                    </tr>
                  ) : (
                    filteredIncome.map((tx) => (
                      <tr
                        key={tx.id}
                        className="hover:bg-surface-soft/60 transition-colors"
                      >
                        <td className="py-2.5 px-3 text-caption-sm text-body font-sans tabular-nums whitespace-nowrap align-top">
                          {format(tx.date, 'd MMM yyyy', { locale: localeId })}
                        </td>
                        <td className="py-2.5 px-3 text-caption-sm font-medium text-ink align-top">
                          <div className="break-words [overflow-wrap:anywhere] whitespace-normal leading-relaxed">
                            <span>{tx.title}</span>
                            <button
                              type="button"
                              onClick={() => handleOpenDetail(tx.rawNote)}
                              className="inline-flex items-center justify-center p-0.5 ml-1.5 rounded text-mute hover:text-ink hover:bg-surface-soft cursor-pointer align-middle transition-colors"
                              title="Lihat catatan asli"
                              aria-label="Lihat catatan asli"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-sans text-caption-sm font-medium tabular-nums whitespace-nowrap text-terminal-green align-top">
                          +Rp {tx.amount.toLocaleString('id-ID')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* 5. Section: Buku Pinjaman (Dipecah jadi 2 tabel terpisah: Piutang & Utang, dengan status Lunas 1-klik switch/checkbox) */}
      <div className="mt-6 sm:mt-8 space-y-3 w-full max-w-6xl xl:max-w-7xl 2xl:max-w-[1560px]">
        <h2 className="text-heading-md font-semibold text-ink font-sans">
          Buku Pinjaman
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          {/* Tabel 1: Piutang (Receivable - Hak Tagih) */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-0.5">
              <HandCoins className="w-4 h-4 text-mute shrink-0" />
              <h3 className="text-caption-sm font-semibold text-ink font-sans">
                Piutang (Hak Tagih)
              </h3>
            </div>

            <div className="rounded-xl border border-hairline bg-canvas overflow-hidden flex flex-col">

            <div className="overflow-x-auto max-h-[440px] overflow-y-auto">
              <table className="w-full text-left text-caption-sm relative font-sans">
                <thead className="sticky top-0 z-10 bg-surface-soft text-body text-caption-xs font-sans font-medium border-b border-hairline">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold w-12 text-center whitespace-nowrap">Status</th>
                    <th className="py-2.5 px-3 font-semibold w-28 whitespace-nowrap">Tanggal</th>
                    <th className="py-2.5 px-3 font-semibold">Pihak / Keterangan</th>
                    <th className="py-2.5 px-3 font-semibold text-right w-32 whitespace-nowrap">Nominal</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReceivables.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-mute text-caption-sm">
                        Tidak ada catatan piutang pada periode ini.
                      </td>
                    </tr>
                  ) : (
                    filteredReceivables.map((d) => (
                      <tr
                        key={d.id}
                        className={`hover:bg-surface-soft/60 transition-colors ${
                          d.isSettled ? 'opacity-60' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 w-12 text-center align-top">
                          <button
                            type="button"
                            onClick={() => handleToggleDebtSettled(d)}
                            className={`w-5 h-5 rounded-[4px] border flex items-center justify-center cursor-pointer shrink-0 transition-colors mx-auto ${
                              d.isSettled
                                ? 'bg-ink border-ink text-canvas'
                                : 'border-hairline-strong bg-canvas hover:border-ink'
                            }`}
                            title={d.isSettled ? 'Tandai belum lunas' : 'Tandai lunas'}
                            aria-label={d.isSettled ? 'Tandai belum lunas' : 'Tandai lunas'}
                          >
                            {d.isSettled && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </button>
                        </td>
                        <td
                          className={`py-2.5 px-3 text-caption-sm font-sans tabular-nums whitespace-nowrap align-top ${
                            d.isSettled ? 'line-through text-mute' : 'text-body'
                          }`}
                        >
                          {format(d.date, 'd MMM yyyy', { locale: localeId })}
                        </td>
                        <td className="py-2.5 px-3 text-caption-sm font-medium text-ink align-top">
                          <div className="break-words [overflow-wrap:anywhere] whitespace-normal leading-relaxed">
                            <span
                              className={
                                d.isSettled ? 'line-through text-mute font-normal' : 'text-ink'
                              }
                            >
                              {d.person}
                              {d.notes && (
                                <span className="text-mute font-normal ml-1">({d.notes})</span>
                              )}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleOpenDetail(d.rawNote)}
                              className="inline-flex items-center justify-center p-0.5 ml-1.5 rounded text-mute hover:text-ink hover:bg-surface-soft cursor-pointer align-middle transition-colors"
                              title="Lihat catatan asli"
                              aria-label="Lihat catatan asli"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-sans text-caption-sm font-medium tabular-nums whitespace-nowrap align-top ${
                            d.isSettled
                              ? 'line-through text-mute'
                              : 'text-terminal-green'
                          }`}
                        >
                          Rp {d.amount.toLocaleString('id-ID')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          </div>

          {/* Tabel 2: Utang (Payable - Kewajiban Bayar) */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-0.5">
              <HandCoins className="w-4 h-4 text-mute shrink-0" />
              <h3 className="text-caption-sm font-semibold text-ink font-sans">
                Utang (Kewajiban Bayar)
              </h3>
            </div>

            <div className="rounded-xl border border-hairline bg-canvas overflow-hidden flex flex-col">

            <div className="overflow-x-auto max-h-[440px] overflow-y-auto">
              <table className="w-full text-left text-caption-sm relative font-sans">
                <thead className="sticky top-0 z-10 bg-surface-soft text-body text-caption-xs font-sans font-medium border-b border-hairline">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold w-12 text-center whitespace-nowrap">Status</th>
                    <th className="py-2.5 px-3 font-semibold w-28 whitespace-nowrap">Tanggal</th>
                    <th className="py-2.5 px-3 font-semibold">Pihak / Keterangan</th>
                    <th className="py-2.5 px-3 font-semibold text-right w-32 whitespace-nowrap">Nominal</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayables.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-mute text-caption-sm">
                        Tidak ada catatan utang pada periode ini.
                      </td>
                    </tr>
                  ) : (
                    filteredPayables.map((d) => (
                      <tr
                        key={d.id}
                        className={`hover:bg-surface-soft/60 transition-colors ${
                          d.isSettled ? 'opacity-60' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 w-12 text-center align-top">
                          <button
                            type="button"
                            onClick={() => handleToggleDebtSettled(d)}
                            className={`w-5 h-5 rounded-[4px] border flex items-center justify-center cursor-pointer shrink-0 transition-colors mx-auto ${
                              d.isSettled
                                ? 'bg-ink border-ink text-canvas'
                                : 'border-hairline-strong bg-canvas hover:border-ink'
                            }`}
                            title={d.isSettled ? 'Tandai belum lunas' : 'Tandai lunas'}
                            aria-label={d.isSettled ? 'Tandai belum lunas' : 'Tandai lunas'}
                          >
                            {d.isSettled && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </button>
                        </td>
                        <td
                          className={`py-2.5 px-3 text-caption-sm font-sans tabular-nums whitespace-nowrap align-top ${
                            d.isSettled ? 'line-through text-mute' : 'text-body'
                          }`}
                        >
                          {format(d.date, 'd MMM yyyy', { locale: localeId })}
                        </td>
                        <td className="py-2.5 px-3 text-caption-sm font-medium text-ink align-top">
                          <div className="break-words [overflow-wrap:anywhere] whitespace-normal leading-relaxed">
                            <span
                              className={
                                d.isSettled ? 'line-through text-mute font-normal' : 'text-ink'
                              }
                            >
                              {d.person}
                              {d.notes && (
                                <span className="text-mute font-normal ml-1">({d.notes})</span>
                              )}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleOpenDetail(d.rawNote)}
                              className="inline-flex items-center justify-center p-0.5 ml-1.5 rounded text-mute hover:text-ink hover:bg-surface-soft cursor-pointer align-middle transition-colors"
                              title="Lihat catatan asli"
                              aria-label="Lihat catatan asli"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-sans text-caption-sm font-medium tabular-nums whitespace-nowrap align-top ${
                            d.isSettled
                              ? 'line-through text-mute'
                              : 'text-terminal-red'
                          }`}
                        >
                          Rp {d.amount.toLocaleString('id-ID')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* Filter Modal Dialog (Bulan Ini, Bulan Lalu, Semua Waktu) */}
      <NotesFilterPopover
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        variant="finance"
        currentFinanceFilter={dateFilter}
        onApplyFinanceFilter={(newFilter) => setDateFilter(newFilter)}
      />

      {/* Unified Finance Note Modal */}
      {activeFinanceModal && (
        <NoteDetailModal
          note={activeFinanceModal}
          isOpen={Boolean(activeFinanceModal)}
          initialMode={modalMode}
          onClose={() => setActiveFinanceModal(null)}
          onDelete={handleDeleteNote}
          onTogglePin={handleTogglePin}
          onSave={(updatedNote: any) => {
            setNotesList((prev) =>
              prev.map((n) => (n.id === updatedNote.id ? { ...n, ...updatedNote } : n))
            );
            setActiveFinanceModal(updatedNote);
          }}
        />
      )}

      {/* Floating Action Button (FAB) on Mobile & Desktop */}
      <button
        type="button"
        onClick={() => setIsCreateModalOpen(true)}
        className="fixed bottom-6 right-6 z-30 flex items-center gap-2 px-4 py-3 rounded-full bg-primary text-on-primary shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer font-sans !border-0"
        title="Catat Keuangan Baru"
        aria-label="Catat Keuangan Baru"
      >
        <Plus className="w-5 h-5" />
        <span className="hidden sm:inline text-body-sm font-medium">Catat Keuangan</span>
      </button>

      {/* Quick Composer Modal for Pure Notes */}
      {isCreateModalOpen && (
        <QuickComposerModal
          isOpen={isCreateModalOpen}
          initialCategory="finance"
          onClose={() => setIsCreateModalOpen(false)}
          onNoteCreated={handleNoteCreated}
          onNoteSynced={(_tempId, realNote) => {
            setNotesList((prev) =>
              prev.map((n) => (n.id === _tempId ? (realNote as FinanceNoteItem) : n))
            );
          }}
        />
      )}
      {/* Dedicated Ask AI Modal */}
      <AskAiModal
        isOpen={isAskAiOpen}
        onClose={() => setIsAskAiOpen(false)}
        category="finance"
        placeholder="Tanya riwayat pengeluaran, pemasukan, atau pinjaman utang..."
        contextTitle="Keuangan & Arus Kas"
      />
    </div>
  );
}
