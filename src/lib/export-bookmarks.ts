interface BookmarkNote {
  id: string;
  content: string;
  specificTags?: string[] | null;
  source?: string | null;
  createdAt: Date;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generates standard Netscape Bookmark HTML file content,
 * ready to be directly imported into Google Chrome, Firefox, Safari, Edge, etc.
 * Supports multiple links inside a single note by creating an export entry per link.
 */
export function generateNetscapeBookmarksHtml(bookmarks: BookmarkNote[]): string {
  const urlRegex = /(https?:\/\/[^\s]+)/gi;

  const items = bookmarks
    .flatMap((b) => {
      const urls = Array.from(b.content.matchAll(urlRegex), (m) => m[0]);
      if (urls.length === 0) {
        if (b.content.startsWith('http')) {
          urls.push(b.content.trim());
        } else {
          return [];
        }
      }

      const textWithoutUrls = b.content.replace(urlRegex, '').trim();
      const addDate = Math.floor(new Date(b.createdAt).getTime() / 1000);

      const tagsList = [...(b.specificTags || [])];
      if (b.source && !tagsList.includes(b.source)) {
        tagsList.push(b.source);
      }
      const tagsStr = tagsList.join(',');

      return urls.map((url, idx) => {
        let title = textWithoutUrls;
        if (!title) {
          title = url;
        } else if (urls.length > 1) {
          title = `${textWithoutUrls} (${idx + 1})`;
        }
        return `    <DT><A HREF="${escapeHtml(url)}" ADD_DATE="${addDate}" TAGS="${escapeHtml(
          tagsStr
        )}">${escapeHtml(title)}</A>`;
      });
    })
    .join('\n');

  return `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file from UnlazyNotes. -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks - UnlazyNotes</TITLE>
<H1>Bookmarks</H1>
<DL><p>
${items}
</DL><p>
`;
}
