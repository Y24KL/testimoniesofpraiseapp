import React, { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { repo } from '@/api';
import { useAudioPlayer } from '@/audio/AudioPlayerContext';
import { CommentsSection } from '@/components/CommentsSection';
import { ErrorState } from '@/components/ErrorState';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { colors, radius, type as t } from '@/constants/theme';
import type { RootStackParamList } from '@/navigation/types';
import { audioTrack } from '@/screens/ListenScreen';
import type { AudioTestimony } from '@/types';
import { messageFor } from '@/utils/errors';
import { formatDate, formatDuration } from '@/utils/format';
import { shareMediaUrl } from '@/utils/links';

/** One audio testimony: play/pause through the app-wide player (keeps playing in the background), details and comments. */
export function AudioTestimonyScreen() {
  const nav = useNavigation();
  const { id } = useRoute<RouteProp<RootStackParamList, 'AudioTestimony'>>().params;
  const player = useAudioPlayer();
  const [item, setItem] = useState<AudioTestimony | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    repo
      .getAudioTestimony(id)
      .then((a) => {
        if (cancelled) return;
        if (!a) setNotFound(true);
        else setItem(a);
      })
      .catch((e) => !cancelled && setError(messageFor(e)));
    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  const track = item ? audioTrack(item) : null;
  const current = !!track && player.track?.id === track.id;
  const playing = current && player.status === 'playing';
  const busy = current && (player.status === 'loading' || player.status === 'reconnecting');

  return (
    <Screen>
      <TopBar title="Audio testimony" onBack={() => nav.goBack()} />
      {notFound && !item ? (
        <ErrorState message="This audio testimony is no longer available." onRetry={() => nav.goBack()} />
      ) : error && !item ? (
        <ErrorState message={error} onRetry={() => setAttempt((a) => a + 1)} />
      ) : !item || !track ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <LoadingSpinner label="LOADING PRAISE" />
        </View>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.playerCard}>
              <View style={styles.art}>
                {item.thumbnailUrl ? <Image source={item.thumbnailUrl} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Ionicons name="musical-notes" size={42} color={colors.accent} />}
              </View>
              <Pressable
                onPress={() => (playing ? player.pause() : player.play(track))}
                style={styles.play}
                accessibilityRole="button"
                accessibilityLabel={playing ? `Pause ${item.title}` : `Play ${item.title}`}
                accessibilityState={{ busy }}
              >
                {busy ? <ActivityIndicator color={colors.onAccent} /> : <Ionicons name={playing ? 'pause' : 'play'} size={30} color={colors.onAccent} style={playing ? undefined : { marginLeft: 3 }} />}
              </Pressable>
              <Text style={styles.status}>
                {current && player.status === 'error' ? player.error ?? 'Playback failed. Tap play to retry.' : playing ? 'Playing: keeps going if you leave the app' : current ? 'Paused' : 'Tap play to listen'}
              </Text>
            </View>
            <View style={{ gap: 6 }}>
              {item.category ? <Text style={styles.cat}>{item.category.toUpperCase()}</Text> : null}
              <Text style={styles.title} accessibilityRole="header">
                {item.title}
              </Text>
              <Text style={styles.meta}>{[item.speaker, formatDate(item.publishedAt ?? item.createdAt), formatDuration(item.duration)].filter(Boolean).join('  •  ')}</Text>
            </View>
            {item.description ? <Text style={styles.desc}>{item.description}</Text> : null}
            <PrimaryButton title="Share" icon="share-social-outline" variant="outline" onPress={() => void shareMediaUrl(item.title, item.audioUrl, 'audio')} />
            <CommentsSection type="audio" mediaId={item.id} mediaTitle={item.title} />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 18, paddingBottom: 40 },
  playerCard: { alignItems: 'center', gap: 14, padding: 20, borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: 'rgba(245,197,66,0.22)' },
  art: { width: 140, height: 140, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  play: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  status: { ...t.small, color: colors.textMuted, textAlign: 'center' },
  cat: { ...t.caps, color: colors.accent },
  title: { ...t.h1, fontSize: 24, color: colors.text },
  meta: { ...t.small, color: colors.textMuted },
  desc: { ...t.body, color: colors.text },
});
