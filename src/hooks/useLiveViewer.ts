import { useEffect, useRef } from 'react';
import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/api/firebase';
import { useAuth } from '@/auth/AuthContext';

const HEARTBEAT_MS = 20000; // refresh presence every 20s

/**
 * Marks the signed-in user as "currently watching" a live session while `active` is true (the
 * Live tab is both focused and actually live), and clears it the moment that stops being true.
 * A simple presence doc with a refreshed timestamp — the admin portal counts how many of these
 * are recent to show a live viewer count. Being on this screen while live counts as watching;
 * this doesn't check whether the video is actually playing or audible.
 */
export function useLiveViewer(sessionId: string | undefined, active: boolean) {
  const { user } = useAuth();
  const uid = user?.uid;
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Tear down any previous session's presence first (covers switching streams or losing focus).
    cleanupRef.current?.();
    cleanupRef.current = null;

    if (!active || !sessionId || !uid) return;

    const ref = doc(db, 'liveViewers', sessionId, 'viewers', uid);
    const beat = () => void setDoc(ref, { uid, lastSeen: serverTimestamp() }).catch(() => undefined);

    beat();
    const interval = setInterval(beat, HEARTBEAT_MS);
    cleanupRef.current = () => {
      clearInterval(interval);
      void deleteDoc(ref).catch(() => undefined);
    };

    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [sessionId, active, uid]);
}
