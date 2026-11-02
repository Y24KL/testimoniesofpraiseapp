import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StackActions, useNavigation } from '@react-navigation/native';
import { repo } from '@/api';
import { useAuth } from '@/auth/AuthContext';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { TopBar } from '@/components/TopBar';
import { CHOIR_FEATURE_TITLE } from '@/constants/choirFeature';
import { colors, type as t } from '@/constants/theme';
import { CHOIR_LIMITS, validateChoirRequest, type ChoirRequestErrors } from '@/utils/choirRequest';
import { messageFor } from '@/utils/errors';

const EMPTY = { groupName: '', churchZone: '', ministrationUrl: '', songTitle: '' };

/**
 * Submission form for "Feature your choir/group on T.O.P". Submissions are saved as pending for
 * review; nothing is published from here. The typed values stay on screen after a network error.
 */
export function ChoirRequestScreen() {
  const nav = useNavigation();
  const { user } = useAuth();
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<ChoirRequestErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const inFlight = useRef(false); // blocks a second tap before React re-renders

  const set = (key: keyof typeof EMPTY) => (text: string) => {
    setValues((v) => ({ ...v, [key]: text }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const submit = async () => {
    if (inFlight.current) return;
    const found = validateChoirRequest(values);
    setErrors(found);
    setServerError(null);
    if (Object.keys(found).length > 0) return;
    if (!user?.uid) {
      setServerError('Please sign in again to send your request.');
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    try {
      await repo.submitChoirFeatureRequest(values, user.uid);
      // replace (not push) so Back cannot return to a filled-in form and send it twice.
      nav.dispatch(StackActions.replace('ChoirRequestSent'));
    } catch (e) {
      setServerError(messageFor(e));
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <TopBar title={CHOIR_FEATURE_TITLE} onBack={() => nav.goBack()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <TextField
            label="Group name"
            value={values.groupName}
            onChangeText={set('groupName')}
            error={errors.groupName}
            maxLength={CHOIR_LIMITS.groupName}
            autoCapitalize="words"
            editable={!submitting}
            accessibilityHint="Required"
          />
          <TextField
            label="Church zone"
            value={values.churchZone}
            onChangeText={set('churchZone')}
            error={errors.churchZone}
            maxLength={CHOIR_LIMITS.churchZone}
            autoCapitalize="words"
            editable={!submitting}
            accessibilityHint="Required"
          />
          <TextField
            label="Ministration URL"
            value={values.ministrationUrl}
            onChangeText={set('ministrationUrl')}
            error={errors.ministrationUrl}
            maxLength={CHOIR_LIMITS.ministrationUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="https://www.youtube.com/watch?v=..."
            placeholderTextColor={colors.textSubtle}
            editable={!submitting}
            accessibilityHint="Required. A YouTube, Facebook or Vimeo link"
          />
          <TextField
            label="Song title"
            value={values.songTitle}
            onChangeText={set('songTitle')}
            error={errors.songTitle}
            maxLength={CHOIR_LIMITS.songTitle}
            editable={!submitting}
            accessibilityHint="Required"
          />

          {serverError ? (
            <Text style={styles.serverError} accessibilityRole="alert">
              {serverError}
            </Text>
          ) : null}

          <PrimaryButton
            title="SUBMIT REQUEST"
            icon="send-outline"
            loading={submitting}
            disabled={submitting}
            onPress={() => void submit()}
            accessibilityHint="Sends your request for review"
          />
          <Text style={styles.note}>Your request is reviewed before anything is published.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  serverError: { ...t.body, color: colors.danger, textAlign: 'center' },
  note: { ...t.caption, color: colors.textSubtle, textAlign: 'center' },
});
