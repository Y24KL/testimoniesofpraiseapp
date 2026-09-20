import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, type as t } from '@/constants/theme';
import { Logo } from './Logo';
import { LoadingSpinner } from './LoadingSpinner';

/**
 * Launch loader. It is shown ONLY while the app is really initialising (session restore) and
 * unmounts the moment that finishes: there is no artificial minimum delay.
 */
export function LoadingPraise() {
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(14)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.timing(rise, { toValue: 0, duration: 450, useNativeDriver: true }),
    ]).start();
  }, [fade, rise]);

  return (
    <LinearGradient colors={gradients.hero} style={styles.root}>
      <Animated.View style={[styles.center, { opacity: fade, transform: [{ translateY: rise }] }]}>
        <Logo size={120} />
        <Text style={styles.title}>LOADING PRAISE</Text>
        <LoadingSpinner size={34} />
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  center: { alignItems: 'center', gap: 22 },
  title: { ...t.caps, fontSize: 15, letterSpacing: 4, color: colors.accent },
});
