// Comprehensive test suite for worker media endpoints + Bunny Storage. Run: node test-media.mjs
import assert from 'node:assert';
import worker from './src/index.js';

const env = {
  FIREBASE_PROJECT_ID: 'demo',
  ALLOWED_ORIGINS: 'http://localhost:5173',
  BUNNY_STORAGE_ZONE_NAME: 'top-test-zone',
  BUNNY_STORAGE_ACCESS_KEY: 'test-bunny-secret-key-12345',
  BUNNY_STORAGE_ENDPOINT: 'storage.bunnycdn.com',
  BUNNY_CDN_HOSTNAME: 'media.testimoniesofpraise.org',
};

const calls = [];
let admin = true;
let bunnyUploadSuccess = true;
let verifyHeadStatus = 200;

globalThis.fetch = async (url, init = {}) => {
  calls.push({ url: String(url), init });

  // 1) Firestore admin query
  if (String(url).includes(':runQuery')) {
    if (!admin) return new Response('{}', { status: 403 });
    return new Response(JSON.stringify([{ document: { name: 'projects/demo/databases/(default)/documents/pushTokens/t1' } }]), { status: 200 });
  }

  // 2) Bunny Storage PUT upload
  if (String(url).includes('storage.bunnycdn.com')) {
    assert.equal(init.method, 'PUT');
    assert.equal(init.headers['AccessKey'], 'test-bunny-secret-key-12345');
    if (bunnyUploadSuccess) {
      return new Response(JSON.stringify({ HttpCode: 201, Message: 'File uploaded.' }), { status: 201 });
    }
    return new Response('Unauthorized storage access', { status: 401 });
  }

  // 3) HEAD request for URL verification
  if (init.method === 'HEAD') {
    if (verifyHeadStatus === 200) {
      return new Response(null, {
        status: 200,
        headers: { 'content-type': 'audio/mpeg', 'content-length': '2048000' },
      });
    }
    return new Response(null, { status: verifyHeadStatus });
  }

  throw new Error('unexpected call to ' + url);
};

console.log('Testing Media Worker Endpoints...');

// 1. GET /api/media/status
{
  const res = await worker.fetch(new Request('https://relay/api/media/status', { method: 'GET' }), env);
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.status, 'ok');
  assert.equal(data.providers.bunny.configured, true);
  assert.equal(data.providers.bunny.storageZone, 'top-test-zone');
  assert.equal(data.providers.bunny.cdnHostname, 'media.testimoniesofpraise.org');
  console.log('✔ GET /api/media/status passed');
}

// 2. POST /upload/bunny without auth header (401)
{
  const res = await worker.fetch(new Request('https://relay/upload/bunny', {
    method: 'POST',
    headers: { Origin: 'http://localhost:5173' },
  }), env);
  assert.equal(res.status, 401);
  console.log('✔ POST /upload/bunny without auth rejected (401)');
}

// 3. POST /upload/bunny with non-admin caller (403)
{
  admin = false;
  const res = await worker.fetch(new Request('https://relay/upload/bunny', {
    method: 'POST',
    headers: { Origin: 'http://localhost:5173', Authorization: 'Bearer fake-user-token' },
  }), env);
  assert.equal(res.status, 403);
  admin = true;
  console.log('✔ POST /upload/bunny with non-admin caller rejected (403)');
}

// 4. POST /upload/bunny when server lacks Bunny credentials (503)
{
  const envNoBunny = { ...env, BUNNY_STORAGE_ACCESS_KEY: '' };
  const res = await worker.fetch(new Request('https://relay/upload/bunny', {
    method: 'POST',
    headers: { Origin: 'http://localhost:5173', Authorization: 'Bearer admin-token' },
  }), envNoBunny);
  assert.equal(res.status, 503);
  const body = await res.json();
  assert.ok(body.error.includes('Bunny Storage is not configured'));
  console.log('✔ POST /upload/bunny without server credentials safely reports 503');
}

// 5. POST /upload/bunny happy path (raw binary stream)
{
  const audioData = new Uint8Array([0x49, 0x44, 0x33, 0x03, 0x00, 0x00]); // ID3 header
  const res = await worker.fetch(new Request('https://relay/upload/bunny', {
    method: 'POST',
    headers: {
      Origin: 'http://localhost:5173',
      Authorization: 'Bearer admin-token',
      'Content-Type': 'audio/mpeg',
      'x-file-name': 'my_testimony.mp3',
      'x-folder': 'audio-testimonies',
    },
    body: audioData,
  }), env);

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.provider, 'bunny');
  assert.ok(data.url.startsWith('https://media.testimoniesofpraise.org/audio-testimonies/'));
  assert.ok(data.url.endsWith('my_testimony.mp3'));
  assert.equal(data.size, 6);
  console.log('✔ POST /upload/bunny uploads file and returns Bunny CDN URL (200)');
}

// 6. POST /api/media/verify verification safeguard
{
  // Happy verification
  verifyHeadStatus = 200;
  const res = await worker.fetch(new Request('https://relay/api/media/verify', {
    method: 'POST',
    headers: {
      Origin: 'http://localhost:5173',
      Authorization: 'Bearer admin-token',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url: 'https://media.testimoniesofpraise.org/audio/test.mp3' }),
  }), env);

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.verified, true);
  assert.equal(data.status, 200);
  assert.equal(data.contentType, 'audio/mpeg');

  // Failed verification (e.g. 404 broken URL)
  verifyHeadStatus = 404;
  const res404 = await worker.fetch(new Request('https://relay/api/media/verify', {
    method: 'POST',
    headers: {
      Origin: 'http://localhost:5173',
      Authorization: 'Bearer admin-token',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url: 'https://media.testimoniesofpraise.org/audio/missing.mp3' }),
  }), env);

  const data404 = await res404.json();
  assert.equal(data404.verified, false);
  assert.equal(data404.status, 404);
  console.log('✔ POST /api/media/verify correctly verifies file accessibility and detects 404s');
}

console.log('All worker media endpoint tests passed successfully!');
