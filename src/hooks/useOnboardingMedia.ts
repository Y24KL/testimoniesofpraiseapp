import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/api/firebase';
import { CONFIG } from '@/constants/config';
import { ONBOARDING_MEDIA, resolveOnboardingMedia, type OnboardingMedia } from '@/constants/onboarding';
import { cacheGet, cacheSet } from '@/storage/cache';

const CACHE_KEY = 'onboarding-media';

/**
 * Onboarding media to show right now. Order: last fetched remote value (cached) > build-time env.
 * A fresh `settings/onboarding` document is fetched in the background and cached for next launch;
 * it is applied immediately only when nothing is configured yet, so media never swaps mid-view.
 */
export function useOnboardingMedia(): { media: OnboardingMedia; ready: boolean } {
  const [media, setMedia] = useState<OnboardingMedia>(ONBOARDING_MEDIA);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    let shown: OnboardingMedia = ONBOARDING_MEDIA;
    void cacheGet<OnboardingMedia>(CACHE_KEY)
      .then((cached) => {
        if (alive && cached && cached.type) {
          shown = cached;
          setMedia(cached);
        }
      })
      .finally(() => alive && setReady(true));

    if (CONFIG.backendMode === 'firestore') {
      getDoc(doc(db, 'settings/onboarding'))
        .then((snap) => {
          if (!snap.exists()) return;
          const d = snap.data();
          const remote = resolveOnboardingMedia({ type: d.mediaType, url: d.mediaUrl, posterUrl: d.posterUrl, overlayOpacity: d.overlayOpacity });
          void cacheSet(CACHE_KEY, remote);
          if (alive && shown.type === 'none') setMedia(remote);
        })
        .catch(() => undefined); // offline / rules not deployed: keep env or cached value
    }
    return () => {
      alive = false;
    };
  }, []);

  return { media, ready };
}
