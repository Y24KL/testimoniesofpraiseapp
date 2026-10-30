import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/api/firebase';

/**
 * The welcome tour's status, saved on the account (users/{uid}.tourStatus) so it follows the user to
 * other devices and survives reinstalls. The rules allow only these two values, and only on that field.
 */
export type TourStatus = 'completed' | 'skipped';

const isStatus = (v: unknown): v is TourStatus => v === 'completed' || v === 'skipped';

export async function readTourStatus(uid: string): Promise<TourStatus | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  const value = snap.exists() ? snap.get('tourStatus') : null;
  return isStatus(value) ? value : null;
}

/** Saves the final status. Safe to repeat: writing the same value again changes nothing. */
export async function saveTourStatus(uid: string, status: TourStatus): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { tourStatus: status, tourUpdatedAt: serverTimestamp() });
}
