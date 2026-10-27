import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';
import { db } from '@/db';
import { notes, type BookmarkMeta } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateText } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { recordAiUsage } from './ai-usage';
import { YoutubeTranscript } from 'youtube-transcript';
import { isDomainUnsupportedForAi } from './platform-icons';
import { extractCleanDomain } from './link-enricher';
import { invalidateUnorganizedCountCache } from './cache';

export interface ExtractedArticle {
  title?: string;
  byline?: string;
  excerpt?: string;
  textContent: string;
  siteName?: string;
}

/**
 * Checks if a URL is a YouTube video URL
 */
export function isYouTubeUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname === 'youtu.be' || u.hostname.includes('youtube.com');
  } catch {
    return /youtube\.com|youtu\.be/i.test(url);
  }
}

/**
 * Extracts transcript text from a YouTube video via pure HTTP Timedtext.
 * Memory-only, zero headless browser, zero whisper binary overhead.
 */
export async function extractYouTubeTranscript(url: string): Promise<ExtractedArticle | null> {
  if (!isYouTubeUrl(url)) return null;

  try {
    const transcriptItems = await YoutubeTranscript.fetchTranscript(url);
    if (!transcriptItems || transcriptItems.length === 0) {
      return null;
    }

    const rawLines = transcriptItems
      .map((item) =>
        item.text
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\n/g, ' ')
          .trim()
      )
      .filter(Boolean);

    if (rawLines.length === 0) {
      return null;
    }

    // Group lines into readable paragraphs (~350 characters or ending with punctuation)
    const paragraphs: string[] = [];
    let currentParagraph = '';

    for (const line of rawLines) {
      currentParagraph += (currentParagraph ? ' ' : '') + line;
      if (currentParagraph.length >= 350 || /[.?!]$/.test(line)) {
        paragraphs.push(currentParagraph);
        currentParagraph = '';
      }
    }
    if (currentParagraph) {
      paragraphs.push(currentParagraph);
    }

    const cleanText = paragraphs.join('\n\n').trim();

    return {
      siteName: 'YouTube',
      textContent: cleanText.slice(0, 15000),
    };
  } catch (err: any) {
    console.warn(`[extractYouTubeTranscript] No transcript found or failed for ${url}:`, err?.message || err);
    return null;
  }
}

function extractParagraphsFromHtml(html: string): string {
  try {
    const { document } = parseHTML(`<div>${html}</div>`);
    const elements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote, pre');
    const paragraphs: string[] = [];

    for (const el of Array.from(elements)) {
      if (el.tagName.toLowerCase() === 'blockquote' && el.querySelector('p')) {
        continue;
      }
      const text = (el.textContent || '').replace(/[ \t]+/g, ' ').trim();
      if (text.length > 0) {
        paragraphs.push(text);
      }
    }

    if (paragraphs.length > 0) {
      return paragraphs.join('\n\n');
    }
  } catch {}

  // Fallback regex if DOM traversal fails
  return html
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|blockquote|pre|tr)>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Extracts clean, distraction-free article text using Mozilla Readability & Linkedom.
 * Preserves natural paragraphs separated by double newlines for optimal readability.
 */
