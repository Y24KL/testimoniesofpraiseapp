import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { TitlePicker } from '@/components/TitlePicker';
import { validateProfile, type ValidProfile } from '@/profile/validation';
import { Logo } from '@/components/Logo';
import { TopBar } from '@/components/TopBar';
import { useAuth } from '@/auth/AuthContext';
import { colors, type as t } from '@/constants/theme';
import type { RootStackParamList } from '@/navigation/types';
import { authMessage } from '@/utils/errors';
import { PASSWORD_RULES, isStrongPassword, isValidEmail } from '@/utils/password';

export function EmailAuthScreen() {
  const nav = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'EmailAuth'>>();
  const { signInWithEmail, register } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>(route.params?.mode ?? 'signin');
  const [fullName, setFullName] = useState('');
  const [title, setTitle] = useState('');
  const [zone, setZone] = useState('');
  const [church, setChurch] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const signup = mode === 'signup';
  // Inline profile errors appear after the first attempt to submit.
  const profileCheck = signup && submitted ? validateProfile({ title, fullName, zone, church }) : null;
  const signupProfileErrors = profileCheck && !profileCheck.ok ? profileCheck.errors : {};
  const mismatch = signup && confirm.length > 0 && password !== confirm;

  const submit = async () => {
    setSubmitted(true);
    setError(null);
    if (!isValidEmail(email)) return setError('Please enter a valid email address.');
    let profile: ValidProfile | undefined;
    if (signup) {
      // Checked before the account exists, so nothing incomplete is created.
      const checked = validateProfile({ title, fullName, zone, church });
      if (!checked.ok) return setError(Object.values(checked.errors)[0] ?? 'Check your details.');
      profile = checked.value;
      if (!isStrongPassword(password)) return setError('Your password does not meet the requirements below.');
      if (password !== confirm) return setError('Passwords do not match.'); // account is NOT created
    } else if (!password) {
      return setError('Please enter your password.');
    }
    setBusy(true);
    try {
      if (signup) await register(fullName, email, password, profile);
      else await signInWithEmail(email, password);
      // Navigation happens automatically when the auth state changes.
    } catch (e) {
      setError(authMessage(e));
      setBusy(false);
    }
  };

  return (
    <Screen>
      <TopBar title="" onBack={() => nav.goBack()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Logo size={56} />
            <Text style={styles.title} accessibilityRole="header">{signup ? 'Create your account' : 'Welcome back'}</Text>
            <Text style={styles.subtitle}>{signup ? 'Join the family and never miss a testimony.' : 'Sign in to continue to Testimonies of Praise.'}</Text>
          </View>

          <View style={styles.segment} accessibilityRole="tablist">
            {(['signin', 'signup'] as const).map((m) => (
              <Pressable
                key={m}
                onPress={() => { setMode(m); setError(null); setSubmitted(false); }}
                style={[styles.segmentBtn, mode === m && styles.segmentOn]}
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === m }}
              >
                <Text style={[styles.segmentText, mode === m && styles.segmentTextOn]}>{m === 'signin' ? 'Sign in' : 'Create account'}</Text>
              </Pressable>
            ))}
          </View>

          {signup ? <TextField label="Full name" value={fullName} onChangeText={setFullName} autoCapitalize="words" textContentType="name" autoComplete="name" error={signupProfileErrors.fullName} /> : null}
          {signup ? <TitlePicker value={title} onChange={setTitle} error={signupProfileErrors.title} /> : null}
          {signup ? <TextField label="Zone" value={zone} onChangeText={setZone} autoCapitalize="words" placeholder="e.g. Lagos Zone 1" error={signupProfileErrors.zone} /> : null}
          {signup ? <TextField label="Church" value={church} onChangeText={setChurch} autoCapitalize="words" placeholder="e.g. Christ Embassy Lagos" error={signupProfileErrors.church} /> : null}
          <TextField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="emailAddress" autoComplete="email" />
          <TextField label="Password" value={password} onChangeText={setPassword} secure autoCapitalize="none" textContentType={signup ? 'newPassword' : 'password'} autoComplete={signup ? 'new-password' : 'current-password'} />

          {signup ? (
            <>
              <TextField label="Confirm password" value={confirm} onChangeText={setConfirm} secure autoCapitalize="none" error={mismatch ? 'Passwords do not match.' : undefined} />
              <View style={styles.rules} accessibilityLabel="Password requirements">
                <Text style={styles.rulesTitle}>Password requirements</Text>
                {PASSWORD_RULES.map((r) => {
                  const ok = r.test(password);
                  return (
                    <View key={r.id} style={styles.rule} accessibilityLabel={`${r.label}: ${ok ? 'met' : 'not met'}`}>
                      <Ionicons name={ok ? 'checkmark-circle' : submitted ? 'close-circle' : 'ellipse-outline'} size={18} color={ok ? colors.success : submitted ? colors.danger : colors.textSubtle} />
                      <Text style={[styles.ruleText, ok && { color: colors.text }]}>{r.label}</Text>
                    </View>
                  );
                })}
              </View>
            </>
          ) : (
            <Pressable onPress={() => nav.navigate('ForgotPassword')} accessibilityRole="button" style={{ alignSelf: 'flex-end' }} hitSlop={10}>
              <Text style={styles.link}>Forgot password?</Text>
            </Pressable>
          )}

          {error ? (
            <View style={styles.errorBox} accessibilityRole="alert">
              <Ionicons name="alert-circle" size={18} color={colors.danger} />
              <Text style={styles.error}>{error}</Text>
            </View>
          ) : null}
          <PrimaryButton title={signup ? 'Create account' : 'Sign in'} onPress={submit} loading={busy} style={{ marginTop: 4 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingBottom: 32, gap: 16 },
  header: { alignItems: 'center', gap: 8, marginBottom: 8 },
  title: { ...t.h1, color: colors.text, marginTop: 8, textAlign: 'center' },
  subtitle: { ...t.body, color: colors.textMuted, textAlign: 'center' },
  segment: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 999, padding: 4, borderWidth: 1, borderColor: colors.borderSoft },
  segmentBtn: { flex: 1, minHeight: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  segmentOn: { backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: 'rgba(245,197,66,0.45)' },
  segmentText: { ...t.small, color: colors.textMuted, fontWeight: '700' },
  segmentTextOn: { color: colors.accent },
  rules: { gap: 6, padding: 14, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSoft },
  rulesTitle: { ...t.small, color: colors.accent, fontWeight: '700', marginBottom: 4 },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ruleText: { ...t.small, color: colors.textMuted },
  errorBox: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', padding: 12, borderRadius: 12, backgroundColor: 'rgba(255,107,127,0.1)', borderWidth: 1, borderColor: 'rgba(255,107,127,0.35)' },
  error: { ...t.small, color: colors.text, flex: 1 },
  link: { ...t.small, color: colors.accent, fontWeight: '700' },
});
