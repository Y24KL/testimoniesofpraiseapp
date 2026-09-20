import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { repo } from '@/api';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { TestimonySubmissionForm, type SubmissionValues } from '@/components/TestimonySubmissionForm';
import { TopBar } from '@/components/TopBar';
import { useAuth } from '@/auth/AuthContext';
import { colors, type as t } from '@/constants/theme';
import { messageFor } from '@/utils/errors';

export function ShareTestimonyScreen() {
  const nav = useNavigation();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  const submit = async (v: SubmissionValues) => {
    setBusy(true);
    setError(null);
    try {
      await repo.submitTestimony({ ...v, userId: user?.uid, userEmail: user?.email });
      setDone(true);
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <TopBar title="Share your testimony" onBack={() => nav.goBack()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {done ? (
            <View style={styles.success} accessibilityLiveRegion="polite">
              <Ionicons name="checkmark-circle" size={64} color={colors.success} />
              <Text style={styles.msg}>Praise the Lord! Your testimony has been received.</Text>
              <PrimaryButton title="SUBMIT ANOTHER" style={{ alignSelf: 'stretch' }} onPress={() => { setDone(false); setFormKey((k) => k + 1); }} />
              <PrimaryButton title="DONE" variant="outline" style={{ alignSelf: 'stretch' }} onPress={() => nav.goBack()} />
            </View>
          ) : (
            <TestimonySubmissionForm key={formKey} initialName={user?.displayName ?? ''} submitting={busy} error={error} onSubmit={submit} />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, flexGrow: 1 },
  success: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingTop: 48 },
  msg: { ...t.h2, color: colors.text, textAlign: 'center' },
});
