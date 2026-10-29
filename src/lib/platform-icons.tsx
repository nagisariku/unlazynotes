import type React from 'react';
import { Globe } from 'lucide-react';
import type { BookmarkMeta } from '@/db/schema';

export function YoutubeIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

export function TwitterIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function GithubIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

export function LinkedinIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76c-.95 0-1.72-.77-1.72-1.72s.77-1.72 1.72-1.72 1.72.77 1.72 1.72-.77 1.72-1.72 1.72m1.39 9.74v-8.37H5.07v8.37h2.78z" />
    </svg>
  );
}

export function InstagramIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

export function ThreadsIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.186 24C5.503 24 0 18.625 0 12.102 0 5.467 5.411 0 12.186 0c6.643 0 11.758 5.253 11.758 12.102 0 1.042-.128 2.05-.38 3.013-.238.905-1.127 1.423-2.008 1.185-.882-.239-1.399-1.134-1.161-2.039.18-.683.27-1.402.27-2.159 0-5.185-3.864-9.15-8.479-9.15-4.707 0-8.528 4.02-8.528 9.15 0 5.215 3.868 9.15 8.528 9.15 2.502 0 4.79-.999 6.294-2.678.636-.71 1.718-.755 2.427-.12.71.637.755 1.718.12 2.428-2.062 2.302-5.18 3.67-8.841 3.67z" />
    </svg>
  );
}

export function MediumIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M13.54 12a6.8 6.8 0 01-6.77 6.82A6.8 6.8 0 010 12a6.8 6.8 0 016.77-6.82A6.8 6.8 0 0113.54 12zM20.96 12c0 3.54-1.51 6.42-3.38 6.42-1.87 0-3.39-2.88-3.39-6.42s1.52-6.42 3.39-6.42 3.38 2.88 3.38 6.42M24 12c0 3.17-.53 5.75-1.19 5.75-.66 0-1.19-2.58-1.19-5.75s.53-5.75 1.19-5.75C23.47 6.25 24 8.83 24 12z" />
    </svg>
  );
}

export function RedditIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .868.173 1.177.464 1.199-.821 2.81-1.397 4.613-1.472l.951-4.458a.25.25 0 0 1 .302-.19l3.19.673a1.24 1.24 0 0 1 .995-.519zM9.5 12a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm5 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm-5.02 5.03c-.15 0-.29-.06-.39-.17a.56.56 0 0 1 .02-.79c1.07-.99 3.9-.99 4.97 0a.56.56 0 0 1-.77.81c-.72-.66-2.73-.66-3.45 0a.55.55 0 0 1-.38.15z" />
    </svg>
  );
}

export function TiktokIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-1.01v9.64c-.03 2.1-.8 4.2-2.3 5.7-1.5 1.5-3.6 2.3-5.7 2.3-2.1 0-4.2-.8-5.7-2.3-1.5-1.5-2.3-3.6-2.3-5.7 0-2.1.8-4.2 2.3-5.7 1.5-1.5 3.6-2.3 5.7-2.3.4 0 .8.04 1.2.12v4.11c-.4-.14-.8-.21-1.2-.21-1.1 0-2.1.4-2.8 1.2-.8.8-1.2 1.8-1.2 2.8 0 1.1.4 2.1 1.2 2.8.8.8 1.8 1.2 2.8 1.2 1.1 0 2.1-.4 2.8-1.2.8-.8 1.2-1.8 1.2-2.8V.02z" />
    </svg>
  );
}

export function SpotifyIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  );
}

export function FigmaIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M5.5 0C4.12 0 3 1.12 3 2.5v4C3 7.88 4.12 9 5.5 9H9V0H5.5zm7 0H9v9h3.5C13.88 9 15 7.88 15 6.5V2.5C15 1.12 13.88 0 12.5 0zM3 11.5c0-1.38 1.12-2.5 2.5-2.5H9v9H5.5C4.12 18 3 16.88 3 15.5v-4zm9-2.5H9v9h3.5c1.38 0 2.5-1.12 2.5-2.5v-4c0-1.38-1.12-2.5-2.5-2.5zM5.5 18C4.12 18 3 19.12 3 20.5S4.12 23 5.5 23 8 21.88 8 20.5V18H5.5z" />
    </svg>
  );
}

export function GoogleMapsIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
    </svg>
  );
}

export function GoogleDocsIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2zm1 14h-7v-2h7v2zm0-4h-7v-2h7v2zm-2-5V3.5L18.5 7H13.5z" />
    </svg>
  );
}

