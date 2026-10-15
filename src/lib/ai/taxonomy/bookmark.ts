import type { CanonicalTagDef } from './types';

export const BOOKMARK_TAXONOMY: CanonicalTagDef[] = [
  {
    canonical: 'github',
    category: 'bookmark',
    description: 'GitHub repositories, code repos, and pull requests',
    aliases: {
      id: ['github', 'repo', 'repository'],
      en: ['github', 'repo', 'repository'],
    },
  },
  {
    canonical: 'youtube',
    category: 'bookmark',
    description: 'YouTube videos, streams, and podcasts',
    aliases: {
      id: ['youtube', 'video'],
      en: ['youtube', 'video'],
    },
  },
  {
    canonical: 'twitter',
    category: 'bookmark',
    description: 'Twitter / X posts and threads',
    aliases: {
      id: ['twitter', 'tweet', 'cuitan'],
      en: ['twitter', 'tweet'],
    },
  },
  {
    canonical: 'instagram',
    category: 'bookmark',
    description: 'Instagram reels, posts, and carousels',
    aliases: {
      id: ['instagram', 'ig', 'reels'],
      en: ['instagram', 'ig', 'reels'],
    },
  },
  {
    canonical: 'tiktok',
    category: 'bookmark',
    description: 'TikTok short videos and clips',
    aliases: {
      id: ['tiktok', 'vt'],
      en: ['tiktok', 'vt'],
    },
  },
  {
    canonical: 'article',
    category: 'bookmark',
    description: 'Web blog posts, news articles, and documentation pages',
    aliases: {
      id: ['artikel', 'tulisan', 'berita'],
      en: ['article', 'blog', 'news', 'reading'],
    },
  },
  {
    canonical: 'tools',
    category: 'bookmark',
    description: 'Online utilities, developer tools, and web apps',
    aliases: {
      id: ['alat', 'tools', 'utilitas'],
      en: ['tools', 'utility', 'devtools', 'software'],
    },
  },
];
