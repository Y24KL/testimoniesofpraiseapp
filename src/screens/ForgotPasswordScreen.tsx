import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { TopBar } from '@/components/TopBar';
import { useAuth } from '@/auth/AuthContext';
import { colors, type as t } from '@/constants/theme';
import { isValidEmail } from '@/utils/password';

export function ForgotPasswordScreen() {
  const nav = useNavigation();
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!isValidEmail(email)) return setError('Please enter a valid email address.');
    setBusy(true);
    setError(null);
    try {
      await resetPassword(email);
    } catch {
      /* Deliberately ignored: never reveal whether an account exists for this email. */
    }
    setBusy(false);
    setSent(true);
  };

  return (
    <Screen>
      <TopBar title="Reset password" onBack={() => nav.goBack()} />
      <View style={styles.content}>
        {sent ? (
          <>
            <Text style={styles.h}>Check your email</Text>
            <Text style={styles.p}>If an account exists for {email.trim()}, we’ve sent a link to reset your password.</Text>
            <PrimaryButton title="BACK TO SIGN IN" onPress={() => nav.goBack()} />
          </>
        ) : (
          <>
            <Text style={styles.p}>Enter the email you used to sign up and we’ll send you a link to reset your password.</Text>
            <TextField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="emailAddress" />
            {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
            <PrimaryButton title="SEND RESET LINK" onPress={submit} loading={busy} />
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 16 },
  h: { ...t.h2, color: colors.text },
  p: { ...t.body, color: colors.textMuted },
  error: { ...t.body, color: colors.danger, textAlign: 'center' },
});
