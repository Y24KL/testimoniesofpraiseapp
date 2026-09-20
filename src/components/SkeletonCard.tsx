import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, type ViewStyle, type StyleProp } from 'react-native';
import { colors, radius } from '@/constants/theme';

export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const o = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(o, { toValue: 0.9, duration: 700, useNativeDriver: true }),
        Animated.timing(o, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    a.start();
    return () => a.stop();
  }, [o]);
  return <Animated.View style={[{ backgroundColor: colors.card, opacity: o, borderRadius: radius.sm }, style]} />;
}

export function SkeletonCard({ horizontal }: { horizontal?: boolean }) {
  return horizontal ? (
    <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Skeleton style={{ width: 132, height: 84, borderRadius: radius.md }} />
      <View style={{ flex: 1, gap: 8 }}>
        <Skeleton style={{ height: 14, width: '90%' }} />
        <Skeleton style={{ height: 12, width: '60%' }} />
        <Skeleton style={{ height: 12, width: '40%' }} />
      </View>
    </View>
  ) : (
    <View style={{ gap: 10 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Skeleton style={{ height: 180, borderRadius: radius.lg }} />
      <Skeleton style={{ height: 14, width: '80%' }} />
      <Skeleton style={{ height: 12, width: '50%' }} />
    </View>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', gap: 12, alignItems: 'center' } });
