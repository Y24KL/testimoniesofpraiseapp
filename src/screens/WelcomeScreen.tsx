import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KingsChatSignInError, signInWithKingsChat } from '@/auth/kingschat';
import { Logo } from '@/components/Logo';
import { OnboardingBackdrop } from '@/components/OnboardingBackdrop';
import { PrimaryButton } from '@/components/PrimaryButton';
import { colors, type as t } from '@/constants/theme';
import { useOnboardingMedia } from '@/hooks/useOnboardingMedia';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export function WelcomeScreen() {
  const nav = useNavigation();
  const { media } = useOnboardingMedia();
  const reducedMotion = useReducedMotion();
  const [error, setError] = useState<string | null>(null);
  const [kingsChatBusy, setKingsChatBusy] = useState(false);
  const enter = useRef(new Animated.Value(0)).current;

  const kingsChat = async () => {
    setError(null);
    setKingsChatBusy(true);
    try {
      await signInWithKingsChat();
    } catch (e) {
      setError(e instanceof KingsChatSignInError ? e.message : 'KingsChat sign-in didn’t finish. Try again.');
    } finally {
      setKingsChatBusy(false);
    }
  };

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
          <Animated.View style={[styles.copy, rise]}>
            <Logo size={media.type === 'none' ? 120 : 84} />
            <Text style={styles.welcome} accessibilityRole="header">Welcome to Testimonies of Praise</Text>
            <Text style={styles.tagline}>No one ever praised God and went away empty, he blesses you for praising him.</Text>
            <Text style={styles.attribution}>Rev. Chris Oyakhilome DSc. DSc. DD</Text>
          </Animated.View>

          <Animated.View style={[styles.actions, rise]}>
            <Pressable
              onPress={kingsChat}
              disabled={kingsChatBusy}
              accessibilityRole="button"
              accessibilityLabel="Continue with KingsChat"
              accessibilityHint="Sign in with your KingsChat account"
              accessibilityState={{ disabled: kingsChatBusy, busy: kingsChatBusy }}
              style={({ pressed }) => [styles.kingsChat, (pressed || kingsChatBusy) && { opacity: 0.85 }]}
            >
              {kingsChatBusy ? <ActivityIndicator color="#fff" /> : null}
              <Text style={styles.kingsChatText}>Continue with KingsChat</Text>
            </Pressable>
            <PrimaryButton title="Sign in with email" icon="mail-outline" onPress={() => nav.navigate('EmailAuth', { mode: 'signin' })} accessibilityHint="Sign in with your email and password" />
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
  header: { alignItems: 'center', gap: 12, paddingTop: 16 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  eyebrowRule: { width: 28, height: 1, backgroundColor: colors.accent },
  eyebrow: { ...t.caps, color: colors.accent, letterSpacing: 3, fontSize: 12 },
  title: { ...t.display, fontSize: 32, lineHeight: 38, color: colors.text, textAlign: 'center' },
  titleGold: { color: colors.accent },
  subtitle: { ...t.body, color: colors.textMuted, textAlign: 'center' },
  copy: { flexGrow: 1, justifyContent: 'flex-end', alignItems: 'center', gap: 14 },
  welcome: { ...t.display, fontSize: 28, lineHeight: 36, letterSpacing: 0, color: colors.text, textAlign: 'center', alignSelf: 'stretch' },
  tagline: { ...t.body, color: colors.text, textAlign: 'center', fontWeight: '700', fontSize: 15, lineHeight: 22, paddingHorizontal: 8 },
  attribution: { ...t.small, color: colors.textSubtle, fontStyle: 'italic', textAlign: 'center', marginTop: -6 },
  actions: { gap: 12 },
  // KingsChat's own button colours (kingschat-web-sdk stylesheet): #2F92E5 with white text, 4px corners.
  kingsChat: { minHeight: 48, borderRadius: 4, backgroundColor: '#2F92E5', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 16 },
  kingsChatText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  signIn: { alignSelf: 'stretch', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12 },
  signInText: { ...t.body, color: colors.textMuted },
  signInLink: { color: colors.accent, fontWeight: '800' },
  error: { ...t.body, color: colors.danger, textAlign: 'center' },
  legal: { ...t.small, fontSize: 12, color: colors.textSubtle, textAlign: 'center' },
});
