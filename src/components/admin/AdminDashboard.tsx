import { useState, useMemo } from 'react';
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
  CreditCard,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  DollarSign,
} from 'lucide-react';

export interface AdminUserItem {
  id: string;
  name: string | null;
  email: string;
  role: string;
  plan: string;
  status: string;
  expiresAt: string | null;
  notesCount: number;
  createdAt: string;
}

export interface AdminMetrics {
  totalUsers: number;
  totalNotes: number;
  proCount: number;
  standardCount: number;
  revenueIdr: number;
  revenueUsd: number;
  paidTransactionsCount: number;
}

interface AdminDashboardProps {
  metrics: AdminMetrics;
  users: AdminUserItem[];
  currentUser: {
    id: string;
    email: string;
    name?: string | null;
  };
}

export default function AdminDashboard({ metrics, users: initialUsers, currentUser }: AdminDashboardProps) {
  const [globalFilter, setGlobalFilter] = useState('');
  const [planFilter, setPlanFilter] = useState<'all' | 'standard' | 'pro'>('all');

  const filteredData = useMemo(() => {
    let result = initialUsers;
    if (planFilter !== 'all') {
      result = result.filter((u) => u.plan === planFilter);
    }
    return result;
  }, [initialUsers, planFilter]);

  const columns = useMemo<LegacyColumnDef<AdminUserItem>[]>(
    () => [
      {
        header: 'Pengguna',
        accessorKey: 'name',
        cell: (info) => {
          const user = info.row.original;
          const initial = (user.name || user.email)[0].toUpperCase();
          return (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-300 shrink-0">
                {initial}
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-zinc-100 text-xs truncate">
                  {user.name || 'Anonymous User'}
                </div>
                <div className="text-[11px] text-zinc-400 truncate">{user.email}</div>
              </div>
            </div>
          );
        },
      },
      {
        header: 'Role',
        accessorKey: 'role',
        cell: (info) => {
          const role = info.getValue() as string;
          return role === 'admin' ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <ShieldCheck className="w-3 h-3" />
              <span>Admin</span>
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium text-zinc-400 bg-zinc-800/80">
              User
            </span>
          );
        },
      },
      {
        header: 'Paket',
        accessorKey: 'plan',
        cell: (info) => {
          const plan = info.getValue() as string;
          return plan === 'pro' ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Sparkles className="w-3 h-3" />
              <span>Pro</span>
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium text-zinc-400 bg-zinc-800/60">
              Standard
            </span>
          );
        },
      },
      {
        header: 'Status Langganan',
        accessorKey: 'status',
        cell: (info) => {
          const status = info.getValue() as string;
          return (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                status === 'active'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              }`}
            >
              {status}
            </span>
          );
        },
      },
      {
        header: 'Total Catatan',
        accessorKey: 'notesCount',
        cell: (info) => (
          <span className="font-mono text-xs font-semibold text-zinc-300">
            {info.getValue() as number}
          </span>
        ),
      },
      {
        header: 'Masa Aktif / Expired',
        accessorKey: 'expiresAt',
        cell: (info) => {
          const exp = info.getValue() as string | null;
          if (!exp) return <span className="text-zinc-500 text-xs">-</span>;
          return (
            <span className="text-xs text-zinc-300 font-mono">
              {new Date(exp).toLocaleDateString('id-ID', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          );
        },
      },
      {
        header: 'Bergabung',
        accessorKey: 'createdAt',
        cell: (info) => {
          const dt = info.getValue() as string;
          return (
            <span className="text-xs text-zinc-400 font-mono">
              {new Date(dt).toLocaleDateString('id-ID', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          );
        },
      },
    ],
    []
  );

  const table = useLegacyTable({
    data: filteredData,
    columns,
    state: {
      globalFilter,
    },
    onGlobalFilterChange: setGlobalFilter,
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

  const proPercentage =
    metrics.totalUsers > 0
      ? Math.round((metrics.proCount / metrics.totalUsers) * 100)
      : 0;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 sm:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Top Bar Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <a
              href="/dashboard"
              className="p-2 rounded-xl border border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
              title="Kembali ke Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </a>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Shield className="w-3.5 h-3.5" />
              <span>Admin Console</span>
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 mt-2">
            Administrator &amp; SaaS Metrics
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Ringkasan data pengguna, adopsi paket, transaksi pembayaran, dan utilisasi platform.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-xs text-zinc-400 block font-medium">Logged in as Admin:</span>
            <span className="text-xs text-zinc-200 font-semibold">{currentUser.email}</span>
          </div>
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Users & Ratio */}
        <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/40 space-y-2">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Pelanggan</span>
            <Users className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-zinc-100">{metrics.totalUsers}</div>
          <div className="text-[11px] text-zinc-400 flex items-center justify-between pt-1 border-t border-zinc-800/80">
            <span>Standard: <strong className="text-zinc-200">{metrics.standardCount}</strong></span>
            <span>Pro: <strong className="text-indigo-400">{metrics.proCount}</strong> ({proPercentage}%)</span>
          </div>
        </div>

        {/* Metric 2: Total Notes Saved */}
        <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/40 space-y-2">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Catatan</span>
            <FileText className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-zinc-100">{metrics.totalNotes}</div>
          <p className="text-[11px] text-zinc-400 pt-1 border-t border-zinc-800/80">
            Rata-rata {metrics.totalUsers > 0 ? (metrics.totalNotes / metrics.totalUsers).toFixed(1) : 0} catatan per user
          </p>
        </div>

        {/* Metric 3: Revenue IDR */}
        <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/40 space-y-2">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Pendapatan IDR</span>
            <CreditCard className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-zinc-100">
            Rp {metrics.revenueIdr.toLocaleString('id-ID')}
          </div>
          <p className="text-[11px] text-zinc-400 pt-1 border-t border-zinc-800/80">
            Dari DOKU Payment Gateway
          </p>
        </div>

        {/* Metric 4: Revenue USD & Transactions */}
        <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/40 space-y-2">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Pendapatan USD</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-zinc-100">${metrics.revenueUsd}</div>
          <div className="text-[11px] text-zinc-400 pt-1 border-t border-zinc-800/80 flex items-center justify-between">
            <span>Transaksi Lunas:</span>
            <strong className="text-emerald-400">{metrics.paidTransactionsCount} paid</strong>
          </div>
        </div>
      </div>

      {/* Users Management Table Section */}
      <div className="p-6 rounded-3xl border border-zinc-800 bg-zinc-900/40 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-zinc-100">Daftar Pengguna Platform</h2>
            <p className="text-xs text-zinc-400">
              Kelola status paket, role, dan statistik penggunaan setiap pengguna.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Filter by Plan */}
            <div className="flex items-center p-1 rounded-xl bg-zinc-950 border border-zinc-800 text-xs">
              <button
                onClick={() => setPlanFilter('all')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  planFilter === 'all'
                    ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Semua ({initialUsers.length})
              </button>
              <button
                onClick={() => setPlanFilter('standard')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  planFilter === 'standard'
                    ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Standard ({metrics.standardCount})
              </button>
              <button
                onClick={() => setPlanFilter('pro')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  planFilter === 'pro'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Pro ({metrics.proCount})
              </button>
            </div>

            {/* Instant Search Bar */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari user / email..."
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-200 placeholder-zinc-500 text-xs focus:outline-none focus:border-zinc-700 w-48 sm:w-60"
              />
            </div>
          </div>
        </div>

        {/* TanStack React Table */}
        <div className="overflow-x-auto rounded-2xl border border-zinc-800/80 bg-zinc-950">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-zinc-800 bg-zinc-900/40 text-zinc-400">
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
            <tbody className="divide-y divide-zinc-800/60">
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="p-8 text-center text-zinc-500">
                    Tidak ada pengguna yang cocok dengan pencarian / filter.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="hover:bg-zinc-900/40 transition-colors">
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

        {/* Pagination Controls */}
        <div className="flex items-center justify-between text-xs text-zinc-400 pt-2">
          <span>
            Halaman{' '}
            <strong className="text-zinc-200">
              {table.getState().pagination.pageIndex + 1}
            </strong>{' '}
            dari <strong className="text-zinc-200">{table.getPageCount() || 1}</strong> ({table.getFilteredRowModel().rows.length} pengguna)
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 disabled:hover:bg-zinc-900 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 disabled:hover:bg-zinc-900 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
