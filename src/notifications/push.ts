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
