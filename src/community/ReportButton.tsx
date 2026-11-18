import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useAuth } from '@/auth/AuthContext';
import { PrimaryButton } from '@/components/PrimaryButton';
import { spacing } from '@/constants/theme';
import { messageFor } from '@/utils/errors';
import { REPORT_REASONS, type ReportContentType, type ReportReason } from './rules';
import { submitReport } from './report';

/**
 * Lets a signed-in person report an item once, for one of the fixed reasons. The reasons are shown as a list
 * rather than an alert, because Android shows at most three alert buttons.
 */
export function ReportButton({ contentType, contentId, label = 'Report' }: { contentType: ReportContentType; contentId: string; label?: string }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const send = async (reason: ReportReason) => {
    if (!user) return;
    setBusy(true);
    try {
      const outcome = await submitReport(user.uid, contentType, contentId, reason);
      setOpen(false);
      Alert.alert(outcome === 'sent' ? 'Thank you' : 'Already reported', outcome === 'sent' ? 'Thank you for helping keep T.O.P. a safe place. Our team will review it.' : 'You have already reported this.');
    } catch (e) {
      Alert.alert('Could not send the report', messageFor(e));
    } finally {
      setBusy(false);
    }
  };

  const toggle = () => {
    if (!user) {
      Alert.alert('Sign in to report', 'Sign in so we can review what you report.');
      return;
    }
    setOpen((o) => !o);
  };

  return (
    <View style={styles.wrap}>
      <PrimaryButton title={open ? 'Cancel' : label} icon="flag-outline" variant="outline" compact onPress={toggle} />
      {open ? (
        <View style={styles.reasons} accessibilityRole="menu">
          {REPORT_REASONS.map((r) => (
            <PrimaryButton key={r.id} title={r.label} variant="outline" compact disabled={busy} loading={busy} onPress={() => void send(r.id)} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  reasons: { gap: spacing.sm },
});
