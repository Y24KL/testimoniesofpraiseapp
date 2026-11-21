/**
 * Personal home sections for the website (Praxiom Phase 2c), the same service the app uses:
 * POST /api/ai/home with the signed-in person's token. Cached per account in localStorage for CACHE_MS;
 * a small "shown but not opened" count per item keeps the same suggestion from staying on top forever.
 * Interests live in users/{uid}/private/discovery (owner only), shared with the app.
 */
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

// Same list, same order, as top-admin/worker/src/tags.js CONTENT_TAGS (checked by tests/contentTags.test.mjs).
export const INTEREST_TAGS = ['healing', 'salvation', 'deliverance', 'miracles', 'finances', 'family', 'marriage', 'youth', 'faith', 'hope', 'worship', 'missions'] as const;
export type InterestTag = (typeof INTEREST_TAGS)[number];
export const INTEREST_LABELS: Record<InterestTag, string> = {
  healing: 'Healing',
  salvation: 'Salvation',
  deliverance: 'Deliverance',
  miracles: 'Miracles',
  finances: 'Financial breakthrough',
  family: 'Family & children',
  marriage: 'Marriage',
  youth: 'Youth & students',
  faith: 'Faith',
  hope: 'Hope & encouragement',
  worship: 'Worship',
  missions: 'Missions & outreach',
};

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

const BASE = ((import.meta.env.VITE_AI_API_URL as string | undefined) || 'https://top-push-relay.gtrusouth116.workers.dev').replace(/\/+$/, '');
const CACHE_MS = 6 * 60 * 60 * 1000;
const TYPES: HomeItemType[] = ['testimony', 'written', 'article', 'lyrical', 'loveworld'];
const cacheKey = (uid: string) => `top:home:v1:${uid}`;
const exposureKey = (uid: string) => `top:home-exposure:v1:${uid}`;

function store(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
function readJson<T>(key: string): T | null {
  try {
    const raw = store()?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function writeJson(key: string, value: unknown) {
  try {
    store()?.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode or full storage: the page still works without the cache */
  }
}

const validItem = (x: unknown): x is HomeItem => {
  const i = x as HomeItem;
  return !!i && TYPES.includes(i.type) && typeof i.id === 'string' && typeof i.title === 'string' && typeof i.reasonText === 'string';
};
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

export function cachedHome(uid: string): { sections: HomeSections; fresh: boolean } | null {
  const c = readJson<{ at: number; data: unknown }>(cacheKey(uid));
  const sections = c ? readSections(c.data) : null;
  return sections ? { sections, fresh: Date.now() - (c?.at ?? 0) < CACHE_MS } : null;
}

export async function fetchHome(uid: string, refresh = false): Promise<HomeSections> {
  const user = auth.currentUser;
  if (!user || user.uid !== uid) throw new Error('Signed out');
  const token = await user.getIdToken();
  const res = await fetch(`${BASE}/api/ai/home`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ exposure: readJson<Record<string, number>>(exposureKey(uid)) ?? {}, refresh }),
  });
  if (!res.ok) throw new Error(`Home sections unavailable (${res.status})`);
  const sections = readSections(await res.json());
  if (!sections) throw new Error('Home sections unreadable');
  writeJson(cacheKey(uid), { at: Date.now(), data: sections });
  return sections;
}

export function clearHomeCache(uid: string) {
  try {
    store()?.removeItem(cacheKey(uid));
  } catch {
    /* nothing cached */
  }
}

export function markShown(uid: string, items: HomeItem[]) {
  const map = readJson<Record<string, number>>(exposureKey(uid)) ?? {};
  for (const i of items.slice(0, 10)) map[`${i.type}:${i.id}`] = Math.min(5, (map[`${i.type}:${i.id}`] ?? 0) + 1);
  writeJson(exposureKey(uid), Object.fromEntries(Object.entries(map).slice(-100)));
}

export function markOpened(uid: string, item: HomeItem) {
  const map = readJson<Record<string, number>>(exposureKey(uid)) ?? {};
  delete map[`${item.type}:${item.id}`];
  writeJson(exposureKey(uid), map);
}

// ---------------- interests (shared with the app) ----------------
export interface DiscoverySettings {
  interests: InterestTag[];
  optOut: boolean;
}

export function sanitizeInterests(input: unknown): InterestTag[] {
  if (!Array.isArray(input)) return [];
  const out: InterestTag[] = [];
  for (const v of input) if (typeof v === 'string' && (INTEREST_TAGS as readonly string[]).includes(v) && !out.includes(v as InterestTag)) out.push(v as InterestTag);
  return out.slice(0, 20);
}

const discoveryRef = (uid: string) => doc(db, 'users', uid, 'private', 'discovery');

export async function getDiscoverySettings(uid: string): Promise<DiscoverySettings> {
  const snap = await getDoc(discoveryRef(uid));
  const d = snap.exists() ? snap.data() : {};
  return { interests: sanitizeInterests(d.interests), optOut: d.optOut === true };
}

export async function saveDiscoverySettings(uid: string, next: DiscoverySettings): Promise<void> {
  await setDoc(discoveryRef(uid), { interests: sanitizeInterests(next.interests), optOut: next.optOut === true, updatedAt: serverTimestamp() });
}

export async function resetDiscovery(uid: string): Promise<void> {
  await deleteDoc(discoveryRef(uid));
}
