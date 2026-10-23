import { useEffect } from 'react';
import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../api/firebase';
import { useAuth } from '../context/AuthContext';

const HEARTBEAT_MS = 20000;

/** TOP Radio listener presence while audio is actually playing (same shape as the mobile app). */
export function useRadioListener(sessionId: string | undefined, active: boolean) {
  const { user } = useAuth();
  const uid = user?.uid;

  useEffect(() => {
    if (!active || !sessionId || !uid) return;
    const ref = doc(db, 'radioListeners', sessionId, 'listeners', uid);
    const beat = () => {
      setDoc(ref, { uid, listenerId: uid, platform: 'web', lastSeen: serverTimestamp() }).catch(() => {});
    };
    beat();
    const interval = setInterval(beat, HEARTBEAT_MS);
    return () => {
      clearInterval(interval);
      deleteDoc(ref).catch(() => {});
    };
  }, [sessionId, active, uid]);
}
