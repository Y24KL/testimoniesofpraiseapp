import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { colors, type as t } from '@/constants/theme';

/** The "Loading Praise" spinner: a soft glowing ring that turns while content is fetched. */
export function LoadingSpinner({ size = 44, label }: { size?: number; label?: string }) {
  const rot = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.timing(rot, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: true }));
    const b = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 800, useNativeDriver: true }),
      ]),
    );
    a.start();
    b.start();
    return () => {
      a.stop();
      b.stop();
    };
  }, [rot, pulse]);
  const spin = rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const glow = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.7] });

  return (
    <View style={styles.wrap} accessible accessibilityRole="progressbar" accessibilityLabel={label ?? 'Loading'}>
      <View style={{ width: size, height: size }}>
        <Animated.View style={[styles.glow, { width: size, height: size, borderRadius: size / 2, opacity: glow }]} />
        <Animated.View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: 3,
            borderColor: colors.border,
            borderTopColor: colors.accent,
            transform: [{ rotate: spin }],
          }}
        />
      </View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  glow: { position: 'absolute', backgroundColor: colors.primaryLight },
  label: { ...t.caps, color: colors.textMuted },
});
