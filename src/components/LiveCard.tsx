import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, radius, type as t } from '@/constants/theme';
import type { LiveConfig } from '@/types';
import { Skeleton } from './SkeletonCard';

export function LiveBadge() {
  const o = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(o, { toValue: 0.35, duration: 700, useNativeDriver: true }),
        Animated.timing(o, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    a.start();
    return () => a.stop();
  }, [o]);
  return (
    <View style={styles.badge} accessible accessibilityLabel="Live now">
      <Animated.View style={[styles.dot, { opacity: o }]} />
      <Text style={styles.badgeText}>LIVE NOW</Text>
    </View>
  );
}

export function LiveCard({ live, onPress }: { live: LiveConfig | null; onPress: () => void }) {
  if (!live) return <Skeleton style={{ height: 120, marginHorizontal: 16, borderRadius: radius.lg }} />;
  return (
    <Pressable onPress={onPress} style={styles.card} accessibilityRole="button" accessibilityLabel={live.isLive ? `Live now: ${live.title ?? 'Watch live'}` : 'Live stream is currently offline'}>
      {live.thumbnail ? <Image source={live.thumbnail} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
      <LinearGradient colors={live.isLive ? ['rgba(75,0,110,0.55)', 'rgba(18,0,28,0.95)'] : gradients.card} style={StyleSheet.absoluteFill} />
      <View style={styles.body}>
        {live.isLive ? <LiveBadge /> : <Text style={styles.offline}>LIVE STREAM IS CURRENTLY OFFLINE.</Text>}
        <Text style={styles.title} numberOfLines={2}>{live.isLive ? live.title ?? 'Watch Live' : 'WATCH LIVE'}</Text>
        <Text style={styles.sub}>{live.isLive ? 'Tap to join the broadcast' : 'We’ll notify you when we go live'}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { minHeight: 130, marginHorizontal: 16, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, justifyContent: 'flex-end' },
  body: { padding: 16, gap: 6 },
  title: { ...t.h2, color: colors.text },
  sub: { ...t.small, color: colors.textMuted },
  offline: { ...t.caps, color: colors.textMuted },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: colors.live, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  badgeText: { ...t.caps, color: '#fff' },
});
