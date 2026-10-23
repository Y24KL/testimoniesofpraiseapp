import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import NetInfo from '@react-native-community/netinfo';
import { useEvent } from 'expo';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { OnboardingMedia } from '@/constants/onboarding';
import { colors, gradients } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { isHls } from '@/utils/format';

/** Branded fallback: used when no media is configured, while loading, or when media fails. */
function BrandBackground() {
  return (
    <>
      <LinearGradient colors={['#5A0E82', '#2E0044', '#12001C']} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={[styles.glow, { top: -120, right: -80, backgroundColor: 'rgba(245,197,66,0.16)' }]} />
      <View style={[styles.glow, { bottom: 120, left: -140, backgroundColor: 'rgba(122,31,162,0.45)' }]} />
    </>
  );
}

function BackdropImage({ uri, onError }: { uri: string; onError?: () => void }) {
  return (
    <Image
      source={{ uri }}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      transition={400}
      cachePolicy="memory-disk"
      priority="high"
      onError={onError}
      accessible={false}
    />
  );
}

function BackdropVideo({ media, onFail }: { media: OnboardingMedia; onFail: () => void }) {
  const [muted, setMuted] = useState(true);
  const insets = useSafeAreaInsets();
  const player = useVideoPlayer({ uri: media.url, contentType: isHls(media.url) ? 'hls' : 'auto' }, (p) => {
    p.muted = true; // muted autoplay is what browsers and iOS allow without a tap
    p.loop = true;
    p.audioMixingMode = 'mixWithOthers'; // never interrupt the user's music for a background clip
    p.play();
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  useEffect(() => {
    if (status === 'error') onFail();
  }, [status, onFail]);
  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);

  return (
    <>
      {media.posterUrl && status !== 'readyToPlay' ? <BackdropImage uri={media.posterUrl} /> : null}
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} allowsFullscreen={false} allowsPictureInPicture={false} />
      <Pressable
        onPress={() => setMuted((m) => !m)}
        style={[styles.mute, { top: insets.top + 12 }]}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={muted ? 'Unmute intro video' : 'Mute intro video'}
      >
        <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={20} color={colors.text} />
      </Pressable>
    </>
  );
}

/**
 * Full-bleed onboarding visual (image or video) with a readability scrim. Any failure falls back
 * to the poster, then to the branded background, so the Welcome actions are never blocked.
 */
export function OnboardingBackdrop({ media }: { media: OnboardingMedia }) {
  const reducedMotion = useReducedMotion();
  const [failed, setFailed] = useState(false);
  const [metered, setMetered] = useState(false);
  const [userStartedVideo, setUserStartedVideo] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    setFailed(false);
  }, [media.url]);
  useEffect(() => {
    if (media.type !== 'video') return;
    void NetInfo.fetch().then((s) => setMetered(Boolean(s.details && 'isConnectionExpensive' in s.details && s.details.isConnectionExpensive)));
  }, [media.type]);

  // On metered data or with reduce-motion we show the still poster and let the user opt in.
  const holdVideo = media.type === 'video' && !userStartedVideo && Boolean(media.posterUrl) && (metered || reducedMotion);

  let content: React.ReactNode = null;
  if (media.type === 'image' && !failed) content = <BackdropImage uri={media.url} onError={() => setFailed(true)} />;
  else if (media.type === 'video' && failed && media.posterUrl) content = <BackdropImage uri={media.posterUrl} />;
  else if (media.type === 'video' && holdVideo && media.posterUrl) content = <BackdropImage uri={media.posterUrl} />;
  else if (media.type === 'video' && !failed) content = <BackdropVideo media={media} onFail={() => setFailed(true)} />;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <BrandBackground />
      {content}
      {content ? (
        <LinearGradient
          colors={gradients.scrim}
          locations={[0, 0.45, 1]}
          style={[StyleSheet.absoluteFill, { opacity: 0.45 + media.overlayOpacity * 0.55 }]}
          pointerEvents="none"
        />
      ) : null}
      {holdVideo ? (
        <Pressable onPress={() => setUserStartedVideo(true)} style={[styles.playIntro, { top: insets.top + 12 }]} accessibilityRole="button" accessibilityLabel="Play intro video">
          <Ionicons name="play" size={18} color={colors.text} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  glow: { position: 'absolute', width: 340, height: 340, borderRadius: 170 },
  mute: { position: 'absolute', left: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(18,0,28,0.45)', alignItems: 'center', justifyContent: 'center' },
  playIntro: { position: 'absolute', left: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(18,0,28,0.45)', alignItems: 'center', justifyContent: 'center' },
});
