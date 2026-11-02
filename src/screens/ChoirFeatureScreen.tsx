import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { CHOIR_FEATURE_INTRO, CHOIR_FEATURE_TITLE } from '@/constants/choirFeature';
import { colors, gradients, radius, type as t } from '@/constants/theme';

/** Landing page for "Feature your choir/group on T.O.P": intro, then the showcase of featured groups. */
export function ChoirFeatureScreen() {
  const nav = useNavigation();
  return (
    <Screen>
      <TopBar title="Feature your choir" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        <LinearGradient colors={gradients.hero} style={styles.banner}>
          <Text style={styles.bannerTitle} accessibilityRole="header">
            {CHOIR_FEATURE_TITLE}
          </Text>
        </LinearGradient>
        <View style={{ gap: 12 }}>
          {CHOIR_FEATURE_INTRO.map((p) => (
            <Text key={p} style={styles.intro}>{p}</Text>
          ))}
        </View>
        <View style={{ gap: 12 }}>
          <PrimaryButton title="EXPLORE FEATURED CHOIRS" icon="play-circle-outline" onPress={() => nav.navigate('ChoirShowcase')} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 20, paddingBottom: 40 },
  banner: { borderRadius: radius.lg, padding: 20, minHeight: 140, justifyContent: 'flex-end' },
  bannerTitle: { ...t.h1, fontSize: 24, color: colors.text },
  intro: { ...t.body, color: colors.text, lineHeight: 24 },
});
