import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Linking, Platform } from 'react-native';
import { repo } from '@/api';
import { loadPrefs } from '@/storage/prefs';
import type { NotificationPrefs } from '@/types';

// NOTE: The global notification handler is set once in App.tsx.
// Do NOT set a second handler here — the last registration wins and can suppress banners.

/**
 * Creates the high-importance Android notification channel required for
 * system dropdown / heads-up banners on Android 8.0+ (API 26+).
 */
export async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Testimonies of Praise',
    description: 'Notifications for new testimonies, live broadcasts, and announcements',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 150, 250],
    lightColor: '#4B006E',
    enableLights: true,
    enableVibrate: true,
    showBadge: true,
    sound: 'default',
  });
}

export async function getPermissionStatus(): Promise<Notifications.PermissionStatus> {
  const p = await Notifications.getPermissionsAsync();
  return p.status; // 'granted' | 'denied' | 'undetermined'
}

/**
 * Triggers the OFFICIAL OS permission dialog requesting alert, sound, and badge.
 */
export async function requestPermission(): Promise<boolean> {
  await ensureAndroidChannel();
  const res = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  });
  return res.status === 'granted';
}

/**
 * Opens system application settings so the user can enable notifications after denial.
 */
export async function openNotificationSettings(): Promise<void> {
  if (Platform.OS === 'ios') {
    await Linking.openURL('app-settings:');
  } else {
    await Linking.openSettings();
  }
}

let currentToken: string | null = null;
export const getCurrentPushToken = () => currentToken;

/**
 * Fetches the Expo push token (requires permission already granted) and associates it with the user
 * on the backend. Safe to call on every launch.
 */
export async function registerPushToken(uid: string, prefsOverride?: NotificationPrefs): Promise<string | null> {
  if (!Device.isDevice) return null; // push does not work on simulators
  if ((await getPermissionStatus()) !== 'granted') return null;
  await ensureAndroidChannel();
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return null;
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  currentToken = token;
  const prefs = prefsOverride ?? (await loadPrefs());
  await repo.registerPushToken({ token, uid, platform: Platform.OS, prefs: { ...prefs } });
  return token;
}

export async function unregisterPushToken(): Promise<void> {
  if (!currentToken) return;
  try {
    await repo.unregisterPushToken(currentToken);
  } catch {
    /* best effort */
  }
  currentToken = null;
}

export interface PushCheckStep {
  label: string;
  ok: boolean;
  detail: string;
}

const EXPO_PUSH = 'https://exp.host/--/api/v2/push';
const errText = (e: unknown) => {
  const x = e as { code?: string; message?: string };
  return [x?.code, x?.message].filter(Boolean).join(': ').slice(0, 200) || String(e).slice(0, 200);
};

/**
 * Step-by-step check of push on THIS phone, ending with a real push sent through Expo/FCM to its
 * own token (so the user sees the drop-down and we see Google's delivery receipt). Registration
 * normally swallows errors; this surfaces them so a "no notification" report can be diagnosed.
 */
export async function diagnosePush(uid: string): Promise<PushCheckStep[]> {
  const steps: PushCheckStep[] = [];
  const add = (label: string, ok: boolean, detail: string) => {
    steps.push({ label, ok, detail });
    return ok;
  };

  if (!add('Real device', Device.isDevice, Device.isDevice ? `${Platform.OS} ${Device.osVersion ?? ''}`.trim() : 'Push does not work on emulators')) return steps;

  const perm = await getPermissionStatus();
  if (!add('Notification permission', perm === 'granted', perm === 'granted' ? 'Allowed' : `Not allowed (${perm}). Turn it on above or in Android settings.`)) return steps;

  try {
    await ensureAndroidChannel();
    const ch = Platform.OS === 'android' ? await Notifications.getNotificationChannelAsync('default') : null;
    const importance = ch?.importance ?? null;
    add('Drop-down (heads-up) channel', Platform.OS !== 'android' || (importance !== null && importance >= Notifications.AndroidImportance.HIGH),
      Platform.OS !== 'android' ? 'Not needed on iOS' : importance === null ? 'Channel missing' : importance >= Notifications.AndroidImportance.HIGH ? 'High importance' : 'Set to low in Android settings: change "Testimonies of Praise" to "Alert/Pop on screen"');
  } catch (e) {
    add('Drop-down (heads-up) channel', false, errText(e));
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!add('App push project', Boolean(projectId), projectId ? String(projectId) : 'Missing EAS projectId in the build')) return steps;

  let token = '';
  try {
    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    currentToken = token;
    add('Push address from Google/Expo', true, `${token.slice(0, 22)}…`);
  } catch (e) {
    add('Push address from Google/Expo', false, errText(e));
    return steps;
  }

  try {
    const prefs = await loadPrefs();
    await repo.registerPushToken({ token, uid, platform: Platform.OS, prefs: { ...prefs } });
    const off = Object.entries(prefs).filter(([, v]) => !v).map(([k]) => k);
    add('Saved to the server', true, off.length ? `Saved. Switched off here: ${off.join(', ')}` : 'Saved. All notification types on');
  } catch (e) {
    add('Saved to the server', false, errText(e));
  }

  try {
    const res = await fetch(`${EXPO_PUSH}/send`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: token,
        title: 'Testimonies of Praise',
        body: 'Test notification: if you can see this drop down, notifications work on this phone.',
        sound: 'default',
        channelId: 'default',
        priority: 'high',
        data: { type: 'announcement', isDiagnostic: true },
      }),
    });
    const json = await res.json();
    const ticket = json?.data;
    if (!res.ok || ticket?.status !== 'ok') {
      add('Test push accepted by Expo', false, ticket?.message || json?.errors?.[0]?.message || `HTTP ${res.status}`);
      return steps;
    }
    add('Test push accepted by Expo', true, 'Sent. It should drop down within a few seconds');
    await new Promise((r) => setTimeout(r, 6000));
    const rr = await fetch(`${EXPO_PUSH}/getReceipts`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [ticket.id] }),
    });
    const receipt = (await rr.json())?.data?.[ticket.id];
    if (!receipt) add('Delivered by Google (FCM)', true, 'No receipt yet (normal for a few seconds). If nothing dropped down, run the check again');
    else add('Delivered by Google (FCM)', receipt.status === 'ok', receipt.status === 'ok' ? 'Delivered to this phone' : `${receipt.details?.error ?? 'Error'}: ${receipt.message ?? ''}`.slice(0, 200));
  } catch (e) {
    add('Test push accepted by Expo', false, errText(e));
  }
  return steps;
}

/**
 * Diagnostic local notification to verify heads-up dropdown banner presentation on device.
 */
export async function triggerLocalDiagnosticNotification(): Promise<void> {
  await ensureAndroidChannel();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Testimonies of Praise - Banner Check',
      body: 'Your notification system is working! Dropdown banners and alerts are active.',
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.HIGH,
      data: { type: 'announcement', isDiagnostic: true },
    },
    trigger: null, // triggers immediately
  });
}
