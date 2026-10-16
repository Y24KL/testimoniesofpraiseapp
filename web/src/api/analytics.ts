import { logEvent } from 'firebase/analytics';
import { auth, analyticsPromise } from './firebase';
import { repo } from './repository';

export function track(
  event: string,
  params: Record<string, any> = {}
): void {
  // Keep the existing Firestore event tracking.
  repo
    .recordEvent(event, params, auth.currentUser?.uid)
    .catch(() => {});

  // Also send the event to Google Analytics.
  void analyticsPromise
    .then((analytics) => {
      if (!analytics) return;

      const safeParams: Record<
        string,
        string | number | boolean
      > = {};

      for (const [key, value] of Object.entries(params)) {
        if (
          typeof value === 'string' ||
          typeof value === 'number' ||
          typeof value === 'boolean'
        ) {
          safeParams[key] = value;
        }
      }

      logEvent(analytics, event, safeParams);
    })
    .catch(() => {});
}
