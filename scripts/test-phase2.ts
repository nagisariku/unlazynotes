/**
 * Integration Test for UnlazyNotes Phase 2:
 * Authentication & Web Dashboard API/Workflow
 */

import { db } from '../src/db';
import { notes, subscriptions, apiKeys } from '../src/db/schema';
import { eq } from 'drizzle-orm';

const BASE_URL = process.env.TEST_URL || 'http://localhost:4321';

async function runPhase2Tests() {
  console.log(`=== Starting Phase 2 Integration Tests against ${BASE_URL} ===\n`);

  // Test 1: Dev Login & Session Verification
  console.log('[Test 1] Testing user authentication and session creation...');
  const testEmail = `phase2_user_${Date.now()}@unlazynotes.local`;
  const loginRes = await fetch(`${BASE_URL}/api/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, name: 'Phase2 Tester' }),
  });

  if (!loginRes.ok) {
    console.error('❌ Fail: dev-login failed with status:', loginRes.status);
    process.exit(1);
  }

  const loginData = await loginRes.json();
  const setCookie = loginRes.headers.get('set-cookie');
  console.log('✅ Pass: Login success for user:', loginData.userId);
  console.log('   Cookie received:', setCookie ? 'Yes' : 'No');

  const authHeaders = {
    Cookie: setCookie || `dev_user_id=${loginData.userId}`,
    Origin: BASE_URL,
  };

  // Test 2: Auto-creation of subscription and API key
  console.log('\n[Test 2] Verifying auto-provisioned subscription and API Key...');
  const [userSub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, loginData.userId));
  const [userKey] = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.userId, loginData.userId));

  if (userSub && userSub.status === 'active' && userSub.plan === 'standard') {
    console.log('✅ Pass: Active Standard subscription automatically created!');
  } else {
    console.error('❌ Fail: Subscription not properly initialized:', userSub);
    process.exit(1);
  }

  if (userKey && userKey.isActive) {
    console.log('✅ Pass: Unique Telegram API Key automatically generated in DB!');
  } else {
    console.error('❌ Fail: API Key record missing:', userKey);
    process.exit(1);
  }

  // Test 3: Insert sample notes (Text, URL Bookmark, Todo)
  console.log('\n[Test 3] Seeding sample notes for dashboard view...');
  const sampleNoteId1 = `note_${Date.now()}_1`;
  const sampleBookmarkId = `note_${Date.now()}_2`;

  await db.insert(notes).values([
    {
      id: sampleNoteId1,
      userId: loginData.userId,
      content: 'meeting evaluasi sprint jam 10 pagi',
      category: 'schedule',
      specificTags: ['meeting', 'sprint'],
      source: null,
      createdAt: new Date(),
    },
    {
      id: sampleBookmarkId,
      userId: loginData.userId,
      content: 'baca dokumentasi keren ini https://astro.build/docs',
      category: 'bookmark',
      specificTags: ['docs', 'astro'],
      source: 'article',
      createdAt: new Date(),
    },
  ]);
  console.log('✅ Pass: Sample notes seeded into database.');

  // Test 4: Fetch notes via API (/api/notes)
  console.log('\n[Test 4] Testing GET /api/notes...');
  const notesRes = await fetch(`${BASE_URL}/api/notes`, { headers: authHeaders });
  if (notesRes.ok) {
    const data = await notesRes.json();
    console.log(`✅ Pass: /api/notes returned ${data.notes.length} notes.`);
  } else {
    console.error('❌ Fail /api/notes:', notesRes.status);
    process.exit(1);
  }

  // Test 5: Search & Category filter (/api/notes?q=sprint and ?category=bookmark)
  console.log('\n[Test 5] Testing search & category filtering...');
  const searchRes = await fetch(`${BASE_URL}/api/notes?q=sprint`, { headers: authHeaders });
  const searchData = await searchRes.json();
  if (searchData.notes?.length === 1 && searchData.notes[0].id === sampleNoteId1) {
    console.log('✅ Pass: Keyword search ?q=sprint correctly matched note!');
  } else {
    console.error('❌ Fail search filter:', searchData);
    process.exit(1);
  }

  const bookmarkFilterRes = await fetch(`${BASE_URL}/api/notes?category=bookmark`, {
    headers: authHeaders,
  });
  const bookmarkFilterData = await bookmarkFilterRes.json();
  if (
    bookmarkFilterData.notes?.length === 1 &&
    bookmarkFilterData.notes[0].id === sampleBookmarkId
  ) {
    console.log('✅ Pass: Category filter ?category=bookmark matched bookmark note!');
  } else {
    console.error('❌ Fail category filter:', bookmarkFilterData);
    process.exit(1);
  }

  // Test 6: Netscape HTML Bookmark Export (/api/bookmarks/export)
  console.log('\n[Test 6] Testing Netscape HTML export (/api/bookmarks/export)...');
  const exportRes = await fetch(`${BASE_URL}/api/bookmarks/export`, { headers: authHeaders });
  const contentType = exportRes.headers.get('content-type');
  const contentDisp = exportRes.headers.get('content-disposition');
  const exportHtml = await exportRes.text();

  if (
    exportRes.ok &&
    contentType?.includes('text/html') &&
    contentDisp?.includes('attachment') &&
    exportHtml.includes('<!DOCTYPE NETSCAPE-Bookmark-file-1>') &&
    exportHtml.includes('https://astro.build/docs')
  ) {
    console.log('✅ Pass: Bookmark export returned valid Netscape HTML file!');
    console.log('   Preview excerpt:\n' + exportHtml.split('\n').slice(0, 8).join('\n'));
  } else {
    console.error('❌ Fail export bookmarks:', { contentType, contentDisp, exportHtml });
    process.exit(1);
  }

  // Test 7: API Key Regeneration (/api/apikey/regenerate)
  console.log('\n[Test 7] Testing API Key regeneration...');
  // First simulate linked telegramChatId
  await db
    .update(apiKeys)
    .set({ telegramChatId: '123456789' })
    .where(eq(apiKeys.userId, loginData.userId));

  const regenRes = await fetch(`${BASE_URL}/api/apikey/regenerate`, {
    method: 'POST',
    headers: authHeaders,
  });
  const regenData = await regenRes.json();

  const [refreshedKey] = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.userId, loginData.userId));

  if (
    regenRes.ok &&
    regenData.success &&
    regenData.apiKey?.startsWith('unz_') &&
    refreshedKey.telegramChatId === null
  ) {
    console.log('✅ Pass: New API Key generated and previous Telegram session disconnected!');
    console.log('   New Key prefix:', regenData.apiKey.substring(0, 10) + '...');
  } else {
    console.error('❌ Fail regenerate key:', regenData, refreshedKey);
    process.exit(1);
  }

  // Test 8: Note Deletion (/api/notes/[id])
  console.log('\n[Test 8] Testing DELETE /api/notes/[id]...');
  const deleteRes = await fetch(`${BASE_URL}/api/notes/${sampleNoteId1}`, {
    method: 'DELETE',
    headers: authHeaders,
  });
  if (deleteRes.ok) {
    const [deletedRow] = await db.select().from(notes).where(eq(notes.id, sampleNoteId1));
    if (!deletedRow) {
      console.log('✅ Pass: Note successfully deleted from database.');
    } else {
      console.error('❌ Fail: Note row still exists in DB');
      process.exit(1);
    }
  } else {
    console.error('❌ Fail delete note:', deleteRes.status);
    process.exit(1);
  }

  // Test 9: Web Pages Rendering (Smoke test for SSR pages)
  console.log('\n[Test 9] Smoke testing SSR page routes (/login, /dashboard, /dashboard/bookmarks, /dashboard/settings)...');
  const pages = ['/', '/login', '/dashboard', '/dashboard/bookmarks', '/dashboard/settings'];
  for (const page of pages) {
    const pageRes = await fetch(`${BASE_URL}${page}`, { headers: authHeaders });
    if (pageRes.status === 200) {
      console.log(`✅ Pass: ${page} rendered HTTP 200 OK`);
    } else {
      console.error(`❌ Fail: ${page} returned status ${pageRes.status}`);
      process.exit(1);
    }
  }

  console.log('\n🎉 ALL PHASE 2 TESTS PASSED! DoD Fase 2 fully verified.');
  process.exit(0);
}

runPhase2Tests().catch((err) => {
  console.error('Phase 2 test suite failed:', err);
  process.exit(1);
});
