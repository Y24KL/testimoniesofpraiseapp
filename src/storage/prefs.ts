import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/constants/config';
import type { NotificationPrefs } from '@/types';

export const DEFAULT_PREFS: NotificationPrefs = { testimonies: true, resources: true, live: true, announcements: true };

export async function loadPrefs(): Promise<NotificationPrefs> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.prefs);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export async function savePrefs(p: NotificationPrefs): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.prefs, JSON.stringify(p));
}
