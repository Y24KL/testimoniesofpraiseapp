import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { colors, MINI_PLAYER_HEIGHT, radius, type as t } from '@/constants/theme';
import { useAudioPlayer } from './AudioPlayerContext';

const STATUS_TEXT = {
  idle: '',
  loading: 'Connecting…',
  playing: '',
  paused: 'Paused',
  reconnecting: 'Reconnecting…',
  error: 'Playback failed — tap play to retry',
} as const;

/** Persistent "now playing" bar shown above the tab bar while audio is loaded. */
export function MiniPlayer() {
  const nav = useNavigation();
  const { track, status, toggle, stop } = useAudioPlayer();
  if (!track) return null;

  const playing = status === 'playing';
  const busy = status === 'loading' || status === 'reconnecting';
  const sub = STATUS_TEXT[status] || (track.live ? 'Live on TOP Radio' : track.artist ?? 'Audio testimony');

  return (
    <View style={styles.wrap}>
      <Pressable
        style={styles.info}
        onPress={() => nav.navigate('Tabs', { screen: 'Listen' })}
        accessibilityRole="button"
        accessibilityLabel={`Now playing: ${track.title}. Open player`}
      >
        <View style={styles.art}>
          <Ionicons name={track.live ? 'radio' : 'musical-notes'} size={18} color={colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>{track.title}</Text>
          <View style={styles.subRow}>
            {track.live && playing ? <View style={styles.liveDot} /> : null}
            <Text style={[styles.sub, status === 'error' && { color: colors.danger }]} numberOfLines={1}>{sub}</Text>
          </View>
        </View>
      </Pressable>
      <Pressable
        onPress={toggle}
        style={styles.play}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={playing ? 'Pause' : 'Play'}
        accessibilityState={{ busy }}
      >
        {busy ? <ActivityIndicator size="small" color={colors.onAccent} /> : <Ionicons name={playing ? 'pause' : 'play'} size={20} color={colors.onAccent} style={playing ? undefined : { marginLeft: 2 }} />}
      </Pressable>
      <Pressable onPress={stop} style={styles.close} hitSlop={8} accessibilityRole="button" accessibilityLabel="Stop and close player">
        <Ionicons name="close" size={20} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: MINI_PLAYER_HEIGHT - 8,
    marginHorizontal: 10,
    marginBottom: 8,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: 'rgba(245,197,66,0.25)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 8,
  },
  info: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  art: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  title: { ...t.h3, fontSize: 14, color: colors.text },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.live },
  sub: { ...t.caption, color: colors.textMuted },
  play: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  close: { width: 32, height: 40, alignItems: 'center', justifyContent: 'center' },
});
