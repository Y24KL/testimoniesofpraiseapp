import { useEffect, useRef } from 'react';
import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../api/firebase';
import { useAuth } from '../context/AuthContext';

const HEARTBEAT_MS = 20000;

export function useLiveViewer(sessionId: string | undefined, active: boolean) {
  const { user } = useAuth();
  const uid = user?.uid;
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;

    if (!active || !sessionId || !uid) return;

    const ref = doc(db, 'liveViewers', sessionId, 'viewers', uid);
    const beat = () => {
      setDoc(ref, { uid, lastSeen: serverTimestamp() }).catch(() => {});
    };

    beat();
    const interval = setInterval(beat, HEARTBEAT_MS);
    cleanupRef.current = () => {
      clearInterval(interval);
      deleteDoc(ref).catch(() => {});
    };

    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [sessionId, active, uid]);
}
