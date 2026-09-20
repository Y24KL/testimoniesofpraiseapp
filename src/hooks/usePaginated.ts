import { useCallback, useEffect, useRef, useState } from 'react';
import { cacheGet, cacheSet } from '@/storage/cache';
import type { Page } from '@/types';
import { toAppError, type AppError } from '@/utils/errors';

/**
 * Cursor pagination with pull-to-refresh and an offline fallback:
 * the first page is cached, and shown (marked `fromCache`) when the network is unavailable.
 */
export function usePaginated<T>(cacheKey: string, fetchPage: (cursor?: unknown) => Promise<Page<T>>) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const cursor = useRef<unknown>(undefined);
  const busy = useRef(false);
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;

  const loadFirst = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (busy.current) return;
      busy.current = true;
      mode === 'refresh' ? setRefreshing(true) : setLoading(true);
      try {
        const page = await fetchRef.current(undefined);
        cursor.current = page.cursor;
        setItems(page.items);
        setHasMore(page.hasMore);
        setError(null);
        setFromCache(false);
        void cacheSet(cacheKey, page.items);
      } catch (e) {
        const cached = await cacheGet<T[]>(cacheKey);
        if (cached?.length) {
          setItems(cached);
          setHasMore(false);
          setFromCache(true);
          setError(null);
        } else {
          setError(toAppError(e));
        }
      } finally {
        busy.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [cacheKey],
  );

  useEffect(() => {
    void loadFirst('initial');
  }, [loadFirst]);

  const loadMore = useCallback(async () => {
    if (busy.current || !hasMore || fromCache) return;
    busy.current = true;
    setLoadingMore(true);
    try {
      const page = await fetchRef.current(cursor.current);
      cursor.current = page.cursor;
      setItems((prev) => {
        const seen = new Set((prev as { id?: string }[]).map((p) => p.id));
        return [...prev, ...page.items.filter((i) => !seen.has((i as { id?: string }).id))];
      });
      setHasMore(page.hasMore);
    } catch {
      setHasMore(false);
    } finally {
      busy.current = false;
      setLoadingMore(false);
    }
  }, [hasMore, fromCache]);

  return {
    items,
    loading,
    refreshing,
    loadingMore,
    error,
    fromCache,
    hasMore,
    refresh: () => loadFirst('refresh'),
    retry: () => loadFirst('initial'),
    loadMore,
  };
}
