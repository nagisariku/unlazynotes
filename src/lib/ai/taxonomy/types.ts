import type { Category } from '../types';

export interface CanonicalTagDef {
  canonical: string;
  category: Category;
  description?: string;
  aliases: {
    id: string[];
    en: string[];
  };
}
