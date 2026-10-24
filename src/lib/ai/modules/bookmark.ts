import type { Source } from '../../constants';
import { sanitizeTags } from '../sanitizer';
import type { NoteTagResult } from '../types';
import type { BookmarkType } from '@/db/schema';

function heuristicClassifyBookmarkType(urls: string[], tags: string[], text: string): BookmarkType {
  const urlStr = urls.join(' ').toLowerCase();

  // 1. Dominant Host / URL matching first:
  if (/youtube|youtu\.be|tiktok|twitter|x\.com|instagram|threads\.net|spotify|netflix|soundcloud|facebook|fb\.com|reddit/i.test(urlStr)) {
    return 'media_social';
  }
  if (/drive\.google|docs\.google|figma|notion|miro|dropbox|confluence|jira|slack|trello/i.test(urlStr)) {
    return 'work_docs';
  }
  if (/maps\.google|goo\.gl\/maps|g\.page|maps\.app\.goo\.gl|waze\.com/i.test(urlStr)) {
    return 'places';
  }
  if (/tokopedia|shopee|amazon|lazada|blibli|bukalapak|aliexpress/i.test(urlStr)) {
    return 'shopping';
  }
  if (/github|gitlab|npmjs|pypi|stackoverflow|docker|kubernetes|crates\.io|bun\.sh|deno|v0\.dev|cursor/i.test(urlStr)) {
    return 'tech_dev';
  }

  // 2. Content & tags semantic hints:
  const combined = (tags.join(' ') + ' ' + text).toLowerCase();
  if (/\b(maps|lokasi|peta|rute|wisata|cafe|resto|gmaps)\b/i.test(combined)) {
    return 'places';
  }
  if (/\b(tokopedia|shopee|wishlist|beli|toko|marketplace|diskon|promo)\b/i.test(combined)) {
    return 'shopping';
  }
  if (/\b(figma|notion|dokumen|docs|proposal|spek|spec|notulensi)\b/i.test(combined)) {
    return 'work_docs';
  }
  if (/\b(github|gitlab|npm|koding|coding|programming|devops|backend|frontend|api|library)\b/i.test(combined)) {
    return 'tech_dev';
  }
  if (/\b(video|youtube|sosmed|musik|song|lagu|podcast|streaming)\b/i.test(combined)) {
    return 'media_social';
  }

  return 'reading_other';
}

interface ClassifiedUrl {
  platformSource: Source;
  tags: string[];
  pathEntities: string[];
}

export function extractUrlPathEntities(rawUrl: string): string[] {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.toLowerCase();
    const pathname = url.pathname.toLowerCase();
    const segments = pathname.split('/').filter(Boolean);
    const entities: string[] = [];

    // GitHub: github.com/:owner/:repo
    if (host === 'github.com' || host.endsWith('.github.com')) {
      for (const seg of segments.slice(0, 2)) {
        let clean = seg.replace(/(-ui|_ui|\.git)$/i, '').replace(/[^a-z0-9-]/g, '');
        if (clean === 'shadcn-ui') clean = 'shadcn';
        if (clean.length >= 3 && !['topics', 'explore', 'trending', 'orgs', 'stars', 'blob', 'tree'].includes(clean)) {
          if (!entities.includes(clean)) entities.push(clean);
        }
      }
    }

    // Twitter / X: twitter.com/:username or x.com/:username
    if (host === 'twitter.com' || host.endsWith('.twitter.com') || host === 'x.com' || host.endsWith('.x.com')) {
      if (segments[0]) {
        const user = segments[0].replace(/[^a-z0-9-]/g, '');
        if (user && user.length >= 3 && !['home', 'explore', 'notifications', 'messages', 'i', 'status', 'intent'].includes(user)) {
          if (!entities.includes(user)) entities.push(user);
        }
      }
    }

    // General domains / frameworks
    for (const seg of segments) {
      const clean = seg.replace(/[^a-z0-9-]/g, '');
      if (['shadcn', 'tailwind', 'nextjs', 'react', 'astro', 'vue', 'svelte', 'typescript', 'python', 'rust', 'golang'].includes(clean)) {
        if (!entities.includes(clean)) entities.push(clean);
      }
    }

    return entities;
  } catch {
    return [];
  }
}

