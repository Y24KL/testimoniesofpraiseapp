import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StatusBar, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEvent } from 'expo';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { repo } from '@/api';
import { colors, gradients, radius, shadow, type as t } from '@/constants/theme';
import type { AdotopocConfig } from '@/types';
import { isWebUrl, openInExternalBrowser } from '@/utils/openExternal';
import { useFeatureVoiceover } from '@/voiceover/useFeatureVoiceover';

const DEFAULT_VIDEO_URL = 'https://topappstorage.b-cdn.net/video/ADOTOP_LOGO_OUTRO_m1awjk.mp4';
const DEFAULT_PAGE_URL = 'https://testimoniesofpraiseweb.onrender.com/adotopoc';
const LOGO = require('../../assets/LOG_xcvt3v.webp');

/**
 * ADOTOPOC (A Day Of Testimonies Of Praise Outreaches & Crusades): full-bleed intro video with the
 * call to action on top, laid out like a premium onboarding card (controls top-left, brand badge
 * top-right, left-aligned headline and a gold button at the bottom). The Resource Center opens in
 * the phone's browser (Chrome when installed), never inside the app.
 */
export function AdotopocScreen() {
  useFeatureVoiceover('feature.adotopoc');
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const focused = useIsFocused();
  const [config, setConfig] = useState<AdotopocConfig>({ resourcePageUrl: DEFAULT_PAGE_URL, introVideoUrl: DEFAULT_VIDEO_URL, introEnabled: true });
  const [muted, setMuted] = useState(true);
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);

  useEffect(() => {
    repo
      .getAdotopocConfig()
      .then(setConfig)
      .catch(() => undefined); // the built-in defaults keep the page usable offline
  }, []);

  const videoUri = config.introEnabled ? config.introVideoUrl || DEFAULT_VIDEO_URL : null;
  const player = useVideoPlayer(videoUri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const videoReady = !!videoUri && status === 'readyToPlay';
  const videoFailed = !!videoUri && status === 'error';

  // Don't keep the intro playing (and using data) behind other screens or while in the browser.
  useEffect(() => {
    if (!videoUri) return;
    if (focused) player.play();
    else player.pause();
  }, [focused, player, videoUri]);

  const toggleMute = () => {
    player.muted = !muted;
    setMuted(!muted);
  };

  const pageUrl = config.resourcePageUrl?.trim() || DEFAULT_PAGE_URL;
  const openResourceCenter = async () => {
    if (opening) return;
    setOpenError(null);
    if (!isWebUrl(pageUrl)) return setOpenError('The Resource Center link isn’t set up correctly. Please try again later.');
    setOpening(true);
    try {
      await openInExternalBrowser(pageUrl);
    } catch {
      setOpenError('Couldn’t open your browser. Check that a browser is installed and try again.');
    } finally {
      setOpening(false);
    }
  };

  const wide = width >= 600;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Brand backdrop: shown while the video loads, if it fails, or when the intro is turned off. */}
      <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />
      {!videoReady ? (
        <View style={styles.backdropCenter} pointerEvents="none">
          <Image source={LOGO} style={styles.backdropLogo} contentFit="contain" accessibilityIgnoresInvertColors />
          {videoUri && !videoFailed ? <ActivityIndicator color={colors.accent} style={{ marginTop: 18 }} /> : null}
        </View>
      ) : null}
      {videoUri && !videoFailed ? (
        <VideoView player={player} style={[StyleSheet.absoluteFill, !videoReady && { opacity: 0 }]} contentFit="cover" nativeControls={false} allowsFullscreen={false} allowsPictureInPicture={false} />
      ) : null}

      {/* Brand-tinted scrim keeps text readable on bright frames (the intro has white sections). */}
      <LinearGradient
        colors={['rgba(18,0,28,0.55)', 'rgba(18,0,28,0.08)', 'rgba(18,0,28,0.15)', 'rgba(18,0,28,0.82)', 'rgba(18,0,28,0.98)']}
        locations={[0, 0.2, 0.45, 0.72, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={[styles.topBar, { top: insets.top + 10 }]}>
        <View style={styles.topLeft}>
          <Pressable onPress={() => nav.goBack()} style={styles.iconBtn} hitSlop={6} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={22} color="#fff" />
          </Pressable>
          {videoReady ? (
            <Pressable onPress={toggleMute} style={styles.iconBtn} hitSlop={6} accessibilityRole="button" accessibilityLabel={muted ? 'Turn sound on' : 'Turn sound off'}>
              <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={20} color="#fff" />
            </Pressable>
          ) : null}
        </View>
        <View style={styles.badge} accessibilityRole="image" accessibilityLabel="ADOTOPOC">
          <Image source={LOGO} style={styles.badgeLogo} contentFit="contain" />
          <Text style={styles.badgeText}>ADOTOPOC</Text>
        </View>
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 28 }, wide && styles.bottomWide]}>
        <Text style={styles.eyebrow}>OUTREACHES & CRUSADES</Text>
        <Text style={[styles.headline, wide && { fontSize: 38, lineHeight: 44 }]} accessibilityRole="header">
          Want to host A Day of Testimonies of Praise?
        </Text>
        <Text style={styles.sub}>Everything you need to plan your outreach or crusade is in our Resource Center.</Text>

        <Pressable
          onPress={openResourceCenter}
          disabled={opening}
          style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
          accessibilityRole="link"
          accessibilityLabel="Go to our Resource Center. Opens in your browser."
          accessibilityState={{ busy: opening }}
        >
          <LinearGradient colors={gradients.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          {opening ? <ActivityIndicator color={colors.onAccent} /> : <Text style={styles.ctaText}>Go to Resource Center</Text>}
          {!opening ? <Ionicons name="open-outline" size={18} color={colors.onAccent} /> : null}
        </Pressable>
        <View style={styles.hintRow}>
          <Ionicons name="globe-outline" size={13} color={colors.textSubtle} />
          <Text style={styles.hint}>Opens in your browser</Text>
        </View>
        {openError ? (
          <Text style={styles.error} accessibilityRole="alert">
            {openError}
          </Text>
        ) : null}
        {videoFailed ? <Text style={styles.hint}>The intro video couldn’t load. You can still open the Resource Center.</Text> : null}
      </View>
    </View>
  );
}

