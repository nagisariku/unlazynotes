import { useState, useEffect, useMemo } from 'react';
import { Search, Filter, X, Sparkles, FileText } from 'lucide-react';
import NoteCard from './NoteCard';
import { Toaster, toast } from 'sonner';

interface NoteItem {
  id: string;
  content: string;
  category: string;
  specificTags?: string[] | null;
  source?: string | null;
  createdAt: string;
}

interface NotesTimelineProps {
  initialNotes: NoteItem[];
}

const ALL_CATEGORIES = [
  'random-yap',
  'draft',
  'bookmark',
  'todo',
  'schedule',
  'finance',
  'credential',
  'reference',
  'others',
];

export default function NotesTimeline({ initialNotes }: NotesTimelineProps) {
  const [notes, setNotes] = useState<NoteItem[]>(initialNotes);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [dateRange, setDateRange] = useState<'all' | 'today' | 'this_week' | 'this_month'>('all');
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  // Initialize filters from URL search params on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q') || '';
    const cat = params.get('category') || '';
    const range = (params.get('range') as any) || 'all';

    if (q) setSearchQuery(q);
    if (cat) setSelectedCategory(cat);
    if (range) setDateRange(range);
    if (cat || range !== 'all') setShowFilterPanel(true);
  }, []);

  // Update browser URL query params whenever filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set('q', searchQuery.trim());
    if (selectedCategory) params.set('category', selectedCategory);
    if (dateRange !== 'all') params.set('range', dateRange);

    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
    window.history.replaceState({}, '', newUrl);
  }, [searchQuery, selectedCategory, dateRange]);

  const handleDeleteNote = (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    toast.success('Catatan berhasil dihapus');
  };

  const handleCopySuccess = () => {
    toast.success('Teks catatan disalin ke clipboard');
  };

  // Filter notes in memory for instant reactivity
  const filteredNotes = useMemo(() => {
    return notes.filter((n) => {
      // 1. Keyword search (case-insensitive)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const contentMatch = n.content.toLowerCase().includes(query);
        const tagMatch = n.specificTags?.some((t) => t.toLowerCase().includes(query));
        const catMatch = n.category.toLowerCase().includes(query);
        if (!contentMatch && !tagMatch && !catMatch) return false;
      }

      // 2. Category filter
      if (selectedCategory && n.category !== selectedCategory) {
        return false;
      }

      // 3. Date range filter
      if (dateRange !== 'all') {
        const noteDate = new Date(n.createdAt);
        const now = new Date();
        const diffMs = now.getTime() - noteDate.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        if (dateRange === 'today' && diffDays > 1) return false;
        if (dateRange === 'this_week' && diffDays > 7) return false;
        if (dateRange === 'this_month' && diffDays > 30) return false;
      }

      return true;
    });
  }, [notes, searchQuery, selectedCategory, dateRange]);

  const hasActiveFilters = Boolean(searchQuery || selectedCategory || dateRange !== 'all');

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('');
    setDateRange('all');
  };

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-8">
      <Toaster position="bottom-right" theme="dark" />

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            <span>Notes Timeline</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
              {filteredNotes.length}
            </span>
          </h1>
          <p className="text-zinc-400 text-xs mt-1">
            Seluruh catatan yang ditangkap otomatis melalui Telegram Bot.
          </p>
        </div>

        {/* Filter Trigger */}
        <button
          onClick={() => setShowFilterPanel(!showFilterPanel)}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-medium transition-all ${
            showFilterPanel || selectedCategory || dateRange !== 'all'
              ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300'
              : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
          }`}
        >
          <Filter className="w-3.5 h-3.5" />
          <span>Filters</span>
          {(selectedCategory || dateRange !== 'all') && (
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
          )}
        </button>
      </div>

      {/* Search Input */}
      <div className="relative mb-5">
        <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3.5" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari kata kunci dalam catatan (misal: 'meeting', 'wifi', 'invoice')..."
          className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900/60 text-zinc-200 placeholder-zinc-500 text-sm focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/50 transition-all"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3.5 top-3.5 text-zinc-500 hover:text-zinc-300"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Collapsible Filter Panel */}
      {showFilterPanel && (
        <div className="mb-8 p-5 rounded-2xl border border-zinc-800 bg-zinc-900/40 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-300 tracking-wide uppercase">
              Filter Parameters
            </span>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
              >
                Reset Semua Filter
              </button>
            )}
          </div>

          {/* Quick Date Filters */}
          <div>
            <label className="text-xs text-zinc-400 block mb-2 font-medium">Rentang Tanggal:</label>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { id: 'all', label: 'Semua Waktu' },
                  { id: 'today', label: 'Hari Ini' },
                  { id: 'this_week', label: 'Minggu Ini' },
                  { id: 'this_month', label: 'Bulan Ini' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setDateRange(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    dateRange === tab.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Categories Buttons */}
          <div>
            <label className="text-xs text-zinc-400 block mb-2 font-medium">Kategori:</label>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setSelectedCategory('')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                  !selectedCategory
                    ? 'bg-zinc-100 text-zinc-900'
                    : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Semua
              </button>
              {ALL_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(selectedCategory === cat ? '' : cat)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium uppercase tracking-wider transition-all ${
                    selectedCategory === cat
                      ? 'bg-indigo-600 text-white'
                      : 'bg-zinc-800/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Notes Grid */}
      {filteredNotes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredNotes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onDelete={handleDeleteNote}
              onCopySuccess={handleCopySuccess}
            />
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="py-20 text-center rounded-3xl border border-dashed border-zinc-800 bg-zinc-900/20 max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center text-zinc-400 mx-auto mb-4">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-zinc-200 mb-1">Belum Ada Catatan</h3>
          <p className="text-zinc-500 text-xs max-w-sm mx-auto mb-6 leading-relaxed">
            {hasActiveFilters
              ? 'Tidak ada catatan yang cocok dengan parameter filter Anda. Coba reset filter.'
              : 'Kirimkan ide, to-do list, atau link ke bot Telegram @unlazynotes_bot untuk mulai mencatat!'}
          </p>
          {hasActiveFilters ? (
            <button
              onClick={clearFilters}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 transition-colors"
            >
              Bersihkan Filter
            </button>
          ) : (
            <a
              href="https://t.me/unlazynotes_bot"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-all shadow"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Buka @unlazynotes_bot</span>
            </a>
          )}
        </div>
      )}
    </div>
  );
}
