import type { Category } from '../types';
import type { CanonicalTagDef } from './types';
import { FINANCE_TAXONOMY } from './finance';
import { TODO_TAXONOMY } from './todo';
import { CREDENTIAL_TAXONOMY } from './credential';
import { BOOKMARK_TAXONOMY } from './bookmark';
import { GENERAL_TAXONOMY } from './general';

export * from './types';
export * from './clusters';
export { FINANCE_TAXONOMY, TODO_TAXONOMY, CREDENTIAL_TAXONOMY, BOOKMARK_TAXONOMY, GENERAL_TAXONOMY };

const ALL_TAXONOMIES: CanonicalTagDef[] = [
  ...FINANCE_TAXONOMY,
  ...TODO_TAXONOMY,
  ...CREDENTIAL_TAXONOMY,
  ...BOOKMARK_TAXONOMY,
  ...GENERAL_TAXONOMY,
];

// In-memory fast alias lookup map: normalized alias -> canonical tag
const ALIAS_MAP = new Map<string, { canonical: string; category: Category }>();

// Category-scoped alias lookup map: category -> Map<alias, canonical>
const CATEGORY_ALIAS_MAP = new Map<Category, Map<string, string>>();

// Initialize maps
for (const def of ALL_TAXONOMIES) {
  if (!CATEGORY_ALIAS_MAP.has(def.category)) {
    CATEGORY_ALIAS_MAP.set(def.category, new Map());
  }
  const catMap = CATEGORY_ALIAS_MAP.get(def.category)!;

  // Map canonical itself
  ALIAS_MAP.set(def.canonical.toLowerCase(), { canonical: def.canonical, category: def.category });
  catMap.set(def.canonical.toLowerCase(), def.canonical);

  // Map Indonesian aliases
  for (const alias of def.aliases.id) {
    const norm = alias.toLowerCase().trim();
    if (!ALIAS_MAP.has(norm)) {
      ALIAS_MAP.set(norm, { canonical: def.canonical, category: def.category });
    }
    catMap.set(norm, def.canonical);
  }

  // Map English aliases
  for (const alias of def.aliases.en) {
    const norm = alias.toLowerCase().trim();
    if (!ALIAS_MAP.has(norm)) {
      ALIAS_MAP.set(norm, { canonical: def.canonical, category: def.category });
    }
    catMap.set(norm, def.canonical);
  }
}

/**
 * Resolves a raw token (slang, Indonesian, or English) to a canonical single-word tag.
 * Priority is given to the specified category if provided.
 */
export function resolveCanonicalTag(rawToken: string, category?: Category): string | null {
  const norm = rawToken.trim().toLowerCase();
  if (!norm) return null;

  if (category && CATEGORY_ALIAS_MAP.has(category)) {
    const catMap = CATEGORY_ALIAS_MAP.get(category)!;
    if (catMap.has(norm)) {
      return catMap.get(norm)!;
    }
  }

  const globalMatch = ALIAS_MAP.get(norm);
  return globalMatch ? globalMatch.canonical : null;
}

/**
 * Extracts recognized canonical tags directly from raw note text using the category's bilingual taxonomy.
 * Zero-cost, instantaneous O(N) regex-based scanner.
 */
/**
 * @deprecated Decommissioned for Pure LLM Architecture. Always returns empty array.
 */
export function extractTagsFromContent(_content: string, _category: Category, _limit = 2): string[] {
  return [];
}

/**
 * Get all allowed canonical single-word tags for a given category.
 * Used to constrain LLM outputs or validate dashboard tags.
 */
export function getCategoryCanonicalTags(category: Category): string[] {
  return ALL_TAXONOMIES.filter(def => def.category === category).map(def => def.canonical);
}
