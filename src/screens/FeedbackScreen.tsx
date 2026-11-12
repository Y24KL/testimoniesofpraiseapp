import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import NetInfo from '@react-native-community/netinfo';
import { useNavigation } from '@react-navigation/native';
import { repo } from '@/api';
import { useAuth } from '@/auth/AuthContext';
import { FeedbackSuccess } from '@/components/FeedbackSuccess';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { TopBar } from '@/components/TopBar';
import { colors, radius, type as t } from '@/constants/theme';
import { toAppError } from '@/utils/errors';
import {
  EMPTY_FEEDBACK,
  FEEDBACK_LIMITS,
  FEEDBACK_SEND_TIMEOUT_MS,
  FEEDBACK_TYPES,
  FEEDBACK_TYPE_LABELS,
  FeedbackTimeoutError,
  validateFeedback,
  withTimeout,
  type FeedbackErrors,
  type FeedbackInput,
  type FeedbackType,
} from '@/utils/feedback';

const TYPE_ICONS: Record<FeedbackType, React.ComponentProps<typeof Ionicons>['name']> = {
  general: 'chatbubble-ellipses-outline',
  suggestion: 'bulb-outline',
  problem: 'bug-outline',
  experience: 'phone-portrait-outline',
  other: 'ellipsis-horizontal-circle-outline',
};

const NOT_SENT_OFFLINE = 'Your feedback was not sent. Check your internet connection and try again. What you typed is still here.';
const NOT_SENT_WAIT = 'Your feedback was not sent. Please wait a moment and try again. What you typed is still here.';
const NOT_SENT = 'Your feedback was not sent. Please try again. What you typed is still here.';

/**
 * "Feedback & Suggestions": the form, and (only after Firestore confirms the save) the thank-you state.
 * Both live on one screen, so Back can never return to a filled-in form and send it twice.
 */
