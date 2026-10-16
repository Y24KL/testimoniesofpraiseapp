import { useEffect, useRef } from 'react';
import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/api/firebase';
import { useAuth } from '@/auth/AuthContext';

const HEARTBEAT_MS = 20000; // refresh presence every 20s

/**
 * Tracks the current user as an active listener for TOP Radio when playing.
 * Records heartbeats to radioListeners/{sessionId}/listeners/{listenerId}.
 */
export function useRadioListener(sessionId: string | undefined, isPlaying: boolean) {
  const { user } = useAuth();
  const uid = user?.uid;
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;

    if (!isPlaying || !sessionId) return;

    // Use user ID if authenticated, or a persistent anonymous session ID
    const listenerId = uid || 'guest_' + Math.random().toString(36).substring(2, 9);
    const ref = doc(db, 'radioListeners', sessionId, 'listeners', listenerId);
    const beat = () =>
      void setDoc(ref, {
        uid: uid ?? null,
        listenerId,
        platform: 'mobile',
        lastSeen: serverTimestamp(),
      }).catch(() => undefined);

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
  }, [sessionId, isPlaying, uid]);
}
