import { useState, useMemo, useEffect } from 'react';
import { Toaster } from 'sonner';
import {
  useLegacyTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
} from '@tanstack/react-table/legacy';
import { flexRender } from '@tanstack/react-table';
import type { LegacyColumnDef } from '@tanstack/react-table/legacy';
import {
  Users,
  FileText,
  DollarSign,
  ShieldCheck,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  SlidersHorizontal,
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
import { SearchPill } from '../ui';
import NotesFilterPopover, { type AdminRoleFilter } from '../dashboard/NotesFilterPopover';

export interface AdminUserItem {
  id: string;
  name: string | null;
  email: string;
  role: string;
  plan: string;
  status: string;
  expiresAt: string | null;
  totalSpending: string;
  totalSpendingRaw: number;
  notesCount: number;
  createdAt: string;
}

export interface TimeSeriesPoint {
  label: string;
  value: number;
  subValue?: number;
  formattedValue?: string;
}

export interface TimeSeriesGroup {
  daily: TimeSeriesPoint[];
  weekly: TimeSeriesPoint[];
  monthly: TimeSeriesPoint[];
}

export interface AdminMetrics {
  totalUsers: number;
  totalPaidUsers: number;
  revenueIdr: number;
  revenueUsd: number;
  totalNotes: number;
  tokenConsumed: number;
  askTimes: number;
}

export interface AdminGraphData {
  userSignUps: TimeSeriesGroup;
  revenue: TimeSeriesGroup;
  tokenAndAsk: TimeSeriesGroup;
}

interface AdminDashboardProps {
  metrics: AdminMetrics;
  graphData: AdminGraphData;
  users: AdminUserItem[];
  currentUser: {
    id: string;
    email: string;
    name?: string | null;
    role?: string;
  };
}

interface ProcessedChartItem {
  name: string;
  value: number;
  formatted: string;
}

/**
 * Komponen Grafik Recharts Interaktif dengan Mode View Harian / Mingguan / Bulanan
 */
function AdminChartCard({
  title,
  icon: Icon,
  dataGroup,
  unitLabel = '',
  isDualMode = false,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  dataGroup?: TimeSeriesGroup;
  unitLabel?: string;
  isDualMode?: boolean;
}) {
  const [interval, setInterval] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [dualMode, setDualMode] = useState<'tokens' | 'ask'>('tokens');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const currentPoints = useMemo(() => {
    if (!dataGroup) return [];
    return dataGroup[interval] || [];
  }, [dataGroup, interval]);

  const chartData: ProcessedChartItem[] = useMemo(() => {
    return currentPoints.map((pt) => {
      const val = isDualMode
        ? dualMode === 'tokens'
          ? pt.value
          : (pt.subValue || 0)
        : pt.value;

      const formatted = isDualMode
        ? dualMode === 'tokens'
          ? (pt.formattedValue || `${val.toLocaleString('id-ID')} tokens`)
          : `${val.toLocaleString('id-ID')} /ask calls`
        : (pt.formattedValue || (unitLabel ? `${val.toLocaleString('id-ID')} ${unitLabel}` : val.toLocaleString('id-ID')));

      return {
        name: pt.label,
        value: val,
        formatted,
      };
    });
  }, [currentPoints, isDualMode, dualMode, unitLabel]);

  const totalSum = useMemo(() => {
    return chartData.reduce((acc, p) => acc + p.value, 0);
  }, [chartData]);

  const totalSumFormatted = useMemo(() => {
    if (isDualMode && dualMode === 'ask') {
      return `${totalSum.toLocaleString('id-ID')} calls`;
    }
    if (unitLabel) {
      return `${totalSum.toLocaleString('id-ID')} ${unitLabel}`;
    }
    return totalSum.toLocaleString('id-ID');
  }, [totalSum, isDualMode, dualMode, unitLabel]);

  return (
    <div className="p-4 sm:p-5 rounded-xl border border-hairline bg-canvas flex flex-col justify-between space-y-3.5 hover:border-hairline-strong transition-all">
      {/* Header Grafik & Interval Toggle Buttons */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {Icon && <Icon className="w-5 h-5 text-mute shrink-0" />}
            <h3 className="text-heading-sm font-semibold text-ink truncate font-sans">{title}</h3>
          </div>

          {/* Mode View Tabs: Daily, Weekly, Monthly */}
          <div className="inline-flex items-center p-1 rounded-full bg-surface-soft border border-hairline shrink-0">
            {(['daily', 'weekly', 'monthly'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setInterval(mode)}
                className={`px-3 py-1 rounded-full text-caption-sm font-sans capitalize cursor-pointer transition-colors ${
                  interval === mode
                    ? 'bg-primary text-on-primary font-semibold'
                    : 'text-body hover:text-ink'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Dual Mode Switch jika ada (Tokens vs /ask times) - Posisi di kanan di bawah tabs Daily/Weekly/Monthly */}
        {isDualMode && (
          <div className="flex justify-end pt-1">
            <div className="inline-flex items-center p-1 rounded-full bg-surface-soft border border-hairline">
              <button
                type="button"
                onClick={() => setDualMode('tokens')}
                className={`text-caption-sm font-sans font-medium px-3 py-1 rounded-full cursor-pointer transition-colors ${
                  dualMode === 'tokens'
                    ? 'bg-primary text-on-primary font-semibold'
                    : 'text-body hover:text-ink'
                }`}
              >
                Tokens
              </button>
              <button
                type="button"
                onClick={() => setDualMode('ask')}
                className={`text-caption-sm font-sans font-medium px-3 py-1 rounded-full cursor-pointer transition-colors ${
                  dualMode === 'ask'
                    ? 'bg-primary text-on-primary font-semibold'
                    : 'text-body hover:text-ink'
                }`}
              >
                /ask calls
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Rangkuman Total Periode Terpilih (Tanpa Horizontal Line Divider) */}
      <div className="flex items-baseline justify-between pt-1 text-caption-sm text-body font-sans">
        <span className="capitalize">Total ({interval})</span>
        <span className="font-semibold text-ink tabular-nums text-body-sm font-sans">
          {totalSumFormatted}
        </span>
      </div>

      {/* Responsive Recharts Container (Height diperbesar) */}
      <div className="w-full h-56 select-none pt-1">
        {isMounted ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-hairline)" />
              <XAxis
                dataKey="name"
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
                        <p className="font-semibold text-ink">{data.name}</p>
                        <p className="text-body mt-0.5">{data.formatted}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar
                dataKey="value"
                fill="var(--color-primary)"
                radius={[4, 4, 0, 0]}
                maxBarSize={36}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="w-full h-full bg-surface-soft/40 rounded-lg animate-pulse" />
        )}
      </div>
    </div>
  );
}

export default function AdminDashboard({
  metrics,
  graphData,
  users: initialUsers,
  currentUser,
}: AdminDashboardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<AdminRoleFilter>('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Filter user list based on active tab & instant search query
  const filteredUsers = useMemo(() => {
    let list = initialUsers;

    if (roleFilter === 'pro') {
      list = list.filter((u) => u.plan === 'pro');
    } else if (roleFilter === 'free') {
      list = list.filter((u) => u.plan !== 'pro');
    } else if (roleFilter === 'admin') {
      list = list.filter((u) => u.role === 'admin');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((u) => {
        const matchName = u.name ? u.name.toLowerCase().includes(q) : false;
        const matchEmail = u.email.toLowerCase().includes(q);
        const matchRole = u.role.toLowerCase().includes(q);
        const matchPlan = u.plan.toLowerCase().includes(q);
        return matchName || matchEmail || matchRole || matchPlan;
      });
    }

    return list;
  }, [initialUsers, roleFilter, searchQuery]);

  // Column definitions for TanStack React Table
  const columns = useMemo<LegacyColumnDef<AdminUserItem>[]>(
    () => [
      {
        header: 'Pengguna',
        accessorKey: 'name',
        cell: (info) => {
          const user = info.row.original;
          const initial = (user.name || user.email || 'U')[0].toUpperCase();
          return (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-surface-soft border border-hairline flex items-center justify-center font-bold text-body-sm text-ink select-none shrink-0">
                {initial}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-semibold text-ink truncate text-body-sm">
                    {user.name || 'Anonymous User'}
                  </span>
                  {user.role === 'admin' && (
                    <span title="Administrator" className="inline-flex items-center">
                      <ShieldCheck className="w-4.5 h-4.5 text-ink shrink-0" />
                    </span>
                  )}
                </div>
                <p className="text-caption-sm text-body truncate font-mono mt-0.5">
                  {user.email}
                </p>
              </div>
            </div>
          );
        },
      },
      {
        header: () => <div className="text-right">Total Notes</div>,
        accessorKey: 'notesCount',
        cell: (info) => (
          <div className="text-right font-sans text-body-sm font-medium text-ink tabular-nums">
            {info.getValue() as number}
          </div>
        ),
      },
      {
        header: 'Paket',
        accessorKey: 'plan',
        cell: (info) => {
          const plan = info.getValue() as string;
          return (
            <span className="text-body-sm font-medium text-ink capitalize font-sans">
              {plan === 'pro' ? 'Pro' : 'Free'}
            </span>
          );
        },
      },
      {
        header: 'Status',
        accessorKey: 'status',
        cell: (info) => {
          const status = info.getValue() as string;
          const isActive = status === 'active';
          return (
            <span className="inline-flex items-center gap-1.5 text-caption-sm font-medium text-ink">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isActive ? 'bg-terminal-green' : 'bg-mute'
                }`}
              />
              <span>{isActive ? 'Aktif' : 'Non-aktif'}</span>
            </span>
          );
        },
      },
      {
        header: 'Masa Berlaku',
        accessorKey: 'expiresAt',
        cell: (info) => {
          const date = info.getValue() as string | null;
          return (
            <span className="text-caption-sm text-body font-sans tabular-nums">
              {date
                ? new Date(date).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })
                : 'Lifetime'}
            </span>
          );
        },
      },
      {
        header: () => <div className="text-right">Pembelanjaan</div>,
        accessorKey: 'totalSpending',
        cell: (info) => (
          <div className="text-right font-sans text-body-sm font-medium text-ink tabular-nums">
            {info.getValue() as string}
          </div>
        ),
      },
      {
        header: 'Terdaftar',
        accessorKey: 'createdAt',
        cell: (info) => (
          <span className="text-caption-sm text-body font-sans tabular-nums">
            {new Date(info.getValue() as string).toLocaleDateString('id-ID', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </span>
        ),
      },
    ],
    []
  );

  const table = useLegacyTable({
    data: filteredUsers,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageIndex: 0,
        pageSize: 10,
      },
    },
  });

  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  const totalFiltered = filteredUsers.length;
  const startRow = totalFiltered === 0 ? 0 : pageIndex * pageSize + 1;
  const endRow = Math.min((pageIndex + 1) * pageSize, totalFiltered);

  const adminLastName = useMemo(() => {
    const raw = currentUser.name || currentUser.email || 'Admin';
    const parts = raw.trim().split(/\s+/);
    return parts[parts.length - 1];
  }, [currentUser.name, currentUser.email]);

  return (
    <div className="w-full max-w-[1680px] 2xl:max-w-[1760px] px-4 sm:px-6 md:px-8 pb-32 sm:pb-12 bg-canvas text-ink relative">
      <Toaster position="bottom-right" />

      {/* 1. Header: Matching User Workspace / Settings / Bookmarks style */}
      <div className="pt-3.5 sm:pt-6 pb-2 sm:pb-3">
        <div className="flex items-center gap-3">
          <h1 className="text-display-lg sm:text-display-xl text-ink font-semibold tracking-tight flex items-baseline gap-2.5 flex-wrap">
            <span>{adminLastName}</span>
            <span className="font-tangerine tangerine-bold text-[1.15em] leading-none inline-block">
              Admin Panel
            </span>
          </h1>
        </div>
        <p className="text-body-sm text-body mt-0.5">
          Platform metrics, direktori pengguna, status langganan, dan ringkasan aktivitas sistem.
        </p>
      </div>

      {/* 2. Platform Overview: 5 Clean Minimalist Cards (Keterangan di bawah value telah dihapus) */}
      <div className="space-y-3 mt-6 sm:mt-8">
        <h2 className="text-heading-md font-semibold text-ink">
          Ringkasan Platform
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4">
          {/* Card 1: Total Users */}
          <div className="p-5 sm:p-6 min-h-[120px] rounded-xl border border-hairline bg-canvas flex flex-col justify-between">
            <div className="flex items-center justify-between text-body">
              <span className="text-caption-xs text-body uppercase font-sans tracking-wider font-medium">
                Total Users
              </span>
              <Users className="w-4 h-4 text-mute" />
            </div>
            <div className="mt-3.5">
              <span className="text-heading-lg font-sans font-semibold text-ink tabular-nums block">
                {metrics.totalUsers}
              </span>
            </div>
          </div>

          {/* Card 2: Pro Members (Icon sama kayak Total Users) */}
          <div className="p-5 sm:p-6 min-h-[120px] rounded-xl border border-hairline bg-canvas flex flex-col justify-between">
            <div className="flex items-center justify-between text-body">
              <span className="text-caption-xs text-body uppercase font-sans tracking-wider font-medium">
                Paid Users
              </span>
              <Users className="w-4 h-4 text-mute" />
            </div>
            <div className="mt-3.5">
              <span className="text-heading-lg font-sans font-semibold text-ink tabular-nums block">
                {metrics.totalPaidUsers}
              </span>
            </div>
          </div>

          {/* Card 3: Total Revenue (Icon Dolar/Uang) */}
          <div className="p-5 sm:p-6 min-h-[120px] rounded-xl border border-hairline bg-canvas flex flex-col justify-between">
            <div className="flex items-center justify-between text-body">
              <span className="text-caption-xs text-body uppercase font-sans tracking-wider font-medium">
                Total Revenue
              </span>
              <DollarSign className="w-4 h-4 text-mute" />
            </div>
            <div className="mt-3.5">
              <span className="text-heading-lg font-sans font-semibold text-ink tabular-nums block truncate">
                {metrics.revenueIdr > 0
                  ? `Rp ${metrics.revenueIdr.toLocaleString('id-ID')}`
                  : metrics.revenueUsd > 0
                  ? `$${metrics.revenueUsd}`
                  : 'Rp 0'}
              </span>
            </div>
          </div>

          {/* Card 4: Total Notes */}
          <div className="p-5 sm:p-6 min-h-[120px] rounded-xl border border-hairline bg-canvas flex flex-col justify-between">
            <div className="flex items-center justify-between text-body">
              <span className="text-caption-xs text-body uppercase font-sans tracking-wider font-medium">
                Total Notes
              </span>
              <FileText className="w-4 h-4 text-mute" />
            </div>
            <div className="mt-3.5">
              <span className="text-heading-lg font-sans font-semibold text-ink tabular-nums block">
                {metrics.totalNotes}
              </span>
            </div>
          </div>

          {/* Card 5: Token Consumed (Icon Sparkles / AI) */}
          <div className="p-5 sm:p-6 min-h-[120px] rounded-xl border border-hairline bg-canvas flex flex-col justify-between col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between text-body">
              <span className="text-caption-xs text-body uppercase font-sans tracking-wider font-medium">
                Token Consumed
              </span>
              <Sparkles className="w-4 h-4 text-mute" />
            </div>
            <div className="mt-3.5">
              <span className="text-heading-lg font-sans font-semibold text-ink tabular-nums block truncate">
                {metrics.tokenConsumed.toLocaleString('id-ID')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Recharts Visual Analytics (3 Sejajar: User Sign Ups, Revenue, Token & AI Usage) */}
      <div className="mt-6 sm:mt-8 space-y-3">
        <h2 className="text-heading-md font-semibold text-ink">
          Grafik Aktivitas
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AdminChartCard
            title="User Sign Up"
            icon={TrendingUp}
            dataGroup={graphData?.userSignUps}
            unitLabel="user"
          />
          <AdminChartCard
            title="Revenue"
            icon={DollarSign}
            dataGroup={graphData?.revenue}
            unitLabel=""
          />
          <AdminChartCard
            title="Token & AI Usage"
            icon={Sparkles}
            dataGroup={graphData?.tokenAndAsk}
            isDualMode={true}
          />
        </div>
      </div>

      {/* 4. User Directory Section */}
      <div className="mt-6 sm:mt-8 space-y-4">
        <div className="pb-1">
          <h2 className="text-heading-md font-semibold text-ink">
            Direktori Pengguna
          </h2>
          <p className="text-caption-sm text-body mt-0.5">
            Manajemen akun pengguna, status langganan, kuota catatan, dan riwayat belanja.
          </p>
        </div>

        {/* Sticky Controls Row: Search Box + Filter Button (Sticky on Mobile & Desktop, solid white background flush at top) */}
        <div className="sticky top-0 z-20 bg-canvas -mx-4 px-4 sm:-mx-6 sm:px-6 md:-mx-8 md:px-8 py-2.5 !mt-0 flex items-center justify-end">
          <div className="flex items-center gap-2 relative w-full sm:w-auto">
            <SearchPill
              wrapperClassName="flex-1 sm:w-72 md:w-80"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama, email, role..."
            />
            <button
              type="button"
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`w-10 h-10 rounded-full flex items-center justify-center cursor-pointer shrink-0 relative transition-colors ${
                isFilterOpen || roleFilter !== 'all'
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-soft text-ink hover:bg-canvas'
              }`}
              title="Filter pengguna"
              aria-label="Toggle filter menu"
            >
              <SlidersHorizontal className="w-4.5 h-4.5" />
              {roleFilter !== 'all' && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-terminal-yellow border-2 border-canvas" />
              )}
            </button>
          </div>
        </div>

        {/* TanStack Table Card dengan Batasan Height */}
        <div className="rounded-xl border border-hairline bg-canvas overflow-hidden">
          <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
            <table className="w-full text-left text-body-sm relative">
              <thead className="sticky top-0 z-10 bg-surface-soft text-body text-caption-xs font-sans font-medium uppercase tracking-wider">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th key={header.id} className="p-3.5 font-semibold">
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="p-8 text-center text-mute text-body-sm">
                      Tidak ada pengguna yang cocok dengan kriteria pencarian atau filter.
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <tr key={row.id} className="hover:bg-surface-soft/60 transition-colors">
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="p-3.5">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer: Rows count and pagination controls */}
          <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-caption-sm text-body bg-canvas">
            <span>
              Menampilkan <strong className="text-ink font-sans font-medium tabular-nums">{startRow}</strong> -{' '}
              <strong className="text-ink font-sans font-medium tabular-nums">{endRow}</strong> dari{' '}
              <strong className="text-ink font-sans font-medium tabular-nums">{totalFiltered}</strong> pengguna
            </span>

            <div className="flex items-center gap-3 self-end sm:self-auto">
              <span className="font-sans text-caption-sm tabular-nums text-mute">
                Halaman {pageIndex + 1} dari {table.getPageCount() || 1}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  className="w-8 h-8 rounded-full border border-hairline bg-surface-soft text-ink hover:bg-canvas disabled:opacity-30 disabled:pointer-events-none cursor-pointer flex items-center justify-center transition-colors"
                  title="Halaman Sebelumnya"
                  aria-label="Halaman Sebelumnya"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  className="w-8 h-8 rounded-full border border-hairline bg-surface-soft text-ink hover:bg-canvas disabled:opacity-30 disabled:pointer-events-none cursor-pointer flex items-center justify-center transition-colors"
                  title="Halaman Selanjutnya"
                  aria-label="Halaman Selanjutnya"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* User Directory Filter Popover Modal */}
      <NotesFilterPopover
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        variant="admin"
        currentAdminFilter={roleFilter}
        onApplyAdminFilter={(newFilter) => setRoleFilter(newFilter)}
      />
    </div>
  );
}
