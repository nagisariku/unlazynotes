import type { APIRoute } from 'astro';
import { db } from '@/db';
import { notes } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getSessionUser } from '@/lib/session';
import { decryptSecret } from '@/lib/crypto';
import { format } from 'date-fns';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const exportFormat = (url.searchParams.get('format') || 'json').toLowerCase();

  const userNotes = await db
    .select()
    .from(notes)
    .where(eq(notes.userId, user.id))
    .orderBy(desc(notes.createdAt));

  const now = new Date();
  const dateSlug = format(now, 'yyyy-MM-dd');
  const dateFormatted = format(now, 'yyyy-MM-dd HH:mm:ss');

  // Dekripsi konten catatan yang terenkripsi khusus untuk pemilik akun
  const processedNotes = userNotes.map((note) => {
    let plainContent = note.content;
    if (note.isEncrypted) {
      try {
        plainContent = decryptSecret(note.content, user.id);
      } catch (err) {
        plainContent = `[Gagal mendekripsi data vault] ${note.content}`;
      }
    }

    return {
      id: note.id,
      content: plainContent,
      category: note.category,
      specificTags: note.specificTags || [],
      source: note.source,
      isEncrypted: note.isEncrypted,
      vaultKey: note.vaultKey,
      createdAt: note.createdAt.toISOString(),
    };
  });

  if (exportFormat === 'markdown' || exportFormat === 'md') {
    let md = `# UnlazyNotes Backup\n\n`;
    md += `- **Tanggal Ekspor:** ${dateFormatted}\n`;
    md += `- **Pengguna:** ${user.name || user.email || 'User'}\n`;
    md += `- **Jumlah Catatan:** ${processedNotes.length}\n\n`;
    md += `---\n\n`;

    for (let i = 0; i < processedNotes.length; i++) {
      const item = processedNotes[i];
      const tagsStr = item.specificTags.map((t) => `#${t}`).join(' ') || '-';
      const vaultBadge = item.isEncrypted ? ` 🔒 [Vault: ${item.vaultKey || 'Secret'}]` : '';

      md += `### ${i + 1}. [${item.createdAt}] [${item.category}]${vaultBadge}\n`;
      md += `**Tags:** ${tagsStr}\n\n`;
      md += `${item.content}\n\n`;
      md += `---\n\n`;
    }

    return new Response(md, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="unlazynotes-backup-${dateSlug}.md"`,
      },
    });
  }

  // Default: JSON format
  const jsonOutput = {
    appName: 'UnlazyNotes',
    exportVersion: '1.0',
    exportedAt: now.toISOString(),
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
    totalNotes: processedNotes.length,
    notes: processedNotes,
  };

  return new Response(JSON.stringify(jsonOutput, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="unlazynotes-backup-${dateSlug}.json"`,
    },
  });
};
