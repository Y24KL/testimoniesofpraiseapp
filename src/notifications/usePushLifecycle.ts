import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { useAuth } from '@/auth/AuthContext';
import { track } from '@/analytics';
import { navigationRef } from '@/navigation/ref';
import { openTarget } from './routing';
import { ensureAndroidChannel, registerPushToken } from './push';

/**
 * - Re-registers the push token on every launch once permission is granted (tokens can rotate).
 * - Opens the exact content when a notification is tapped, including from a cold start.
 */
export function usePushLifecycle() {
  const { user } = useAuth();
  const last = Notifications.useLastNotificationResponse();

  useEffect(() => {
    void ensureAndroidChannel();
    if (user) void registerPushToken(user.uid).catch(() => undefined);
  }, [user]);

  useEffect(() => {
    if (!last || !user) return;
    const data = last.notification.request.content.data as { type?: string; contentId?: string } | undefined;
    track('notification_open', { type: data?.type });
    // Wait until the navigator is mounted (cold start).
    const id = setInterval(() => {
      if (navigationRef.isReady()) {
        clearInterval(id);
        openTarget({ type: data?.type, contentId: data?.contentId });
      }
    }, 100);
    const stop = setTimeout(() => clearInterval(id), 5000);
    return () => {
      clearInterval(id);
      clearTimeout(stop);
    };
  }, [last, user]);
}
