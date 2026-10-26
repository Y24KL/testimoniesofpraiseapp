import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { EmptyState } from '@/components/EmptyState';
import { LiveBadge } from '@/components/LiveCard';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { VideoPlayer } from '@/components/VideoPlayer';
import { LiveChat } from '@/components/LiveChat';
import { YouTubePlayer } from '@/video/YouTubePlayer';
import { parseYouTubeId } from '@/utils/youtube';
import { colors, radius, type as t } from '@/constants/theme';
import { useLive } from '@/hooks/useContent';
import { useLiveViewer } from '@/hooks/useLiveViewer';
import { MESSAGES } from '@/utils/errors';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useAudioPlayer } from '@/audio/AudioPlayerContext';

export function LiveScreen() {
  const nav = useNavigation();
  const { live, error } = useLive();
  // Bottom-tab screens stay mounted when you switch tabs (that's normally what you want — instant
  // switching), but that also means a playing video keeps its audio running in the background
  // unless we explicitly stop it. Unmounting the player while this tab isn't focused fixes that.
  const isFocused = useIsFocused();
  // Counts as watching the moment this tab is open while the stream is live — matches how the
  // admin portal's viewer count is meant to work, not tied to whether the video is actually playing.
  useLiveViewer(live?.sessionId, isFocused && !!live?.isLive);
  // The live video autoplays with sound: pause radio/audio first so two streams never overlap.
  const audio = useAudioPlayer();
  const watching = isFocused && !!live?.isLive && !!live.streamUrl;
  React.useEffect(() => {
    if (watching && audio.status === 'playing') audio.pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watching]);

  // live > pre-live > offline. Only one branch renders, so the pre-live player is unmounted (stopped)
  // the moment the real broadcast starts or the admin turns pre-live playback off.
  const mode: 'loading' | 'live' | 'prelive' | 'offline' = !live ? 'loading' : live.isLive && live.streamUrl ? 'live' : live.preLive ? 'prelive' : 'offline';
  const prevMode = React.useRef(mode);
  const [switchNote, setSwitchNote] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (prevMode.current === 'prelive' && mode === 'live') setSwitchNote('We’re live! The broadcast has started, so we switched you to it.');
    else if (prevMode.current === 'prelive' && mode === 'offline') setSwitchNote('Pre-live playback has ended. We’ll be live soon.');
    else if (mode === 'prelive' || mode === 'offline') setSwitchNote((n) => (prevMode.current === 'live' ? null : n));
    prevMode.current = mode;
  }, [mode]);
  const pre = live?.preLive;
  return (
    <Screen>
      <TopBar title="Watch Live" onNotifications={() => nav.navigate('Notifications')} onProfile={() => nav.navigate('Profile')} />
      {!live ? (
        <View style={{ flex: 1, justifyContent: 'center' }}><LoadingSpinner label="LOADING PRAISE" /></View>
      ) : live.isLive && live.streamUrl ? (
        <ScrollView contentContainerStyle={styles.content}>
          {/* key forces a fresh player if the admin swaps the stream URL while we're watching */}
          {!isFocused ? (
            <View style={styles.paused}>
              <Ionicons name="pause-circle-outline" size={40} color={colors.textMuted} />
              <Text style={styles.pausedText}>Paused — come back to this tab to keep watching</Text>
            </View>
          ) : live.sourceType === 'youtube' && parseYouTubeId(live.streamUrl) ? (
            <YouTubePlayer key={live.streamUrl} videoId={parseYouTubeId(live.streamUrl)!} label={live.title ?? 'Live stream'} />
          ) : (
            <VideoPlayer key={live.streamUrl} uri={live.streamUrl} live autoPlay label={live.title ?? 'Live stream'} />
          )}
          {switchNote ? <Text style={styles.switchNote} accessibilityLiveRegion="polite">{switchNote}</Text> : null}
          <LiveBadge />
          <Text style={styles.title}>{live.title ?? 'Live now'}</Text>
          {live.description ? <Text style={styles.desc}>{live.description}</Text> : null}
          {live.sessionId ? <LiveChat sessionId={live.sessionId} /> : null}
        </ScrollView>
      ) : mode === 'prelive' && pre ? (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.waitBanner} accessibilityRole="summary">
            <Ionicons name="time-outline" size={22} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={styles.waitTitle}>We’re not live yet</Text>
              <Text style={styles.waitText}>Watch while you wait. The live broadcast takes over here automatically when it starts.</Text>
            </View>
          </View>
          {!isFocused ? (
            <View style={styles.paused}>
              <Ionicons name="pause-circle-outline" size={40} color={colors.textMuted} />
              <Text style={styles.pausedText}>Paused — come back to this tab to keep watching</Text>
            </View>
          ) : pre.sourceType === 'youtube' && parseYouTubeId(pre.url) ? (
            <YouTubePlayer key={pre.url} videoId={parseYouTubeId(pre.url)!} label={pre.title} />
          ) : (
            <VideoPlayer key={pre.url} uri={pre.url} autoPlay={false} label={pre.title} />
          )}
          <Text style={styles.waitCaps}>WHILE YOU WAIT</Text>
          <Text style={styles.title}>{pre.title}</Text>
          {pre.description ? <Text style={styles.desc}>{pre.description}</Text> : null}
          {switchNote ? <Text style={styles.switchNote}>{switchNote}</Text> : null}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {switchNote ? <Text style={styles.switchNote} accessibilityLiveRegion="polite">{switchNote}</Text> : null}
          <View style={styles.offlineBox}>
            {live.thumbnail ? <Image source={live.thumbnail} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={8} /> : null}
            <View style={styles.offlineOverlay}>
              <Ionicons name="radio-outline" size={44} color={colors.textMuted} />
              <Text style={styles.offlineText} accessibilityRole="header">LIVE STREAM IS CURRENTLY OFFLINE.</Text>
            </View>
          </View>
          {error ? <Text style={styles.note}>{MESSAGES.network}</Text> : <EmptyState icon="notifications-outline" title="We’ll let you know" message="Turn on Live notifications in your profile to be alerted when we go live." />}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 14 },
  title: { ...t.h2, color: colors.text },
  desc: { ...t.body, color: colors.textMuted },
  offlineBox: { aspectRatio: 16 / 9, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.card },
  offlineOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors.overlay, padding: 16 },
  offlineText: { ...t.caps, fontSize: 13, color: colors.text, textAlign: 'center' },
  note: { ...t.body, color: colors.textMuted, textAlign: 'center' },
  paused: { aspectRatio: 16 / 9, borderRadius: radius.md, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', gap: 10 },
  waitBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.md, backgroundColor: 'rgba(245,197,66,0.08)', borderWidth: 1, borderColor: 'rgba(245,197,66,0.35)' },
  waitTitle: { ...t.h3, color: colors.text },
  waitText: { ...t.small, color: colors.textMuted, marginTop: 2 },
  waitCaps: { ...t.caps, color: colors.accent },
  switchNote: { ...t.small, color: colors.accent, textAlign: 'center' },
  pausedText: { ...t.small, color: colors.textMuted, textAlign: 'center', paddingHorizontal: 24 },
});
