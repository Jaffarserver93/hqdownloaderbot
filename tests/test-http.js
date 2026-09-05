import assert from 'assert';
import app from '../src/app.js';
import { createDownloadRecord, saveUserSession } from '../src/db/index.js';

async function runHttpTests() {
  console.log('🧪 Starting HTTP Server Integration Tests...');

  // Start temporary local server on dynamic port
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  process.env.INSTAGRAM_VERIFY_TOKEN = 'test_verify_token_123';
  process.env.BOT_USERNAME = 'hqdownloaderbot';

  try {
    // 1. Health Check
    console.log('\n▶ Testing GET / (Health check)...');
    const healthRes = await fetch(`${baseUrl}/`);
    const healthJson = await healthRes.json();
    assert.strictEqual(healthRes.status, 200);
    assert.strictEqual(healthJson.status, 'online');
    assert.strictEqual(healthJson.bot, '@hqdownloaderbot');
    console.log('✅ Health check passed.');

    // 2. Webhook verification - Valid Token
    console.log('\n▶ Testing GET /webhook (Valid verification)...');
    const challenge = 'random_challenge_string_abc123';
    const verifyRes = await fetch(`${baseUrl}/webhook?hub.mode=subscribe&hub.verify_token=test_verify_token_123&hub.challenge=${challenge}`);
    const verifyText = await verifyRes.text();
    assert.strictEqual(verifyRes.status, 200);
    assert.strictEqual(verifyText, challenge);
    console.log('✅ Webhook verification passed with 200 challenge.');

    // 3. Webhook verification - Invalid Token
    console.log('\n▶ Testing GET /webhook (Invalid token)...');
    const failRes = await fetch(`${baseUrl}/webhook?hub.mode=subscribe&hub.verify_token=wrong_token&hub.challenge=${challenge}`);
    assert.strictEqual(failRes.status, 403);
    console.log('✅ Webhook invalid token correctly rejected with 403.');

    // 4. Download Route - Expired Token
    console.log('\n▶ Testing GET /dl/:id (Expired token)...');
    const expiredId = 'http_expired_test';
    await createDownloadRecord({
      id: expiredId,
      fileId: 'tg_file_expired',
      mediaType: 'video',
      creatorName: 'TestCreator',
      caption: 'Expired Reel',
      createdAt: new Date(Date.now() - 28 * 60 * 60 * 1000),
      expiresAt: new Date(Date.now() - 4 * 60 * 60 * 1000)
    });

    const dlExpiredRes = await fetch(`${baseUrl}/dl/${expiredId}`);
    assert.strictEqual(dlExpiredRes.status, 410); // HTTP 410 Gone
    const expiredBody = await dlExpiredRes.text();
    assert(expiredBody.includes('Download Link Expired'));
    assert(expiredBody.includes('ago'));
    console.log('✅ GET /dl/:id for expired token returned 410 with relative time.');

    // 5. Download Route - Non-existent Token
    console.log('\n▶ Testing GET /dl/:id (Not found token)...');
    const notFoundRes = await fetch(`${baseUrl}/dl/non_existent_token_999`);
    assert.strictEqual(notFoundRes.status, 404);
    console.log('✅ GET /dl/:id for non-existent token returned 404.');

    // 6. Webhook POST - Event receipt
    console.log('\n▶ Testing POST /webhook (Event dispatch)...');
    const postWebhookRes = await fetch(`${baseUrl}/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        object: 'instagram',
        entry: [{
          id: 'test_page_123',
          time: Date.now(),
          messaging: [{
            sender: { id: 'test_user_789' },
            recipient: { id: 'test_page_123' },
            message: { text: 'hi' }
          }]
        }]
      })
    });
    assert.strictEqual(postWebhookRes.status, 200);
    const postResText = await postWebhookRes.text();
    assert.strictEqual(postResText, 'EVENT_RECEIVED');
    console.log('✅ POST /webhook responded with EVENT_RECEIVED.');

    console.log('\n=========================================');
    console.log('🎉 ALL HTTP API INTEGRATION TESTS PASSED!');
    console.log('=========================================\n');
  } finally {
    server.close();
  }
}

runHttpTests().catch(err => {
  console.error('❌ HTTP Tests failed:', err);
  process.exit(1);
});
