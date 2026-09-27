import { auth } from '@/api/firebase';
import { repo } from '@/api';

type Params = Record<string, string | number | boolean | undefined>;

/**
 * Non-sensitive product analytics: app_open, video_play, video_complete, download_complete,
 * notification_open. Never include personal data in params. Fire-and-forget.
 */
export function track(event: string, params: Params = {}): void {
  // Set EXPO_PUBLIC_ANALYTICS=off in .env to stop writing events (saves Firestore quota on the free plan).
  if (process.env.EXPO_PUBLIC_ANALYTICS === 'off') return;
  void repo.recordEvent(event, params, auth.currentUser?.uid).catch(() => undefined);
}
