import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, radius, type as t } from '@/constants/theme';
import { downloadKey, useDownloads } from '@/downloads/DownloadsContext';
import type { Testimony } from '@/types';
import { formatDate, formatDuration } from '@/utils/format';

interface Props {
  item: Testimony;
  onPress: () => void;
  variant?: 'row' | 'hero' | 'tile';
}

function Meta({ item }: { item: Testimony }) {
  const d = formatDate(item.publishedAt ?? item.createdAt);
  return <Text style={styles.meta} numberOfLines={1}>{[item.authorName, d].filter(Boolean).join('  •  ')}</Text>;
}

function DownloadedBadge({ id }: { id: string }) {
  const dl = useDownloads().get(downloadKey('testimony', id));
  if (dl?.status !== 'done') return null;
  return (
    <View style={styles.badge} accessibilityLabel="Downloaded">
      <Ionicons name="checkmark-circle" size={14} color={colors.success} />
      <Text style={styles.badgeText}>SAVED</Text>
    </View>
  );
}

export function TestimonyCard({ item, onPress, variant = 'row' }: Props) {
  const dur = formatDuration(item.duration);
  const a11y = `${item.title}${item.authorName ? `, by ${item.authorName}` : ''}${dur ? `, ${dur}` : ''}`;

  if (variant === 'hero') {
    return (
      <Pressable onPress={onPress} style={styles.hero} accessibilityRole="button" accessibilityLabel={a11y}>
        <Image source={item.thumbnail} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
        <LinearGradient colors={gradients.card} style={StyleSheet.absoluteFill} />
        <View style={styles.heroBody}>
          <View style={styles.chip}><Text style={styles.chipText}>{(item.category ?? 'FEATURED').toUpperCase()}</Text></View>
          <Text style={styles.heroTitle} numberOfLines={2}>{item.title}</Text>
          <Meta item={item} />
        </View>
        <View style={styles.heroPlay}><Ionicons name="play" size={26} color={colors.text} /></View>
      </Pressable>
    );
  }

  if (variant === 'tile') {
    return (
      <Pressable onPress={onPress} style={styles.tile} accessibilityRole="button" accessibilityLabel={a11y}>
        <View style={styles.tileThumb}>
          <Image source={item.thumbnail} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
          {dur ? <View style={styles.dur}><Text style={styles.durText}>{dur}</Text></View> : null}
        </View>
        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
        <Meta item={item} />
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress} style={styles.row} accessibilityRole="button" accessibilityLabel={a11y}>
      <View style={styles.rowThumb}>
        <Image source={item.thumbnail} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
        {dur ? <View style={styles.dur}><Text style={styles.durText}>{dur}</Text></View> : null}
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        {item.category ? <Text style={styles.cat}>{item.category.toUpperCase()}</Text> : null}
        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
        <Meta item={item} />
        <DownloadedBadge id={item.id} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { height: 260, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.card, justifyContent: 'flex-end', marginHorizontal: 16 },
  heroBody: { padding: 16, gap: 6 },
  heroTitle: { ...t.h2, color: colors.text },
  heroPlay: { position: 'absolute', right: 16, top: 16, width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary + 'dd', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.accent },
  chip: { alignSelf: 'flex-start', backgroundColor: colors.accent, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  chipText: { ...t.caps, fontSize: 10, color: colors.bg },
  tile: { width: 200, gap: 6 },
  tileThumb: { height: 112, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.card },
  row: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 8, alignItems: 'flex-start' },
  rowThumb: { width: 132, height: 84, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.card },
  title: { ...t.h3, fontSize: 15, color: colors.text },
  cat: { ...t.caps, fontSize: 10, color: colors.accent },
  meta: { ...t.small, color: colors.textMuted },
  dur: { position: 'absolute', right: 6, bottom: 6, backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  durText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  badgeText: { ...t.caps, fontSize: 10, color: colors.success },
});
