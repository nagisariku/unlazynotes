import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Extracts thumbnail OG image and clean text from bookmark note content.
 * Follows canonical rule: Only uses the FIRST link as the primary thumbnail.
 */
export function extractBookmarkThumbnail(
  content: string,
  attachments?: Array<{ type: string; localPath?: string }> | null
): {
  thumbnail: string | null;
  cleanText: string;
  primaryUrl: string;
} {
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const urls = Array.from(content.matchAll(urlRegex), (m) => m[0]);
  const primaryUrl = urls[0] || '';

  let domain = '';
  if (primaryUrl) {
    try {
      domain = new URL(primaryUrl).hostname.toLowerCase().replace(/^www\./, '');
    } catch {
      domain = primaryUrl;
    }
  }

  let thumbnail: string | null = null;

  if (primaryUrl) {
    // 1. YouTube
    if (domain.includes('youtube.com') || domain.includes('youtu.be')) {
      const m = primaryUrl.match(
        /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/
      );
      if (m && m[1]) {
        thumbnail = `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg`;
      }
    }
    // 2. GitHub
    else if (domain === 'github.com') {
      const m = primaryUrl.match(/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/);
      if (m && m[1] && m[2] && m[1] !== 'topics' && m[1] !== 'search') {
        thumbnail = `https://opengraph.githubassets.com/1/${m[1]}/${m[2]}`;
      }
    }
    // 3. Direct image file URL
    else if (/\.(jpeg|jpg|gif|png|webp|svg)(\?.*)?$/i.test(primaryUrl)) {
      thumbnail = primaryUrl;
    }
  }

  // Fallback: Check note attachments for image
  if (!thumbnail && attachments && attachments.length > 0) {
    const imgAtt = attachments.find((a) => a.type === 'image');
    if (imgAtt?.localPath) {
      thumbnail = imgAtt.localPath;
    }
  }

  return {
    thumbnail,
    cleanText: content,
    primaryUrl,
  };
}
