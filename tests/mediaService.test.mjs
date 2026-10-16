/**
 * Unit Tests for Unified Media Service, Provider Routing, and Playback Compatibility
 * Run with: node tests/mediaService.test.mjs
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { identifyProvider, resolvePlaybackUrl, getMediaInfo, getProviderDisplayName } from '../web/src/services/mediaService.ts';
import { createBackupSnapshot } from '../scripts/media-migration.mjs';

console.log('Running Unified Media Service Test Suite...\n');

// 1. Provider Identification Tests
{
  console.log('1. Testing Provider Identification:');

  // Bunny CDN patterns
  assert.equal(identifyProvider('https://top-media.b-cdn.net/audio/praise1.mp3'), 'bunny');
  assert.equal(identifyProvider('https://storage.bunnycdn.com/top-media/file.mp4'), 'bunny');
  assert.equal(identifyProvider('https://media.testimoniesofpraise.org/audio/test.aac'), 'bunny');

  // Cloudinary patterns
  assert.equal(identifyProvider('https://res.cloudinary.com/duw6xrnpn/image/upload/v1234/sample.jpg'), 'cloudinary');
  assert.equal(identifyProvider('https://res.cloudinary.com/duw6xrnpn/video/upload/v1234/testimony.mp4'), 'cloudinary');

  // HLS stream patterns
  assert.equal(identifyProvider('https://stream.testimoniesofpraise.org/hls/live.m3u8'), 'hls');
  assert.equal(identifyProvider('https://myradio.com/broadcast.m3u8?token=xyz'), 'hls');

  // Firebase Storage patterns
  assert.equal(identifyProvider('https://firebasestorage.googleapis.com/v0/b/project.appspot.com/o/file.mp3?alt=media'), 'firebase');

  // External / Null / Empty
  assert.equal(identifyProvider('https://youtube.com/watch?v=1234'), 'external');
  assert.equal(identifyProvider(''), 'external');
  assert.equal(identifyProvider(null), 'external');
  assert.equal(identifyProvider(undefined), 'external');

  console.log('✔ All provider identification tests passed.');
}

// 2. Playback URL Resolution & Preservation Tests
{
  console.log('\n2. Testing Playback URL Resolution:');

  // Preserve HLS streams exactly
  const hlsUrl = 'https://stream.testimoniesofpraise.org/hls/live.m3u8';
  assert.equal(resolvePlaybackUrl(hlsUrl), hlsUrl);

  // Preserve existing Cloudinary URLs untouched by default
  const cloudUrl = 'https://res.cloudinary.com/duw6xrnpn/image/upload/v12345/banner.png';
  assert.equal(resolvePlaybackUrl(cloudUrl), cloudUrl);

  // Cloudinary image auto-optimization when explicitly requested
  const cloudOptimized = resolvePlaybackUrl(cloudUrl, { optimizeImage: true });
  assert.equal(cloudOptimized, 'https://res.cloudinary.com/duw6xrnpn/image/upload/f_auto,q_auto/v12345/banner.png');

  // Do not double-optimize
  assert.equal(resolvePlaybackUrl(cloudOptimized, { optimizeImage: true }), cloudOptimized);

  // Preserve Bunny CDN URLs intact (with Range header support for iOS/Android)
  const bunnyAudio = 'https://top-media.b-cdn.net/audio-testimonies/1739000000-healing.mp3';
  assert.equal(resolvePlaybackUrl(bunnyAudio), bunnyAudio);

  console.log('✔ All playback URL resolution tests passed.');
}

// 3. Media Info & Capabilities Tests
{
  console.log('\n3. Testing Media Info & Capabilities:');

  const bunnyInfo = getMediaInfo('https://top-media.b-cdn.net/audio/test.mp3');
  assert.equal(bunnyInfo.provider, 'bunny');
  assert.equal(bunnyInfo.isHls, false);
  assert.equal(bunnyInfo.supportsByteRange, true);

  const hlsInfo = getMediaInfo('https://stream.testimoniesofpraise.org/hls/live.m3u8');
  assert.equal(hlsInfo.provider, 'hls');
  assert.equal(hlsInfo.isHls, true);
  assert.equal(hlsInfo.isStream, true);

  console.log('✔ Media capabilities tests passed.');
}

// 4. Provider Display Names Tests
{
  console.log('\n4. Testing Provider Display Names:');

  assert.equal(getProviderDisplayName('bunny'), 'Bunny Storage (CDN)');
  assert.equal(getProviderDisplayName('cloudinary'), 'Cloudinary');
  assert.equal(getProviderDisplayName('hls'), 'Live Stream (HLS)');
  assert.equal(getProviderDisplayName('firebase'), 'Firebase Storage');
  assert.equal(getProviderDisplayName('external'), 'External Host');

  console.log('✔ Provider display names tests passed.');
}

// 5. Migration Safeguard & Snapshot Backup Tests
{
  console.log('\n5. Testing Migration Snapshot & Rollback:');

  const testRecords = [
    { id: '1', title: 'Test Item', originalUrl: 'https://res.cloudinary.com/old.mp3', targetUrl: 'https://top-media.b-cdn.net/new.mp3' },
  ];

  const snapshotFile = createBackupSnapshot(testRecords, 'test-snapshot');
  assert.ok(fs.existsSync(snapshotFile), 'Backup file was created');

  const savedData = JSON.parse(fs.readFileSync(snapshotFile, 'utf-8'));
  assert.equal(savedData.length, 1);
  assert.equal(savedData[0].originalUrl, 'https://res.cloudinary.com/old.mp3');

  // Clean up test file
  fs.unlinkSync(snapshotFile);
  console.log('✔ Migration snapshot creation and verification tests passed.');
}

console.log('\n🎉 ALL MEDIA SERVICE AND COMPATIBILITY TESTS PASSED SUCCESSFULLY!');
