import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const INSTALLATION_KEY = 'top:device:installation_id:v1';

let cachedInstallationId: string | null = null;

/**
 * Retrieves the persistent installation identifier for this application install.
 * On application uninstall/reinstall, AsyncStorage is cleared, producing a new
 * installation identifier that forces a fresh-authentication verification challenge.
 */
export async function getInstallationId(): Promise<string> {
  if (cachedInstallationId) {
    return cachedInstallationId;
  }

  try {
    const existing = await AsyncStorage.getItem(INSTALLATION_KEY);
    if (existing && existing.length > 10) {
      cachedInstallationId = existing;
      return existing;
    }

    const newId = Crypto.randomUUID();
    await AsyncStorage.setItem(INSTALLATION_KEY, newId);
    cachedInstallationId = newId;
    return newId;
  } catch {
    // Fallback if AsyncStorage fails
    if (!cachedInstallationId) {
      cachedInstallationId = Crypto.randomUUID();
    }
    return cachedInstallationId;
  }
}

/** Resets the local installation identifier (e.g. on full local data reset) */
export async function resetInstallationId(): Promise<void> {
  cachedInstallationId = null;
  try {
    await AsyncStorage.removeItem(INSTALLATION_KEY);
  } catch {
    /* best effort */
  }
}
