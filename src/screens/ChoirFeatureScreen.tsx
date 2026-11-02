import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useEvent } from 'expo';
import { VideoView, useVideoPlayer } from 'expo-video';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { PrimaryButton } from '@/components/PrimaryButton';
import { CHOIR_FEATURE_INTRO, CHOIR_FEATURE_TITLE, CHOIR_HERO_VIDEO } from '@/constants/choirFeature';
import { type as t } from '@/constants/theme';

/** Landing page for "Feature your choir/group on T.O.P", laid out like ADOTOPOC: full-bleed hero, intro over it. */
export function ChoirFeatureScreen() {
  const nav = useNavigation();
  const [headline, ...details] = CHOIR_FEATURE_INTRO;
  const player = useVideoPlayer(CHOIR_HERO_VIDEO || null, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  return (
    <View style={styles.root}>
      {CHOIR_HERO_VIDEO ? (
        <VideoView player={player} style={[StyleSheet.absoluteFill, status !== 'readyToPlay' && { opacity: 0 }]} contentFit="cover" nativeControls={false} allowsFullscreen={false} allowsPictureInPicture={false} />
      ) : null}
      <LinearGradient colors={['#4B006E', '#2E0044', '#12001C']} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={['rgba(18,0,28,0.1)', 'rgba(18,0,28,0.9)']} style={StyleSheet.absoluteFill} />
      <Pressable onPress={() => nav.goBack()} accessibilityRole="button" accessibilityLabel="Back" style={styles.close} hitSlop={10}>
        <Ionicons name="close" size={22} color="#fff" />
      </Pressable>
      <View style={styles.copy}>
        <Text style={styles.eyebrow}>{CHOIR_FEATURE_TITLE}</Text>
        <Text style={styles.headline} accessibilityRole="header">
          {headline}
        </Text>
        {details.map((p) => (
          <Text key={p} style={styles.detail}>
            {p}
          </Text>
        ))}
        <View style={{ marginTop: 24 }}>
          <PrimaryButton title="EXPLORE FEATURED CHOIRS" icon="play-circle-outline" onPress={() => nav.navigate('ChoirShowcase')} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#2E0044', overflow: 'hidden' },
  close: { position: 'absolute', top: 56, left: 20, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(18,0,28,0.45)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.18)' },
  copy: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 24, paddingBottom: 48 },
  eyebrow: { ...t.caps, color: '#F5C542', letterSpacing: 1.5 },
  headline: { ...t.display, fontSize: 32, lineHeight: 38, color: '#fff', marginTop: 12 },
  detail: { ...t.body, color: 'rgba(255,255,255,0.85)', lineHeight: 24, marginTop: 14 },
});
