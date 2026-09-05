import assert from 'assert';
import { initDb, createDownloadRecord, getDownloadRecord, saveUserSession, getUserSession } from '../src/db/index.js';
import { extractInstagramShortcode, findInstagramUrlInText } from '../src/services/instagramExtractor.js';
import { buildGreetingQuickReplies, buildDeliveryCaption } from '../src/services/metaMessenger.js';
import { renderActivePage, renderExpiredPage } from '../src/views/downloadView.js';

async function runTests() {
  console.log('🧪 Running Test Suite for Instagram Downloader Bot...');

  // --- Test 1: Instagram URL Parsing ---
  console.log('\n▶ Testing Instagram URL parser...');
  const testUrls = [
    { input: 'https://www.instagram.com/reel/C7-XYZ123/?igsh=abc', expected: 'C7-XYZ123' },
    { input: 'Check this reel https://instagram.com/p/DF123abc456/ it is so cool', expectedUrl: 'https://instagram.com/p/DF123abc456/', expectedShortcode: 'DF123abc456' },
    { input: 'https://www.instagram.com/share/reel/C_abc987/', expected: 'C_abc987' }
  ];

  assert.strictEqual(extractInstagramShortcode(testUrls[0].input), testUrls[0].expected);
  assert.strictEqual(findInstagramUrlInText(testUrls[1].input), testUrls[1].expectedUrl);
  assert.strictEqual(extractInstagramShortcode(testUrls[1].expectedUrl), testUrls[1].expectedShortcode);
  assert.strictEqual(extractInstagramShortcode(testUrls[2].input), testUrls[2].expected);
  console.log('✅ URL parsing tests passed.');

  // --- Test 2: Database Initialization & Operations ---
  console.log('\n▶ Testing Database CRUD & Sessions...');
  await initDb();

  const activeId = 'active_test_123';
  const now = new Date();
  const expiresAtActive = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24h future

  await createDownloadRecord({
    id: activeId,
    fileId: 'tg_file_video_999',
    mediaType: 'video',
    creatorName: 'Noor.',
    caption: 'I’ve been wanting to try this trend for so long #trending',
    createdAt: now,
    expiresAt: expiresAtActive
  });

  const fetchedActive = await getDownloadRecord(activeId);
  assert(fetchedActive, 'Active record should be retrieved');
  assert.strictEqual(fetchedActive.file_id, 'tg_file_video_999');
  assert.strictEqual(fetchedActive.creator_name, 'Noor.');
  console.log('✅ Active record created and verified.');

  const expiredId = 'expired_test_456';
  const expiredDate = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 hours ago

  await createDownloadRecord({
    id: expiredId,
    fileId: 'tg_file_video_888',
    mediaType: 'video',
    creatorName: 'TestCreator',
    caption: 'Expired post',
    createdAt: new Date(now.getTime() - 26 * 60 * 60 * 1000),
    expiresAt: expiredDate
  });

  const fetchedExpired = await getDownloadRecord(expiredId);
  assert(fetchedExpired, 'Expired record should be retrieved');
  assert(new Date(fetchedExpired.expires_at) < now, 'Record expires_at should be in the past');
  console.log('✅ Expired record created and verified.');

  // Session persistence
  const testSender = 'user_instagram_1001';
  await saveUserSession(testSender, {
    videoSlug: activeId,
    audioSlug: 'audio_slug_123',
    videoFileId: 'tg_file_video_999',
    audioFileId: 'tg_file_audio_999',
    creatorName: 'Noor.',
    caption: 'I’ve been wanting to try this trend'
  });

  const fetchedSession = await getUserSession(testSender);
  assert.strictEqual(fetchedSession.video_slug, activeId);
  assert.strictEqual(fetchedSession.creator_name, 'Noor.');
  console.log('✅ User session saved and retrieved.');

  // --- Test 3: Messenger Messages & Quick Replies ---
  console.log('\n▶ Testing Quick Replies & Captions...');
  const { text: greetingText, quickReplies } = buildGreetingQuickReplies();
  assert(greetingText.includes('What do you want?'));
  assert(greetingText.includes('1  — Video'));
  assert(greetingText.includes('2  — Audio only'));
  assert(greetingText.includes('3  — Both'));
  assert.strictEqual(quickReplies.length, 3);
  assert.strictEqual(quickReplies[0].payload, 'ACTION_VIDEO');
  assert.strictEqual(quickReplies[1].payload, 'ACTION_AUDIO');
  assert.strictEqual(quickReplies[2].payload, 'ACTION_BOTH');
  console.log('✅ Greeting Quick Replies verified.');

  const captionOutput = buildDeliveryCaption({
    choiceType: 'both',
    creatorName: 'Noor.',
    caption: 'I’ve been wanting to try this trend for so long',
    videoDownloadUrl: 'https://mydomain.com/dl/rrlfek.mp4',
    audioDownloadUrl: 'https://mydomain.com/dl/cg6fqg.m4a'
  });

  assert(captionOutput.includes("🎬🎵 Here's your video + audio!"));
  assert(captionOutput.includes('👤 Noor.'));
  assert(captionOutput.includes('📝 I’ve been wanting to try this trend for so long'));
  assert(captionOutput.includes('🔥 Trending Audio'));
  assert(captionOutput.includes('⚠️ Found a bug or error? Screenshot it and send to acc @jxfr.in'));
  assert(captionOutput.includes('📥 Download HQ MP4: https://mydomain.com/dl/rrlfek.mp4'));
  assert(captionOutput.includes('📥 Download MP3: https://mydomain.com/dl/cg6fqg.m4a'));
  console.log('✅ Formatted caption matched specification.');

  // --- Test 4: Web Views Rendering ---
  console.log('\n▶ Testing Web Landing Pages...');

  // Active page
  const activeHtml = renderActivePage({
    id: activeId,
    mediaType: 'video',
    directCdnUrl: 'https://api.telegram.org/file/bot123/videos/test.mp4',
    creatorName: 'Noor.',
    caption: 'Test caption',
    expiresAt: expiresAtActive,
    botUsername: 'hqdownloaderbot'
  });

  assert(activeHtml.includes('🎬 Instagram Reel Video'));
  assert(activeHtml.includes('@Noor.'));
  assert(activeHtml.includes('https://api.telegram.org/file/bot123/videos/test.mp4'));
  assert(activeHtml.includes('download='));
  assert(activeHtml.includes('countdown'));
  assert(activeHtml.includes('@jxfr.in'));
  console.log('✅ Active download landing page renders correctly with countdown and direct CDN.');

  // Expired page
  const expiredHtml = renderExpiredPage({
    id: expiredId,
    expiresAt: expiredDate,
    botUsername: 'hqdownloaderbot'
  });

  assert(expiredHtml.includes('Download Link Expired'));
  assert(expiredHtml.includes('Status: Link Inactive'));
  assert(expiredHtml.includes('ago'), 'Should include dynamic relative time "ago"');
  assert(!expiredHtml.includes('<video'), 'Expired page must NOT contain video player');
  assert(!expiredHtml.includes('class="btn-download"'), 'Expired page must NOT contain download button');
  console.log('✅ Expired page renders correctly with dynamic relative time and zero media assets.');

  console.log('\n=========================================');
  console.log('🎉 ALL INTEGRATION TESTS PASSED CLEANLY!');
  console.log('=========================================\n');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
