import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { repo } from '@/api';
import { useAudioPlayer, type AudioTrack } from '@/audio/AudioPlayerContext';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { SkeletonCard } from '@/components/SkeletonCard';
import { TopBar } from '@/components/TopBar';
import { colors, radius, type as t } from '@/constants/theme';
import { useLive } from '@/hooks/useContent';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { AudioTestimony, RadioConfig } from '@/types';
import { formatDuration } from '@/utils/format';

export const radioTrack = (cfg: RadioConfig): AudioTrack => ({
  id: `radio:${cfg.sessionId ?? 'stream'}`,
  url: cfg.streamUrl,
  title: cfg.currentProgramme || 'TOP Radio',
  artist: 'TOP Radio · Live',
  live: true,
  sessionId: cfg.sessionId,
});

export const audioTrack = (a: AudioTestimony): AudioTrack => ({
  id: `audio:${a.id}`,
  url: a.audioUrl,
  title: a.title,
  artist: a.speaker || 'Audio testimony',
  artwork: a.thumbnailUrl,
});

/** Three bars that move only while audio is actually playing (native driver, off with reduce-motion). */
function Equalizer({ active }: { active: boolean }) {
  const reduced = useReducedMotion();
  const bars = useRef([0, 1, 2].map(() => new Animated.Value(0.4))).current;
  useEffect(() => {
    if (!active || reduced) {
      bars.forEach((b) => b.setValue(0.4));
      return;
    }
    const loops = bars.map((b, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(b, { toValue: 1, duration: 320 + i * 90, useNativeDriver: true }),
          Animated.timing(b, { toValue: 0.3, duration: 320 + i * 90, useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [active, reduced, bars]);
  return (
    <View style={styles.eq} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {bars.map((b, i) => (
        <Animated.View key={i} style={[styles.eqBar, { transform: [{ scaleY: b }] }]} />
      ))}
    </View>
  );
}

export function ListenScreen() {
  const nav = useNavigation();
  const { live } = useLive();
  const player = useAudioPlayer();
  const [radio, setRadio] = useState<RadioConfig | null>(null);
  const [radioError, setRadioError] = useState(false);
  const [library, setLibrary] = useState<AudioTestimony[] | null>(null);
  const [libraryError, setLibraryError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(
    () =>
      repo.subscribeRadio(
        (cfg) => {
          setRadio(cfg);
          setRadioError(false);
        },
        () => setRadioError(true),
      ),
    [],
  );

  const loadLibrary = useCallback(async () => {
    try {
      setLibrary(await repo.getAudioTestimonies(50));
      setLibraryError(false);
    } catch {
      setLibraryError(true);
      setLibrary((cur) => cur ?? []);
    }
  }, []);

  useEffect(() => {
    void loadLibrary();
  }, [loadLibrary]);

  const radioAvailable = Boolean(radio?.isLive && radio.streamUrl);
  const radioId = radio ? radioTrack(radio).id : '';
  const radioCurrent = radioAvailable && player.track?.id === radioId;
  const radioPlaying = radioCurrent && player.status === 'playing';
  const radioBusy = radioCurrent && (player.status === 'loading' || player.status === 'reconnecting');

  const radioStatus = !radioAvailable
    ? 'Not broadcasting right now'
    : radioCurrent && player.status === 'reconnecting'
      ? 'Reconnecting…'
      : radioCurrent && player.status === 'error'
        ? 'Couldn’t connect. Tap play to retry.'
        : radioPlaying
          ? 'Playing live'
          : 'Tap to listen live';

  const header = (
    <View>
      {/* Main video broadcast status, from settings/live: never a fake badge */}
      {live?.isLive ? (
        <Pressable
          style={styles.broadcastLive}
          onPress={() => nav.navigate('Tabs', { screen: 'Live' })}
          accessibilityRole="button"
          accessibilityLabel="The live broadcast is on. Watch now"
        >
          <View style={styles.liveDot} />
          <Text style={styles.broadcastText} numberOfLines={1}>
            The live broadcast is on now
          </Text>
          <Text style={styles.broadcastLink}>Watch</Text>
        </Pressable>
      ) : live ? (
        <View style={styles.broadcastOff}>
          <Ionicons name="videocam-off-outline" size={16} color={colors.textMuted} />
          <Text style={styles.broadcastOffText}>The live broadcast is offline. Keep listening below.</Text>
        </View>
      ) : null}

      <View style={styles.radioCard}>
        <LinearGradient colors={['#5A0E82', '#2E0044', '#1C0829']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={styles.radioTop}>
          <View style={styles.radioIcon}>
            <Ionicons name="radio" size={26} color={colors.accent} />
          </View>
          {radioAvailable ? (
            <View style={styles.onAir}>
              <View style={styles.liveDot} />
              <Text style={styles.onAirText}>ON AIR</Text>
            </View>
          ) : (
            <View style={styles.offAir}>
              <Text style={styles.offAirText}>{radio === null && !radioError ? 'CHECKING…' : 'OFF AIR'}</Text>
            </View>
          )}
        </View>
        <Text style={styles.radioLabel}>TOP RADIO</Text>
        <Text style={styles.radioTitle} numberOfLines={2}>
          {radioAvailable ? radio?.currentProgramme || 'Live now' : 'TOP Radio is off air'}
        </Text>
        <Text style={styles.radioDesc} numberOfLines={3}>
          {radioAvailable
            ? radio?.description || 'Gospel music, prayers and testimonies, streaming live.'
            : radioError
              ? 'We couldn’t check the radio status. Pull down to try again.'
              : 'When the radio is on air you can listen here, even with your screen locked. Audio testimonies are always available below.'}
        </Text>
        <View style={styles.radioControls}>
          <Pressable
            onPress={() => (radioPlaying ? player.pause() : radio && player.play(radioTrack(radio)))}
            disabled={!radioAvailable}
            style={[styles.bigPlay, !radioAvailable && styles.bigPlayDisabled]}
            accessibilityRole="button"
            accessibilityLabel={radioPlaying ? 'Pause TOP Radio' : 'Play TOP Radio'}
            accessibilityState={{ disabled: !radioAvailable, busy: radioBusy }}
          >
            {radioBusy ? (
              <ActivityIndicator color={colors.onAccent} />
            ) : (
              <Ionicons
                name={radioPlaying ? 'pause' : 'play'}
                size={30}
                color={radioAvailable ? colors.onAccent : colors.textSubtle}
                style={radioPlaying ? undefined : { marginLeft: 3 }}
              />
            )}
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.radioStatus}>{radioStatus}</Text>
            <Text style={styles.radioHint}>Keeps playing in the background</Text>
          </View>
          <Equalizer active={radioPlaying} />
        </View>
      </View>

      <Text style={styles.sectionTitle} accessibilityRole="header">
        Audio testimonies
      </Text>
      <Text style={styles.sectionSub}>Listen any time, on demand.</Text>
    </View>
  );

  return (
    <Screen>
      <TopBar title="Listen" onNotifications={() => nav.navigate('Notifications')} onProfile={() => nav.navigate('Profile')} />
      <FlatList
        data={library ?? []}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.accent}
            onRefresh={async () => {
              setRefreshing(true);
              await loadLibrary();
              setRefreshing(false);
            }}
          />
        }
        renderItem={({ item }) => {
          const tr = audioTrack(item);
          const current = player.track?.id === tr.id;
          const playing = current && player.status === 'playing';
          const busy = current && player.status === 'loading';
          return (
            <View style={[styles.row, current && styles.rowActive]}>
              <Pressable
                onPress={() => (playing ? player.pause() : player.play(tr))}
                style={[styles.rowPlay, current && styles.rowPlayActive]}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={`${playing ? 'Pause' : 'Play'} ${item.title}`}
              >
                {busy ? (
                  <ActivityIndicator size="small" color={colors.onAccent} />
                ) : (
                  <Ionicons name={playing ? 'pause' : 'play'} size={18} color={current ? colors.onAccent : colors.accent} style={playing ? undefined : { marginLeft: 2 }} />
                )}
              </Pressable>
              <Pressable
                style={{ flex: 1, gap: 3 }}
                onPress={() => nav.navigate('AudioTestimony', { id: item.id })}
                accessibilityRole="button"
                accessibilityLabel={`Open ${item.title}${item.speaker ? `, by ${item.speaker}` : ''}: details and comments`}
              >
                <Text style={styles.rowTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.rowMeta} numberOfLines={1}>
                  {[item.speaker, formatDuration(item.duration), item.category].filter(Boolean).join('  ·  ')}
                </Text>
              </Pressable>
              <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.textSubtle} />
            </View>
          );
        }}
        ListEmptyComponent={
          library === null ? (
            <View style={{ paddingHorizontal: 20, gap: 12 }}>
              <SkeletonCard horizontal />
              <SkeletonCard horizontal />
            </View>
          ) : (
            <EmptyState
              icon="musical-notes-outline"
              title={libraryError ? 'Couldn’t load audio' : 'No audio testimonies yet'}
              message={libraryError ? 'Check your connection and pull down to retry.' : 'Audio testimonies will appear here as soon as they’re published.'}
            />
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  broadcastLive: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginTop: 4, padding: 12, borderRadius: radius.md, backgroundColor: 'rgba(255,59,78,0.12)', borderWidth: 1, borderColor: 'rgba(255,59,78,0.4)' },
  broadcastText: { ...t.small, flex: 1, color: colors.text, fontWeight: '700' },
  broadcastLink: { ...t.small, color: colors.accent, fontWeight: '800' },
  broadcastOff: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginTop: 4, padding: 12, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSoft },
  broadcastOffText: { ...t.small, flex: 1, color: colors.textMuted },
  radioCard: { marginHorizontal: 20, marginTop: 14, padding: 20, borderRadius: radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(245,197,66,0.22)', gap: 6 },
  radioTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  radioIcon: { width: 52, height: 52, borderRadius: 18, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(245,197,66,0.3)' },
  onAir: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: 'rgba(255,59,78,0.18)', borderWidth: 1, borderColor: 'rgba(255,59,78,0.5)' },
  onAirText: { ...t.label, color: '#FF8A96', fontWeight: '800' },
  offAir: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.08)' },
  offAirText: { ...t.label, color: colors.textMuted },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.live },
  radioLabel: { ...t.caps, fontSize: 11, color: colors.accent },
  radioTitle: { ...t.h1, fontSize: 24, color: colors.text },
  radioDesc: { ...t.small, color: colors.textMuted },
  radioControls: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 14 },
  bigPlay: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  bigPlayDisabled: { backgroundColor: 'rgba(255,255,255,0.08)' },
  radioStatus: { ...t.h3, fontSize: 15, color: colors.text },
  radioHint: { ...t.caption, color: colors.textSubtle, marginTop: 2 },
  eq: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 28 },
  eqBar: { width: 4, height: 28, borderRadius: 2, backgroundColor: colors.accent },
  sectionTitle: { ...t.h2, color: colors.text, marginHorizontal: 20, marginTop: 28 },
  sectionSub: { ...t.small, color: colors.textSubtle, marginHorizontal: 20, marginTop: 2, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, marginHorizontal: 20, marginBottom: 10, padding: 12, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSoft },
  rowActive: { borderColor: 'rgba(245,197,66,0.5)', backgroundColor: 'rgba(245,197,66,0.06)' },
  rowPlay: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  rowPlayActive: { backgroundColor: colors.accent },
  rowTitle: { ...t.h3, fontSize: 15, color: colors.text },
  rowMeta: { ...t.caption, color: colors.textSubtle },
});
