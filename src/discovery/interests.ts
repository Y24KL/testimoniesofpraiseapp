/** Saves and resets the person's discovery settings. Only allowlisted tags are written. */
import { doc, getDoc, serverTimestamp, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/api/firebase';
import { readDiscovery, sanitizeInterests, type DiscoverySettings, type InterestTag } from './rules';
import { resetDiscoveryCache } from './activity';

const ref = (uid: string) => doc(db, 'users', uid, 'private', 'discovery');

export async function getDiscoverySettings(uid: string): Promise<DiscoverySettings> {
  const snap = await getDoc(ref(uid));
  return readDiscovery(snap.exists() ? snap.data() : null);
}

export async function saveDiscoverySettings(uid: string, next: { interests: InterestTag[]; optOut: boolean }): Promise<void> {
  await setDoc(ref(uid), { interests: sanitizeInterests(next.interests), optOut: next.optOut === true, updatedAt: serverTimestamp() });
  resetDiscoveryCache();
}

/** Clears interests and the opt-out. Recorded history is deleted separately (see clearActivityHistory). */
export async function resetDiscovery(uid: string): Promise<void> {
  await deleteDoc(ref(uid));
  resetDiscoveryCache();
}
