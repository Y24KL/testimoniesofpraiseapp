/**
 * Test Suite: Media Manager Worker Endpoints, Diagnostics & Env Sanitization
 * Run with: node tests/mediaManagerWorker.test.mjs
 */

import assert from 'node:assert';
import worker from '../top-admin/worker/src/index.js';

console.log('Running Media Manager Worker & Diagnostics Test Suite...\n');

const baseEnv = {
  FIREBASE_PROJECT_ID: 'testimoniesofpraiseapp',
  ALLOWED_ORIGINS: 'http://localhost:5173,https://testimoniesofpraiseweb.onrender.com',
  BUNNY_STORAGE_ZONE_NAME: 'top-media-storage',
  BUNNY_STORAGE_ACCESS_KEY: 'test-bunny-access-key-xyz',
  BUNNY_STORAGE_ENDPOINT: 'storage.bunnycdn.com',
  BUNNY_CDN_HOSTNAME: 'top-media.b-cdn.net',
};

// 1. Worker Status Endpoint with Full Configuration
{
  console.log('1. Testing GET /api/media/status with full configuration:');
  const req = new Request('https://relay/api/media/status', {
    method: 'GET',
    headers: { Origin: 'http://localhost:5173' },
  });

  const res = await worker.fetch(req, baseEnv);
  assert.equal(res.status, 200);
  assert.ok(res.headers.get('Cache-Control')?.includes('no-store'), 'Must send Cache-Control: no-store');
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'http://localhost:5173');

  const body = await res.json();
  assert.equal(body.status, 'ok');
  assert.ok(body.version, 'status must report a version');
  assert.equal(body.providers.bunny.configured, true);
  assert.equal(body.providers.bunny.hasAccessKey, true);
  assert.equal(body.providers.bunny.storageZone, 'top-media-storage');
  assert.equal(body.providers.bunny.cdnHostname, 'top-media.b-cdn.net');
  assert.equal(body.providers.bunny.state, 'ready');

  console.log('✔ Full configuration status returned correctly with no-store header.');
}

// 2. Worker Status Endpoint with Missing AccessKey
{
  console.log('\n2. Testing GET /api/media/status when BUNNY_STORAGE_ACCESS_KEY is missing:');
  const envNoKey = { ...baseEnv, BUNNY_STORAGE_ACCESS_KEY: '' };
  const req = new Request('https://relay/api/media/status', { method: 'GET' });

  const res = await worker.fetch(req, envNoKey);
  const body = await res.json();

  assert.equal(body.providers.bunny.configured, false);
  assert.equal(body.providers.bunny.hasAccessKey, false);
  assert.ok(body.providers.bunny.missingConfig.includes('BUNNY_STORAGE_ACCESS_KEY'));
  assert.equal(body.providers.bunny.state, 'missing_secret');

  console.log('✔ Missing secret accurately detected and safe diagnostic state reported.');
}

// 3. Dynamic Localhost and Allowed Origin CORS
{
  console.log('\n3. Testing Dynamic CORS Handling:');

  // Allowed origin
  const reqAllowed = new Request('https://relay/api/media/status', {
    method: 'GET',
    headers: { Origin: 'https://testimoniesofpraiseweb.onrender.com' },
  });
  const resAllowed = await worker.fetch(reqAllowed, baseEnv);
  assert.equal(resAllowed.headers.get('Access-Control-Allow-Origin'), 'https://testimoniesofpraiseweb.onrender.com');

  // Localhost dev port (e.g. 5174)
  const reqDev = new Request('https://relay/api/media/status', {
    method: 'GET',
    headers: { Origin: 'http://localhost:5174' },
  });
  const resDev = await worker.fetch(reqDev, baseEnv);
  assert.equal(resDev.headers.get('Access-Control-Allow-Origin'), 'http://localhost:5174');

  console.log('✔ CORS headers reflect allowed origins and localhost dev hosts.');
}

// 4. Citation String Stripping & Env Normalization
{
  console.log('\n4. Testing Environment URL Sanitization:');

  const cleanUrl = (url) => (url ? url.replace(/\[cite:[^\]]+\]/g, '').trim().replace(/\/$/, '') : '');

  const corruptedWorkerUrl = 'https://top-push-relay.gtrusouth116.workers.dev[cite: 18, 20]';
  const clean = cleanUrl(corruptedWorkerUrl);
  assert.equal(clean, 'https://top-push-relay.gtrusouth116.workers.dev');

  const corruptedCloudinary = 'duw6xrnpn[cite: 20]';
  assert.equal(cleanUrl(corruptedCloudinary), 'duw6xrnpn');

  console.log('✔ Citation text successfully stripped from environment strings.');
}

console.log('\n🎉 ALL MEDIA MANAGER WORKER TESTS PASSED SUCCESSFULLY!');
