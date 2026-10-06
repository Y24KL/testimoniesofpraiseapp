import { useEffect, useState } from 'react';
import { collection, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

const STALE_MS = 90_000; // two missed heartbeats (heartbeat is every 20s on the app side)

/**
 * Counts people currently on the Live screen in the app while this stream is live — a heartbeat
 * doc per viewer, refreshed every 20s (see src/hooks/useLiveViewer.ts in the mobile app). A
 * viewer is "live" here from the moment they open the Live tab while the stream is live, not
 * from confirmed playback. Docs older than ~90s (two missed heartbeats — an app that crashed or
 * lost connection without cleaning up after itself) are treated as gone.
 */
export function ViewerCount({ sessionId }: { sessionId: string }) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    setCount(null);
    const col = collection(db, 'liveViewers', sessionId, 'viewers');
    return onSnapshot(col, (snap) => {
      const now = Date.now();
      const live = snap.docs.filter((d) => {
        const ts = d.data().lastSeen as Timestamp | undefined;
        return ts && now - ts.toMillis() < STALE_MS;
      });
      setCount(live.length);
    });
  }, [sessionId]);

  if (count === null) return null;
  return (
    <span className="pill ok" style={{ marginLeft: 10 }}>
      👁 {count} watching now
    </span>
  );
}
