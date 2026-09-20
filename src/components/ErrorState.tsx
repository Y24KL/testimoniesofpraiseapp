import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, type as t } from '@/constants/theme';
import { PrimaryButton } from './PrimaryButton';
import { MESSAGES } from '@/utils/errors';

interface Props {
  message?: string;
  onRetry?: () => void;
  compact?: boolean;
}

export function ErrorState({ message = MESSAGES.generic, onRetry, compact }: Props) {
  return (
    <View style={[styles.wrap, compact && { padding: 16 }]} accessibilityRole="alert">
      <Ionicons name="alert-circle-outline" size={compact ? 32 : 46} color={colors.danger} />
      <Text style={styles.msg}>{message}</Text>
      {onRetry ? <PrimaryButton title="TRY AGAIN" onPress={onRetry} variant="outline" style={{ alignSelf: 'stretch' }} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 },
  msg: { ...t.body, color: colors.textMuted, textAlign: 'center' },
});
