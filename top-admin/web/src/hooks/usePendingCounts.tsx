import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { collection, getCountFromServer, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import type { Metric } from '../components/ui';
import type { CountKey } from '../nav';

/** What each pending counter measures. All are server-side counts (one read per 1,000 matches). */
const SOURCES: Record<CountKey, { collection: string; field: string; value: string }> = {
  submissions: { collection: 'testimonySubmissions', field: 'status', value: 'pending' },
  choirRequests: { collection: 'choirFeatureRequests', field: 'status', value: 'pending' },
  feedback: { collection: 'appFeedback', field: 'status', value: 'new' },
  sponsorships: { collection: 'sponsorships', field: 'status', value: 'pending' },
  reports: { collection: 'contentReports', field: 'status', value: 'open' },
  support: { collection: 'supportThreads', field: 'status', value: 'awaiting_admin' },
};

const KEYS = Object.keys(SOURCES) as CountKey[];
const REFRESH_MS = 3 * 60 * 1000;

type Counts = Record<CountKey, Metric>;
interface PendingApi { counts: Counts; refresh: () => void; refreshedAt: Date | null }

const initial = Object.fromEntries(KEYS.map((k) => [k, { state: 'loading' }])) as Counts;
const Ctx = createContext<PendingApi>({ counts: initial, refresh: () => undefined, refreshedAt: null });

export function PendingCountsProvider({ children }: { children: ReactNode }) {
  const [counts, setCounts] = useState<Counts>(initial);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);

  const refresh = useCallback(() => {
    void Promise.all(
      KEYS.map(async (k): Promise<[CountKey, Metric]> => {
        const s = SOURCES[k];
        try {
          const snap = await getCountFromServer(query(collection(db, s.collection), where(s.field, '==', s.value)));
          return [k, { state: 'ready', value: snap.data().count }];
        } catch (e) {
          return [k, { state: 'error', message: (e as Error).message }];
        }
      }),
    ).then((entries) => {
      setCounts(Object.fromEntries(entries) as Counts);
      setRefreshedAt(new Date());
    });
  }, []);

  useEffect(() => {
    refresh();
    const t = window.setInterval(refresh, REFRESH_MS);
    return () => window.clearInterval(t);
  }, [refresh]);

  return <Ctx.Provider value={{ counts, refresh, refreshedAt }}>{children}</Ctx.Provider>;
}

export const usePendingCounts = () => useContext(Ctx);

/** A count to show beside a menu entry: only a confirmed, non-zero number. Failures show nothing. */
export function badgeCount(m: Metric | undefined): number | null {
  return m && m.state === 'ready' && m.value > 0 ? m.value : null;
}
