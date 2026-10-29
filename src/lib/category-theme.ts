/**
 * Centralized Category Theming System for UnlazyNotes
 * 
 * GitHub Bookmark/Thumbnail-Inspired Aesthetic:
 * 1. Flat paper-white canvas cards (no background color).
 * 2. Neutral hairline borders (like original design).
 * 3. High-contrast circular accent dots before text content & in filter popover.
 * 4. Solid category-colored horizontal bottom accent line (h-1 / 4px) clipped to rounded card corners.
 */

export interface CategoryTheme {
  key: string;
  label: string;
  dot: string;
  line: string;
  badgeBg: string;
}

export const CATEGORY_THEMES: Record<string, CategoryTheme> = {
  todo: {
    key: 'todo',
    label: 'Todo',
    dot: 'bg-amber-500',
    line: 'bg-amber-500',
    badgeBg: 'bg-surface-soft text-ink',
  },
  schedule: {
    key: 'schedule',
    label: 'Schedule',
    dot: 'bg-sky-500',
    line: 'bg-sky-500',
    badgeBg: 'bg-surface-soft text-ink',
  },
  finance: {
    key: 'finance',
    label: 'Finance',
    dot: 'bg-emerald-500',
    line: 'bg-emerald-500',
    badgeBg: 'bg-surface-soft text-ink',
  },
  bookmark: {
    key: 'bookmark',
    label: 'Bookmark',
    dot: 'bg-indigo-500',
    line: 'bg-indigo-500',
    badgeBg: 'bg-surface-soft text-ink',
  },
  draft: {
    key: 'draft',
    label: 'Draft',
    dot: 'bg-purple-500',
    line: 'bg-purple-500',
    badgeBg: 'bg-surface-soft text-ink',
  },
  reference: {
    key: 'reference',
    label: 'Reference',
    dot: 'bg-teal-600',
    line: 'bg-teal-600',
    badgeBg: 'bg-surface-soft text-ink',
  },
  'random-yap': {
    key: 'random-yap',
    label: 'Random Yap',
    dot: 'bg-rose-500',
    line: 'bg-rose-500',
    badgeBg: 'bg-surface-soft text-ink',
  },
  credential: {
    key: 'credential',
    label: 'Credential',
    dot: 'bg-slate-600',
    line: 'bg-slate-600',
    badgeBg: 'bg-surface-soft text-ink',
  },
  others: {
    key: 'others',
    label: 'Others',
    dot: 'bg-neutral-400',
    line: 'bg-neutral-400',
    badgeBg: 'bg-surface-soft text-ink',
  },
  archived: {
    key: 'archived',
    label: 'Archived',
    dot: 'bg-zinc-400',
    line: 'bg-zinc-400',
    badgeBg: 'bg-surface-soft text-ink',
  },
};

/**
 * Normalizes input category and returns corresponding CategoryTheme.
 * Safe fallback to `others` for undefined, null, or unrecognized categories.
 */
export function getCategoryTheme(category?: string | null): CategoryTheme {
  if (!category) return CATEGORY_THEMES.others;
  const normalized = category.toLowerCase().trim();
  if (normalized === 'bookmarks') return CATEGORY_THEMES.bookmark;
  return CATEGORY_THEMES[normalized] || CATEGORY_THEMES.others;
}
