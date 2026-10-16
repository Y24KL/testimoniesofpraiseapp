import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/constants/config';

export async function getReadArticleIds(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.articlesRead);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

export async function markArticleAsRead(id: string): Promise<void> {
  try {
    const current = await getReadArticleIds();
    current.add(id);
    await AsyncStorage.setItem(STORAGE_KEYS.articlesRead, JSON.stringify(Array.from(current)));
  } catch {
    /* best effort */
  }
}
