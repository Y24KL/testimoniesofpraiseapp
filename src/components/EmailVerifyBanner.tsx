import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, type as t } from '@/constants/theme';
import { useAuth } from '@/auth/AuthContext';

/** Shown to password-account users until they tap the verification link Firebase emailed them. */
export function EmailVerifyBanner() {
  const { user, needsEmailVerification, refreshEmailVerified, resendVerificationEmail } = useAuth();
  const [busy, setBusy] = useState<'resend' | 'refresh' | null>(null);
  const [msg, setMsg] = useState('');

  if (!needsEmailVerification) return null;

  const resend = async () => {
    setBusy('resend');
    setMsg('');
    try {
      await resendVerificationEmail();
      setMsg(`Sent to ${user?.email}.`);
    } catch {
      setMsg('Could not send the email. Try again shortly.');
    }
    setBusy(null);
  };

  const refresh = async () => {
    setBusy('refresh');
    setMsg('');
    await refreshEmailVerified();
    setBusy(null);
  };

  return (
    <View style={styles.wrap} accessibilityRole="alert">
      <View style={styles.row}>
        <Ionicons name="mail-unread-outline" size={18} color={colors.accent} />
        <Text style={styles.title}>Please verify your email</Text>
      </View>
      <Text style={styles.body}>We sent a link to {user?.email}. Tap it, then come back and press "I've verified".</Text>
      {msg ? <Text style={styles.msg}>{msg}</Text> : null}
      <View style={styles.actions}>
        <Text onPress={busy ? undefined : refresh} style={[styles.action, styles.primary]} accessibilityRole="button">
          {busy === 'refresh' ? 'Checking…' : "I've verified"}
        </Text>
        <Text onPress={busy ? undefined : resend} style={styles.action} accessibilityRole="button">
          {busy === 'resend' ? 'Sending…' : 'Resend email'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { margin: 16, marginBottom: 0, padding: 14, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.accent, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { ...t.h3, fontSize: 14, color: colors.text },
  body: { ...t.small, color: colors.textMuted },
  msg: { ...t.small, color: colors.accent },
  actions: { flexDirection: 'row', gap: 20, marginTop: 2 },
  action: { ...t.small, fontWeight: '700', color: colors.textMuted },
  primary: { color: colors.accent },
});
