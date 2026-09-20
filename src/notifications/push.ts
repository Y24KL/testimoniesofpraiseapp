import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { repo } from '@/api';
import { loadPrefs } from '@/storage/prefs';
import type { NotificationPrefs } from '@/types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Testimonies of Praise',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 200, 100, 200],
    lightColor: '#4B006E',
  });
}

export async function getPermissionStatus() {
  const p = await Notifications.getPermissionsAsync();
  return p.status; // 'granted' | 'denied' | 'undetermined'
}

/** Triggers the OFFICIAL OS permission dialog. Call only after explaining why (see NotificationPrimerScreen). */
export async function requestPermission(): Promise<boolean> {
  await ensureAndroidChannel();
  const res = await Notifications.requestPermissionsAsync();
  return res.status === 'granted';
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
