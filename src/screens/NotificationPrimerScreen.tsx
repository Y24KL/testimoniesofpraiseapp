import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useAuth } from '@/auth/AuthContext';
import { useAppFlags } from '@/context/AppFlags';
import { colors, gradients, type as t } from '@/constants/theme';
import {
  getPermissionStatus,
  openNotificationSettings,
  registerPushToken,
  requestPermission,
} from '@/notifications/push';

/** Explains WHY, then triggers the real OS permission dialog. */
export function NotificationPrimerScreen() {
  const { user } = useAuth();
  const { markPrimerSeen } = useAppFlags();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>('undetermined');

  useEffect(() => {
    getPermissionStatus().then((s) => {
      setStatus(s);
      // Only auto-skip if already granted
      if (s === 'granted') {
        void markPrimerSeen();
      }
    });
  }, [markPrimerSeen]);

  const enable = async () => {
    setBusy(true);
    try {
      if (status === 'denied') {
        await openNotificationSettings();
        await markPrimerSeen();
        return;
      }

      const granted = await requestPermission();
      if (granted && user) {
        await registerPushToken(user.uid).catch(() => undefined);
      }
    } finally {
      await markPrimerSeen();
      setBusy(false);
    }
  };

  return (
    <LinearGradient colors={gradients.hero} style={{ flex: 1 }}>
      <SafeAreaView style={styles.root}>
        <View style={styles.center}>
          <View style={styles.icon}>
            <Ionicons name="notifications" size={46} color={colors.accent} />
          </View>
          <Text style={styles.h}>Stay connected with Testimonies of Praise.</Text>
          <Text style={styles.p}>
            Receive notifications when new testimonies, videos, live events and important announcements
            are available.
          </Text>
        </View>
        <View style={{ gap: 12 }}>
          <PrimaryButton
            title={status === 'denied' ? 'OPEN SETTINGS TO ALLOW' : 'TURN ON NOTIFICATIONS'}
            icon="notifications-outline"
            onPress={enable}
            loading={busy}
          />
          <PrimaryButton
            title="NOT NOW"
            variant="ghost"
            onPress={() => void markPrimerSeen()}
            disabled={busy}
          />
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 24, justifyContent: 'space-between' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  icon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.accent,
  },
  h: { ...t.h1, fontSize: 24, color: colors.text, textAlign: 'center' },
  p: { ...t.body, color: colors.textMuted, textAlign: 'center' },
});
