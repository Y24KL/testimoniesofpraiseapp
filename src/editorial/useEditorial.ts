import { useEffect, useState } from 'react';
import { fetchFeatured, fetchFeaturedList, subscribeEditorial, type FeaturedItem } from './service';
import { nextBroadcast, pickInspiration, type Editorial, type Inspiration, type RadioEntry } from './rules';

export interface DailyDiscovery {
  ready: boolean;
  inspiration: Inspiration | null;
  broadcast: { atUtcMs: number; entry: RadioEntry } | null;
  featured: FeaturedItem[];
  highlights: FeaturedItem[];
}

/** The Home "Daily discovery" content. Empty slots stay empty. */
export function useDailyDiscovery(nowUtcMs: number = Date.now()): DailyDiscovery {
  const [config, setConfig] = useState<Editorial | null>(null);
  const [featured, setFeatured] = useState<FeaturedItem[]>([]);
  const [highlights, setHighlights] = useState<FeaturedItem[]>([]);

  useEffect(() => subscribeEditorial(setConfig, () => setConfig(null)), []);

  useEffect(() => {
    if (!config) return;
    let alive = true;
    const kinds = ['testimony', 'lyrical', 'article'] as const;
    void Promise.all(kinds.map((k) => (config.featuredIds[k] ? fetchFeatured(k, config.featuredIds[k]!) : Promise.resolve(null)))).then((items) => {
      if (alive) setFeatured(items.filter((x): x is FeaturedItem => x !== null));
    });
    void fetchFeaturedList('choir', config.highlightChoirIds).then((items) => alive && setHighlights(items));
    return () => {
      alive = false;
    };
  }, [config]);

  return {
    ready: config !== null,
    inspiration: config ? pickInspiration(config.inspirations, nowUtcMs) : null,
    broadcast: config ? nextBroadcast(config.radioSchedule, nowUtcMs) : null,
    featured,
    highlights,
  };
}
