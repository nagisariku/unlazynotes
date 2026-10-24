/**
 * Lightweight Link Metadata Enricher
 * Uses YouTube official free oEmbed (zero API key) and fast HTML head stream (<25KB)
 * Zero browser dependencies (no Puppeteer/Playwright) and strictly bounded by 3s timeout.
 */

export interface LinkMetadata {
  title?: string;
  description?: string;
  thumbnailUrl?: string;
  author?: string;
}

/**
 * Fetches lightweight metadata (title, description, thumbnail) from any web or media URL.
 * Automatically handles YouTube oEmbed and generic OpenGraph/HTML headers.
 */
export async function fetchLinkMetadata(url: string): Promise<LinkMetadata | null> {
  if (!url || !/^https?:\/\//i.test(url.trim())) {
    return null;
  }

  const cleanUrl = url.trim();

  try {
    // A. YouTube via Official Free oEmbed (Zero Key, Instant JSON)
    if (/youtube\.com|youtu\.be/i.test(cleanUrl)) {
      try {
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(cleanUrl)}&format=json`;
        const res = await fetch(oembedUrl, {
          signal: AbortSignal.timeout(3000),
        });
        if (res.ok) {
          const data = (await res.json()) as any;
          return {
            title: typeof data.title === 'string' ? data.title.trim() : undefined,
            author: typeof data.author_name === 'string' ? data.author_name.trim() : undefined,
            thumbnailUrl: typeof data.thumbnail_url === 'string' ? data.thumbnail_url.trim() : undefined,
          };
        }
      } catch {
        // Fallback to generic fetch below if oEmbed fails
      }
    }

    // B. Instagram Reels, TikTok, GitHub, & Web Umum via Lightweight Head Stream
    const res = await fetch(cleanUrl, {
      headers: {
        'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(3000),
    });

    if (!res.ok) return null;

    // Baca hanya potongan pertama (<25KB) untuk mengambil tag <head> tanpa memuat seluruh page
    const htmlSnippet = await res.text();
    const headPart = htmlSnippet.slice(0, 25000);

    // 1. Ekstraksi Judul (og:title, twitter:title, atau <title>)
    const titleMatch =
      headPart.match(/<meta\s+[^>]*property=["']og:title["']\s+content=["'](.*?)["']/i) ||
      headPart.match(/<meta\s+[^>]*name=["']twitter:title["']\s+content=["'](.*?)["']/i) ||
      headPart.match(/<title[^>]*>(.*?)<\/title>/i);

    // 2. Ekstraksi Deskripsi (og:description, twitter:description, atau meta description)
    const descMatch =
      headPart.match(/<meta\s+[^>]*property=["']og:description["']\s+content=["'](.*?)["']/i) ||
      headPart.match(/<meta\s+[^>]*name=["']twitter:description["']\s+content=["'](.*?)["']/i) ||
      headPart.match(/<meta\s+[^>]*name=["']description["']\s+content=["'](.*?)["']/i);

    // 3. Ekstraksi Gambar / Thumbnail (og:image atau twitter:image)
    const imageMatch =
      headPart.match(/<meta\s+[^>]*property=["']og:image["']\s+content=["'](.*?)["']/i) ||
      headPart.match(/<meta\s+[^>]*name=["']twitter:image["']\s+content=["'](.*?)["']/i);

    const title = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : undefined;
    const description = descMatch ? decodeHtmlEntities(descMatch[1].trim()) : undefined;
    const thumbnailUrl = imageMatch ? imageMatch[1].trim() : undefined;

    if (!title && !description) {
      return null;
    }

    return {
      title,
      description,
      thumbnailUrl,
    };
  } catch {
    // Graceful fallback for timeout or unreachable domain
    return null;
  }
}

/**
 * Basic HTML entity decoder for common chars in titles/descriptions
 */
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}
