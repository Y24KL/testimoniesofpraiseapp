/**
 * Analyses published testimony videos with Gemini and writes timed clips to Firestore (testimonyClips).
 * Runs on a schedule in GitHub Actions (.github/workflows/analyze-clips.yml). Never run by the app.
 *
 *   node analyze-clips.mjs --dry-run   lists what would be analysed (no Gemini calls, no writes)
 *   node analyze-clips.mjs             analyses up to MAX_VIDEOS / MAX_MINUTES per run
 *
 * Secrets (GitHub Actions secrets, never committed):
 *   GEMINI_API_KEY               Gemini API key (paid tier, billing enabled)
 *   FIREBASE_SERVICE_ACCOUNT     service account JSON for project testimoniesofpraiseapp
 */
import admin from 'firebase-admin';
import { cleanSegments, clipLabel } from './lib.mjs';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CLIP_VERSION = 1;
const MODEL = 'gemini-3.8-flash';
const EMBED_MODEL = 'models/gemini-embedding-001';
const EMBED_DIMENSIONS = 1024;
const GEMINI = 'https://generativelanguage.googleapis.com';
const MAX_VIDEOS = Number(process.env.MAX_VIDEOS || 3);
const MAX_MINUTES = Number(process.env.MAX_MINUTES || 130);
const MAX_BYTES = 1.5 * 1024 * 1024 * 1024;

const dryRun = process.argv.includes('--dry-run');
const geminiKey = process.env.GEMINI_API_KEY;
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;

const log = (...a) => console.log(new Date().toISOString(), ...a);

if (!serviceAccount) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set.');
if (!dryRun && !geminiKey) throw new Error('GEMINI_API_KEY is not set.');

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(serviceAccount)) });
const db = admin.firestore();

