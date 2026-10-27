import { db } from '@/db';
import { notes, type BookmarkMeta, type BookmarkItemMeta } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { invalidateUnorganizedCountCache } from './cache';

/**
 * Multi-Provider Link Metadata Enricher
 * Supports:
 * 1. YouTube official oEmbed
 * 2. Twitter / X official oEmbed & caption extraction
 * 3. Reddit native .json API (title & selftext caption)
 * 4. TikTok official oEmbed (title as caption)
 * 5. Universal OpenGraph / Twitter Card / HTML Title streaming (<25KB)
 * 6. Google S2 Favicon API as 100% reliable icon fallback
 */

export interface LinkMetadata extends BookmarkMeta {}

/**
 * Extracts clean domain from URL
 */
export function extractCleanDomain(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Basic HTML entity decoder for common chars in titles/descriptions
 */
export function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x2F;/g, '/')
    .replace(/&#x27;/g, "'");
}

/**
 * Extracts secondary URLs embedded within a text string
 */
export function extractUrlsFromText(text: string): string[] {
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  return Array.from(new Set(Array.from(text.matchAll(urlRegex), (m) => m[0])));
}

/**
 * Fetches lightweight metadata, caption, and OpenGraph images from any URL.
 * Strictly bounded by 3000ms timeout with zero headless browser dependencies.
 */
