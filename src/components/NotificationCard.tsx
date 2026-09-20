import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, type as t } from '@/constants/theme';
import type { AppNotification } from '@/types';
import { formatDate } from '@/utils/format';

const ICON: Record<AppNotification['type'], React.ComponentProps<typeof Ionicons>['name']> = {
  testimony: 'play-circle',
  resource: 'albums',
  live: 'radio',
  announcement: 'megaphone',
  featured: 'star',
};

export function NotificationCard({ item, onPress }: { item: AppNotification; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.card} accessibilityRole="button" accessibilityLabel={`${item.title}. ${item.message}`}>
      <View style={styles.icon}><Ionicons name={ICON[item.type]} size={22} color={colors.accent} /></View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.msg}>{item.message}</Text>
        <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: 12, marginHorizontal: 16, marginVertical: 5, padding: 14, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  title: { ...t.h3, fontSize: 15, color: colors.text },
  msg: { ...t.body, fontSize: 14, color: colors.textMuted },
  date: { ...t.small, fontSize: 12, color: colors.textMuted },
});
