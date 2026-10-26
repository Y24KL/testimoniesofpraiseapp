import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GoogleButton } from '@/components/GoogleButton';
import { Logo } from '@/components/Logo';
import { OnboardingBackdrop } from '@/components/OnboardingBackdrop';
import { PrimaryButton } from '@/components/PrimaryButton';
import { isGoogleConfigured } from '@/constants/config';
import { colors, type as t } from '@/constants/theme';
import { useOnboardingMedia } from '@/hooks/useOnboardingMedia';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const FEATURES = ['Live broadcasts', 'Video testimonies', 'TOP Radio', 'Offline downloads'];

export function WelcomeScreen() {
  const nav = useNavigation();
  const { media } = useOnboardingMedia();
  const reducedMotion = useReducedMotion();
  const [error, setError] = useState<string | null>(null);
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) {
      enter.setValue(1);
      return;
    }
    Animated.timing(enter, { toValue: 1, duration: 520, delay: 120, useNativeDriver: true }).start();
  }, [enter, reducedMotion]);

  const rise = { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] };

  return (
    <View style={styles.root}>
      <OnboardingBackdrop media={media} />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content} bounces={false} showsVerticalScrollIndicator={false}>
          <View style={styles.top}>
            <Logo size={media.type === 'none' ? 120 : 64} />
          </View>

          <Animated.View style={[styles.copy, rise]}>
            <Text style={styles.eyebrow}>WELCOME TO</Text>
            <Text style={styles.title} accessibilityRole="header">
              Testimonies{'\n'}of Praise
            </Text>
            <Text style={styles.tagline}>
              “Nobody ever praised God and went away empty, He always blesses you for praising Him.”
            </Text>
            <Text style={styles.attribution}>Rev. Chris Oyakhilome DSc. DSc. DD</Text>
            <View style={styles.chips}>
              {FEATURES.map((f) => (
                <View key={f} style={styles.chip}>
                  <Text style={styles.chipText}>{f}</Text>
                </View>
              ))}
            </View>
          </Animated.View>

          <Animated.View style={[styles.actions, rise]}>
            <PrimaryButton title="Get started" icon="arrow-forward" onPress={() => nav.navigate('EmailAuth', { mode: 'signup' })} accessibilityHint="Create a free account" />
            {isGoogleConfigured ? <GoogleButton onError={setError} /> : null}
            <Pressable onPress={() => nav.navigate('EmailAuth', { mode: 'signin' })} style={styles.signIn} accessibilityRole="button" accessibilityLabel="I already have an account. Sign in">
              <Text style={styles.signInText}>
                Already have an account? <Text style={styles.signInLink}>Sign in</Text>
              </Text>
            </Pressable>
            {error ? (
              <Text style={styles.error} accessibilityRole="alert">
                {error}
              </Text>
            ) : null}
            <Text style={styles.legal}>By continuing you agree to the Terms of Service and Privacy Policy.</Text>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 12, justifyContent: 'space-between', gap: 24 },
  top: { alignItems: 'center', paddingTop: 20 },
  copy: { flexGrow: 1, justifyContent: 'flex-end', gap: 8 },
  eyebrow: { ...t.caps, color: colors.accent, letterSpacing: 3 },
  title: { ...t.display, fontSize: 40, lineHeight: 44, color: colors.text },
  tagline: { ...t.body, color: colors.textMuted, marginTop: 6 },
  attribution: { ...t.small, color: colors.textSubtle, fontStyle: 'italic' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(245,197,66,0.35)' },
  chipText: { ...t.small, fontSize: 12, color: colors.text, fontWeight: '600' },
  actions: { gap: 12 },
  signIn: { alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 12 },
  signInText: { ...t.body, color: colors.textMuted },
  signInLink: { color: colors.accent, fontWeight: '800' },
  error: { ...t.body, color: colors.danger, textAlign: 'center' },
  legal: { ...t.small, fontSize: 12, color: colors.textSubtle, textAlign: 'center' },
});