export interface PlatformInfo {
  domain: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function getUrlPlatformInfo(url: string): PlatformInfo {
  let domain = '';
  try {
    domain = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    domain = url;
  }

  if (domain.includes('youtube.com') || domain.includes('youtu.be')) {
    return { domain, label: 'YouTube', icon: YoutubeIcon };
  }
  if (domain === 'github.com') {
    return { domain, label: 'GitHub', icon: GithubIcon };
  }
  if (domain === 'twitter.com' || domain === 'x.com') {
    return { domain, label: 'Twitter', icon: TwitterIcon };
  }
  if (domain.includes('threads.net')) {
    return { domain, label: 'Threads', icon: ThreadsIcon };
  }
  if (domain.includes('medium.com')) {
    return { domain, label: 'Medium', icon: MediumIcon };
  }
  if (domain.includes('linkedin.com')) {
    return { domain, label: 'LinkedIn', icon: LinkedinIcon };
  }
  if (domain.includes('instagram.com')) {
    return { domain, label: 'Instagram', icon: InstagramIcon };
  }
  if (domain.includes('reddit.com')) {
    return { domain, label: 'Reddit', icon: RedditIcon };
  }
  if (domain.includes('tiktok.com')) {
    return { domain, label: 'TikTok', icon: TiktokIcon };
  }
  if (domain.includes('spotify.com')) {
    return { domain, label: 'Spotify', icon: SpotifyIcon };
  }
  if (domain.includes('figma.com')) {
    return { domain, label: 'Figma', icon: FigmaIcon };
  }
  if (domain.includes('maps.google.') || domain.includes('maps.app.goo.gl') || url.includes('google.com/maps')) {
    return { domain, label: 'Google Maps', icon: GoogleMapsIcon };
  }
  if (domain.includes('docs.google.com') || domain.includes('drive.google.com')) {
    return { domain, label: 'Google Docs', icon: GoogleDocsIcon };
  }

  return { domain, label: domain || 'Link', icon: Globe };
}

export function getYoutubeThumbnail(url: string): string | null {
  try {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    return match && match[1] ? `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg` : null;
  } catch {
    return null;
  }
}

export function getLinkThumbnail(url: string, meta?: BookmarkMeta | null): string | null {
  if (!url) return null;

  // 1. YouTube thumbnail from video ID
  const ytThumb = getYoutubeThumbnail(url);
  if (ytThumb) return ytThumb;

  // 2. Multi-link items match
  if (meta?.items && Array.isArray(meta.items)) {
    const matchedItem = meta.items.find(
      (it) => it.url === url || (it.domain && url.toLowerCase().includes(it.domain.toLowerCase()))
    );
    if (matchedItem?.imageUrl) {
      return matchedItem.imageUrl;
    }
  }

  // 3. Direct match with current metadata primaryUrl or domain
  if (meta?.imageUrl && (url === meta.primaryUrl || (meta.domain && url.toLowerCase().includes(meta.domain.toLowerCase())))) {
    return meta.imageUrl;
  }

  // 4. Direct image file extension
  if (/\.(jpeg|jpg|gif|png|webp|svg)(\?.*)?$/i.test(url)) {
    return url;
  }

  return null;
}

export function getLinkTitle(url: string, meta?: BookmarkMeta | null): string | null {
  if (!url) return null;

  if (meta?.items && Array.isArray(meta.items)) {
    const matchedItem = meta.items.find(
      (it) => it.url === url || (it.domain && url.toLowerCase().includes(it.domain.toLowerCase()))
    );
    if (matchedItem?.title) {
      return matchedItem.title;
    }
  }

  if (url === meta?.primaryUrl && meta?.title) {
    return meta.title;
  }

  return null;
}

/**
 * Checks if a domain/URL cannot be extracted or processed by AI
 * due to login gates, authentication walls, or interactive canvas/app formats.
 * Client-safe: Zero Node/DB runtime dependencies.
 */
export function isDomainUnsupportedForAi(url: string): { unsupported: boolean; reason?: string } {
  if (!url) return { unsupported: false };
  try {
    const domain = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    const unsupportedList: Array<{ pattern: RegExp; reason: string }> = [
      { pattern: /canva\.com/i, reason: 'Canva adalah editor desain interaktif yang dilindungi login' },
      { pattern: /figma\.com/i, reason: 'Figma adalah kanvas desain interaktif berbasis web' },
      { pattern: /instagram\.com/i, reason: 'Instagram dilindungi autentikasi login' },
      { pattern: /threads\.net/i, reason: 'Threads dilindungi sistem autentikasi login' },
      { pattern: /facebook\.com|fb\.com|fb\.watch/i, reason: 'Facebook dilindungi sistem autentikasi login' },
      { pattern: /spotify\.com/i, reason: 'Spotify adalah aplikasi media audio interaktif' },
      { pattern: /pinterest\.com/i, reason: 'Pinterest adalah feed visual interaktif yang dilindungi login' },
      { pattern: /drive\.google\.com|docs\.google\.com/i, reason: 'Google Drive/Docs dilindungi izin akses dokumen' },
      { pattern: /linkedin\.com/i, reason: 'LinkedIn dilindungi pembatas login akun' },
    ];

    for (const item of unsupportedList) {
      if (item.pattern.test(domain)) {
        return { unsupported: true, reason: item.reason };
      }
    }
  } catch {}
  return { unsupported: false };
}

export type CanonicalPlatformKey =
  | 'youtube'
  | 'github'
  | 'twitter'
  | 'instagram'
  | 'tiktok'
  | 'spotify'
  | 'figma'
  | 'reddit'
  | 'medium'
  | 'linkedin'
  | 'threads'
  | 'maps'
  | 'google_docs'
  | 'other';

export function resolveBookmarkPlatform(
  url?: string | null,
  source?: string | null,
  tags?: string[] | null
): {
  key: CanonicalPlatformKey | string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
} {
  const cleanSource = (source || '').toLowerCase().trim();
  const cleanTags = (tags || []).map((t) => t.toLowerCase().trim());
  const cleanUrl = (url || '').trim();

  // 1. YouTube
  if (
    cleanSource === 'youtube' ||
    cleanTags.includes('youtube') ||
    cleanUrl.includes('youtube.com') ||
    cleanUrl.includes('youtu.be')
  ) {
    return { key: 'youtube', label: 'YouTube', icon: YoutubeIcon };
  }

  // 2. GitHub
  if (
    cleanSource === 'github' ||
    cleanTags.includes('github') ||
    cleanUrl.includes('github.com')
  ) {
    return { key: 'github', label: 'GitHub', icon: GithubIcon };
  }

  // 3. Twitter / X
  if (
    cleanSource === 'twitter' ||
    cleanSource === 'x' ||
    cleanTags.includes('twitter') ||
    cleanTags.includes('x') ||
    cleanUrl.includes('twitter.com') ||
    cleanUrl.includes('x.com')
  ) {
    return { key: 'twitter', label: 'X (Twitter)', icon: TwitterIcon };
  }

  // 4. Instagram
  if (
    cleanSource === 'instagram' ||
    cleanTags.includes('instagram') ||
    cleanUrl.includes('instagram.com')
  ) {
    return { key: 'instagram', label: 'Instagram', icon: InstagramIcon };
  }

  // 5. TikTok
  if (
    cleanSource === 'tiktok' ||
    cleanTags.includes('tiktok') ||
    cleanUrl.includes('tiktok.com')
  ) {
    return { key: 'tiktok', label: 'TikTok', icon: TiktokIcon };
  }

  // 6. Spotify
  if (
    cleanSource === 'spotify' ||
    cleanTags.includes('spotify') ||
    cleanUrl.includes('spotify.com')
  ) {
    return { key: 'spotify', label: 'Spotify', icon: SpotifyIcon };
  }

  // 7. Figma
  if (
    cleanSource === 'figma' ||
    cleanTags.includes('figma') ||
    cleanUrl.includes('figma.com')
  ) {
    return { key: 'figma', label: 'Figma', icon: FigmaIcon };
  }

  // 8. Reddit
  if (
    cleanSource === 'reddit' ||
    cleanTags.includes('reddit') ||
    cleanUrl.includes('reddit.com')
  ) {
    return { key: 'reddit', label: 'Reddit', icon: RedditIcon };
  }

  // 9. Medium
  if (
    cleanSource === 'medium' ||
    cleanTags.includes('medium') ||
    cleanUrl.includes('medium.com')
  ) {
    return { key: 'medium', label: 'Medium', icon: MediumIcon };
  }

  // 10. LinkedIn
  if (
    cleanSource === 'linkedin' ||
    cleanTags.includes('linkedin') ||
    cleanUrl.includes('linkedin.com')
  ) {
    return { key: 'linkedin', label: 'LinkedIn', icon: LinkedinIcon };
  }

  // 11. Threads
  if (
    cleanSource === 'threads' ||
    cleanTags.includes('threads') ||
    cleanUrl.includes('threads.net')
  ) {
    return { key: 'threads', label: 'Threads', icon: ThreadsIcon };
  }

  // 12. Google Maps
  if (
    cleanSource === 'maps' ||
    cleanTags.includes('maps') ||
    cleanUrl.includes('maps.google.') ||
    cleanUrl.includes('maps.app.goo.gl') ||
    cleanUrl.includes('google.com/maps')
  ) {
    return { key: 'maps', label: 'Google Maps', icon: GoogleMapsIcon };
  }

  // 13. Google Docs / Drive
  if (
    cleanSource === 'google-docs' ||
    cleanSource === 'google-drive' ||
    cleanSource === 'drive' ||
    cleanTags.includes('drive') ||
    cleanTags.includes('google-docs') ||
    cleanUrl.includes('docs.google.com') ||
    cleanUrl.includes('drive.google.com')
  ) {
    return { key: 'google_docs', label: 'Google Docs', icon: GoogleDocsIcon };
  }

  // Fallback: Web & Artikel
  return { key: 'other', label: 'Web & Artikel', icon: Globe };
}