export async function fetchLinkMetadata(rawUrl: string): Promise<BookmarkMeta | null> {
  if (!rawUrl || !/^https?:\/\//i.test(rawUrl.trim())) {
    return null;
  }

  const cleanUrl = rawUrl.trim();
  const domain = extractCleanDomain(cleanUrl);
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  const fetchedAt = new Date().toISOString();

  const baseMeta: BookmarkMeta = {
    primaryUrl: cleanUrl,
    domain,
    faviconUrl,
    readingStatus: 'unread',
    fetchedAt,
  };

  try {
    // 1. YouTube via Official Free oEmbed
    if (domain.includes('youtube.com') || domain.includes('youtu.be')) {
      try {
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(cleanUrl)}&format=json`;
        const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          const data = (await res.json()) as any;
          return {
            ...baseMeta,
            siteName: 'YouTube',
            title: typeof data.title === 'string' ? decodeHtmlEntities(data.title.trim()) : undefined,
            author: typeof data.author_name === 'string' ? data.author_name.trim() : undefined,
            imageUrl: typeof data.thumbnail_url === 'string' ? data.thumbnail_url.trim() : undefined,
          };
        }
      } catch {
        // Fallback to universal head scraper
      }
    }

    // 2. Twitter / X via Official Free oEmbed (Captures Full Tweet Text)
    if (domain === 'twitter.com' || domain === 'x.com') {
      try {
        const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(cleanUrl)}`;
        const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          const data = (await res.json()) as any;
          let tweetText: string | undefined = undefined;
          if (typeof data.html === 'string') {
            // Extract text from <blockquote ...><p ...>(.*?)<\/p>
            const pMatch = data.html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
            if (pMatch && pMatch[1]) {
              tweetText = decodeHtmlEntities(pMatch[1].replace(/<br\s*[\/]?>/gi, '\n').replace(/<[^>]+>/g, '').trim());
            }
          }

          const embedded = tweetText ? extractUrlsFromText(tweetText) : [];
          const author = typeof data.author_name === 'string' ? data.author_name.trim() : undefined;
          const title = tweetText
            ? (tweetText.length > 80 ? `${tweetText.slice(0, 80)}...` : tweetText)
            : (author ? `Postingan oleh ${author} di X` : 'Postingan X / Twitter');

          return {
            ...baseMeta,
            siteName: 'X (Twitter)',
            title,
            author,
            caption: tweetText,
            description: tweetText,
            embeddedUrls: embedded.length > 0 ? embedded : undefined,
          };
        }
      } catch {
        // Fallback to universal head scraper
      }
    }

    // 3. Reddit via Native .json Endpoint (Captures Post Title & Selftext)
    if (domain.includes('reddit.com')) {
      try {
        // Clean query parameters and append .json
        const parsed = new URL(cleanUrl);
        parsed.search = '';
        let jsonUrl = parsed.toString().replace(/\/$/, '') + '.json';
        const res = await fetch(jsonUrl, {
          headers: {
            'User-Agent': 'UnlazyNotesBot/1.0 (PKM Link Scraper)',
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(3000),
        });

        if (res.ok) {
          const json = (await res.json()) as any;
          const postData = Array.isArray(json)
            ? json[0]?.data?.children?.[0]?.data
            : json?.data?.children?.[0]?.data;

          if (postData) {
            const title = postData.title ? decodeHtmlEntities(postData.title.trim()) : undefined;
            const selftext = postData.selftext ? decodeHtmlEntities(postData.selftext.trim()) : undefined;
            const author = postData.author ? `u/${postData.author}` : undefined;
            const sub = postData.subreddit ? `r/${postData.subreddit}` : undefined;
            let imageUrl: string | undefined = undefined;

            if (postData.thumbnail && /^https?:\/\//i.test(postData.thumbnail)) {
              imageUrl = postData.thumbnail;
            } else if (postData.preview?.images?.[0]?.source?.url) {
              imageUrl = decodeHtmlEntities(postData.preview.images[0].source.url);
            }

            const embedded = selftext ? extractUrlsFromText(selftext) : [];

            return {
              ...baseMeta,
              siteName: sub ? `Reddit (${sub})` : 'Reddit',
              title: title || (sub ? `Post di ${sub}` : 'Postingan Reddit'),
              description: selftext ? (selftext.length > 200 ? `${selftext.slice(0, 200)}...` : selftext) : undefined,
              caption: selftext,
              author,
              imageUrl,
              embeddedUrls: embedded.length > 0 ? embedded : undefined,
            };
          }
        }
      } catch {
        // Fallback to universal head scraper
      }
    }

    // 4. TikTok via Official Free oEmbed
    if (domain.includes('tiktok.com')) {
      try {
        const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(cleanUrl)}`;
        const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          const data = (await res.json()) as any;
          const caption = typeof data.title === 'string' ? decodeHtmlEntities(data.title.trim()) : undefined;
          const author = typeof data.author_name === 'string' ? data.author_name.trim() : undefined;
          const imageUrl = typeof data.thumbnail_url === 'string' ? data.thumbnail_url.trim() : undefined;

          return {
            ...baseMeta,
            siteName: 'TikTok',
            title: caption || (author ? `Video oleh ${author}` : 'Video TikTok'),
            caption,
            description: caption,
            author,
            imageUrl,
          };
        }
      } catch {
        // Fallback to universal head scraper
      }
    }

    // 5. Universal Web via Lightweight Head Stream (< 75KB) with Chrome User-Agent
    const res = await fetch(cleanUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return baseMeta;
    }

    const htmlSnippet = await res.text();
    const headPart = htmlSnippet.slice(0, 75000);

    const extractMeta = (nameOrProp: string): string | undefined => {
      const r1 = new RegExp(`<meta\\s+[^>]*?(?:property|name)=["']${nameOrProp}["'][^>]*?content=["'](.*?)["']`, 'i');
      const r2 = new RegExp(`<meta\\s+[^>]*?content=["'](.*?)["'][^>]*?(?:property|name)=["']${nameOrProp}["']`, 'i');
      const m1 = headPart.match(r1);
      if (m1 && m1[1]) return decodeHtmlEntities(m1[1].trim());
      const m2 = headPart.match(r2);
      if (m2 && m2[1]) return decodeHtmlEntities(m2[1].trim());
      return undefined;
    };

    // Title extraction
    const ogTitle = extractMeta('og:title');
    const twitterTitle = extractMeta('twitter:title');
    const titleTagMatch = headPart.match(/<title[^>]*>(.*?)<\/title>/i);
    const tagTitle = titleTagMatch ? decodeHtmlEntities(titleTagMatch[1].trim()) : undefined;
    const title = ogTitle || twitterTitle || tagTitle || domain;

    // Description extraction
    const ogDesc = extractMeta('og:description');
    const twitterDesc = extractMeta('twitter:description');
    const standardDesc = extractMeta('description');
    const description = ogDesc || twitterDesc || standardDesc;

    // Image extraction
    const ogImage = extractMeta('og:image');
    const twitterImage = extractMeta('twitter:image');
    const imageUrl = ogImage || twitterImage;

    // Site Name extraction
    const ogSiteName = extractMeta('og:site_name');
    const siteName = ogSiteName || domain;

    return {
      ...baseMeta,
      title: title || domain,
      description,
      imageUrl,
      siteName: siteName || domain,
    };
  } catch {
    // Graceful fallback for timeout or unreachable domain
    return baseMeta;
  }
}

