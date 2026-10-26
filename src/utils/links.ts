import { Alert, Platform, Share } from 'react-native';
import { CONFIG } from '@/constants/config';
import { isWebUrl } from '@/utils/openExternal';

export const deepLink = {
  testimony: (id: string) => `testimoniesofpraise://testimony/${encodeURIComponent(id)}`,
  live: () => 'testimoniesofpraise://live',
};

/** Custom-scheme links are not clickable for people without the app, so share the website too. */
export const shareMessage = (title: string) => `${title}\n\nWatch on Testimonies of Praise: ${CONFIG.websiteUrl}`;

/**
 * Shares the media file itself: the public URL stored on the testimony when it was uploaded (the
 * Bunny CDN / Cloudinary address of that exact video or audio), never the app's homepage.
 * Only https/http links are shared; anything else (missing, local file path) shows an error.
 */
export async function shareMediaUrl(title: string, url: string | null | undefined, kind: 'video' | 'audio' = 'video'): Promise<void> {
  const clean = url?.trim();
  if (!clean || !isWebUrl(clean) || /^file:|^content:/i.test(clean)) {
    Alert.alert('Can’t share this ' + kind, `This ${kind} doesn’t have a shareable link yet. Please try again later.`);
    return;
  }
  const label = kind === 'video' ? 'Watch' : 'Listen to';
  await Share.share(
    Platform.OS === 'ios'
      ? { title, message: `${label} “${title}” on Testimonies of Praise`, url: clean }
      : { title, message: `${label} “${title}” on Testimonies of Praise\n${clean}` },
    { dialogTitle: `Share ${kind}`, subject: title },
  );
}
