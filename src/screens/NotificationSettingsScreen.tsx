import React, { useEffect, useState } from 'react';
import { AppState, Linking, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { useAuth } from '@/auth/AuthContext';
import { colors, radius, type as t } from '@/constants/theme';
import { getPermissionStatus, registerPushToken, requestPermission } from '@/notifications/push';
import { DEFAULT_PREFS, loadPrefs, savePrefs } from '@/storage/prefs';
import type { NotificationPrefs } from '@/types';

const ROWS: { key: keyof NotificationPrefs; label: string; hint: string }[] = [
  { key: 'testimonies', label: 'New Testimonies', hint: 'When a new testimony is published' },
  { key: 'resources', label: 'New Resources', hint: 'When new downloads or graphics are added' },
  { key: 'live', label: 'Live Notifications', hint: 'When a live stream is starting' },
  { key: 'announcements', label: 'Important Announcements', hint: 'Featured content and church updates' },
];

export function NotificationSettingsScreen() {
  const nav = useNavigation();
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [perm, setPerm] = useState<string>('undetermined');

  useEffect(() => {
    void loadPrefs().then(setPrefs);
    const refresh = () => void getPermissionStatus().then(setPerm);
    refresh();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => sub.remove();
  }, []);

  const toggle = async (key: keyof NotificationPrefs, value: boolean) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    await savePrefs(next);
    if (user) await registerPushToken(user.uid, next).catch(() => undefined); // syncs prefs to the backend
  };

  const enable = async () => {
    if (perm === 'denied') return void Linking.openSettings(); // OS won't show the dialog again
    const ok = await requestPermission();
    setPerm(ok ? 'granted' : 'denied');
    if (ok && user) await registerPushToken(user.uid).catch(() => undefined);
  };

  return (
    <Screen>
      <TopBar title="Notification preferences" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        {perm !== 'granted' ? (
          <View style={styles.warn}>
            <Text style={styles.warnText}>Notifications are turned off for this device.</Text>
            <PrimaryButton title={perm === 'denied' ? 'OPEN DEVICE SETTINGS' : 'TURN ON NOTIFICATIONS'} onPress={enable} />
          </View>
        ) : null}
        {ROWS.map((r) => (
          <View key={r.key} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{r.label}</Text>
              <Text style={styles.hint}>{r.hint}</Text>
            </View>
            <Switch
              value={prefs[r.key]}
              onValueChange={(v) => void toggle(r.key, v)}
              trackColor={{ true: colors.primaryLight, false: colors.border }}
              thumbColor={prefs[r.key] ? colors.accent : colors.textMuted}
              accessibilityLabel={r.label}
            />
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  warn: { gap: 10, padding: 14, borderRadius: radius.md, borderWidth: 1, borderColor: colors.danger, backgroundColor: colors.surface },
  warnText: { ...t.body, color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  label: { ...t.h3, fontSize: 15, color: colors.text },
  hint: { ...t.small, color: colors.textMuted },
});
