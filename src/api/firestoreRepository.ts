import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit as qLimit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  where,
  type DocumentData,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { Platform } from 'react-native';
import { CONFIG } from '@/constants/config';
import type { Page } from '@/types';
import { db } from './firebase';
import { normalizeLive, normalizeNotification, normalizeTestimony } from './normalize';
import type { ContentRepository, PageOptions } from './repository';

async function getPage<T>(
  col: string,
  map: (id: string, d: DocumentData) => T,
  { limit, cursor, featuredOnly }: PageOptions,
): Promise<Page<T>> {
  // NOTE: where(isPublished) + orderBy(createdAt) needs a composite index; Firestore logs a
  // console link to create it the first time this query runs.
  const c: QueryConstraint[] = [where('isPublished', '==', true)];
  if (featuredOnly) c.push(where('isFeatured', '==', true));
  c.push(orderBy('createdAt', 'desc'));
  if (cursor) c.push(startAfter(cursor as QueryDocumentSnapshot));
  c.push(qLimit(limit));
  const snap = await getDocs(query(collection(db, col), ...c));
  return {
    items: snap.docs.map((d) => map(d.id, d.data())),
    cursor: snap.docs[snap.docs.length - 1],
    hasMore: snap.docs.length === limit,
  };
}

async function getOne<T>(col: string, id: string, map: (id: string, d: DocumentData) => T & { isPublished: boolean }) {
  const s = await getDoc(doc(db, col, id));
  if (!s.exists()) return null;
  const item = map(s.id, s.data());
  return item.isPublished ? item : null;
}

const tokenDocId = (t: string) => t.replace(/\//g, '_');

export const firestoreRepository: ContentRepository = {
  getTestimonies: (o) => getPage(CONFIG.collections.testimonies, normalizeTestimony, o),
  getTestimony: (id) => getOne(CONFIG.collections.testimonies, id, normalizeTestimony),

  async getNotifications(max) {
    const snap = await getDocs(
      query(
        collection(db, CONFIG.collections.notifications),
        where('published', '==', true),
        orderBy('createdAt', 'desc'),
        qLimit(max),
      ),
    );
    return snap.docs.map((d) => normalizeNotification(d.id, d.data()));
  },

  subscribeLive(cb, onError) {
    return onSnapshot(
      doc(db, CONFIG.collections.liveDoc),
      (s) => cb(normalizeLive(s.exists() ? s.data() : null)),
      (e) => onError?.(e),
    );
  },

  async submitTestimony(input) {
    await addDoc(collection(db, CONFIG.collections.submissions), {
      fullName: input.fullName,
      churchZone: input.churchZone,
      testimony: input.testimony,
      userId: input.userId ?? null,
      userEmail: input.userEmail ?? null,
      source: 'mobile',
      status: 'pending',
      createdAt: serverTimestamp(),
    });
  },

  async registerPushToken({ token, uid, platform, prefs }) {
    await setDoc(
      doc(db, CONFIG.collections.pushTokens, tokenDocId(token)),
      { token, uid, platform, prefs, updatedAt: serverTimestamp() },
      { merge: true },
    );
  },

  async unregisterPushToken(token) {
    await deleteDoc(doc(db, CONFIG.collections.pushTokens, tokenDocId(token)));
  },

  async recordEvent(event, params, uid) {
    await addDoc(collection(db, CONFIG.collections.analytics), {
      event,
      params,
      uid: uid ?? null,
      platform: Platform.OS,
      ts: serverTimestamp(),
    });
  },
};
