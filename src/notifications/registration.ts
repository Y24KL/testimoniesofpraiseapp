/**
 * Push registration manager (Notification System 3.0, step B). One place decides when to ask for permission,
 * fetches the Expo token and (Android) the phone's own Firebase token, and saves them with app version and
 * timezone under the signed-in account. Failures are recorded (never silently dropped) and retried with backoff;
 * the outcome is kept on the device for the diagnostics screen. Tokens are never logged.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { repo } from '@/api';
import { loadPrefs, pushPrefsPayload } from '@/storage/prefs';
import type { NotificationPrefs } from '@/types';
import { ensureAndroidChannel, setCurrentPushToken } from './push';
import {
  EMPTY_RECORD, errorCode, isRetryable, nextRetryDelay, permissionState, registrationSignature, shouldAutoAskPermission, shouldWrite,
  type PermissionStatus, type RegistrationRecord,
} from './registrationRules';

const RECORD_KEY = 'top.pushRegistration.v1';
const ASKED_KEY = 'top.pushPermissionAskedForVersion';
export const APP_VERSION = Constants.expoConfig?.version ?? 'unknown';

let record: RegistrationRecord = { ...EMPTY_RECORD };
let loaded = false;
let inFlight: Promise<RegistrationRecord> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<(r: RegistrationRecord) => void>();

async function load(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(RECORD_KEY);
    if (raw) record = { ...EMPTY_RECORD, ...JSON.parse(raw) };
  } catch {
    /* start fresh */
  }
}

async function save(patch: Partial<RegistrationRecord>): Promise<RegistrationRecord> {
  record = { ...record, ...patch };
  listeners.forEach((l) => l(record));
  await AsyncStorage.setItem(RECORD_KEY, JSON.stringify(record)).catch(() => undefined);
  return record;
}

export function getRegistration(): RegistrationRecord {
  return record;
}

export function subscribeRegistration(fn: (r: RegistrationRecord) => void): () => void {
  listeners.add(fn);
  void load().then(() => fn(record));
  return () => listeners.delete(fn);
}

function timeZoneInfo(): { timeZone?: string; utcOffsetMinutes: number } {
  let timeZone: string | undefined;
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    timeZone = undefined;
  }
  return { timeZone, utcOffsetMinutes: Math.max(-840, Math.min(840, -new Date().getTimezoneOffset())) };
}

/** Android only: the phone's own Firebase token, so the server can send notifications Android shows itself. */
async function fcmDeviceToken(): Promise<string | undefined> {
  if (Platform.OS !== 'android') return undefined;
  try {
    const t = await Notifications.getDevicePushTokenAsync();
    return typeof t.data === 'string' && t.data.length >= 20 && t.data.length <= 4096 ? t.data : undefined;
  } catch {
    return undefined;
  }
}

async function readPermission(): Promise<{ status: PermissionStatus; canAskAgain: boolean }> {
  const p = await Notifications.getPermissionsAsync();
  return { status: p.status as PermissionStatus, canAskAgain: p.canAskAgain !== false };
}

function scheduleRetry(uid: string, primerSeen: boolean): void {
  if (retryTimer) clearTimeout(retryTimer);
  const delay = nextRetryDelay(record.failures);
  if (delay === null) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void ensureRegistered(uid, { primerSeen, allowPrompt: false });
  }, delay);
}

export interface EnsureOptions {
  primerSeen: boolean;
  /** Allow the automatic once-per-version permission prompt (never on background refreshes). */
  allowPrompt?: boolean;
  /** Ask for permission now because the person tapped a button. */
  userInitiated?: boolean;
  /** Write to the server even if nothing changed (after a preference change). */
  force?: boolean;
  prefsOverride?: NotificationPrefs;
}

/**
 * Makes sure this phone is registered for the signed-in account. Safe to call often (launch, foreground,
 * permission change, token rotation): concurrent calls share one run, and unchanged records are written at most
 * once a day.
 */
export function ensureRegistered(uid: string, opts: EnsureOptions): Promise<RegistrationRecord> {
  if (inFlight) return inFlight;
  inFlight = run(uid, opts).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function run(uid: string, opts: EnsureOptions): Promise<RegistrationRecord> {
  await load();
  const now = Date.now();
  if (!Device.isDevice) return save({ state: 'unsupported', uid, lastAttemptAt: now });

  try {
    let p = await readPermission();
    if (p.status !== 'granted') {
      const asked = await AsyncStorage.getItem(ASKED_KEY).catch(() => null);
      const auto = opts.allowPrompt !== false && shouldAutoAskPermission({ status: p.status, canAskAgain: p.canAskAgain, primerSeen: opts.primerSeen, askedForVersion: asked, appVersion: APP_VERSION });
      if ((auto || opts.userInitiated) && p.canAskAgain) {
        await AsyncStorage.setItem(ASKED_KEY, APP_VERSION).catch(() => undefined);
        await ensureAndroidChannel();
        const r = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: true, allowSound: true } });
        p = { status: r.status as PermissionStatus, canAskAgain: r.canAskAgain !== false };
      }
    }
    if (p.status !== 'granted') {
      return save({ state: permissionState(p.status, p.canAskAgain), permission: p.status, uid, lastAttemptAt: now, errorCode: null, errorMessage: null });
    }

    await save({ state: 'registering', permission: 'granted', uid, lastAttemptAt: now });
    await ensureAndroidChannel();
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) throw Object.assign(new Error('Missing EAS project id in this build'), { code: 'missing-project-id' });
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    setCurrentPushToken(token);
    const fcmToken = await fcmDeviceToken();
    const prefs = pushPrefsPayload(opts.prefsOverride ?? (await loadPrefs()));
    const tz = timeZoneInfo();
    const signature = registrationSignature({ uid, token, fcmToken, appVersion: APP_VERSION, timeZone: tz.timeZone, prefs });
    const written = opts.force || shouldWrite(record, signature, now) || record.uid !== uid;
    if (written) {
      await repo.registerPushToken({ token, uid, platform: Platform.OS, prefs, fcmToken, appVersion: APP_VERSION, timeZone: tz.timeZone, utcOffsetMinutes: tz.utcOffsetMinutes });
    }
    if (retryTimer) clearTimeout(retryTimer);
    return save({
      state: 'registered',
      uid,
      tokenPreview: `${token.slice(0, 22)}…`,
      hasFcmToken: Boolean(fcmToken),
      permission: 'granted',
      ...(written ? { lastSuccessAt: now, lastWrittenSignature: signature } : {}),
      errorCode: null,
      errorMessage: null,
      failures: 0,
    });
  } catch (e) {
    const code = errorCode(e);
    if (__DEV__) console.warn('[push] registration failed:', code);
    const next = await save({ state: 'error', uid, errorCode: code, errorMessage: String((e as Error)?.message ?? '').slice(0, 160), failures: record.failures + 1 });
    if (isRetryable(code)) scheduleRetry(uid, opts.primerSeen);
    return next;
  }
}

/** Removes this phone's registration (on sign-out), so it stops receiving the previous account's notifications. */
export async function unregisterThisDevice(): Promise<void> {
  await load();
  if (retryTimer) clearTimeout(retryTimer);
  try {
    if (Device.isDevice && (await readPermission()).status === 'granted') {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
      if (projectId) {
        const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
        await repo.unregisterPushToken(token);
      }
    }
  } catch {
    /* best effort: the server also retires tokens that stop working */
  }
  setCurrentPushToken(null);
  await save({ ...EMPTY_RECORD, state: 'needs_permission' });
}
