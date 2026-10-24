import type { APIRoute } from 'astro';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { getSessionUser } from '@/lib/session';
import type { NoteAttachment } from '@/db/schema';

export const prerender = false;

const UPLOAD_DIR = path.resolve(process.cwd(), 'public/uploads');

export const POST: APIRoute = async ({ request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return new Response(JSON.stringify({ error: 'File tidak ditemukan' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const isImage = file.type.startsWith('image/');
    const fileId = crypto.randomUUID();

    let savedFileName = '';
    let mimeType = file.type || 'application/octet-stream';
    let sizeBytes = buffer.length;

    if (isImage) {
      savedFileName = `${user.id}_${Date.now()}_${fileId.slice(0, 8)}.webp`;
      const fullPath = path.join(UPLOAD_DIR, savedFileName);

      const compressedBuffer = await sharp(buffer)
        .resize({ width: 1200, withoutEnlargement: true })
        .webp({ quality: 75 })
        .toBuffer();

      await fs.promises.writeFile(fullPath, compressedBuffer);
      sizeBytes = compressedBuffer.length;
      mimeType = 'image/webp';
    } else {
      const ext = path.extname(file.name) || '.dat';
      savedFileName = `${user.id}_${Date.now()}_${fileId.slice(0, 8)}${ext}`;
      const fullPath = path.join(UPLOAD_DIR, savedFileName);
      await fs.promises.writeFile(fullPath, buffer);
    }

    const attachment: NoteAttachment = {
      fileId,
      type: isImage ? 'image' : 'file',
      fileName: file.name,
      mimeType,
      sizeBytes,
      localPath: `/uploads/${savedFileName}`,
    };

    return new Response(
      JSON.stringify({
        success: true,
        attachment,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    console.error('[API POST /api/upload] Error uploading file:', err);
    return new Response(
      JSON.stringify({ error: 'Gagal mengunggah file' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
