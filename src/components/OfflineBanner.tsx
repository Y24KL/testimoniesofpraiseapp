import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, type as t } from '@/constants/theme';
import { useNetwork } from '@/offline/useNetwork';
import { MESSAGES } from '@/utils/errors';

export function OfflineBanner() {
  const { isOffline } = useNetwork();
  if (!isOffline) return null;
  return (
    <View style={styles.bar} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Ionicons name="cloud-offline-outline" size={16} color={colors.text} />
      <Text style={styles.text}>{MESSAGES.offline}</Text>
      <Text style={styles.sub}>Downloads are still available.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.danger + 'cc', paddingHorizontal: 16, paddingVertical: 6 },
  text: { ...t.caps, color: colors.text },
  sub: { ...t.small, color: colors.text, opacity: 0.9 },
});
