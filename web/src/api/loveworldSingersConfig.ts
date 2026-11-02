import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { LOVEWORLD_HERO_VIDEO } from '../constants/loveworldSingers';

/**
 * The background video for the LoveWorld Singers page: the link an admin saved in the admin portal
 * (settings/loveworldSingers), or the default when nothing valid is saved.
 */
export async function getLoveworldHeroVideo(): Promise<string> {
  try {
    const snap = await getDoc(doc(db, 'settings', 'loveworldSingers'));
    const url = snap.exists() ? (snap.data() as { heroVideoUrl?: unknown }).heroVideoUrl : undefined;
    return typeof url === 'string' && /^https:\/\//.test(url.trim()) ? url.trim() : LOVEWORLD_HERO_VIDEO;
  } catch {
    return LOVEWORLD_HERO_VIDEO;
  }
}
