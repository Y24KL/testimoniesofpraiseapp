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
import {
  normalizeAdotopoc,
  normalizeArticle,
  normalizeAudioTestimony,
  normalizeLive,
  normalizeNotification,
  normalizePromotion,
  normalizeRadio,
  normalizeTestimony,
} from './normalize';
import type { ContentRepository, PageOptions } from './repository';

async function getPage<T>(
  col: string,
  map: (id: string, d: DocumentData) => T,
  { limit, cursor, featuredOnly }: PageOptions,
): Promise<Page<T>> {
  try {
    // NOTE: where(isPublished) + orderBy(createdAt) needs a composite index in firestore.indexes.json
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
  } catch (e) {
    if ((e as { code?: string })?.code === 'permission-denied') {
      return { items: [], cursor: undefined, hasMore: false };
    }
    throw e;
  }
}

async function getOne<T>(col: string, id: string, map: (id: string, d: DocumentData) => T & { isPublished: boolean }) {
  try {
    const s = await getDoc(doc(db, col, id));
    if (!s.exists()) return null;
    const item = map(s.id, s.data());
    return item.isPublished ? item : null;
  } catch (e) {
    // Unpublished documents or restricted read access: treat as unavailable
    if ((e as { code?: string })?.code === 'permission-denied') return null;
    throw e;
  }
}

const tokenDocId = (t: string) => t.replace(/\//g, '_');

export const firestoreRepository: ContentRepository = {
  getTestimonies: (o) => getPage(CONFIG.collections.testimonies, normalizeTestimony, o),
  getTestimony: (id) => getOne(CONFIG.collections.testimonies, id, normalizeTestimony),

  async getNotifications(max) {
    try {
      const snap = await getDocs(
        query(
          collection(db, CONFIG.collections.notifications),
          where('published', '==', true),
          orderBy('createdAt', 'desc'),
          qLimit(max),
        ),
      );
      return snap.docs.map((d) => normalizeNotification(d.id, d.data()));
    } catch (e) {
      if ((e as { code?: string })?.code === 'permission-denied') return [];
      throw e;
    }
  },

  subscribeLive(cb, onError) {
    return onSnapshot(
      doc(db, CONFIG.collections.liveDoc),
      (s) => cb(normalizeLive(s.exists() ? s.data() : null)),
      (e) => {
        if ((e as { code?: string })?.code === 'permission-denied') {
          cb(normalizeLive(null));
        } else {
          onError?.(e);
        }
      },
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
      params: JSON.parse(JSON.stringify(params)), // Firestore rejects `undefined` values
      uid: uid ?? null,
      platform: Platform.OS,
      ts: serverTimestamp(),
    });
  },

  async getPromotions() {
    try {
      let snap = await getDocs(
        query(
          collection(db, CONFIG.collections.promotions),
          where('isPublished', '==', true),
          orderBy('order', 'asc'),
        ),
      );
      if (snap.empty) {
        try {
          const altSnap = await getDocs(
            query(
              collection(db, CONFIG.collections.promotions),
              where('published', '==', true),
              orderBy('order', 'asc'),
            ),
          );
          if (!altSnap.empty) snap = altSnap;
        } catch {
          // ignore secondary schema query errors
        }
      }
      return snap.docs.map((d) => normalizePromotion(d.id, d.data()));
    } catch (e) {
      if ((e as { code?: string })?.code === 'permission-denied') return [];
      throw e;
    }
  },

  async getArticles(max = 20) {
    try {
      let snap = await getDocs(
        query(
          collection(db, CONFIG.collections.articles),
          where('isPublished', '==', true),
          orderBy('createdAt', 'desc'),
          qLimit(max),
        ),
      );

      // Schema fallback if documents were saved with published: true
      if (snap.empty) {
        try {
          const altSnap = await getDocs(
            query(
              collection(db, CONFIG.collections.articles),
              where('published', '==', true),
              orderBy('createdAt', 'desc'),
              qLimit(max),
            ),
          );
          if (!altSnap.empty) snap = altSnap;
        } catch {
          // ignore secondary schema query errors
        }
      }

      return snap.docs.map((d) => normalizeArticle(d.id, d.data()));
    } catch (e) {
      if ((e as { code?: string })?.code === 'permission-denied') return [];
      throw e;
    }
  },

  getArticle(id) {
    return getOne(CONFIG.collections.articles, id, normalizeArticle);
  },

  async getAudioTestimonies(max = 30) {
    try {
      let snap = await getDocs(
        query(
          collection(db, CONFIG.collections.audioTestimonies),
          where('isPublished', '==', true),
          orderBy('createdAt', 'desc'),
          qLimit(max),
        ),
      );

      if (snap.empty) {
        try {
          const altSnap = await getDocs(
            query(
              collection(db, CONFIG.collections.audioTestimonies),
              where('published', '==', true),
              orderBy('createdAt', 'desc'),
              qLimit(max),
            ),
          );
          if (!altSnap.empty) snap = altSnap;
        } catch {
          // ignore secondary schema query errors
        }
      }

      return snap.docs.map((d) => normalizeAudioTestimony(d.id, d.data()));
    } catch (e) {
      if ((e as { code?: string })?.code === 'permission-denied') return [];
      throw e;
    }
  },

  async getRadioConfig() {
    try {
      const snap = await getDoc(doc(db, CONFIG.collections.radioDoc));
      return normalizeRadio(snap.exists() ? snap.data() : null);
    } catch (e) {
      if ((e as { code?: string })?.code === 'permission-denied') return normalizeRadio(null);
      throw e;
    }
  },

  subscribeRadio(cb, onError) {
    return onSnapshot(
      doc(db, CONFIG.collections.radioDoc),
      (s) => cb(normalizeRadio(s.exists() ? s.data() : null)),
      (e) => {
        if ((e as { code?: string })?.code === 'permission-denied') {
          cb(normalizeRadio(null));
        } else {
          onError?.(e);
        }
      },
    );
  },

  async getAdotopocConfig() {
    try {
      const snap = await getDoc(doc(db, CONFIG.collections.adotopocDoc));
      return normalizeAdotopoc(snap.exists() ? snap.data() : null);
    } catch (e) {
      if ((e as { code?: string })?.code === 'permission-denied') return normalizeAdotopoc(null);
      throw e;
    }
  },
};