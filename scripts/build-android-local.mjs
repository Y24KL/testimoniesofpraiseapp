#!/usr/bin/env node
/**
 * Builds a signed release APK on this computer, without EAS Build (no monthly build limit).
 *
 *   npm run build:android:local            -> uses eas.json "preview" env (default)
 *   npm run build:android:local -- production
 *
 * What it does, mirroring an EAS build:
 *  1. Loads the EXPO_PUBLIC_* / ORG_GRADLE_PROJECT_* values from eas.json for the chosen profile.
 *  2. Regenerates the native android/ folder (npx expo prebuild --clean); it is gitignored.
 *  3. Signs with the SAME keystore EAS uses (credentials.json + credentials/android/keystore.jks,
 *     downloaded once with `npx eas-cli credentials -p android` → "Download credentials"), so the
 *     APK's SHA-1 matches the one registered in Firebase and installs over EAS-built versions.
 *  4. Runs Gradle assembleRelease and copies the APK to build-output/.
 *
 * Needs JDK 17 and the Android SDK. Defaults to C:\Users\hp\Android\{jdk-17,Sdk}; override with
 * JAVA_HOME / ANDROID_HOME. Secrets stay on disk: credentials.json and credentials/ are gitignored.
 */
import { spawnSync, execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import os from 'node:os';

const root = resolve(import.meta.dirname, '..');
const profile = process.argv[2] || 'preview';
const isWin = process.platform === 'win32';
const fail = (msg) => {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
};
const step = (msg) => console.log(`\n▶ ${msg}`);

// ---- toolchain -------------------------------------------------------------
const home = os.homedir();
const javaHome = process.env.JAVA_HOME && existsSync(join(process.env.JAVA_HOME, 'bin')) && !/jdk-?2[1-9]/i.test(process.env.JAVA_HOME)
  ? process.env.JAVA_HOME
  : join(home, 'Android', 'jdk-17');
const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || join(home, 'Android', 'Sdk');
if (!existsSync(join(javaHome, 'bin', isWin ? 'java.exe' : 'java'))) fail(`JDK 17 not found at ${javaHome}. Set JAVA_HOME to a JDK 17.`);
if (!existsSync(join(androidHome, 'platform-tools'))) fail(`Android SDK not found at ${androidHome}. Set ANDROID_HOME.`);

// ---- signing credentials (same keystore as EAS) -----------------------------
const credPath = join(root, 'credentials.json');
if (!existsSync(credPath)) {
  fail('credentials.json not found. Run `npx eas-cli credentials -p android`, choose the profile, then "credentials.json: Upload/Download credentials" → "Download credentials from EAS to credentials.json".');
}
const ks = JSON.parse(readFileSync(credPath, 'utf8'))?.android?.keystore;
if (!ks?.keystorePath || !ks.keystorePassword || !ks.keyAlias || !ks.keyPassword) fail('credentials.json has no complete android.keystore entry.');
const keystoreFile = resolve(root, ks.keystorePath);
if (!existsSync(keystoreFile)) fail(`Keystore file not found: ${keystoreFile}`);

// ---- environment from eas.json ----------------------------------------------
const eas = JSON.parse(readFileSync(join(root, 'eas.json'), 'utf8'));
const profileEnv = eas?.build?.[profile]?.env;
if (!profileEnv) fail(`eas.json has no build.${profile}.env`);
const env = {
  ...process.env,
  ...profileEnv,
  NODE_ENV: 'production',
  JAVA_HOME: javaHome,
  ANDROID_HOME: androidHome,
  ANDROID_SDK_ROOT: androidHome,
  PATH: [join(javaHome, 'bin'), join(androidHome, 'platform-tools'), process.env.PATH].join(isWin ? ';' : ':'),
  TOP_KEYSTORE_PATH: keystoreFile,
  TOP_KEYSTORE_PASSWORD: ks.keystorePassword,
  TOP_KEY_ALIAS: ks.keyAlias,
  TOP_KEY_PASSWORD: ks.keyPassword,
};

const run = (cmd, args, cwd = root) => {
  const r = spawnSync(cmd, args, { cwd, env, stdio: 'inherit', shell: isWin });
  if (r.status !== 0) fail(`${cmd} ${args.join(' ')} failed (exit ${r.status}).`);
};

// ---- 1. native project --------------------------------------------------------
step(`Generating the native Android project (profile: ${profile})`);
run('npx', ['expo', 'prebuild', '--platform', 'android', '--clean', '--no-install']);

const androidDir = join(root, 'android');
// CMake 3.22.1 (Android's default) bundles ninja 1.10, which fails on Windows with "Filename longer
// than 260 characters" because React Native's C++ object paths embed the project path twice.
// ninja 1.12 (CMake 3.31+) handles long paths when Windows LongPathsEnabled is on.
const props = [`sdk.dir=${androidHome.replace(/\\/g, '\\\\')}`];
const cmakeRoot = join(androidHome, 'cmake');
const newestCmake = existsSync(cmakeRoot)
  ? readdirSync(cmakeRoot)
      .filter((v) => /^\d+\.\d+\.\d+$/.test(v) && v.startsWith('3.') && Number(v.split('.')[1]) >= 31)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .pop()
  : undefined;
if (newestCmake) props.push(`cmake.dir=${join(cmakeRoot, newestCmake).replace(/\\/g, '\\\\')}`);
else if (isWin) console.warn('  ! CMake 3.31+ not found in the SDK; the C++ build may hit the 260-character path limit.');
writeFileSync(join(androidDir, 'local.properties'), props.join('\n') + '\n');

// ---- 2. release signing --------------------------------------------------------
step('Configuring release signing with the EAS keystore');
const gradleFile = join(androidDir, 'app', 'build.gradle');
let gradle = readFileSync(gradleFile, 'utf8');
if (!gradle.includes('TOP_KEYSTORE_PATH')) {
  gradle = gradle.replace(
    /signingConfigs\s*\{/,
    `signingConfigs {
        release {
            storeFile file(System.getenv("TOP_KEYSTORE_PATH"))
            storePassword System.getenv("TOP_KEYSTORE_PASSWORD")
            keyAlias System.getenv("TOP_KEY_ALIAS")
            keyPassword System.getenv("TOP_KEY_PASSWORD")
        }`,
  );
  const before = gradle;
  gradle = gradle.replace(/(release\s*\{[^{}]*?)signingConfig\s+signingConfigs\.debug/, '$1signingConfig signingConfigs.release');
  if (gradle === before) fail('Could not find the release signingConfig in android/app/build.gradle (Expo template changed?).');
  writeFileSync(gradleFile, gradle);
}

// ---- 3. build -----------------------------------------------------------------------
step('Building the release APK with Gradle (first run downloads dependencies: 10-30 min)');
const gradleArgs = ['assembleRelease', '--no-daemon', '-x', 'lint'];
if (isWin) {
  // .bat files must go through cmd.exe; quote the full path because the project folder may contain spaces.
  const r = spawnSync('cmd.exe', ['/d', '/s', '/c', `""${join(androidDir, 'gradlew.bat')}" ${gradleArgs.join(' ')}"`], {
    cwd: androidDir,
    env,
    stdio: 'inherit',
    windowsVerbatimArguments: true,
  });
  if (r.status !== 0) fail(`Gradle build failed (exit ${r.status}). Scroll up for the first "What went wrong".`);
} else {
  run('./gradlew', gradleArgs, androidDir);
}

const apk = join(androidDir, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
if (!existsSync(apk)) fail('Gradle finished but app-release.apk was not found.');

let sha = 'local';
try {
  sha = execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim();
} catch {
  /* not a git checkout */
}
const version = JSON.parse(execSync('npx expo config --json --type public', { cwd: root, env }).toString()).version;
mkdirSync(join(root, 'build-output'), { recursive: true });
const out = join(root, 'build-output', `testimonies-of-praise-${version}-${profile}-${sha}.apk`);
copyFileSync(apk, out);

// ---- 4. verify signature ---------------------------------------------------------------
const apksigner = join(androidHome, 'build-tools', '36.0.0', 'lib', 'apksigner.jar');
if (existsSync(apksigner)) {
  const r = spawnSync(join(javaHome, 'bin', 'java'), ['-jar', apksigner, 'verify', '--print-certs', out], { env, encoding: 'utf8' });
  const line = (r.stdout || '').split('\n').find((l) => /SHA-1/.test(l));
  console.log(`\n  Signer: ${line ? line.trim() : 'could not read'}`);
}
console.log(`\n✔ APK ready: ${out}\n`);
