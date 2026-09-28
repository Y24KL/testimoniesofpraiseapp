import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Logo } from '@/components/Logo';
import { useAuth } from '@/auth/AuthContext';
import { colors, gradients, type as t } from '@/constants/theme';
import { clearNewAccount } from '@/onboarding/welcome';

/** Shown exactly once, right after a brand-new account is created (email sign-up or a first-time Google sign-in). */
export function FirstTimeWelcomeScreen() {
  const { user, clearNewAccount: clearInMemory } = useAuth();

  const done = () => {
    if (user) void clearNewAccount(user.uid);
    clearInMemory();
  };

  return (
    <LinearGradient colors={gradients.hero} style={{ flex: 1 }}>
      <SafeAreaView style={styles.root}>
        <View style={styles.center}>
          <Logo size={110} />
          <Text style={styles.h}>Welcome{user?.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}!</Text>
          <Text style={styles.p}>We're glad you're here. Every testimony has a story, and we can't wait to hear yours.</Text>
          <View style={styles.row}>
            <Ionicons name="play-circle-outline" size={20} color={colors.accent} />
            <Text style={styles.rowText}>Watch and be encouraged by others' testimonies</Text>
          </View>
          <View style={styles.row}>
            <Ionicons name="radio-outline" size={20} color={colors.accent} />
            <Text style={styles.rowText}>Join us Live to hear amazing testimonies as they happen</Text>
          </View>
          <View style={styles.row}>
            <Ionicons name="heart-outline" size={20} color={colors.accent} />
            <Text style={styles.rowText}>Share what God has done for you by listening to the Loveworld Singers</Text>
          </View>
        </View>
        <PrimaryButton title="GET STARTED" onPress={done} />
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 24, justifyContent: 'space-between' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  h: { ...t.h1, fontSize: 26, color: colors.accent, textAlign: 'center', marginTop: 10 },
  p: { ...t.body, color: colors.textMuted, textAlign: 'center', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'stretch' },
  rowText: { ...t.body, color: colors.text, flex: 1 },
});
