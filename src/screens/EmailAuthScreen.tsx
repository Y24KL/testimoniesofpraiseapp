import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const signup = mode === 'signup';
  const mismatch = signup && confirm.length > 0 && password !== confirm;

  const submit = async () => {
    setSubmitted(true);
    setError(null);
    if (!isValidEmail(email)) return setError('Please enter a valid email address.');
    if (signup) {
      if (!fullName.trim()) return setError('Please enter your full name.');
      if (!isStrongPassword(password)) return setError('Your password does not meet the requirements below.');
      if (password !== confirm) return setError('Passwords do not match.'); // account is NOT created
    } else if (!password) {
      return setError('Please enter your password.');
    }
    setBusy(true);
    try {
      if (signup) await register(fullName, email, password);
      else await signInWithEmail(email, password);
      // Navigation happens automatically when the auth state changes.
    } catch (e) {
      setError(authMessage(e));
      setBusy(false);
    }
  };

  return (
    <Screen>
      <TopBar title={signup ? 'Create account' : 'Sign in'} onBack={() => nav.goBack()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {signup ? <TextField label="Full Name" value={fullName} onChangeText={setFullName} autoCapitalize="words" textContentType="name" /> : null}
          <TextField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="emailAddress" />
          <TextField label="Password" value={password} onChangeText={setPassword} secure autoCapitalize="none" textContentType={signup ? 'newPassword' : 'password'} />

          {signup ? (
            <>
              <TextField label="Confirm Password" value={confirm} onChangeText={setConfirm} secure autoCapitalize="none" error={mismatch ? 'Passwords do not match.' : undefined} />
              <View style={styles.rules} accessibilityLabel="Password requirements">
                <Text style={styles.rulesTitle}>PASSWORD REQUIREMENTS</Text>
                {PASSWORD_RULES.map((r) => {
                  const ok = r.test(password);
                  return (
                    <View key={r.id} style={styles.rule} accessibilityLabel={`${r.label}: ${ok ? 'met' : 'not met'}`}>
                      <Ionicons name={ok ? 'checkmark-circle' : submitted ? 'close-circle' : 'ellipse-outline'} size={18} color={ok ? colors.success : submitted ? colors.danger : colors.textMuted} />
                      <Text style={[styles.ruleText, ok && { color: colors.text }]}>{r.label}</Text>
                    </View>
                  );
                })}
              </View>
            </>
          ) : (
            <Pressable onPress={() => nav.navigate('ForgotPassword')} accessibilityRole="button" style={{ alignSelf: 'flex-end' }} hitSlop={10}>
              <Text style={styles.link}>Forgot Password?</Text>
            </Pressable>
          )}

          {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
          <PrimaryButton title={signup ? 'CREATE ACCOUNT' : 'SIGN IN'} onPress={submit} loading={busy} />
          <Pressable onPress={() => { setMode(signup ? 'signin' : 'signup'); setError(null); setSubmitted(false); }} accessibilityRole="button" style={{ alignSelf: 'center', padding: 8 }}>
            <Text style={styles.switch}>{signup ? 'Already have an account? ' : 'New here? '}<Text style={styles.link}>{signup ? 'Sign in' : 'Create account'}</Text></Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 16 },
  rules: { gap: 6, padding: 14, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  rulesTitle: { ...t.caps, fontSize: 11, color: colors.accent, marginBottom: 4 },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ruleText: { ...t.small, color: colors.textMuted },
  error: { ...t.body, color: colors.danger, textAlign: 'center' },
  link: { ...t.small, color: colors.accent, fontWeight: '700' },
  switch: { ...t.body, color: colors.textMuted },
});
