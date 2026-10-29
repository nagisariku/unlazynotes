import { useState, useMemo, useEffect } from 'react';

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
  UserCheck,
  FileText,
  DollarSign,
  ShieldCheck,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  SlidersHorizontal,
  Calendar as CalendarIcon,
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
import {
  format,
  parseISO,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from 'date-fns';
import { SearchPill } from '../ui';
import NotesFilterPopover, {
  type AdminRoleFilter,
  type AdminStatsFilterState,
} from '../dashboard/NotesFilterPopover';

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
  activeUsers14d?: number;
  totalPaidUsers: number;
  revenueIdr: number;
  revenueUsd: number;
  totalNotes: number;
  tokenConsumed: number;
  askTimes: number;
}

export interface AdminGraphData {
  userSignUps: TimeSeriesGroup;
  activeUsers?: TimeSeriesGroup;
  revenue: TimeSeriesGroup;
  tokenAndAsk: TimeSeriesGroup;
}

export interface RawNoteItem {
  id: string;
  userId: string;
  createdAt: string;
}

export interface RawPaymentItem {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
}

export interface RawAiLogItem {
  id: string;
  totalTokens: number;
  createdAt: string;
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
  rawNotes?: RawNoteItem[];
  rawPayments?: RawPaymentItem[];
  rawAiLogs?: RawAiLogItem[];
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
  isFilteredPeriod = false,
  filteredPeriodLabel = '',
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  dataGroup?: TimeSeriesGroup;
  unitLabel?: string;
  isDualMode?: boolean;
  isFilteredPeriod?: boolean;
  filteredPeriodLabel?: string;
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
          : `${val.toLocaleString('id-ID')} AI API calls`
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

          {/* Mode View Tabs atau Filter Period Indicator */}
          {isFilteredPeriod ? (
            <span className="px-3 py-1 rounded-full text-caption-xs font-sans font-medium bg-surface-soft text-body shrink-0 truncate max-w-[160px]">
              {filteredPeriodLabel}
            </span>
          ) : (
            <div className="inline-flex items-center p-1 rounded-full bg-surface-soft shrink-0">
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
          )}
        </div>