function classifyUrl(rawUrl: string): ClassifiedUrl {
  let host = '';
  try {
    host = new URL(rawUrl).hostname.toLowerCase();
  } catch {
    host = rawUrl.toLowerCase();
  }

  const pathEntities = extractUrlPathEntities(rawUrl);

  // Major Platforms
  if (host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be' || host.endsWith('.youtu.be')) {
    return { platformSource: 'youtube', tags: ['youtube'], pathEntities };
  }
  if (host === 'instagram.com' || host.endsWith('.instagram.com')) {
    return { platformSource: 'instagram', tags: ['instagram'], pathEntities };
  }
  if (host === 'twitter.com' || host.endsWith('.twitter.com') || host === 'x.com' || host.endsWith('.x.com')) {
    return { platformSource: 'twitter', tags: ['twitter'], pathEntities };
  }
  if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) {
    return { platformSource: 'tiktok', tags: ['tiktok'], pathEntities };
  }
  if (host === 'github.com' || host.endsWith('.github.com')) {
    return { platformSource: 'github', tags: ['github'], pathEntities };
  }
  if (host === 'facebook.com' || host.endsWith('.facebook.com') || host === 'fb.watch' || host === 'fb.com') {
    return { platformSource: 'article', tags: ['facebook'], pathEntities };
  }
  if (host === 'netflix.com' || host.endsWith('.netflix.com')) {
    return { platformSource: 'article', tags: ['netflix', 'entertainment'], pathEntities };
  }
  if (host === 'spotify.com' || host.endsWith('.spotify.com')) {
    return { platformSource: 'article', tags: ['spotify', 'music'], pathEntities };
  }
  if (host === 'reddit.com' || host.endsWith('.reddit.com')) {
    return { platformSource: 'article', tags: ['reddit'], pathEntities };
  }
  if (host === 'linkedin.com' || host.endsWith('.linkedin.com')) {
    return { platformSource: 'article', tags: ['linkedin', 'career'], pathEntities };
  }

  // Domain-Aware Category Recognition
  if (/medium\.com/i.test(host)) {
    return { platformSource: 'article', tags: ['medium'], pathEntities };
  }
  if (/dev\.to|stackoverflow\.com|gitlab\.com|bitbucket\.org|npmjs\.com|pypi\.org|docker\.com|kubernetes\.io|crates\.io|bun\.sh|deno\.com/i.test(host)) {
    return { platformSource: 'article', tags: ['dev'], pathEntities };
  }
  if (/figma\.com|dribbble\.com|behance\.net|awwwards\.com|canva\.com|unsplash\.com|pinterest\.com/i.test(host)) {
    return { platformSource: 'article', tags: ['design'], pathEntities };
  }
  if (/news\.ycombinator\.com|theverge\.com|techcrunch\.com|wired\.com|kompas\.com|detik\.com|cnn\.com|bbc\.com|reuters\.com/i.test(host)) {
    return { platformSource: 'article', tags: ['news'], pathEntities };
  }
  if (/openai\.com|anthropic\.com|huggingface\.co|v0\.dev|cursor\.com|claude\.ai|chatgpt\.com/i.test(host)) {
    return { platformSource: 'article', tags: ['ai'], pathEntities };
  }
  if (/glints\.com|jobstreet\.co\.id|glassdoor\.com|indeed\.com/i.test(host)) {
    return { platformSource: 'article', tags: ['career'], pathEntities };
  }
  if (/stripe\.com|payermax\.com|paypal\.com|midtrans\.com|xendit\.co|doku\.com/i.test(host)) {
    return { platformSource: 'article', tags: ['fintech'], pathEntities };
  }

  return { platformSource: 'article', tags: ['article'], pathEntities };
}

