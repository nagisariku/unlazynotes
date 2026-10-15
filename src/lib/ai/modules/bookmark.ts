import type { Source } from '../../constants';
import { sanitizeTags } from '../sanitizer';
import type { NoteTagResult } from '../types';

/**
 * Specialized Bookmark Module.
 * Guaranteed category 'bookmark' with domain-aware, reusable single-word platform/domain tags.
 */
export function processBookmarkNote(content: string): NoteTagResult {
  const text = content.trim();
  const urlRegex = /(https?:\/\/[^\s]+)/i;
  const match = text.match(urlRegex);

  let source: Source = 'article';
  let tag: string = 'article';

  if (match) {
    try {
      const urlObj = new URL(match[0]);
      const host = urlObj.hostname.toLowerCase();

      // Major Social / Video / Code Platforms
      const isYoutube = host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be' || host.endsWith('.youtu.be');
      const isInstagram = host === 'instagram.com' || host.endsWith('.instagram.com');
      const isTwitter = host === 'twitter.com' || host.endsWith('.twitter.com') || host === 'x.com' || host.endsWith('.x.com');
      const isTiktok = host === 'tiktok.com' || host.endsWith('.tiktok.com');
      const isGithub = host === 'github.com' || host.endsWith('.github.com');

      if (isYoutube) {
        source = 'youtube';
        tag = 'youtube';
      } else if (isInstagram) {
        source = 'instagram';
        tag = 'instagram';
      } else if (isTwitter) {
        source = 'twitter';
        tag = 'twitter';
      } else if (isTiktok) {
        source = 'tiktok';
        tag = 'tiktok';
      } else if (isGithub) {
        source = 'github';
        tag = 'github';
      } else {
        source = 'article';

        // Domain-Aware Category Recognition
        if (/dev\.to|stackoverflow\.com|gitlab\.com|bitbucket\.org|npmjs\.com|pypi\.org|docker\.com|kubernetes\.io|crates\.io|bun\.sh|deno\.com/i.test(host)) {
          tag = 'dev';
        } else if (/figma\.com|dribbble\.com|behance\.net|awwwards\.com|canva\.com|unsplash\.com/i.test(host)) {
          tag = 'design';
        } else if (/news\.ycombinator\.com|theverge\.com|techcrunch\.com|wired\.com|kompas\.com|detik\.com|cnn\.com|bbc\.com|reuters\.com/i.test(host)) {
          tag = 'news';
        } else if (/openai\.com|anthropic\.com|huggingface\.co|v0\.dev|cursor\.com|claude\.ai|chatgpt\.com/i.test(host)) {
          tag = 'ai';
        } else if (/linkedin\.com|glints\.com|jobstreet\.co\.id|glassdoor\.com|indeed\.com/i.test(host)) {
          tag = 'career';
        } else if (/stripe\.com|payermax\.com|paypal\.com|midtrans\.com|xendit\.co|doku\.com/i.test(host)) {
          tag = 'fintech';
        } else {
          tag = 'article';
        }
      }
    } catch {
      // Fallback matching if URL parsing fails
      const urlStr = match[0].toLowerCase();
      if (/youtube\.com|youtu\.be/i.test(urlStr)) {
        source = 'youtube';
        tag = 'youtube';
      } else if (/github\.com/i.test(urlStr)) {
        source = 'github';
        tag = 'github';
      } else if (/(^|\/)(www\.)?(twitter|x)\.com/i.test(urlStr)) {
        source = 'twitter';
        tag = 'twitter';
      } else if (/instagram\.com/i.test(urlStr)) {
        source = 'instagram';
        tag = 'instagram';
      } else if (/tiktok\.com/i.test(urlStr)) {
        source = 'tiktok';
        tag = 'tiktok';
      } else {
        source = 'article';
        tag = 'article';
      }
    }
  }

  // Tags: only clean single-word platform/domain tag. Never URL slugs, repo names, or 'read-later'.
  return {
    category: 'bookmark',
    specific_tags: sanitizeTags([tag], 'bookmark', text),
    source,
  };
}