export function FeedbackScreen() {
  const nav = useNavigation();
  const { user } = useAuth();
  const [values, setValues] = useState<FeedbackInput>(EMPTY_FEEDBACK);
  const [errors, setErrors] = useState<FeedbackErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const inFlight = useRef(false); // blocks a second tap before React re-renders
  // A save that timed out may still be queued by Firestore. Retrying the same text waits on that same
  // save instead of starting another, so one feedback is never stored twice.
  const pending = useRef<{ key: string; work: Promise<void> } | null>(null);

  const set = <K extends keyof FeedbackInput>(key: K, value: FeedbackInput[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const leave = () => {
    if (nav.canGoBack()) nav.goBack();
    else nav.navigate('Tabs', { screen: 'Home' });
  };

  const sendAnother = () => {
    pending.current = null;
    setValues(EMPTY_FEEDBACK);
    setErrors({});
    setServerError(null);
    setSent(false);
  };

  const submit = async () => {
    if (inFlight.current) return;
    const found = validateFeedback(values);
    setErrors(found);
    setServerError(null);
    if (Object.keys(found).length > 0) return;
    if (!user?.uid) {
      setServerError('Please sign in again to send your feedback.');
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    try {
      const net = await NetInfo.fetch().catch(() => null);
      if (net && net.isConnected === false) {
        setServerError(NOT_SENT_OFFLINE);
        return;
      }
      const key = JSON.stringify(values);
      if (!pending.current || pending.current.key !== key) {
        const work = repo.submitFeedback(values, user.uid);
        work.catch(() => undefined); // handled below; avoids an unhandled rejection after a timeout
        pending.current = { key, work };
      }
      await withTimeout(pending.current.work, FEEDBACK_SEND_TIMEOUT_MS);
      pending.current = null;
      setSent(true); // only reached once the server has confirmed the write
    } catch (e) {
      if (e instanceof FeedbackTimeoutError) {
        setServerError(NOT_SENT_OFFLINE); // keep `pending`: the save may still go through
      } else {
        pending.current = null;
        const kind = toAppError(e).kind;
        setServerError(kind === 'network' ? NOT_SENT_OFFLINE : kind === 'permission' ? NOT_SENT_WAIT : NOT_SENT);
      }
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <Screen>
        <TopBar title="Feedback & Suggestions" onBack={leave} />
        <ScrollView contentContainerStyle={styles.successContent}>
          <FeedbackSuccess onBack={leave} onSendAnother={sendAnother} />
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <TopBar title="Feedback & Suggestions" onBack={leave} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={{ gap: 8 }}>
            <Text style={styles.introLead}>We'd love to hear from you!</Text>
            <Text style={styles.intro}>
              Your thoughts, ideas and suggestions help us make Testimonies of Praise better. Share your experience with us and let us know how we can improve.
            </Text>
          </View>

          <View style={{ gap: 8 }}>
            <Text style={styles.label}>Feedback type</Text>
            <View style={styles.types} accessibilityRole="radiogroup">
              {FEEDBACK_TYPES.map((type) => {
                const on = values.feedbackType === type;
                return (
                  <Pressable
                    key={type}
                    onPress={() => set('feedbackType', type)}
                    disabled={submitting}
                    style={({ pressed }) => [styles.typeCard, on && styles.typeCardOn, pressed && { opacity: 0.85 }]}
                    accessibilityRole="radio"
                    accessibilityLabel={FEEDBACK_TYPE_LABELS[type]}
                    accessibilityState={{ selected: on, checked: on, disabled: submitting }}
                  >
                    <View style={[styles.typeIcon, on && styles.typeIconOn]}>
                      <Ionicons name={TYPE_ICONS[type]} size={20} color={on ? colors.onAccent : colors.accent} />
                    </View>
                    <Text style={[styles.typeText, on && { color: colors.text }]}>{FEEDBACK_TYPE_LABELS[type]}</Text>
                    {on ? <Ionicons name="checkmark-circle" size={18} color={colors.accent} /> : null}
                  </Pressable>
                );
              })}
            </View>
            {errors.feedbackType ? <Text style={styles.fieldError}>{errors.feedbackType}</Text> : null}
          </View>

          <TextField
            label="Subject (optional)"
            value={values.subject}
            onChangeText={(v) => set('subject', v)}
            error={errors.subject}
            maxLength={FEEDBACK_LIMITS.subject}
            placeholder="What's your feedback about?"
            editable={!submitting}
            returnKeyType="next"
          />

          <View style={{ gap: 4 }}>
            <TextField
              label="Message"
              value={values.message}
              onChangeText={(v) => set('message', v)}
              error={errors.message}
              maxLength={FEEDBACK_LIMITS.message}
              placeholder="Tell us what you think. Share your experience, suggestions or any issues you've encountered..."
              editable={!submitting}
              multiline
              textAlignVertical="top"
              style={styles.message}
              accessibilityHint="Required"
            />
            <Text style={styles.counter}>
              {values.message.length}/{FEEDBACK_LIMITS.message}
            </Text>
          </View>

          <View style={{ gap: 10 }}>
            <Text style={styles.label}>How would you rate your experience with T.O.P?</Text>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((n) => {
                const filled = values.rating !== null && n <= values.rating;
                return (
                  <Pressable
                    key={n}
                    // Tapping the current rating again clears it: the rating is optional.
                    onPress={() => set('rating', values.rating === n ? null : n)}
                    disabled={submitting}
                    hitSlop={4}
                    style={styles.star}
                    accessibilityRole="button"
                    accessibilityLabel={`${n} ${n === 1 ? 'star' : 'stars'}`}
                    accessibilityState={{ selected: values.rating === n, disabled: submitting }}
                  >
                    <Ionicons name={filled ? 'star' : 'star-outline'} size={34} color={filled ? colors.accent : colors.textSubtle} />
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.optional}>Optional</Text>
          </View>

          {serverError ? (
            <Text style={styles.serverError} accessibilityRole="alert">
              {serverError}
            </Text>
          ) : null}

          <PrimaryButton
            title="SEND FEEDBACK"
            icon="send"
            loading={submitting}
            disabled={submitting}
            onPress={() => void submit()}
            accessibilityHint="Sends your feedback to the Testimonies of Praise team"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 20, paddingBottom: 48 },
  successContent: { flexGrow: 1, justifyContent: 'center' },
  introLead: { ...t.h2, color: colors.text },
  intro: { ...t.body, color: colors.textMuted },
  label: { ...t.small, color: colors.textMuted, fontWeight: '700' },
  types: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeCard: {
    flexGrow: 1,
    flexBasis: '46%',
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  typeCardOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  typeIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft },
  typeIconOn: { backgroundColor: colors.accent },
  typeText: { ...t.small, flex: 1, color: colors.textMuted, fontWeight: '700' },
  fieldError: { ...t.small, color: colors.danger },
  message: { minHeight: 140 },
  counter: { ...t.caption, color: colors.textSubtle, textAlign: 'right' },
  stars: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  star: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  optional: { ...t.caption, color: colors.textSubtle, textAlign: 'center' },
  serverError: { ...t.body, color: colors.danger, textAlign: 'center' },
});
