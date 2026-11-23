import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/auth/AuthContext';
import { colors, radius, type as t } from '@/constants/theme';
import { openNotificationSettings } from '@/notifications/push';
import { ensureRegistered, subscribeRegistration } from '@/notifications/registration';
import { explainRegistration, type RegistrationRecord } from '@/notifications/registrationRules';

const HIDE_KEY = 'top.notificationNudgeHiddenUntil';
const HIDE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Shown on Home only when this phone cannot receive notifications (not allowed, blocked, or registration failed),
 * with the one action that fixes it. Can be hidden for a week.
 */
export function NotificationNudge() {
  const { user } = useAuth();
  const [reg, setReg] = useState<RegistrationRecord | null>(null);
  const [hidden, setHidden] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => subscribeRegistration(setReg), []);
  useEffect(() => {
    void AsyncStorage.getItem(HIDE_KEY)
      .then((v) => setHidden(Boolean(v && Number(v) > Date.now())))
      .catch(() => setHidden(false));
  }, []);

  if (!user || !reg || hidden) return null;
  if (!['needs_permission', 'blocked', 'error'].includes(reg.state)) return null;

  const act = async () => {
    setBusy(true);
    try {
      if (reg.state === 'blocked') await openNotificationSettings();
      else await ensureRegistered(user.uid, { primerSeen: true, userInitiated: true, force: true });
    } finally {
      setBusy(false);
    }
  };

  const hide = async () => {
    setHidden(true);
    await AsyncStorage.setItem(HIDE_KEY, String(Date.now() + HIDE_MS)).catch(() => undefined);
  };

  const label = reg.state === 'blocked' ? 'Open settings' : reg.state === 'error' ? 'Try again' : 'Turn on';
  return (
    <View style={styles.box} accessibilityRole="alert">
      <Ionicons name="notifications-off-outline" size={22} color={colors.accent} />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{reg.state === 'error' ? 'Notifications are not set up yet' : 'You’ll miss live services and new testimonies'}</Text>
        <Text style={styles.body}>{explainRegistration(reg)}</Text>
      </View>
      <View style={{ gap: 6, alignItems: 'flex-end' }}>
        <Pressable onPress={() => void act()} disabled={busy} style={styles.btn} accessibilityRole="button" accessibilityLabel={label}>
          {busy ? <ActivityIndicator color={colors.onAccent} size="small" /> : <Text style={styles.btnText}>{label}</Text>}
        </Pressable>
        <Pressable onPress={() => void hide()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Hide for a week">
          <Text style={styles.later}>Not now</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 20, marginTop: 16, padding: 14, borderRadius: radius.lg, backgroundColor: 'rgba(245,197,66,0.08)', borderWidth: 1, borderColor: 'rgba(245,197,66,0.45)' },
  title: { ...t.h3, color: colors.text },
  body: { ...t.small, color: colors.textMuted, marginTop: 2 },
  btn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.accent, minWidth: 92, alignItems: 'center' },
  btnText: { ...t.small, fontWeight: '800', color: colors.onAccent },
  later: { ...t.caption, color: colors.textSubtle },
});
