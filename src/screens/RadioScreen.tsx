import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEvent } from 'expo';
import { useVideoPlayer } from 'expo-video';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { repo } from '@/api';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { colors, gradients, radius, type as t } from '@/constants/theme';
import { useRadioListener } from '@/hooks/useRadioListener';
import type { AudioTestimony, RadioConfig } from '@/types';
import { messageFor } from '@/utils/errors';
import { formatDuration } from '@/utils/format';

function WaveVisualizer({ isPlaying }: { isPlaying: boolean }) {
  const anims = useRef([
    new Animated.Value(0.3),
    new Animated.Value(0.7),
    new Animated.Value(0.4),
    new Animated.Value(1),
    new Animated.Value(0.5),
    new Animated.Value(0.8),
    new Animated.Value(0.2),
  ]).current;

  useEffect(() => {
    if (!isPlaying) {
      anims.forEach((a) => a.setValue(0.2));
      return;
    }

    const loops = anims.map((anim, idx) => {
      const duration = 300 + (idx % 4) * 120;
      return Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 0.9 + (idx % 3) * 0.05,
            duration,
            useNativeDriver: false,
          }),
          Animated.timing(anim, {
            toValue: 0.15 + (idx % 2) * 0.1,
            duration,
            useNativeDriver: false,
          }),
        ]),
      );
    });

    loops.forEach((l) => l.start());
    return () => {
      loops.forEach((l) => l.stop());
    };
  }, [isPlaying, anims]);

  return (
    <View style={styles.waveContainer}>
      {anims.map((anim, idx) => (
        <Animated.View
          key={idx}
          style={[
            styles.waveBar,
            {
              height: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [6, 48],
              }),
            },
          ]}
        />
      ))}
    </View>
  );
}

