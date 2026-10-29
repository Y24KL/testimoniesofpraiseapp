/**
 * Generates draft voiceovers from APPROVED scripts with ElevenLabs. Run locally, never in the app.
 *
 *   npm run voiceovers:plan        -> lists what would be generated (no API calls, no cost)
 *   npm run voiceovers:generate    -> generates missing drafts into voiceover-drafts/ (git-ignored)
 *   npm run voiceovers:generate -- --force --id=feature.sponsor  -> regenerate one entry
 *
 * Only entries with status 'approved' and a script are generated. Existing drafts are kept unless
 * --force is given, so approved audio is never overwritten by accident. The API key is read from
 * .env.local (ELEVENLABS_API_KEY) and is never printed.
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { VOICEOVERS, VOICEOVER_CONFIG, type VoiceoverEntry } from '../src/voiceover/manifest.ts';

const root = resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const force = args.includes('--force');
// Safe by default: nothing is generated (and nothing is billed) unless --generate or --force is passed.
const dryRun = !args.includes('--generate') && !force;
const onlyId = args.find((a) => a.startsWith('--id='))?.slice('--id='.length);
const MAX_CHARS = 5000; // single-request limit used here; keeps each clip small and cheap to fix

function readKey(): string | null {
  const file = join(root, '.env.local');
  if (!existsSync(file)) return null;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*ELEVENLABS_API_KEY\s*=\s*(.*?)\s*$/);
    if (m) return m[1].replace(/^["']|["']$/g, '') || null;
  }
  return null;
}

const outPath = (e: VoiceoverEntry) => join(root, 'voiceover-drafts', `${e.id}.v${e.version}.mp3`);

const targets = Object.values(VOICEOVERS).filter((e) => e.status === 'approved' && e.script && (!onlyId || e.id === onlyId));
const awaiting = Object.values(VOICEOVERS).filter((e) => e.status === 'awaiting-script').map((e) => e.id);

console.log(`Approved entries: ${targets.length}. Awaiting script: ${awaiting.length} (${awaiting.join(', ')}).`);
if (targets.length === 0) {
  console.log('Nothing to generate. Add an approved script to src/voiceover/manifest.ts first.');
  process.exit(0);
}

for (const e of targets) {
  const script = e.script!.trim();
  if (script.length === 0 || script.length > MAX_CHARS) {
    console.error(`✖ ${e.id}: script must be 1–${MAX_CHARS} characters (now ${script.length}).`);
    process.exit(1);
  }
}

if (dryRun) {
  for (const e of targets) {
    const file = outPath(e);
    const state = existsSync(file) ? 'draft exists (kept; use --force to regenerate)' : 'will generate';
    console.log(`- ${e.id} v${e.version}: ${e.script!.trim().length} chars, voice ${e.voiceId ?? VOICEOVER_CONFIG.voiceId}, ${state}`);
  }
  console.log('Dry run: no API calls were made.');
  process.exit(0);
}

const apiKey = readKey();
if (!apiKey) {
  console.error('✖ ELEVENLABS_API_KEY is not set in .env.local. Run: npx -y @elevenlabs/cli@latest onboard init');
  process.exit(1);
}

mkdirSync(join(root, 'voiceover-drafts'), { recursive: true });

for (const e of targets) {
  const file = outPath(e);
  if (existsSync(file) && !force) {
    console.log(`= ${e.id} v${e.version}: draft already exists, skipped`);
    continue;
  }
  const voice = e.voiceId ?? VOICEOVER_CONFIG.voiceId;
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=${VOICEOVER_CONFIG.outputFormat}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({
      text: e.script!.trim(),
      model_id: VOICEOVER_CONFIG.modelId,
      voice_settings: VOICEOVER_CONFIG.voiceSettings,
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    // Status only: the response body can echo request details, so it is not printed.
    console.error(`✖ ${e.id}: ElevenLabs returned HTTP ${res.status}. No file was written.`);
    process.exitCode = 1;
    continue;
  }
  const bytes = Buffer.from(await res.arrayBuffer());
  writeFileSync(file, bytes);
  console.log(`✔ ${e.id} v${e.version}: ${(statSync(file).size / 1024).toFixed(0)} KB -> voiceover-drafts/${e.id}.v${e.version}.mp3`);
}
