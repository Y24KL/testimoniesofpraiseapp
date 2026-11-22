#!/usr/bin/env node
/**
 * Checks which key signed an APK before it is shared with users.
 *
 * Android only installs an update over the existing app when BOTH are signed with the same key; otherwise
 * people see "App not installed" / "uninstall the old version first" and lose their data on the phone.
 * Every T.O.P APK must therefore be signed with the one release key that EAS keeps for this project.
 *
 *   npm run apk:check -- path/to/app.apk [more.apk ...]
 *
 * Exit code 1 when an APK is signed with any other key (for example the public React Native debug key that a
 * plain `expo run:android --variant release` or a Gradle build without credentials uses).
 * Reads the v2/v3 APK Signature Block directly, so no Android SDK is needed. Fingerprints are public, not secrets.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';

/** SHA-1 of the T.O.P release key held by EAS (Expo account → project → Credentials → Android). */
export const RELEASE_SHA1 = process.env.TOP_RELEASE_SHA1 || '2C:79:DC:F4:8D:15:F5:5A:33:A5:DF:B9:A8:E1:C8:B9:22:1C:DC:F3';
/** The public debug key from the React Native / Expo template. An APK signed with it can never update a release. */
const DEBUG_SHA1 = '5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25';

const hex = (buf, algo) => crypto.createHash(algo).update(buf).digest('hex').toUpperCase().match(/../g).join(':');

export function apkSigner(file) {
  const b = fs.readFileSync(file);
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 70_000); i--) {
    if (b.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('not a zip/APK file');
  const cdOffset = b.readUInt32LE(eocd + 16);
  if (b.toString('latin1', cdOffset - 16, cdOffset) !== 'APK Sig Block 42') throw new Error('no APK Signature Block (v2/v3) found');
  const size = Number(b.readBigUInt64LE(cdOffset - 24));
  let p = cdOffset - size;
  const end = cdOffset - 24;
  while (p < end) {
    const len = Number(b.readBigUInt64LE(p));
    const id = b.readUInt32LE(p + 8);
    const v = b.subarray(p + 12, p + 8 + len);
    if (id === 0x7109871a || id === 0xf05368c0) {
      // signers → signer → signed data → (digests, certificates → first certificate)
      let q = 12;
      q += 4 + v.readUInt32LE(q); // digests
      q += 4; // certificates sequence
      const certLen = v.readUInt32LE(q);
      const cert = v.subarray(q + 4, q + 4 + certLen);
      return { sha1: hex(cert, 'sha1'), sha256: hex(cert, 'sha256'), scheme: id === 0x7109871a ? 'v2' : 'v3' };
    }
    p += 8 + len;
  }
  throw new Error('APK Signature Block has no v2/v3 signer');
}

const files = process.argv.slice(2);
if (!files.length) {
  console.error('Usage: npm run apk:check -- path/to/app.apk');
  process.exit(2);
}
let bad = 0;
for (const f of files) {
  try {
    const s = apkSigner(f);
    const ok = s.sha1 === RELEASE_SHA1;
    if (!ok) bad += 1;
    console.log(`${ok ? '✔' : '✘'} ${f}\n    SHA-1   ${s.sha1}\n    SHA-256 ${s.sha256}`);
    if (s.sha1 === DEBUG_SHA1) console.log('    This is the public DEBUG key. Do not share this APK: it cannot update the installed app.');
    else if (!ok) console.log(`    Not the T.O.P release key (${RELEASE_SHA1}). Phones would have to uninstall to install it.`);
  } catch (e) {
    bad += 1;
    console.log(`✘ ${f}: ${e.message}`);
  }
}
process.exit(bad ? 1 : 0);