const glass = { backgroundColor: 'rgba(18,0,28,0.45)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' } as const;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  backdropCenter: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', paddingBottom: 160 },
  backdropLogo: { width: 150, height: 150, opacity: 0.9 },
  topBar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 5 },
  topLeft: { flexDirection: 'row', gap: 10 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', ...glass },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 6, paddingRight: 12, paddingVertical: 6, borderRadius: radius.sm, backgroundColor: colors.primary, borderWidth: 1, borderColor: 'rgba(245,197,66,0.55)', ...shadow.card },
  badgeLogo: { width: 30, height: 30 },
  badgeText: { ...t.label, color: colors.accent, letterSpacing: 1.4 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 24, gap: 12 },
  bottomWide: { paddingHorizontal: 48, maxWidth: 640 },
  eyebrow: { ...t.caps, color: colors.accent },
  headline: { ...t.display, color: colors.text, textShadowColor: 'rgba(0,0,0,0.45)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 },
  sub: { ...t.body, fontSize: 17, lineHeight: 24, color: 'rgba(255,255,255,0.88)', maxWidth: 480 },
  cta: {
    marginTop: 10,
    alignSelf: 'flex-start',
    minWidth: 240,
    maxWidth: 360,
    height: 56,
    paddingHorizontal: 24,
    borderRadius: 12,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    ...shadow.gold,
  },
  ctaText: { fontSize: 17, fontWeight: '800', color: colors.onAccent },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hint: { ...t.caption, color: colors.textSubtle },
  error: { ...t.small, color: colors.danger },
});
