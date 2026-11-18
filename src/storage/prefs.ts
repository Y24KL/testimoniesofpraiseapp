import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/constants/config';
import type { NotificationPrefs } from '@/types';

export const DEFAULT_PREFS: NotificationPrefs = {
  testimonies: true,
  live: true,
  announcements: true,
  promotions: true,
  choirs: true,
  loveworld: true,
  articles: true,
};

export async function loadPrefs(): Promise<NotificationPrefs> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.prefs);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

/**
 * The preference fields the server accepts (firestore.rules, validPushPrefs). Anything else stored on the
 * device is dropped before it is sent, so a stray key can never make the token write fail silently.
 */
export function pushPrefsPayload(p: Partial<NotificationPrefs>): Record<string, boolean> {
  const out: Record<string, boolean> = { ...DEFAULT_PREFS };
  for (const key of Object.keys(DEFAULT_PREFS) as (keyof NotificationPrefs)[]) {
    if (typeof p[key] === 'boolean') out[key] = p[key] as boolean;
  }
  return out;
}

export async function savePrefs(p: NotificationPrefs): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.prefs, JSON.stringify(p));
}
