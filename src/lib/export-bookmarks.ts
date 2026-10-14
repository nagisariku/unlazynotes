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
 */
export function generateNetscapeBookmarksHtml(bookmarks: BookmarkNote[]): string {
  const urlRegex = /(https?:\/\/[^\s]+)/i;

  const items = bookmarks
    .map((b) => {
      const urlMatch = b.content.match(urlRegex);
      const url = urlMatch ? urlMatch[0] : b.content.startsWith('http') ? b.content : null;
      if (!url) return null;

      const title = b.content.replace(url, '').trim() || url;
      const addDate = Math.floor(new Date(b.createdAt).getTime() / 1000);

      const tagsList = [...(b.specificTags || [])];
      if (b.source && !tagsList.includes(b.source)) {
        tagsList.push(b.source);
      }
      const tagsStr = tagsList.join(',');

      return `    <DT><A HREF="${escapeHtml(url)}" ADD_DATE="${addDate}" TAGS="${escapeHtml(
        tagsStr
      )}">${escapeHtml(title)}</A>`;
    })
    .filter(Boolean)
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