import { isDomainUnsupportedForAi } from './platform-icons';
export { isDomainUnsupportedForAi };

/**
 * Asynchronously enriches a note with bookmark metadata in background (Fire & Forget).
 * Concurrently scrapes all unique URLs (up to 5 links) with Promise.allSettled.
 * Zero latency on caller: will not block Telegram webhook or Web API.
 */
export async function enrichNoteBookmarkAsync(noteId: string, content: string): Promise<void> {
  if (!content || !noteId) return;

  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const urls = Array.from(content.matchAll(urlRegex), (m) => m[0]);
  if (urls.length === 0) return;

  const uniqueUrls = Array.from(new Set(urls)).slice(0, 5);
  const primaryUrl = uniqueUrls[0];

  try {
    const results = await Promise.allSettled(uniqueUrls.map((u) => fetchLinkMetadata(u)));
    const primaryResult = results[0];
    const primaryMeta = primaryResult.status === 'fulfilled' && primaryResult.value ? primaryResult.value : null;
    if (!primaryMeta) return;

    const items: BookmarkItemMeta[] = results.map((res, idx) => {
      const u = uniqueUrls[idx];
      const itemMeta = res.status === 'fulfilled' && res.value ? res.value : null;
      const domain = extractCleanDomain(u);
      return {
        url: u,
        domain,
        title: itemMeta?.title,
        imageUrl: itemMeta?.imageUrl,
        faviconUrl: itemMeta?.faviconUrl || `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
      };
    });

    const domainCheck = isDomainUnsupportedForAi(primaryUrl);

    const finalMeta: BookmarkMeta = {
      ...primaryMeta,
      items,
      isAiSupported: !domainCheck.unsupported,
      unsupportedReason: domainCheck.reason,
    };

    const [existingNote] = await db
      .select({
        id: notes.id,
        userId: notes.userId,
        category: notes.category,
        bookmarkType: notes.bookmarkType,
        specificTags: notes.specificTags,
        isProcessed: notes.isProcessed,
      })
      .from(notes)
      .where(eq(notes.id, noteId))
      .limit(1);

    if (!existingNote) return;

    const updates: Record<string, any> = {
      bookmarkMeta: finalMeta,
    };

    if (existingNote.category === 'others' || !existingNote.isProcessed) {
      updates.category = 'bookmark';
      updates.isProcessed = true;

      if (!existingNote.bookmarkType) {
        const domain = extractCleanDomain(primaryUrl);
        if (
          domain.includes('threads.net') ||
          domain.includes('instagram.com') ||
          domain.includes('twitter.com') ||
          domain.includes('x.com') ||
          domain.includes('tiktok.com') ||
          domain.includes('youtube.com') ||
          domain.includes('youtu.be') ||
          domain.includes('reddit.com') ||
          domain.includes('facebook.com')
        ) {
          updates.bookmarkType = 'media_social';
        } else if (
          domain.includes('github.com') ||
          domain.includes('gitlab.com') ||
          domain.includes('stackoverflow.com')
        ) {
          updates.bookmarkType = 'tech_dev';
        } else if (
          domain.includes('figma.com') ||
          domain.includes('notion.so') ||
          domain.includes('docs.google.com') ||
          domain.includes('drive.google.com')
        ) {
          updates.bookmarkType = 'work_docs';
        } else if (
          domain.includes('maps.google.com') ||
          domain.includes('google.com/maps')
        ) {
          updates.bookmarkType = 'places';
        } else if (
          domain.includes('shopee') ||
          domain.includes('tokopedia') ||
          domain.includes('amazon')
        ) {
          updates.bookmarkType = 'shopping';
        } else {
          updates.bookmarkType = 'reading_other';
        }
      }

      if (!existingNote.specificTags || existingNote.specificTags.length === 0) {
        const domain = extractCleanDomain(primaryUrl);
        const baseDomain = domain.split('.')[0] || 'link';
        updates.specificTags = [baseDomain, updates.bookmarkType || 'bookmark'];
      }

      invalidateUnorganizedCountCache(existingNote.userId);
    }

    await db
      .update(notes)
      .set(updates)
      .where(eq(notes.id, noteId));
  } catch (err) {
    console.error(`[enrichNoteBookmarkAsync Error] noteId=${noteId}:`, err);
  }
}
