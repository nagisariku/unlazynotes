import type { Source } from '../../constants';
import { sanitizeTags } from '../sanitizer';
import type { NoteTagResult } from '../types';

interface ClassifiedUrl {
  platformSource: Source;
  tags: string[];
}

function classifyUrl(rawUrl: string): ClassifiedUrl {
  let host = '';
  try {
    host = new URL(rawUrl).hostname.toLowerCase();
  } catch {
    host = rawUrl.toLowerCase();
  }

  // Major Platforms
  if (host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be' || host.endsWith('.youtu.be')) {
    return { platformSource: 'youtube', tags: ['youtube'] };
  }
  if (host === 'instagram.com' || host.endsWith('.instagram.com')) {
    return { platformSource: 'instagram', tags: ['instagram'] };
  }
  if (host === 'twitter.com' || host.endsWith('.twitter.com') || host === 'x.com' || host.endsWith('.x.com')) {
    return { platformSource: 'twitter', tags: ['twitter'] };
  }
  if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) {
    return { platformSource: 'tiktok', tags: ['tiktok'] };
  }
  if (host === 'github.com' || host.endsWith('.github.com')) {
    return { platformSource: 'github', tags: ['github'] };
  }
  if (host === 'facebook.com' || host.endsWith('.facebook.com') || host === 'fb.watch' || host === 'fb.com') {
    return { platformSource: 'article', tags: ['facebook'] };
  }
  if (host === 'netflix.com' || host.endsWith('.netflix.com')) {
    return { platformSource: 'article', tags: ['netflix', 'entertainment'] };
  }
  if (host === 'spotify.com' || host.endsWith('.spotify.com')) {
    return { platformSource: 'article', tags: ['spotify', 'music'] };
  }
  if (host === 'reddit.com' || host.endsWith('.reddit.com')) {
    return { platformSource: 'article', tags: ['reddit'] };
  }
  if (host === 'linkedin.com' || host.endsWith('.linkedin.com')) {
    return { platformSource: 'article', tags: ['linkedin', 'career'] };
  }

  // Domain-Aware Category Recognition
  if (/medium\.com/i.test(host)) {
    return { platformSource: 'article', tags: ['medium'] };
  }
  if (/dev\.to|stackoverflow\.com|gitlab\.com|bitbucket\.org|npmjs\.com|pypi\.org|docker\.com|kubernetes\.io|crates\.io|bun\.sh|deno\.com/i.test(host)) {
    return { platformSource: 'article', tags: ['dev'] };
  }
  if (/figma\.com|dribbble\.com|behance\.net|awwwards\.com|canva\.com|unsplash\.com|pinterest\.com/i.test(host)) {
    return { platformSource: 'article', tags: ['design'] };
  }
  if (/news\.ycombinator\.com|theverge\.com|techcrunch\.com|wired\.com|kompas\.com|detik\.com|cnn\.com|bbc\.com|reuters\.com/i.test(host)) {
    return { platformSource: 'article', tags: ['news'] };
  }
  if (/openai\.com|anthropic\.com|huggingface\.co|v0\.dev|cursor\.com|claude\.ai|chatgpt\.com/i.test(host)) {
    return { platformSource: 'article', tags: ['ai'] };
  }
  if (/glints\.com|jobstreet\.co\.id|glassdoor\.com|indeed\.com/i.test(host)) {
    return { platformSource: 'article', tags: ['career'] };
  }
  if (/stripe\.com|payermax\.com|paypal\.com|midtrans\.com|xendit\.co|doku\.com/i.test(host)) {
    return { platformSource: 'article', tags: ['fintech'] };
  }

  return { platformSource: 'article', tags: ['article'] };
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
    return {
      category: 'bookmark',
      specific_tags: sanitizeTags(['article'], 'bookmark', text),
      source: 'article',
    };
  }

  const classifiedList = matches.map((u) => classifyUrl(u));
  const rawTags: string[] = [];

  for (const item of classifiedList) {
    for (const t of item.tags) {
      if (!rawTags.includes(t)) {
        rawTags.push(t);
      }
    }
  }

  // Extract semantic tags from caption if accompanying text exists
  const textWithoutUrls = text.replace(urlRegex, '').trim();
  if (textWithoutUrls.length > 0) {
    const captionTags = extractCaptionTags(textWithoutUrls);
    for (const ct of captionTags) {
      if (!rawTags.includes(ct)) {
        rawTags.push(ct);
      }
    }
  }

  // Determine source:
  // - If single URL -> its platform source
  // - If multiple URLs with identical platform -> that platform source
  // - If multiple URLs with mixed platforms -> null (never 'multi', avoid misleading single badge)
  let finalSource: Source | null = null;
  if (matches.length === 1) {
    finalSource = classifiedList[0].platformSource;
  } else {
    const uniquePlatformSources = Array.from(
      new Set(classifiedList.map((c) => c.platformSource))
    );
    if (uniquePlatformSources.length === 1 && uniquePlatformSources[0] !== 'article') {
      finalSource = uniquePlatformSources[0];
    } else {
      finalSource = null;
    }
  }

  const maxTags = matches.length > 1 || textWithoutUrls.length > 0 ? 5 : 2;
  const sanitized = sanitizeTags(rawTags, 'bookmark', text, maxTags);

  return {
    category: 'bookmark',
    specific_tags: sanitized,
    source: finalSource,
  };
}