async function gemini(path, { method = 'POST', body, headers = {} } = {}) {
  const response = await fetch(`${GEMINI}${path}`, {
    method,
    headers: { 'x-goog-api-key': geminiKey, 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(600_000),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Gemini ${path.split('?')[0]} returned HTTP ${response.status}`);
  return data;
}

/** Downloads the public video file to a temporary path. */
async function download(url, dir) {
  const response = await fetch(url, { signal: AbortSignal.timeout(900_000) });
  if (!response.ok) throw new Error(`Video download failed (HTTP ${response.status})`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > MAX_BYTES) throw new Error('Video is larger than 1.5 GB; skipped.');
  const file = join(dir, 'video.mp4');
  writeFileSync(file, bytes);
  return { file, bytes: bytes.length };
}

/** Uploads to the Gemini File API (resumable) and waits until the file is ready. */
async function uploadToGemini(file, bytes, displayName) {
  const start = await fetch(`${GEMINI}/upload/v1beta/files`, {
    method: 'POST',
    headers: {
      'x-goog-api-key': geminiKey,
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(bytes),
      'X-Goog-Upload-Header-Content-Type': 'video/mp4',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: displayName } }),
  });
  const uploadUrl = start.headers.get('x-goog-upload-url');
  if (!start.ok || !uploadUrl) throw new Error(`Gemini upload start failed (HTTP ${start.status})`);

  const bodyBytes = readFileSync(file);
  const done = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Length': String(bodyBytes.length), 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize' },
    body: bodyBytes,
  });
  const uploaded = await done.json().catch(() => null);
  if (!done.ok || !uploaded?.file?.name) throw new Error(`Gemini upload failed (HTTP ${done.status})`);

  let info = uploaded.file;
  for (let i = 0; i < 60 && info.state !== 'ACTIVE'; i += 1) {
    if (info.state === 'FAILED') throw new Error('Gemini could not process this video.');
    await new Promise((r) => setTimeout(r, 5000));
    info = await gemini(`/v1beta/${info.name}`, { method: 'GET' });
  }
  if (info.state !== 'ACTIVE') throw new Error('Gemini took too long to process this video.');
  return info;
}

const PROMPT = `Split this testimony video into segments of about 10 to 30 seconds.
For each segment give:
- start and end as m:ss (or h:mm:ss) from the start of the video,
- description: one or two short factual sentences about what can be seen AND what is said (in the video's own language).
Describe only what is visible or audible. Do not guess names, do not identify anyone by their face, and do not add anything that is not shown.
Return only the JSON array.`;

async function analyseVideo(url) {
  const data = await gemini(`/v1beta/models/${MODEL}:generateContent`, {
    body: {
      contents: [{ parts: [{ file_data: { mime_type: 'video/mp4', file_uri: url } }, { text: PROMPT }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: { start: { type: 'STRING' }, end: { type: 'STRING' }, description: { type: 'STRING' } },
            required: ['start', 'end', 'description'],
          },
        },
        temperature: 0.2,
      },
    },
  });
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]';
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Gemini returned an unreadable answer for this video.');
  }
  return { raw, usage: data?.usageMetadata ?? {} };
}

async function embedClips(texts) {
  const data = await gemini(`/v1beta/${EMBED_MODEL}:batchEmbedContents`, {
    body: {
      requests: texts.map((text) => ({
        model: EMBED_MODEL,
        content: { parts: [{ text }] },
        taskType: 'RETRIEVAL_DOCUMENT',
        outputDimensionality: EMBED_DIMENSIONS,
      })),
    },
  });
  return (data?.embeddings ?? []).map((e) => e.values);
}

async function replaceClips(testimony, clips, embeddings) {
  const existing = await db.collection('testimonyClips').where('testimonyId', '==', testimony.id).get();
  const batch = db.batch();
  existing.docs.forEach((d) => batch.delete(d.ref));
  clips.forEach((clip, i) => {
    const ref = db.collection('testimonyClips').doc(`${testimony.id}_${String(i).padStart(3, '0')}`);
    batch.set(ref, {
      testimonyId: testimony.id,
      title: testimony.title,
      isPublished: true,
      startSec: clip.startSec,
      endSec: clip.endSec,
      startLabel: clipLabel(clip.startSec),
      description: clip.description,
      embedding: admin.firestore.FieldValue.vector(embeddings[i]),
      clipVersion: CLIP_VERSION,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
  batch.set(db.collection('testimonies').doc(testimony.id), {
    clipsVersion: CLIP_VERSION,
    clipCount: clips.length,
    clipsAnalyzedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  await batch.commit();
}

async function main() {
  const snap = await db.collection('testimonies').where('isPublished', '==', true).get();
  const pending = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((t) => typeof t.videoUrl === 'string' && /^https:\/\//.test(t.videoUrl) && t.clipsVersion !== CLIP_VERSION);

  const totalMinutes = pending.reduce((sum, t) => sum + (Number(t.duration) || 0) / 60, 0);
  log(`Published testimonies: ${snap.size}. Waiting for clips: ${pending.length} (about ${totalMinutes.toFixed(0)} minutes).`);
  if (dryRun) {
    for (const t of pending) log(`- ${t.id}: ${t.title} (${Math.round((Number(t.duration) || 0) / 60)} min)`);
    log('Dry run: nothing was analysed or written.');
    return;
  }

  let minutesUsed = 0;
  let done = 0;
  for (const t of pending) {
    if (done >= MAX_VIDEOS) break;
    const minutes = (Number(t.duration) || 0) / 60;
    if (minutesUsed + minutes > MAX_MINUTES && done > 0) break; // budget cap for one run
    const dir = mkdtempSync(join(tmpdir(), 'clips-'));
    try {
      log(`Analysing ${t.id} (${Math.round(minutes)} min)`);
      const { file, bytes } = await download(t.videoUrl, dir);
      const uploaded = await uploadToGemini(file, bytes, t.id);
      const { raw, usage } = await analyseVideo(uploaded.uri);
      const clips = cleanSegments(raw, Number(t.duration) || 0);
      if (clips.length === 0) throw new Error('No usable clips were returned.');
      const embeddings = await embedClips(clips.map((c) => c.description));
      if (embeddings.length !== clips.length) throw new Error('Embedding count did not match the clips.');
      await replaceClips(t, clips, embeddings);
      await gemini(`/v1beta/${uploaded.name}`, { method: 'DELETE' }).catch(() => undefined);
      log(`Saved ${clips.length} clips for ${t.id}. Tokens in: ${usage.promptTokenCount ?? '?'}, out: ${usage.candidatesTokenCount ?? '?'}`);
      minutesUsed += minutes;
      done += 1;
    } catch (e) {
      // One bad video never stops the rest; its status stays unset so it is retried next run.
      log(`Skipped ${t.id}: ${e.message}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
  log(`Run finished. Analysed ${done} video(s), about ${minutesUsed.toFixed(0)} minute(s).`);
}

main().catch((e) => {
  console.error('Clip analysis failed:', e.message);
  process.exitCode = 1;
});
