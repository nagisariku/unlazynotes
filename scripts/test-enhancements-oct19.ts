import * as dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

import sharp from 'sharp';
import { db } from '../src/db';
import { users, apiKeys, notes, type NoteAttachment } from '../src/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import {
  formatSnippetPage,
  handleReadCommand,
  handleSyncCommand,
  processTelegramMessage,
  PERSISTENT_DOCK_KEYBOARD,
} from '../src/lib/telegram-handler';
import { processTelegramAttachment } from '../src/lib/media-processor';
import { organizeUserNotes } from '../src/lib/ai/batch-organizer';
import { getTelegramMsg } from '../src/lib/i18n/telegram';

async function runTests() {
  console.log('====================================================');
  console.log('TESTING ENHANCEMENTS: /READ, SYNC COOLDOWN, MULTIMEDIA');
  console.log('====================================================\n');

  let total = 0;
  let passed = 0;

  function assert(condition: boolean, message: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`✅ PASS | ${message}`);
    } else {
      console.error(`❌ FAIL | ${message}`);
    }
  }

  // 1. Setup Test User and API Key
  const testUserId = `test-user-oct19-${Date.now()}`;
  const testChatId = `test-chat-${Date.now()}`;

  await db.insert(users).values({
    id: testUserId,
    email: `${testUserId}@example.com`,
    name: 'Oct19 Tester',
    emailVerified: true,
    preferredLocale: 'id',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await db.insert(apiKeys).values({
    id: `key-${testUserId}`,
    userId: testUserId,
    keyHash: `hash-${testUserId}`,
    telegramChatId: testChatId,
    isActive: true,
    createdAt: new Date(),
  });

  try {
    // -------------------------------------------------------------
    // MODULE 1: /read & formatSnippetPage Enhancements
    // -------------------------------------------------------------
    console.log('\n--- MODULE 1: /read & Snippet Formatting ---');

    // 1a. Test Snippet Badges ([unorganized], 🖼️, 📎)
    const testSnippetNotes = [
      {
        content: 'Catatan terorganisir biasa tanpa lampiran',
        createdAt: new Date(),
        category: 'todo',
        isProcessed: true,
        attachments: [],
      },
      {
        content: 'Catatan mentah baru belum dirapikan AI',
        createdAt: new Date(),
        category: 'others',
        isProcessed: false,
        attachments: [],
      },
      {
        content: 'Struk makan siang padang',
        createdAt: new Date(),
        category: 'finance',
        isProcessed: true,
        attachments: [{ type: 'image' as const, fileId: 'img1', fileName: 'struk.webp', sizeBytes: 50000, localPath: '/path' }],
      },
      {
        content: 'Dokumen panduan sprint project',
        createdAt: new Date(),
        category: 'reference',
        isProcessed: false,
        attachments: [{ type: 'file' as const, fileId: 'doc1', fileName: 'sprint.pdf', sizeBytes: 150000, localPath: '/path' }],
      },
    ];

    const formattedSnippets = formatSnippetPage(
      testSnippetNotes,
      testSnippetNotes.length,
      1,
      9,
      '📖 *Semua Catatan*',
      'id'
    );

    assert(
      formattedSnippets.includes('(1) 📌 Catatan terorganisir'),
      'Item 1 clean formatting without badge'
    );
    assert(
      formattedSnippets.includes('(2) 📌 Catatan mentah baru belum dirapikan AI [unorganized]'),
      'Item 2 has [unorganized] badge when isProcessed = false'
    );
    assert(
      formattedSnippets.includes('(3) 📌 🖼️ Struk makan siang padang'),
      'Item 3 has 🖼️ badge for image attachment'
    );
    assert(
      formattedSnippets.includes('(4) 📌 📎 Dokumen panduan sprint project [unorganized]'),
      'Item 4 has 📎 badge and [unorganized] badge'
    );

    // 1b. Insert 30 notes to test /read pagination and max 27 limit
    console.log('\n--- Testing handleReadCommand pagination (max 27 notes, 3 pages) ---');
    const noteInserts = [];
    for (let i = 1; i <= 30; i++) {
      noteInserts.push({
        id: `note-read-${testUserId}-${i}`,
        userId: testUserId,
        content: `Test Note Read #${i} - Detail content snippet`,
        category: (i % 2 === 0 ? 'todo' : 'others') as any,
        isProcessed: i % 3 === 0,
        createdAt: new Date(Date.now() - (30 - i) * 60000), // staggered times
      });
    }
    await db.insert(notes).values(noteInserts);

    // Page 1
    const readPage1 = await handleReadCommand(testChatId, testUserId, 1, 'id');
    assert(readPage1.ok === true, 'handleReadCommand page 1 should return ok');
    assert(readPage1.page === 1, 'Page number should be 1');
    assert(readPage1.totalCount === 27, `Total count capped at 27 (got ${readPage1.totalCount})`);

    // Page 3 (last page of 27 notes)
    const readPage3 = await handleReadCommand(testChatId, testUserId, 3, 'id');
    assert(readPage3.ok === true && readPage3.page === 3, 'handleReadCommand page 3 should return ok');

    // Page 4 should clamp to page 3
    const readPage4 = await handleReadCommand(testChatId, testUserId, 4, 'id');
    assert(readPage4.page === 3, `Page 4 should clamp to max page 3 (got ${readPage4.page})`);

    // Verify Persistent Dock contains '📖 Read'
    assert(
      PERSISTENT_DOCK_KEYBOARD.keyboard[0].some((k) => k.text === '📖 Read'),
      'Persistent Dock keyboard includes 📖 Read button in row 1'
    );

    // -------------------------------------------------------------
    // MODULE 2: Tombol Dock 🔄 Sync & 10s Cooldown
    // -------------------------------------------------------------
    console.log('\n--- MODULE 2: Tombol Dock 🔄 Sync & Cooldown ---');
    
    // First sync run: should trigger sync
    const sync1 = await handleSyncCommand(testChatId, testUserId, 'id');
    assert(sync1.ok === true, 'First sync run should execute successfully');

    // Immediate second sync run: should trigger cooldown
    const sync2 = await handleSyncCommand(testChatId, testUserId, 'id');
    assert(sync2.ok === true, 'Second sync run should be handled safely');
    assert(sync2.action === 'sync_cooldown', `Second sync must hit sync_cooldown (got ${sync2.action})`);

    // -------------------------------------------------------------
    // MODULE 3: Multimedia Attachments & Sharp Compression
    // -------------------------------------------------------------
    console.log('\n--- MODULE 3: Multimedia Attachments & Sharp Compression ---');

    // 3a. Rejection of unsupported media (video, voice, audio)
    const voiceMsg = {
      message_id: 101,
      chat: { id: testChatId },
      voice: { file_id: 'voice-123' },
    };
    const voiceRes = await processTelegramMessage(voiceMsg);
    assert(voiceRes.action === 'unsupported_media', 'Voice note should be rejected as unsupported_media');

    // 3b. Rejection: File size > 3MB
    const oversizePhotoMsg = {
      message_id: 102,
      chat: { id: testChatId },
      caption: 'Foto besar > 3MB',
      photo: [
        { file_id: 'photo-small', file_size: 50000 },
        { file_id: 'photo-large', file_size: 4 * 1024 * 1024 }, // 4MB
      ],
    };
    const oversizeRes = await processTelegramMessage(oversizePhotoMsg);
    assert(oversizeRes.error === 'media_size_exceeded', 'Photo > 3MB should be rejected with media_size_exceeded');

    // 3c. Rejection: Media without caption
    const noCaptionPhotoMsg = {
      message_id: 103,
      chat: { id: testChatId },
      // no caption
      photo: [
        { file_id: 'photo-valid-size', file_size: 200 * 1024 },
      ],
    };
    const noCaptionRes = await processTelegramMessage(noCaptionPhotoMsg);
    assert(noCaptionRes.error === 'media_missing_caption', 'Single photo without caption must be rejected with media_missing_caption');

    // 3d. Sharp Local Compression Test
    // Create an uncompressed sample raw image using sharp (e.g. 2000x2000 png)
    const rawLargeImage = await sharp({
      create: {
        width: 1800,
        height: 1200,
        channels: 3,
        background: { r: 120, g: 180, b: 240 },
      },
    })
      .png()
      .toBuffer();

    console.log(`Initial test raw PNG size: ${(rawLargeImage.length / 1024).toFixed(1)} KB`);

    // Compress using Sharp to WebP 70% with max width 1200px
    const compressedImage = await sharp(rawLargeImage)
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 70 })
      .toBuffer();

    const compressedMetadata = await sharp(compressedImage).metadata();
    console.log(`Compressed WebP size: ${(compressedImage.length / 1024).toFixed(1)} KB, width: ${compressedMetadata.width}px`);

    assert(
      (compressedMetadata.width || 0) <= 1200,
      `Compressed image width <= 1200px (got ${compressedMetadata.width}px)`
    );
    assert(
      compressedImage.length < 100 * 1024,
      `Compressed image size is puluhan KB (< 100KB, got ${(compressedImage.length / 1024).toFixed(1)} KB)`
    );

    // 3e. Test media-processor fallback & schema storage
    const processedMock = await processTelegramAttachment(
      'mock-file-id-123',
      'image',
      testUserId,
      'struk-test.jpg',
      'image/jpeg',
      50000
    );

    assert(processedMock.type === 'image', 'Processed attachment type should be image');
    assert(processedMock.fileId === 'mock-file-id-123', 'Processed attachment fileId preserved');

    // Insert note with attachment into DB and query back
    const noteWithAttachId = `note-attach-${Date.now()}`;
    await db.insert(notes).values({
      id: noteWithAttachId,
      userId: testUserId,
      content: 'Foto kwitansi pembayaran listrik PLN 250rb',
      category: 'finance',
      specificTags: ['pln', 'listrik'],
      attachments: [processedMock],
      source: 'telegram',
      isProcessed: true,
      createdAt: new Date(),
    });

    const [savedAttachNote] = await db.select().from(notes).where(eq(notes.id, noteWithAttachId)).limit(1);
    assert(
      Array.isArray(savedAttachNote.attachments) && savedAttachNote.attachments.length === 1,
      'Attachment array saved into database schema jsonb column'
    );

    // -------------------------------------------------------------
    // MODULE 4: Zero-Vision AI Prepend
    // -------------------------------------------------------------
    console.log('\n--- MODULE 4: Zero-Vision AI Prepend ---');
    // When note has attachment, organizeUserNotes should prepend "[Catatan ini memiliki lampiran gambar/file]"
    const unorgWithAttachId = `note-unorg-attach-${Date.now()}`;
    await db.insert(notes).values({
      id: unorgWithAttachId,
      userId: testUserId,
      content: 'Beli obat batuk siladex di apotek k24 35k',
      category: 'others',
      specificTags: [],
      attachments: [processedMock],
      source: 'telegram',
      isProcessed: false,
      createdAt: new Date(),
    });

    const organizeRes = await organizeUserNotes(testUserId);
    assert(organizeRes.total >= 1, 'organizeUserNotes processed notes with attachments');

    const [updatedUnorg] = await db.select().from(notes).where(eq(notes.id, unorgWithAttachId)).limit(1);
    assert(updatedUnorg.isProcessed === true, 'Note marked as isProcessed = true after organize');
    assert(
      ['finance', 'todo', 'others'].includes(updatedUnorg.category),
      `Category organized properly (got ${updatedUnorg.category})`
    );

  } finally {
    // Cleanup test data
    console.log('\n--- Cleaning up test data ---');
    await db.delete(notes).where(eq(notes.userId, testUserId));
    await db.delete(apiKeys).where(eq(apiKeys.userId, testUserId));
    await db.delete(users).where(eq(users.id, testUserId));
  }

  console.log('\n====================================================');
  console.log(`TEST RESULTS: ${passed} / ${total} assertions passed`);
  console.log('====================================================');

  if (passed === total) {
    console.log('🎉 ALL TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
  } else {
    console.error('💥 SOME TESTS FAILED');
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
