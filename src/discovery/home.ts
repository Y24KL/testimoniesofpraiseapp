/**
 * Personal home sections (Praxiom Phase 2c): For You, Continue, New in your interests, Featured.
 * The Worker builds them from the person's own interests and history (POST /api/ai/home, caller's token).
 * Results are cached on the device per account for CACHE_MS so the home screen opens instantly and the
 * server is asked at most a few times a day. The device also keeps a small "shown but not opened" count
 * per item, so the same suggestion does not stay at the top forever.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '@/api/firebase';
import { CONFIG } from '@/constants/config';
import { recordActivity } from './activity';
import type { ContentType } from './rules';

export type HomeItemType = 'testimony' | 'written' | 'article' | 'lyrical' | 'loveworld';

export interface HomeItem {
  type: HomeItemType;
  id: string;
  title: string;
  subtitle: string;
  thumbnail: string | null;
  duration: number | null;
  tags: string[];
  reason: string;
  reasonText: string;
  positionSec?: number;
  durationSec?: number;
}

export interface HomeSections {
  personalized: boolean;
  interests: string[];
  forYou: HomeItem[];
  newInInterests: HomeItem[];
  featured: HomeItem[];
  continue: HomeItem[];
  generatedAt: number;
}

const CACHE_MS = 6 * 60 * 60 * 1000;
const cacheKey = (uid: string) => `top:home:v1:${uid}`;
const exposureKey = (uid: string) => `top:home-exposure:v1:${uid}`;
const TYPES: HomeItemType[] = ['testimony', 'written', 'article', 'lyrical', 'loveworld'];

function validItem(x: unknown): x is HomeItem {
  const i = x as HomeItem;
  return !!i && TYPES.includes(i.type) && typeof i.id === 'string' && typeof i.title === 'string' && typeof i.reasonText === 'string';
}

function readSections(raw: unknown): HomeSections | null {
  const r = raw as Partial<HomeSections> | null;
  if (!r || typeof r !== 'object') return null;
  const list = (v: unknown) => (Array.isArray(v) ? v.filter(validItem) : []);
  return {
    personalized: r.personalized === true,
    interests: Array.isArray(r.interests) ? r.interests.filter((t) => typeof t === 'string') : [],
    forYou: list(r.forYou),
    newInInterests: list(r.newInInterests),
    featured: list(r.featured),
    continue: list(r.continue),
    generatedAt: Number(r.generatedAt) || 0,
  };
}

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function cachedHome(uid: string): Promise<{ sections: HomeSections; fresh: boolean } | null> {
  const c = await readJson<{ at: number; data: unknown }>(cacheKey(uid));
  const sections = c ? readSections(c.data) : null;
  return sections ? { sections, fresh: Date.now() - (c?.at ?? 0) < CACHE_MS } : null;
}

/** Asks the Worker for fresh sections. Throws on failure; callers keep showing the cached copy. */
export async function fetchHome(uid: string, refresh = false): Promise<HomeSections> {
  const user = auth.currentUser;
  if (!user || user.uid !== uid) throw new Error('Signed out');
  const token = await user.getIdToken();
  const exposure = (await readJson<Record<string, number>>(exposureKey(uid))) ?? {};
  const res = await fetch(`${CONFIG.authApiUrl}/api/ai/home`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ exposure, refresh }),
  });
  if (!res.ok) throw new Error(`Home sections unavailable (${res.status})`);
  const sections = readSections(await res.json());
  if (!sections) throw new Error('Home sections unreadable');
  await AsyncStorage.setItem(cacheKey(uid), JSON.stringify({ at: Date.now(), data: sections })).catch(() => undefined);
  return sections;
}

export async function clearHomeCache(uid: string): Promise<void> {
  await AsyncStorage.removeItem(cacheKey(uid)).catch(() => undefined);
}

/** Counts one showing of the top suggestions (called once per new set of sections). */
export async function markShown(uid: string, items: HomeItem[]): Promise<void> {
  const map = (await readJson<Record<string, number>>(exposureKey(uid))) ?? {};
  for (const i of items.slice(0, 10)) map[`${i.type}:${i.id}`] = Math.min(5, (map[`${i.type}:${i.id}`] ?? 0) + 1);
  const trimmed = Object.fromEntries(Object.entries(map).slice(-100));
  await AsyncStorage.setItem(exposureKey(uid), JSON.stringify(trimmed)).catch(() => undefined);
}

const ACTIVITY_TYPE: Partial<Record<HomeItemType, ContentType>> = { testimony: 'testimony', written: 'written', article: 'article', lyrical: 'lyrical' };

/** Records that a suggestion was opened: clears its "shown" count and logs a home view. */
export async function markOpened(uid: string, item: HomeItem): Promise<void> {
  const map = (await readJson<Record<string, number>>(exposureKey(uid))) ?? {};
  delete map[`${item.type}:${item.id}`];
  await AsyncStorage.setItem(exposureKey(uid), JSON.stringify(map)).catch(() => undefined);
  const contentType = ACTIVITY_TYPE[item.type];
  if (contentType) recordActivity({ type: 'view', contentType, contentId: item.id, source: 'home' });
}