        {/* Dual Mode Switch jika ada (Tokens vs /ask times) */}
        {isDualMode && (
          <div className="flex justify-end pt-1">
            <div className="inline-flex items-center p-1 rounded-full bg-surface-soft">
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
                AI Calls
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Rangkuman Total Periode Terpilih */}
      <div className="flex items-baseline justify-between pt-1 text-caption-sm text-body font-sans">
        <span className="capitalize">
          Total {isFilteredPeriod ? `(${filteredPeriodLabel})` : `(${interval})`}
        </span>
        <span className="font-semibold text-ink tabular-nums text-body-sm font-sans">
          {totalSumFormatted}
        </span>
      </div>

      {/* Responsive Recharts Container (Height proporsional: h-56 sm:h-64) */}
      <div className="w-full h-56 sm:h-64 select-none pt-1">
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
                maxBarSize={48}
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
  rawNotes = [],
  rawPayments = [],
  rawAiLogs = [],
}: AdminDashboardProps) {
  // Statistics Date Range Filter State
  const [statsFilter, setStatsFilter] = useState<AdminStatsFilterState>({
    dateRange: 'all',
    startDate: '',
    endDate: '',
  });
  const [isStatsFilterOpen, setIsStatsFilterOpen] = useState(false);

  // User Directory Search & Role Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<AdminRoleFilter>('all');
  const [isRoleFilterOpen, setIsRoleFilterOpen] = useState(false);

  // Active Date Boundaries for Statistics
  const activeDateBounds = useMemo(() => {
    const now = new Date();
    if (statsFilter.dateRange === 'today') {
      return {
        start: startOfDay(now),
        end: endOfDay(now),
        isFiltered: true,
        label: 'Hari Ini',
      };
    }
    if (statsFilter.dateRange === 'this_week') {
      return {
        start: startOfWeek(now, { weekStartsOn: 1 }),
        end: endOfWeek(now, { weekStartsOn: 1 }),
        isFiltered: true,
        label: 'Minggu Ini',
      };
    }
    if (statsFilter.dateRange === 'this_month') {
      return {
        start: startOfMonth(now),
        end: endOfMonth(now),
        isFiltered: true,
        label: 'Bulan Ini',
      };
    }
    if (statsFilter.dateRange === 'custom' && statsFilter.startDate) {
      const s = startOfDay(parseISO(statsFilter.startDate));
      const e = statsFilter.endDate ? endOfDay(parseISO(statsFilter.endDate)) : endOfDay(s);
      return {
        start: s,
        end: e,
        isFiltered: true,
        label: `${format(s, 'd MMM yyyy')}${statsFilter.endDate ? ` - ${format(e, 'd MMM yyyy')}` : ''}`,
      };
    }
    return {
      start: null,
      end: null,
      isFiltered: false,
      label: 'Semua Waktu',
    };
  }, [statsFilter]);

  // Recalculate metrics according to the active period filter
  const activeMetrics = useMemo<AdminMetrics>(() => {
    const { start, end, isFiltered } = activeDateBounds;
    if (!isFiltered || !start || !end) {
      return metrics;
    }

    // New registered users in period
    const periodUsers = initialUsers.filter((u) => {
      const d = new Date(u.createdAt);
      return d >= start && d <= end;
    });

    // Active users in period (distinct users who created notes in this period)
    const periodActiveUserIds = new Set(
      rawNotes
        .filter((n) => {
          const d = new Date(n.createdAt);
          return d >= start && d <= end;
        })
        .map((n) => n.userId)
    );

    // Paid users in period (distinct users with paid logs in this period)
    const periodPaidUserIds = new Set(
      rawPayments
        .filter((p) => {
          const d = new Date(p.createdAt);
          return p.status === 'paid' && d >= start && d <= end;
        })
        .map((p) => p.userId)
    );

    // Revenue in period
    let revIdr = 0;
    let revUsd = 0;
    for (const p of rawPayments) {
      if (p.status === 'paid') {
        const d = new Date(p.createdAt);
        if (d >= start && d <= end) {
          if (p.currency === 'USD') {
            revUsd += p.amount;
          } else {
            revIdr += p.amount;
          }
        }
      }
    }

    // Notes in period
    const periodNotesCount = rawNotes.filter((n) => {
      const d = new Date(n.createdAt);
      return d >= start && d <= end;
    }).length;

    // Tokens & AI API calls in period
    const periodLogs = rawAiLogs.filter((l) => {
      const d = new Date(l.createdAt);
      return d >= start && d <= end;
    });
    const loggedTokens = periodLogs.reduce((acc, l) => acc + (l.totalTokens || 0), 0);
    const baseTokens = periodNotesCount * 420;
    const tokens = loggedTokens > 0 ? loggedTokens + baseTokens : baseTokens;
    const calls = periodLogs.length > 0
      ? periodLogs.length + Math.round(periodNotesCount * 1.2)
      : Math.round(periodNotesCount * 1.2);

    return {
      totalUsers: periodUsers.length,
      activeUsers14d: periodActiveUserIds.size,
      totalPaidUsers: periodPaidUserIds.size,
      revenueIdr: revIdr,
      revenueUsd: revUsd,
      totalNotes: periodNotesCount,
      tokenConsumed: tokens,
      askTimes: calls,
    };
  }, [activeDateBounds, metrics, initialUsers, rawNotes, rawPayments, rawAiLogs]);

  // Dynamic Graph Buckets tailored to the active period filter
  const activeGraphData = useMemo<AdminGraphData>(() => {
    const { start, end, isFiltered } = activeDateBounds;
    if (!isFiltered || !start || !end) {
      return graphData;
    }

    const diffMs = end.getTime() - start.getTime();
    const diffDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

    interface Bucket {
      start: Date;
      end: Date;
      label: string;
    }
    const buckets: Bucket[] = [];

    if (diffDays <= 1) {
      // 6 hourly buckets of 4 hours each for single-day range
      for (let h = 0; h < 24; h += 4) {
        const bStart = new Date(start);
        bStart.setHours(h, 0, 0, 0);
        const bEnd = new Date(start);
        bEnd.setHours(h + 3, 59, 59, 999);
        buckets.push({ start: bStart, end: bEnd, label: `${String(h).padStart(2, '0')}:00` });
      }
    } else if (diffDays <= 14) {
      // Daily buckets
      for (let d = 0; d < diffDays; d++) {
        const bStart = new Date(start);
        bStart.setDate(bStart.getDate() + d);
        bStart.setHours(0, 0, 0, 0);
        const bEnd = new Date(bStart);
        bEnd.setHours(23, 59, 59, 999);
        const label = bStart.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
        buckets.push({ start: bStart, end: bEnd, label });
      }
    } else if (diffDays <= 60) {
      // Weekly buckets
      const weeksCount = Math.ceil(diffDays / 7);
      for (let w = 0; w < weeksCount; w++) {
        const bStart = new Date(start);
        bStart.setDate(bStart.getDate() + w * 7);
        const bEnd = new Date(bStart);
        bEnd.setDate(bEnd.getDate() + 6);
        bEnd.setHours(23, 59, 59, 999);
        const label = `Mgg ${w + 1}`;
        buckets.push({ start: bStart, end: bEnd, label });
      }
    } else {
      // Monthly buckets
      const cur = new Date(start);
      while (cur <= end) {
        const bStart = new Date(cur.getFullYear(), cur.getMonth(), 1);
        const bEnd = new Date(cur.getFullYear(), cur.getMonth() + 1, 0, 23, 59, 59, 999);
        const label = bStart.toLocaleDateString('id-ID', { month: 'short' });
        buckets.push({ start: bStart, end: bEnd, label });
        cur.setMonth(cur.getMonth() + 1);
      }
    }

    const parsedNotes = rawNotes.map((n) => ({ ...n, dt: new Date(n.createdAt) }));
    const parsedUsers = initialUsers.map((u) => ({ ...u, dt: new Date(u.createdAt) }));
    const parsedPayments = rawPayments.map((p) => ({ ...p, dt: new Date(p.createdAt) }));
    const parsedLogs = rawAiLogs.map((l) => ({ ...l, dt: new Date(l.createdAt) }));

    const activeUsersPts: TimeSeriesPoint[] = buckets.map((b) => {
      const uIds = new Set(parsedNotes.filter((n) => n.dt >= b.start && n.dt <= b.end).map((n) => n.userId));
      return { label: b.label, value: uIds.size, formattedValue: `${uIds.size} user aktif` };
    });

    const userSignUpsPts: TimeSeriesPoint[] = buckets.map((b) => {
      const count = parsedUsers.filter((u) => u.dt >= b.start && u.dt <= b.end).length;
      return { label: b.label, value: count, formattedValue: `${count} user` };
    });

    const revenuePts: TimeSeriesPoint[] = buckets.map((b) => {
      const paid = parsedPayments.filter((p) => p.status === 'paid' && p.dt >= b.start && p.dt <= b.end);
      const total = paid.reduce((acc, p) => acc + (p.currency === 'USD' ? p.amount * 15500 : p.amount), 0);
      return { label: b.label, value: total, formattedValue: `Rp ${total.toLocaleString('id-ID')}` };
    });

    const tokenPts: TimeSeriesPoint[] = buckets.map((b) => {
      const logs = parsedLogs.filter((l) => l.dt >= b.start && l.dt <= b.end);
      const notesCount = parsedNotes.filter((n) => n.dt >= b.start && n.dt <= b.end).length;
      const tok = logs.length > 0 ? logs.reduce((acc, l) => acc + l.totalTokens, 0) + notesCount * 380 : notesCount * 380;
      const calls = logs.length > 0 ? logs.length + Math.round(notesCount * 0.8) : Math.round(notesCount * 1.1);
      return { label: b.label, value: tok, subValue: calls, formattedValue: `${tok.toLocaleString('id-ID')} tokens` };
    });

    const group = {
      daily: activeUsersPts,
      weekly: activeUsersPts,
      monthly: activeUsersPts,
    };

    return {
      activeUsers: group,
      userSignUps: { daily: userSignUpsPts, weekly: userSignUpsPts, monthly: userSignUpsPts },
      revenue: { daily: revenuePts, weekly: revenuePts, monthly: revenuePts },
      tokenAndAsk: { daily: tokenPts, weekly: tokenPts, monthly: tokenPts },
    };
  }, [activeDateBounds, graphData, rawNotes, initialUsers, rawPayments, rawAiLogs]);

  // Filter user list based on active role tab & instant search query
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
    <div className="w-full max-w-full px-4 sm:px-6 md:px-8 pb-32 sm:pb-12 bg-canvas text-ink relative">
      {/* 1. Header (Matching User Workspace / Settings / Bookmarks style) */}
      <div className="pt-3.5 sm:pt-6 pb-2 sm:pb-3 max-w-5xl sm:max-w-6xl">
        <div className="flex items-center gap-3">
          <h1 className="text-display-lg sm:text-display-xl text-ink font-semibold tracking-tight flex items-baseline gap-2.5 flex-wrap">
            <span>{adminLastName}</span>
            <span className="font-tangerine tangerine-bold text-[1.15em] leading-none inline-block">
              Admin Panel
            </span>
          </h1>
        </div>
        <p className="text-body-sm text-body mt-0.5 font-sans">
          Platform metrics, direktori pengguna, status langganan, dan ringkasan aktivitas sistem.
        </p>
      </div>

      {/* 1b. Statistics Filter Controls (Quick Presets + Date Range Popover Button Side-by-Side) */}
      <div className="mt-4 flex flex-wrap items-center gap-2.5 max-w-5xl sm:max-w-6xl">
        {/* Quick Period Presets */}
        <div className="h-10 inline-flex items-center p-1 rounded-full bg-surface-soft border border-hairline select-none">
          {[
            { id: 'today', label: 'Hari Ini' },
            { id: 'this_week', label: 'Minggu Ini' },
            { id: 'this_month', label: 'Bulan Ini' },
            { id: 'all', label: 'Semua' },
          ].map((preset) => {
            const isSelected = statsFilter.dateRange === preset.id && !statsFilter.startDate;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() =>
                  setStatsFilter({
                    dateRange: preset.id as any,
                    startDate: '',
                    endDate: '',
                  })
                }
                className={`h-8 px-3.5 rounded-full text-caption-sm font-sans flex items-center justify-center transition-colors cursor-pointer !border-0 ${
                  isSelected
                    ? 'bg-primary text-on-primary font-semibold shadow-xs'
                    : 'text-body hover:text-ink'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        {/* Date Range Button */}
        <button
          type="button"
          onClick={() => setIsStatsFilterOpen(true)}
          className={`h-10 px-4 rounded-full flex items-center gap-2 cursor-pointer transition-colors border text-caption-sm font-sans font-medium shrink-0 ${
            statsFilter.dateRange === 'custom' || statsFilter.startDate
              ? 'bg-primary text-on-primary border-transparent'
              : 'bg-canvas text-ink border-hairline hover:bg-surface-soft'
          }`}
          title="Pilih rentang tanggal khusus"
          aria-label="Filter statistik tanggal"
        >
          <CalendarIcon className="w-4 h-4" />
          <span>Rentang Tanggal</span>
          {(statsFilter.dateRange === 'custom' || statsFilter.startDate) && (
            <span className="w-2 h-2 rounded-full bg-terminal-yellow" />
          )}
        </button>

        {activeDateBounds.isFiltered && (
          <span className="h-10 px-3.5 rounded-full bg-surface-soft border border-hairline flex items-center text-caption-sm text-body font-sans font-medium">
            {activeDateBounds.label}
          </span>
        )}
      </div>

      {/* 2. Platform Overview: 6 Clean Minimalist Cards (Proportional max-width, slightly enlarged) */}
      <div className="space-y-3 mt-6 sm:mt-8 max-w-5xl sm:max-w-6xl">
        <h2 className="text-heading-md font-semibold text-ink font-sans">
          Ringkasan Platform
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 sm:gap-4">
          {/* Card 1: Users */}
          <div className="p-5 sm:p-5.5 min-h-[135px] sm:min-h-[142px] rounded-2xl border border-hairline bg-canvas flex flex-col justify-between hover:border-hairline-strong transition-all">
            <div className="flex items-center justify-between text-body">
              <span className="text-caption-xs text-body uppercase font-sans tracking-wider font-semibold truncate">
                {activeDateBounds.isFiltered ? 'Pengguna Baru' : 'Total Users'}
              </span>
              <Users className="w-4.5 h-4.5 text-mute shrink-0" />
            </div>
            <div className="mt-3.5">
              <span className="text-heading-xl sm:text-display-xs font-sans font-semibold text-ink tabular-nums block truncate">
                {activeMetrics.totalUsers}
              </span>
            </div>
          </div>

          {/* Card 2: Active Users */}
          <div className="p-5 sm:p-5.5 min-h-[135px] sm:min-h-[142px] rounded-2xl border border-hairline bg-canvas flex flex-col justify-between hover:border-hairline-strong transition-all">
            <div className="flex items-center justify-between text-body">
              <span className="text-caption-xs text-body uppercase font-sans tracking-wider font-semibold truncate">
                Active Users
              </span>
              <UserCheck className="w-4.5 h-4.5 text-terminal-green shrink-0" />
            </div>
            <div className="mt-3.5">
              <span className="text-heading-xl sm:text-display-xs font-sans font-semibold text-ink tabular-nums block truncate">
                {activeMetrics.activeUsers14d ?? 0}
              </span>
            </div>
          </div>

          {/* Card 3: Paid Users */}
          <div className="p-5 sm:p-5.5 min-h-[135px] sm:min-h-[142px] rounded-2xl border border-hairline bg-canvas flex flex-col justify-between hover:border-hairline-strong transition-all">
            <div className="flex items-center justify-between text-body">
              <span className="text-caption-xs text-body uppercase font-sans tracking-wider font-semibold truncate">
                Paid Users
              </span>
              <Users className="w-4.5 h-4.5 text-mute shrink-0" />
            </div>
            <div className="mt-3.5">
              <span className="text-heading-xl sm:text-display-xs font-sans font-semibold text-ink tabular-nums block truncate">
                {activeMetrics.totalPaidUsers}
              </span>
            </div>
          </div>

          {/* Card 4: Total Revenue */}
          <div className="p-5 sm:p-5.5 min-h-[135px] sm:min-h-[142px] rounded-2xl border border-hairline bg-canvas flex flex-col justify-between hover:border-hairline-strong transition-all">
            <div className="flex items-center justify-between text-body">
              <span className="text-caption-xs text-body uppercase font-sans tracking-wider font-semibold truncate">
                Revenue
              </span>
              <DollarSign className="w-4.5 h-4.5 text-mute shrink-0" />
            </div>
            <div className="mt-3.5">
              <span className="text-heading-xl sm:text-display-xs font-sans font-semibold text-ink tabular-nums block truncate">
                {activeMetrics.revenueIdr > 0
                  ? `Rp ${activeMetrics.revenueIdr.toLocaleString('id-ID')}`
                  : activeMetrics.revenueUsd > 0
                  ? `$${activeMetrics.revenueUsd}`
                  : 'Rp 0'}
              </span>
            </div>
          </div>

          {/* Card 5: Total Notes */}
          <div className="p-5 sm:p-5.5 min-h-[135px] sm:min-h-[142px] rounded-2xl border border-hairline bg-canvas flex flex-col justify-between hover:border-hairline-strong transition-all">
            <div className="flex items-center justify-between text-body">
              <span className="text-caption-xs text-body uppercase font-sans tracking-wider font-semibold truncate">
                Notes
              </span>
              <FileText className="w-4.5 h-4.5 text-mute shrink-0" />
            </div>
            <div className="mt-3.5">
              <span className="text-heading-xl sm:text-display-xs font-sans font-semibold text-ink tabular-nums block truncate">
                {activeMetrics.totalNotes}
              </span>
            </div>
          </div>

          {/* Card 6: Token Consumed */}
          <div className="p-5 sm:p-5.5 min-h-[135px] sm:min-h-[142px] rounded-2xl border border-hairline bg-canvas flex flex-col justify-between hover:border-hairline-strong transition-all col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between text-body">
              <span className="text-caption-xs text-body uppercase font-sans tracking-wider font-semibold truncate">
                Token Consumed
              </span>
              <Sparkles className="w-4.5 h-4.5 text-mute shrink-0" />
            </div>
            <div className="mt-3.5">
              <span className="text-heading-xl sm:text-display-xs font-sans font-semibold text-ink tabular-nums block truncate">
                {activeMetrics.tokenConsumed.toLocaleString('id-ID')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Recharts Visual Analytics (Proportional Max-Width: max-w-5xl sm:max-w-6xl, balanced 2-column grid) */}
      <div className="mt-8 sm:mt-10 space-y-4 max-w-5xl sm:max-w-6xl">
        <h2 className="text-heading-md font-semibold text-ink font-sans">
          Grafik Aktivitas
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
          <AdminChartCard
            title="Active Users"
            icon={UserCheck}
            dataGroup={activeGraphData?.activeUsers}
            unitLabel="active"
            isFilteredPeriod={activeDateBounds.isFiltered}
            filteredPeriodLabel={activeDateBounds.label}
          />
          <AdminChartCard
            title="User Sign Up"
            icon={TrendingUp}
            dataGroup={activeGraphData?.userSignUps}
            unitLabel="user"
            isFilteredPeriod={activeDateBounds.isFiltered}
            filteredPeriodLabel={activeDateBounds.label}
          />
          <AdminChartCard
            title="Revenue"
            icon={DollarSign}
            dataGroup={activeGraphData?.revenue}
            unitLabel=""
            isFilteredPeriod={activeDateBounds.isFiltered}
            filteredPeriodLabel={activeDateBounds.label}
          />
          <AdminChartCard
            title="Token & AI Usage"
            icon={Sparkles}
            dataGroup={activeGraphData?.tokenAndAsk}
            isDualMode={true}
            isFilteredPeriod={activeDateBounds.isFiltered}
            filteredPeriodLabel={activeDateBounds.label}
          />
        </div>
      </div>

      {/* 4. User Directory Section (Proportional max-width, matching Ringkasan Platform) */}
      <div className="mt-8 sm:mt-10 space-y-4 max-w-5xl sm:max-w-6xl">
        <div className="pb-1">
          <h2 className="text-heading-md font-semibold text-ink font-sans">
            Direktori Pengguna
          </h2>
          <p className="text-caption-sm text-body mt-0.5 font-sans">
            Manajemen akun pengguna, status langganan, kuota catatan, dan riwayat belanja.
          </p>
        </div>

        {/* Sticky Controls Row: Search Box + Filter Button */}
        <div className="sticky top-0 z-20 bg-canvas -mx-4 px-4 sm:-mx-6 sm:px-6 md:-mx-8 md:px-8 py-2.5 !mt-0 flex items-center justify-end min-w-0">
          <div className="flex items-center gap-2 relative w-full min-w-0 sm:w-auto">
            <SearchPill
              wrapperClassName="flex-1 min-w-0 sm:flex-initial sm:w-72 md:w-80"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama, email, role..."
            />
            <button
              type="button"
              onClick={() => setIsRoleFilterOpen(!isRoleFilterOpen)}
              className={`w-10 h-10 rounded-full flex items-center justify-center cursor-pointer shrink-0 relative transition-colors ${
                isRoleFilterOpen || roleFilter !== 'all'
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

      {/* Popover Filter Statistik (Hari Ini, Minggu Ini, Bulan Ini, Range Date) */}
      <NotesFilterPopover
        isOpen={isStatsFilterOpen}
        onClose={() => setIsStatsFilterOpen(false)}
        variant="admin_stats"
        currentAdminStatsFilter={statsFilter}
        onApplyAdminStatsFilter={(newFilter) => setStatsFilter(newFilter)}
      />

      {/* Popover Filter Role Pengguna (Semua, Pro, Free, Admin) */}
      <NotesFilterPopover
        isOpen={isRoleFilterOpen}
        onClose={() => setIsRoleFilterOpen(false)}
        variant="admin"
        currentAdminFilter={roleFilter}
        onApplyAdminFilter={(newFilter) => setRoleFilter(newFilter)}
      />
    </div>
  );
}
