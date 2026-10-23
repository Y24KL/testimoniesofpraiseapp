import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, type as t } from '@/constants/theme';

interface Props {
  title: string;
  subtitle?: string;
  action?: string;
  onAction?: () => void;
}

export function SectionHeader({ title, subtitle, action, onAction }: Props) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {action ? (
        <Pressable onPress={onAction} hitSlop={12} style={styles.actionBtn} accessibilityRole="button" accessibilityLabel={`${action}: ${title}`}>
          <Text style={styles.action}>{action}</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.accent} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 28, marginBottom: 12, gap: 12 },
  title: { ...t.h2, color: colors.text },
  subtitle: { ...t.small, color: colors.textSubtle, marginTop: 2 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 2 },
  action: { ...t.small, color: colors.accent, fontWeight: '700' },
});
