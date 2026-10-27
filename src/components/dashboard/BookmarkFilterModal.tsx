import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Globe } from 'lucide-react';
import { YoutubeIcon, TwitterIcon, GithubIcon, RedditIcon } from '@/lib/platform-icons';
import { BOOKMARK_MACRO_CONFIG } from './BookmarksView';
import { Button } from '../ui';

export interface BookmarkFilterState {
  dateRange: 'this_month' | 'all';
  readingStatus: 'all' | 'unread';
  platform: string;
  category: string;
}

interface BookmarkFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentFilters: BookmarkFilterState;
  onApply: (filters: BookmarkFilterState) => void;
  onReset: () => void;
}

const PLATFORM_OPTIONS = [
  { key: 'all', label: 'Semua', Icon: null },
  { key: 'youtube', label: 'YouTube', Icon: YoutubeIcon },
  { key: 'twitter', label: 'X (Twitter)', Icon: TwitterIcon },
  { key: 'github', label: 'GitHub', Icon: GithubIcon },
  { key: 'reddit', label: 'Reddit', Icon: RedditIcon },
  { key: 'other', label: 'Web & Lainnya', Icon: Globe },
];

export default function BookmarkFilterModal({
  isOpen,
  onClose,
  currentFilters,
  onApply,
  onReset,
}: BookmarkFilterModalProps) {
  const [mounted, setMounted] = useState(false);
  const [draftFilters, setDraftFilters] = useState<BookmarkFilterState>(currentFilters);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setDraftFilters(currentFilters);
    }
  }, [isOpen, currentFilters]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  const handleApply = () => {
    onApply(draftFilters);
    onClose();
  };

  const handleReset = () => {
    onReset();
    onClose();
  };

  const modalContent = (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[9998] bg-black/60 select-none animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Container */}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none select-none">
        <div
          className="relative w-full max-w-[360px] max-h-[calc(100dvh-2rem)] flex flex-col rounded-2xl bg-canvas p-4 sm:p-5 text-ink shadow-2xl pointer-events-auto overscroll-contain animate-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-hairline/60">
            <h3 className="text-body-md font-semibold text-ink">Filter Bookmark</h3>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-mute hover:text-ink hover:bg-surface-soft transition-colors cursor-pointer"
              title="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Filter Body: Scrollable */}
          <div className="flex-1 overflow-y-auto py-4 space-y-4 no-scrollbar">
            {/* 1. Periode Waktu */}
            <div className="space-y-1.5">
              <label className="text-caption-sm font-medium text-body uppercase tracking-wider block">
                Periode Waktu
              </label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setDraftFilters((prev) => ({ ...prev, dateRange: 'this_month' }))}
                  className={`px-3 py-1.5 rounded-full text-caption-sm font-medium cursor-pointer transition-colors !border-0 ${
                    draftFilters.dateRange === 'this_month'
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-soft text-body hover:text-ink'
                  }`}
                >
                  Bulan Ini
                </button>
                <button
                  type="button"
                  onClick={() => setDraftFilters((prev) => ({ ...prev, dateRange: 'all' }))}
                  className={`px-3 py-1.5 rounded-full text-caption-sm font-medium cursor-pointer transition-colors !border-0 ${
                    draftFilters.dateRange === 'all'
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-soft text-body hover:text-ink'
                  }`}
                >
                  Semua Waktu
                </button>
              </div>
            </div>

            {/* 2. Status Baca */}
            <div className="space-y-1.5">
              <label className="text-caption-sm font-medium text-body uppercase tracking-wider block">
                Status Baca
              </label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setDraftFilters((prev) => ({ ...prev, readingStatus: 'all' }))}
                  className={`px-3 py-1.5 rounded-full text-caption-sm font-medium cursor-pointer transition-colors !border-0 ${
                    draftFilters.readingStatus === 'all'
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-soft text-body hover:text-ink'
                  }`}
                >
                  Semua
                </button>
                <button
                  type="button"
                  onClick={() => setDraftFilters((prev) => ({ ...prev, readingStatus: 'unread' }))}
                  className={`px-3 py-1.5 rounded-full text-caption-sm font-medium cursor-pointer transition-colors !border-0 ${
                    draftFilters.readingStatus === 'unread'
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-soft text-body hover:text-ink'
                  }`}
                >
                  Belum Dibaca
                </button>
              </div>
            </div>

            {/* 3. Platform */}
            <div className="space-y-1.5">
              <label className="text-caption-sm font-medium text-body uppercase tracking-wider block">
                Platform
              </label>
              <div className="flex flex-wrap gap-1.5">
                {PLATFORM_OPTIONS.map((item) => {
                  const Icon = item.Icon;
                  const isActive = draftFilters.platform === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setDraftFilters((prev) => ({ ...prev, platform: item.key }))}
                      className={`px-3 py-1.5 rounded-full text-caption-sm font-medium cursor-pointer flex items-center gap-1.5 transition-colors !border-0 ${
                        isActive
                          ? 'bg-primary text-on-primary'
                          : 'bg-surface-soft text-body hover:text-ink'
                      }`}
                    >
                      {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Kategori */}
            <div className="space-y-1.5">
              <label className="text-caption-sm font-medium text-body uppercase tracking-wider block">
                Kategori
              </label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setDraftFilters((prev) => ({ ...prev, category: 'all' }))}
                  className={`px-3 py-1.5 rounded-full text-caption-sm font-medium cursor-pointer transition-colors !border-0 ${
                    draftFilters.category === 'all'
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-soft text-body hover:text-ink'
                  }`}
                >
                  Semua Kategori
                </button>
                {BOOKMARK_MACRO_CONFIG.map((conf) => {
                  const isActive = draftFilters.category === conf.type;
                  return (
                    <button
                      key={conf.type}
                      type="button"
                      onClick={() => setDraftFilters((prev) => ({ ...prev, category: conf.type }))}
                      className={`px-3 py-1.5 rounded-full text-caption-sm font-medium cursor-pointer transition-colors !border-0 ${
                        isActive
                          ? 'bg-primary text-on-primary'
                          : 'bg-surface-soft text-body hover:text-ink'
                      }`}
                    >
                      {conf.title}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer Controls: Reset & Terapkan */}
          <div className="flex items-center gap-2 pt-3 border-t border-hairline/60">
            <button
              type="button"
              onClick={handleReset}
              className="flex-1 py-2 px-3 rounded-xl bg-surface-soft hover:bg-hairline/60 text-body hover:text-ink text-caption-sm font-medium transition-colors cursor-pointer !border-0"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="flex-1 py-2 px-3 rounded-xl bg-primary text-on-primary hover:opacity-90 text-caption-sm font-semibold transition-opacity cursor-pointer !border-0"
            >
              Terapkan
            </button>
          </div>
        </div>
      </div>
    </>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
}
