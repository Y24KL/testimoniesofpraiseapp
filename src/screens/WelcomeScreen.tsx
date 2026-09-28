import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GoogleButton } from '@/components/GoogleButton';
import { Logo } from '@/components/Logo';
import { PrimaryButton } from '@/components/PrimaryButton';
import { colors, gradients, type as t } from '@/constants/theme';

export function WelcomeScreen() {
  const nav = useNavigation();
  const [error, setError] = useState<string | null>(null);
  return (
    <LinearGradient colors={gradients.hero} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} bounces={false}>
          <View style={styles.hero}>
            <Logo size={110} />
            <Text style={styles.welcome}>WELCOME TO</Text>
            <Text style={styles.brand}>TESTIMONIES OF PRAISE</Text>
            <Text style={styles.tag}>No one Praises God and goes away empty, He always blesses you for praising him.</Text>
          </View>
          <View style={{ gap: 12 }}>
            <GoogleButton onError={setError} />
            <PrimaryButton title="CONTINUE WITH EMAIL" icon="mail-outline" variant="outline" onPress={() => nav.navigate('EmailAuth', { mode: 'signin' })} />
            {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
            <Text style={styles.legal}>By continuing you agree to the Terms of Service and Privacy Policy.</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'space-between', padding: 24, gap: 32 },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 32 },
  welcome: { ...t.caps, color: colors.textMuted, marginTop: 18, letterSpacing: 4 },
  brand: { ...t.h1, fontSize: 26, color: colors.accent, textAlign: 'center', letterSpacing: 1.5 },
  tag: { ...t.body, color: colors.textMuted, textAlign: 'center', marginTop: 6 },
  error: { ...t.body, color: colors.danger, textAlign: 'center' },
  legal: { ...t.small, color: colors.textMuted, textAlign: 'center', fontSize: 12 },
});
