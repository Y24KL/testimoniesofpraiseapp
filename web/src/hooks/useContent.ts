import { useCallback, useEffect, useState } from 'react';
import { repo, type PageOptions } from '../api/repository';
import type { LiveConfig, Testimony } from '../types';

export function useTestimonies(opts: Partial<PageOptions> = {}) {
  const [items, setItems] = useState<Testimony[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [cursor, setCursor] = useState<unknown>(undefined);
  const [hasMore, setHasMore] = useState(true);

  const limit = opts.limit ?? 12;
  const featuredOnly = opts.featuredOnly;

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await repo.getTestimonies({ limit, featuredOnly });
      setItems(res.items);
      setCursor(res.cursor);
      setHasMore(res.hasMore);
    } catch (e: any) {
      setError(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [limit, featuredOnly]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
  }, [load]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || !cursor) return;
    setLoadingMore(true);
    try {
      const res = await repo.getTestimonies({ limit, cursor, featuredOnly });
      setItems((prev) => [...prev, ...res.items]);
      setCursor(res.cursor);
      setHasMore(res.hasMore);
    } catch (e: any) {
      setError(e);
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, cursor, limit, featuredOnly]);

  return {
    items,
    loading,
    loadingMore,
    refreshing,
    error,
    hasMore,
    refresh,
    loadMore,
    retry: load,
  };
}

export function useLive() {
  const [live, setLive] = useState<LiveConfig | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    return repo.subscribeLive(
      (cfg) => {
        setLive(cfg);
        setError(null);
      },
      (err) => setError(err),
    );
  }, []);

  return { live, error };
}