export function RadioScreen() {
  const nav = useNavigation();
  const [activeTab, setActiveTab] = useState<'live' | 'library'>('live');
  const [radioConfig, setRadioConfig] = useState<RadioConfig | null>(null);
  const [library, setLibrary] = useState<AudioTestimony[] | null>(null);
  const [selectedArchive, setSelectedArchive] = useState<AudioTestimony | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Subscribe to live radio configuration updates from Firestore
  useEffect(() => {
    const unsub = repo.subscribeRadio(
      (cfg) => setRadioConfig(cfg),
      (err) => setError(messageFor(err)),
    );
    return unsub;
  }, []);

  // Fetch audio testimonies library
  const loadLibrary = useCallback(async () => {
    try {
      const list = await repo.getAudioTestimonies(50);
      setLibrary(list);
    } catch (e) {
      // Best effort for library tab
    }
  }, []);

  useEffect(() => {
    void loadLibrary();
  }, [loadLibrary]);

  // Determine active audio URL: either selected archive track or live stream
  const activeAudioUrl =
    activeTab === 'library' && selectedArchive
      ? selectedArchive.audioUrl
      : radioConfig?.isLive && radioConfig?.streamUrl
        ? radioConfig.streamUrl
        : '';

  // Expo-video audio-first player setup
  const player = useVideoPlayer(activeAudioUrl ? { uri: activeAudioUrl } : null, (p) => {
    p.loop = activeTab === 'library';
    p.staysActiveInBackground = true;
  });

  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const { status } = useEvent(player, 'statusChange', { status: player.status });

  // Real-time listener heartbeat (only while listening to live stream)
  const isListeningLive = isPlaying && activeTab === 'live' && !!radioConfig?.isLive;
  useRadioListener(radioConfig?.sessionId, isListeningLive);

  const togglePlayback = () => {
    if (!activeAudioUrl) return;
    if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
  };

  const isBuffering = status === 'loading';

  return (
    <Screen>
      <TopBar title="TOP Radio" onBack={() => nav.goBack()} />

      {/* Mode Segment Bar */}
      <View style={styles.segmentContainer}>
        <Pressable
          style={[styles.segmentBtn, activeTab === 'live' && styles.segmentBtnActive]}
          onPress={() => {
            setActiveTab('live');
            if (selectedArchive) {
              setSelectedArchive(null);
              player.pause();
            }
          }}
        >
          <Ionicons
            name="radio-outline"
            size={16}
            color={activeTab === 'live' ? colors.bg : colors.textMuted}
          />
          <Text style={[styles.segmentText, activeTab === 'live' && styles.segmentTextActive]}>
            Live Broadcast
          </Text>
        </Pressable>

        <Pressable
          style={[styles.segmentBtn, activeTab === 'library' && styles.segmentBtnActive]}
          onPress={() => {
            setActiveTab('library');
            if (activeTab === 'live' && isPlaying) {
              player.pause();
            }
          }}
        >
          <Ionicons
            name="musical-notes-outline"
            size={16}
            color={activeTab === 'library' ? colors.bg : colors.textMuted}
          />
          <Text style={[styles.segmentText, activeTab === 'library' && styles.segmentTextActive]}>
            Audio Archive
          </Text>
        </Pressable>
      </View>

      {activeTab === 'live' ? (
        <View style={styles.liveContainer}>
          {/* Live Badge */}
          <View style={styles.statusRow}>
            {radioConfig?.isLive ? (
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveBadgeText}>ON AIR</Text>
              </View>
            ) : (
              <View style={styles.offAirBadge}>
                <Text style={styles.offAirText}>OFF AIR</Text>
              </View>
            )}
          </View>

          {/* Radio Dial Artwork */}
          <View style={styles.dialCard}>
            <LinearGradient colors={gradients.card} style={StyleSheet.absoluteFill} />
            <View style={styles.iconRing}>
              <Ionicons
                name="radio"
                size={54}
                color={radioConfig?.isLive ? colors.accent : colors.textMuted}
              />
            </View>

            <WaveVisualizer isPlaying={isPlaying && !!radioConfig?.isLive} />

            <View style={styles.programmeBox}>
              <Text style={styles.programmeTitle} numberOfLines={2}>
                {radioConfig?.currentProgramme || 'TOP Radio Live'}
              </Text>
              {radioConfig?.description ? (
                <Text style={styles.programmeDesc} numberOfLines={3}>
                  {radioConfig.description}
                </Text>
              ) : (
                <Text style={styles.programmeDesc}>
                  24/7 Glorious Gospel Music, Prophetic Prayers & Exhilarating Testimonies.
                </Text>
              )}
            </View>
          </View>

          {/* Controls Area */}
          <View style={styles.controlsArea}>
            <Pressable
              onPress={togglePlayback}
              disabled={!radioConfig?.isLive || !radioConfig?.streamUrl}
              style={[
                styles.playBtn,
                (!radioConfig?.isLive || !radioConfig?.streamUrl) && styles.playBtnDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel={isPlaying ? 'Pause radio' : 'Play radio'}
            >
              {isBuffering ? (
                <ActivityIndicator color={colors.bg} size="small" />
              ) : (
                <Ionicons
                  name={isPlaying ? 'pause' : 'play'}
                  size={36}
                  color={colors.bg}
                  style={isPlaying ? undefined : { marginLeft: 4 }}
                />
              )}
            </Pressable>

            <Text style={styles.statusSub}>
              {radioConfig?.isLive
                ? isPlaying
                  ? 'Playing live broadcast'
                  : 'Tap to listen'
                : 'Broadcast currently off-air. Check back shortly!'}
            </Text>
          </View>
        </View>
      ) : (
        /* Audio Archive Tab */
        <FlatList
          data={library}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.archiveList}
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
            const isCurrent = selectedArchive?.id === item.id;
            return (
              <Pressable
                style={[styles.archiveItem, isCurrent && styles.archiveItemActive]}
                onPress={() => {
                  if (isCurrent) {
                    togglePlayback();
                  } else {
                    setSelectedArchive(item);
                    setTimeout(() => player.play(), 100);
                  }
                }}
              >
                <View style={[styles.archivePlayIcon, isCurrent && styles.archivePlayIconActive]}>
                  <Ionicons
                    name={isCurrent && isPlaying ? 'pause' : 'play'}
                    size={20}
                    color={isCurrent ? colors.bg : colors.accent}
                  />
                </View>

                <View style={styles.archiveDetails}>
                  <Text style={styles.archiveTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.archiveSpeaker} numberOfLines={1}>
                    {[item.speaker, formatDuration(item.duration)].filter(Boolean).join('  •  ')}
                  </Text>
                </View>

                {item.category ? (
                  <View style={styles.archiveCategory}>
                    <Text style={styles.archiveCategoryText}>{item.category}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              icon="musical-notes-outline"
              title="No Audio Testimonies"
              message="Audio testimonies will appear here once published."
            />
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  segmentContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginVertical: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  segmentBtnActive: {
    backgroundColor: colors.accent,
  },
  segmentText: {
    ...t.label,
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: colors.bg,
    fontWeight: '800',
  },
  liveContainer: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(52, 199, 89, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(52, 199, 89, 0.4)',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34C759',
  },
  liveBadgeText: {
    ...t.label,
    fontSize: 11,
    fontWeight: '800',
    color: '#34C759',
    letterSpacing: 1,
  },
  offAirBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  offAirText: {
    ...t.label,
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1,
  },
  dialCard: {
    width: '100%',
    borderRadius: radius.xl,
    padding: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    gap: 16,
    overflow: 'hidden',
  },
  iconRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(245, 197, 66, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 197, 66, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 50,
  },
  waveBar: {
    width: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  programmeBox: {
    alignItems: 'center',
    gap: 6,
  },
  programmeTitle: {
    ...t.h2,
    fontSize: 20,
    color: colors.text,
    textAlign: 'center',
  },
  programmeDesc: {
    ...t.body,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  controlsArea: {
    alignItems: 'center',
    gap: 12,
  },
  playBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  playBtnDisabled: {
    opacity: 0.5,
    backgroundColor: colors.surfaceLight,
  },
  statusSub: {
    ...t.caption,
    color: colors.textMuted,
    fontSize: 13,
  },
  archiveList: {
    padding: 16,
    gap: 10,
  },
  archiveItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  archiveItemActive: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(245, 197, 66, 0.08)',
  },
  archivePlayIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(245, 197, 66, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  archivePlayIconActive: {
    backgroundColor: colors.accent,
  },
  archiveDetails: {
    flex: 1,
    gap: 4,
  },
  archiveTitle: {
    ...t.body,
    fontWeight: '700',
    color: colors.text,
    fontSize: 14,
  },
  archiveSpeaker: {
    ...t.caption,
    color: colors.textMuted,
    fontSize: 12,
  },
  archiveCategory: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  archiveCategoryText: {
    ...t.label,
    fontSize: 10,
    color: colors.textMuted,
  },
});
