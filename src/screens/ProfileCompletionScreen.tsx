import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/auth/AuthContext';
import { Logo } from '@/components/Logo';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { TitlePicker } from '@/components/TitlePicker';
import { colors, radius, type as t } from '@/constants/theme';
import { PROFILE_LIMITS, validateProfile, type ProfileErrors, type ProfileInput } from '@/profile/validation';

const EMPTY: ProfileInput = { title: '', fullName: '', zone: '', church: '' };

/**
 * Shown once, right after a new account is created (email or Google), before the app opens.
 * Saves the profile against the signed-in UID; it is never shown again once saved.
 */
export function ProfileCompletionScreen() {
  const { completeProfile, signOut, user } = useAuth();
  const [form, setForm] = useState<ProfileInput>(EMPTY);
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const submitting = useRef(false);

  const set = (key: keyof ProfileInput) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (touched) setErrors((e) => ({ ...e, [key]: undefined }));
    setFormError(null);
  };

  const submit = async () => {
    if (submitting.current) return; // a second tap while saving does nothing
    setTouched(true);
    setFormError(null);
    const checked = validateProfile(form);
    if (!checked.ok) {
      setErrors(checked.errors);
      return;
    }
    setErrors({});
    submitting.current = true;
    setBusy(true);
    try {
      await completeProfile(form);
      // On success the navigator moves on by itself (the profile is no longer pending).
    } catch (e) {
      setFormError((e as Error).message || 'We couldn’t save your profile. Please try again.');
      setBusy(false);
      submitting.current = false;
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Logo size={56} />
            <Text style={styles.title} accessibilityRole="header">
              Complete your profile
            </Text>
            <Text style={styles.sub}>Tell us a little about you before you start. This takes less than a minute.</Text>
            {user?.email ? <Text style={styles.email}>{user.email}</Text> : null}
          </View>

          <TitlePicker value={form.title} onChange={set('title')} error={errors.title} disabled={busy} />

          <TextField
            label="Full name *"
            value={form.fullName}
            onChangeText={set('fullName')}
            autoCapitalize="words"
            textContentType="name"
            autoComplete="name"
            maxLength={PROFILE_LIMITS.fullName}
            editable={!busy}
            error={errors.fullName}
          />
          <TextField
            label="Zone *"
            value={form.zone}
            onChangeText={set('zone')}
            autoCapitalize="words"
            maxLength={PROFILE_LIMITS.zone}
            placeholder="e.g. Lagos Zone 1"
            editable={!busy}
            error={errors.zone}
          />
          <TextField
            label="Church *"
            value={form.church}
            onChangeText={set('church')}
            autoCapitalize="words"
            maxLength={PROFILE_LIMITS.church}
            placeholder="e.g. Christ Embassy Lagos"
            editable={!busy}
            error={errors.church}
          />

          {formError ? (
            <View style={styles.errBox} accessibilityRole="alert">
              <Ionicons name="alert-circle" size={18} color={colors.danger} />
              <Text style={styles.errText}>{formError}</Text>
            </View>
          ) : null}

          <PrimaryButton title="Continue" onPress={submit} loading={busy} disabled={busy} />
          <Pressable onPress={() => void signOut()} disabled={busy} accessibilityRole="button" style={styles.signOut} hitSlop={10}>
            <Text style={styles.signOutText}>Not you? Sign out</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 18, paddingBottom: 40 },
  header: { alignItems: 'center', gap: 8, marginBottom: 4 },
  title: { ...t.h1, color: colors.text, textAlign: 'center' },
  sub: { ...t.body, color: colors.textMuted, textAlign: 'center' },
  email: { ...t.small, color: colors.accent },
  errBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: radius.md, backgroundColor: 'rgba(255,107,127,0.12)', borderWidth: 1, borderColor: colors.danger },
  errText: { ...t.small, color: colors.danger, flex: 1 },
  signOut: { alignSelf: 'center', paddingVertical: 8 },
  signOutText: { ...t.small, color: colors.textMuted, fontWeight: '700' },
});
