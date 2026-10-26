import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useAuth } from '@/auth/AuthContext';
import { track } from '@/analytics';
import { useAppFlags } from '@/context/AppFlags';
import { navigationRef } from '@/navigation/ref';
import { openTarget } from './routing';
import { ensureAndroidChannel, registerPushToken } from './push';

const HANDLED_KEY = 'top.lastHandledNotificationResponse';

/** A stable id for one tap on one notification. */
const responseId = (r: Notifications.NotificationResponse) => `${r.notification.request.identifier}:${r.notification.date}:${r.actionIdentifier}`;

/**
 * - Re-registers the push token on every launch once permission is granted (tokens can rotate).
 * - Opens the exact content when a notification is TAPPED: from a cold start (terminated app), from the
 *   background, or while the app is open. Each tap is handled exactly once.
 *
 * Previously this used useLastNotificationResponse(), which keeps returning the last tapped
 * notification on later, normal launches (and re-fired whenever `user` changed), so the app kept
 * reopening that old notification (usually the Notifications list) instead of starting on Home.
 */
export function usePushLifecycle() {
  const { user, isSessionVerified } = useAuth();
  const { primerSeen } = useAppFlags();
  const pending = useRef<Notifications.NotificationResponse | null>(null);
  const handled = useRef<Set<string>>(new Set());
  const canNavigate = Boolean(user && isSessionVerified && primerSeen);

  useEffect(() => {
    void ensureAndroidChannel();
    if (user) void registerPushToken(user.uid).catch(() => undefined);
  }, [user]);

  const flush = useRef<() => void>(() => undefined);
  flush.current = () => {
    const r = pending.current;
    if (!r || !canNavigate) return;
    // Wait until the signed-in navigator is mounted (cold start / just after sign-in).
    const started = Date.now();
    const tick = () => {
      if (pending.current !== r) return;
      if (navigationRef.isReady() && navigationRef.getRootState()?.routeNames?.includes('Tabs')) {
        pending.current = null;
        const data = (r.notification.request.content.data ?? {}) as { type?: string; contentId?: string };
        track('notification_open', { type: data.type });
        openTarget({ type: data.type, contentId: data.contentId });
      } else if (Date.now() - started < 8000) {
        setTimeout(tick, 100);
      }
    };
    tick();
  };

  useEffect(() => {
    let alive = true;
    const accept = async (r: Notifications.NotificationResponse | null, persisted: boolean) => {
      if (!r || r.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
      const id = responseId(r);
      if (handled.current.has(id)) return;
      if (persisted) {
        // Cold start: the OS hands back the LAST tap ever made, even on later normal launches.
        const last = await AsyncStorage.getItem(HANDLED_KEY).catch(() => null);
        if (!alive || last === id || handled.current.has(id)) return;
      }
      handled.current.add(id);
      await AsyncStorage.setItem(HANDLED_KEY, id).catch(() => undefined);
      void Notifications.clearLastNotificationResponseAsync?.().catch(() => undefined);
      pending.current = r;
      flush.current();
    };
    void Notifications.getLastNotificationResponseAsync().then((r) => accept(r, true));
    const sub = Notifications.addNotificationResponseReceivedListener((r) => void accept(r, false));
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  // A tap that arrived before sign-in / the notification primer finished opens once Home is ready.
  useEffect(() => {
    flush.current();
  }, [canNavigate]);
}