function extractCaptionTags(textWithoutUrls: string): string[] {
  if (!textWithoutUrls) return [];
  const lower = textWithoutUrls.toLowerCase();
  const tags: string[] = [];

  if (/\b(devops|sre|ci\/cd|cicd|docker|k8s|kubernetes|infra|infrastructure)\b/i.test(lower)) {
    tags.push('devops');
  }
  if (/\b(animasi|animation|motion|gsap|threejs)\b/i.test(lower)) {
    tags.push('animasi');
  }
  if (/\b(referensi|reference|inspirasi|inspiration)\b/i.test(lower)) {
    tags.push('referensi');
  }
  if (/\b(belajar|study|kuliah|materi|tutorial|skripsi|kursus|course|guide|panduan)\b/i.test(lower)) {
    tags.push('study');
  }
  if (/\b(ujian|exam|uts|uas|kuis|quiz|midterm|finals)\b/i.test(lower)) {
    tags.push('exam');
  }
  if (/\b(ai|artificial intelligence|machine learning|deep learning|llm|gpt|chatgpt)\b/i.test(lower)) {
    tags.push('ai');
  }
  if (/\b(koding|coding|programming|developer|arsitektur|backend|frontend|fullstack|api|database|framework)\b/i.test(lower)) {
    tags.push('dev');
  }
  if (/\b(desain|design|ui|ux|wireframe|figma|prototipe|prototype)\b/i.test(lower)) {
    tags.push('design');
  }
  if (/\b(makan|makanan|kuliner|food|resep|cooking|masak|resto)\b/i.test(lower)) {
    tags.push('food');
  }
  if (/\b(film|movie|anime|series|drama|nonton|streaming|lagu|musik)\b/i.test(lower)) {
    tags.push('entertainment');
  }
  if (/\b(kerja|kantor|work|project|projek|client|klien|sprint)\b/i.test(lower)) {
    tags.push('work');
  }

  return tags;
}

/**
 * Specialized Bookmark Module.
 * Guaranteed category 'bookmark' with support for multiple links, multi-platform recognition,
 * and contextual caption extraction without splitting the note.
 */
export function processBookmarkNote(content: string): NoteTagResult {
  const text = content.trim();
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const matches = Array.from(text.matchAll(urlRegex), (m) => m[0]);

  if (matches.length === 0) {
    const bookmarkType = heuristicClassifyBookmarkType([], [], text);
    return {
      category: 'bookmark',
      specific_tags: sanitizeTags(['article'], 'bookmark', text),
      source: 'article',
      bookmark_type: bookmarkType,
      bookmarkType,
    };
  }

  const classifiedList = matches.map((u) => classifyUrl(u));

  // Determine dominant source:
  // - If single URL -> its platform source
  // - If multiple URLs -> dominant platform by frequency, or first prominent non-article platform
  let finalSource: Source | null = null;
  const nonArticlePlatforms = classifiedList
    .map((c) => c.platformSource)
    .filter((p): p is Source => Boolean(p) && p !== 'article');

  if (nonArticlePlatforms.length > 0) {
    const counts = new Map<Source, number>();
    for (const p of nonArticlePlatforms) {
      counts.set(p, (counts.get(p) || 0) + 1);
    }
    let maxCount = 0;
    let dominant: Source = nonArticlePlatforms[0];
    for (const [p, count] of counts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        dominant = p;
      }
    }
    finalSource = dominant;
  } else if (classifiedList.length > 0) {
    finalSource = classifiedList[0].platformSource;
  }

  // Build high-relevance tag list:
  // 1. Dominant platform first
  // 2. Extracted path entities (e.g. 'shadcn')
  // 3. Other platform tags (e.g. 'twitter', 'youtube')
  // 4. Caption semantic tags (e.g. 'ui', 'tutorial')
  const rawTags: string[] = [];

  // Dominant platform tag
  if (finalSource && finalSource !== 'article' && !rawTags.includes(finalSource)) {
    rawTags.push(finalSource);
  }

  // Path entities across all URLs
  for (const item of classifiedList) {
    for (const ent of item.pathEntities) {
      if (!rawTags.includes(ent)) {
        rawTags.push(ent);
      }
    }
  }

  // Other platform tags
  for (const item of classifiedList) {
    for (const t of item.tags) {
      if (!rawTags.includes(t)) {
        rawTags.push(t);
      }
    }
  }

  // Semantic tags from caption
  const textWithoutUrls = text.replace(urlRegex, '').trim();
  if (textWithoutUrls.length > 0) {
    const captionTags = extractCaptionTags(textWithoutUrls);
    for (const ct of captionTags) {
      if (!rawTags.includes(ct)) {
        rawTags.push(ct);
      }
    }
  }

  const maxTags = matches.length > 1 || textWithoutUrls.length > 0 ? 5 : 2;
  const sanitized = sanitizeTags(rawTags, 'bookmark', text, maxTags);
  const bookmarkType = heuristicClassifyBookmarkType(matches, sanitized, text);

  return {
    category: 'bookmark',
    specific_tags: sanitized,
    source: finalSource,
    bookmark_type: bookmarkType,
    bookmarkType,
  };
}