export async function extractArticleContent(url: string): Promise<ExtractedArticle | null> {
  if (!url || !/^https?:\/\//i.test(url.trim())) {
    return null;
  }

  try {
    const res = await fetch(url.trim(), {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      return null;
    }

    const html = await res.text();
    const { document } = parseHTML(html);

    // Run Mozilla Readability engine
    const reader = new Readability(document as any, {
      charThreshold: 60,
    });
    const article = reader.parse();

    if (!article || (!article.textContent && !article.content)) {
      return null;
    }

    // Extract clean text with natural paragraphs preserved
    let cleanText = '';
    if (article.content) {
      cleanText = extractParagraphsFromHtml(article.content);
    }
    if (!cleanText && article.textContent) {
      cleanText = article.textContent
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }

    if (cleanText.length < 50) {
      return null;
    }

    return {
      title: article.title || undefined,
      byline: article.byline || undefined,
      excerpt: article.excerpt || undefined,
      siteName: article.siteName || undefined,
      // Cap at 25.000 characters to keep database storage optimal while supporting long-form articles
      textContent: cleanText.slice(0, 25000),
    };
  } catch (err) {
    console.error(`[extractArticleContent Error] url=${url}:`, err);
    return null;
  }
}

/**
 * Summarizes article content or video transcript into comprehensive executive key takeaways using Gemini Flash.
 */
export async function summarizeArticleWithAi(
  articleText: string,
  title?: string,
  isTranscript: boolean = false
): Promise<string[]> {
  const apiKey = process.env.AI_PROVIDER_API_KEY;
  const modelName = process.env.AI_MODEL_NAME || 'gemini-3.8-flash';

  if (!apiKey || apiKey === 'sk-xxxx' || apiKey.startsWith('mock-')) {
    // Basic fallback if AI provider is not available
    const sentences = articleText
      .split(/(?<=[.?!])\s+/)
      .filter((s) => s.length > 25);
    return sentences.length > 0 ? sentences : ['Konten berhasil diekstrak.'];
  }

  try {
    const openaiCompatible = createOpenAICompatible({
      name: 'cosmoshub',
      baseURL: process.env.AI_BASE_URL || 'https://api.cosmoshub.tech/v1',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const contextPrefix = isTranscript ? 'Transkrip Video YouTube' : 'Artikel Web';
    const promptText = title
      ? `${contextPrefix}: "${title}"\n\nIsi Teks:\n${articleText.slice(0, 8000)}`
      : `${contextPrefix} Isi Teks:\n${articleText.slice(0, 8000)}`;

    const result = await generateText({
      model: openaiCompatible(modelName),
      temperature: 0.2,
      system: `Anda adalah asisten cerdas pembuat ringkasan eksekutif UnlazyNotes.
Baca teks (${isTranscript ? 'transkrip video' : 'artikel'}) dan hasilkan poin-poin kesimpulan terpenting (Key Takeaways) dalam bahasa Indonesia yang ringkas, padat informasi, lugas, dan langsung ke inti substansi secara komprehensif tanpa membatasi jumlah poin (ekstrak sebanyak mungkin poin penting yang esensial sesuai cakupan materi).
Format output: Kembalikan STRICT array of strings format JSON murni:
["poin 1", "poin 2", "poin 3", ...]
DILARANG memberikan kata pengantar, basa-basi, atau membungkus di luar format JSON.`,
      prompt: promptText,
    });

    await recordAiUsage({
      feature: 'enhance',
      model: modelName,
      usage: result.usage,
    });

    let rawJson = result.text.trim();
    const match = rawJson.match(/\[[\s\S]*\]/);
    if (match) {
      rawJson = match[0];
    }

    const parsed = JSON.parse(rawJson);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((item) => String(item).trim());
    }

    return ['Berhasil mengekstrak poin utama konten.'];
  } catch (err) {
    console.warn('[summarizeArticleWithAi Fallback]:', err);
    // Non-fatal fallback
    return ['Gagal membuat ringkasan AI otomatis; teks lengkap tersedia di bawah.'];
  }
}

/**
 * High-level service: Fetches, extracts reader text or video transcript,
 * generates comprehensive AI key takeaways, and updates notes.bookmarkMeta in database.
 */

function getFallbackBookmarkCategoryAndTags(targetUrl: string, note: any) {
  const domain = extractCleanDomain(targetUrl);
  const baseDomain = domain.split('.')[0] || 'link';

  let bookmarkType = note.bookmarkType;
  if (!bookmarkType) {
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
      bookmarkType = 'media_social';
    } else if (
      domain.includes('github.com') ||
      domain.includes('gitlab.com') ||
      domain.includes('stackoverflow.com')
    ) {
      bookmarkType = 'tech_dev';
    } else if (
      domain.includes('figma.com') ||
      domain.includes('notion.so') ||
      domain.includes('docs.google.com') ||
      domain.includes('drive.google.com')
    ) {
      bookmarkType = 'work_docs';
    } else if (
      domain.includes('maps.google.com') ||
      domain.includes('google.com/maps')
    ) {
      bookmarkType = 'places';
    } else if (
      domain.includes('shopee') ||
      domain.includes('tokopedia') ||
      domain.includes('amazon')
    ) {
      bookmarkType = 'shopping';
    } else {
      bookmarkType = 'reading_other';
    }
  }

  const specificTags = note.specificTags && note.specificTags.length > 0
    ? note.specificTags
    : [baseDomain, bookmarkType || 'bookmark'];

  return {
    category: 'bookmark' as const,
    bookmarkType,
    specificTags,
    isProcessed: true,
  };
}

export async function readAndSummarizeBookmark(
  noteId: string,
  userId: string
): Promise<{
  success: boolean;
  bookmarkMeta?: BookmarkMeta;
  error?: string;
}> {
  const [note] = await db
    .select()
    .from(notes)
    .where(eq(notes.id, noteId))
    .limit(1);

  if (!note || note.userId !== userId) {
    return { success: false, error: 'Catatan tidak ditemukan atau akses ditolak' };
  }

  // Determine target URL
  let targetUrl = note.bookmarkMeta?.primaryUrl;
  if (!targetUrl) {
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const match = note.content.match(urlRegex);
    if (match && match[0]) {
      targetUrl = match[0];
    }
  }

  if (!targetUrl) {
    return { success: false, error: 'Tidak ada URL valid pada bookmark ini' };
  }

  const domainCheck = isDomainUnsupportedForAi(targetUrl);
  if (domainCheck.unsupported) {
    const errorMsg = domainCheck.reason || 'Tautan ini tidak mendukung pemrosesan teks AI.';
    const currentMeta: BookmarkMeta = note.bookmarkMeta || {
      primaryUrl: targetUrl,
      domain: new URL(targetUrl).hostname.replace(/^www\./, ''),
    };
    const updates: Record<string, any> = {
      bookmarkMeta: {
        ...currentMeta,
        isAiSupported: false,
        unsupportedReason: errorMsg,
      },
    };
    if (note.category === 'others' || !note.isProcessed) {
      const fallback = getFallbackBookmarkCategoryAndTags(targetUrl, note);
      updates.category = fallback.category;
      updates.bookmarkType = fallback.bookmarkType;
      updates.specificTags = fallback.specificTags;
      updates.isProcessed = fallback.isProcessed;
      invalidateUnorganizedCountCache(userId);
    }
    await db
      .update(notes)
      .set(updates)
      .where(eq(notes.id, noteId));

    return {
      success: false,
      error: errorMsg,
    };
  }

  const isYt = isYouTubeUrl(targetUrl);
  let article: ExtractedArticle | null = null;

  if (isYt) {
    // 1. Extract video transcript via timedtext
    article = await extractYouTubeTranscript(targetUrl);
    if (!article || !article.textContent) {
      const errorMsg =
        'Transkrip video YouTube tidak tersedia untuk video ini (subtitle dinonaktifkan atau belum dibuat oleh kreator/YouTube).';
      const currentMeta: BookmarkMeta = note.bookmarkMeta || {
        primaryUrl: targetUrl,
        domain: new URL(targetUrl).hostname.replace(/^www\./, ''),
      };
      const ytUpdates: Record<string, any> = {
        bookmarkMeta: {
          ...currentMeta,
          isAiSupported: false,
          unsupportedReason: errorMsg,
        },
      };
      if (note.category === 'others' || !note.isProcessed) {
        const fallback = getFallbackBookmarkCategoryAndTags(targetUrl, note);
        ytUpdates.category = fallback.category;
        ytUpdates.bookmarkType = fallback.bookmarkType;
        ytUpdates.specificTags = fallback.specificTags;
        ytUpdates.isProcessed = fallback.isProcessed;
        invalidateUnorganizedCountCache(userId);
      }
      await db
        .update(notes)
        .set(ytUpdates)
        .where(eq(notes.id, noteId));

      return {
        success: false,
        error: errorMsg,
      };
    }
  } else {
    // 1. Extract clean article content via Readability
    article = await extractArticleContent(targetUrl);
    if (!article || !article.textContent) {
      const errorMsg =
        'Halaman web tidak dapat diekstrak (mungkin dilindungi login atau berformat media/aplikasi web interaktif).';
      const currentMeta: BookmarkMeta = note.bookmarkMeta || {
        primaryUrl: targetUrl,
        domain: new URL(targetUrl).hostname.replace(/^www\./, ''),
      };
      const articleUpdates: Record<string, any> = {
        bookmarkMeta: {
          ...currentMeta,
          isAiSupported: false,
          unsupportedReason: errorMsg,
        },
      };
      if (note.category === 'others' || !note.isProcessed) {
        const fallback = getFallbackBookmarkCategoryAndTags(targetUrl, note);
        articleUpdates.category = fallback.category;
        articleUpdates.bookmarkType = fallback.bookmarkType;
        articleUpdates.specificTags = fallback.specificTags;
        articleUpdates.isProcessed = fallback.isProcessed;
        invalidateUnorganizedCountCache(userId);
      }
      await db
        .update(notes)
        .set(articleUpdates)
        .where(eq(notes.id, noteId));

      return {
        success: false,
        error: errorMsg,
      };
    }
  }

  const articleTitle = article.title || note.bookmarkMeta?.title;

  // 2. Generate comprehensive AI Key Takeaways
  const aiSummary = await summarizeArticleWithAi(article.textContent, articleTitle, isYt);

  // 3. Compute reading time (average 200 words per minute)
  const wordCount = article.textContent.split(/\s+/).filter(Boolean).length;
  const readingTimeMin = Math.max(1, Math.round(wordCount / 200));

  // 4. Update database record
  const currentMeta: BookmarkMeta = note.bookmarkMeta || {
    primaryUrl: targetUrl,
    domain: new URL(targetUrl).hostname.replace(/^www\./, ''),
  };

  const updatedMeta: BookmarkMeta = {
    ...currentMeta,
    title: articleTitle || currentMeta.title,
    author: article.byline || currentMeta.author,
    siteName: article.siteName || currentMeta.siteName,
    articleContent: article.textContent,
    aiSummary,
    readingTimeMin,
    isContentExtracted: true,
    readingStatus: 'reading',
  };

  await db
    .update(notes)
    .set({
      bookmarkMeta: updatedMeta,
    })
    .where(eq(notes.id, noteId));

  return {
    success: true,
    bookmarkMeta: updatedMeta,
  };
}
