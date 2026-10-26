import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, type as t } from '@/constants/theme';
import type { WrittenTestimony } from '@/types';
import { formatDate, initials } from '@/utils/format';

/** Gold-ringed photo (or initials) used on written testimony cards and the reading screen. */
export function TestifierAvatar({ name, photoUrl, size = 52 }: { name?: string; photoUrl?: string; size?: number }) {
  return (
    <View style={[styles.ring, { width: size + 8, height: size + 8, borderRadius: (size + 8) / 2 }]}>
      {photoUrl ? (
        <Image source={photoUrl} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" transition={150} />
      ) : (
        <View style={[styles.initials, { width: size, height: size, borderRadius: size / 2 }]}>
          <Text style={[styles.initialsText, { fontSize: size * 0.36 }]}>{initials(name) || 'T'}</Text>
        </View>
      )}
    </View>
  );
}

/** One written testimony in the library: who, where, a short excerpt and the date. */
export function WrittenTestimonyCard({ item, onPress }: { item: WrittenTestimony; onPress: () => void }) {
  const date = formatDate(item.publishedAt ?? item.createdAt);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] }]}
      accessibilityRole="button"
      accessibilityLabel={`Read ${item.title}${item.authorName ? ` by ${item.authorName}` : ''}`}
    >
      <View style={styles.head}>
        <TestifierAvatar name={item.authorName} photoUrl={item.authorPhotoUrl} size={44} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>
            {item.authorName || 'Testimonies of Praise'}
          </Text>
          {item.churchZone ? (
            <Text style={styles.zone} numberOfLines={1}>
              {item.churchZone}
            </Text>
          ) : null}
        </View>
        <Text style={styles.quote} accessibilityElementsHidden importantForAccessibility="no">
          ”
        </Text>
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {item.title}
      </Text>
      <Text style={styles.excerpt} numberOfLines={4}>
        {item.excerpt}
      </Text>
      <View style={styles.foot}>
        <Text style={styles.meta} numberOfLines={1}>
          {[item.category, date].filter(Boolean).join('  •  ')}
        </Text>
        <View style={styles.read}>
          <Text style={styles.readText}>Read</Text>
          <Ionicons name="arrow-forward" size={14} color={colors.accent} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ring: { backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  initials: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  initialsText: { color: colors.accent, fontWeight: '800' },
  card: {
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 16,
    gap: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(245,197,66,0.22)',
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { ...t.h3, color: colors.text },
  zone: { ...t.small, color: colors.textMuted },
  quote: { fontSize: 44, lineHeight: 44, fontWeight: '900', color: colors.primaryLight, marginTop: 6 },
  title: { ...t.h2, fontSize: 18, lineHeight: 24, color: colors.accent },
  excerpt: { ...t.body, color: colors.textMuted },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 2 },
  meta: { ...t.caption, color: colors.textSubtle, flex: 1 },
  read: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  readText: { ...t.small, color: colors.accent, fontWeight: '800' },
});
