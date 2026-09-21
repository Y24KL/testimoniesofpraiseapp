import { useEffect, useState } from 'react';
import { repo } from '@/api';
import { CONFIG } from '@/constants/config';
import { cacheGet, cacheSet } from '@/storage/cache';
import type { LiveConfig, Testimony } from '@/types';
import { usePaginated } from './usePaginated';

export const useTestimonies = (opts: { featuredOnly?: boolean; limit?: number } = {}) =>
  usePaginated<Testimony>(`testimonies:${opts.featuredOnly ? 'featured' : 'all'}:${opts.limit ?? CONFIG.pageSize}`, (cursor) =>
    repo.getTestimonies({ limit: opts.limit ?? CONFIG.pageSize, cursor, featuredOnly: opts.featuredOnly }),
  );

/** Live config straight from the Admin Portal's backend (never hard-coded). */
export function useLive() {
  const [live, setLive] = useState<LiveConfig | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void cacheGet<LiveConfig>('live').then((c) => !cancelled && c && setLive((cur) => cur ?? { ...c, isLive: false }));
    const unsub = repo.subscribeLive(
      (l) => {
        setLive(l);
        setError(false);
        void cacheSet('live', l);
      },
      () => setError(true),
    );
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);
  return { live, error };
}
