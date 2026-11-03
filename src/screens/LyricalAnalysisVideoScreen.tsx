import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { repo } from '@/api';
import { ErrorState } from '@/components/ErrorState';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { VideoPlayer } from '@/components/VideoPlayer';
import { colors, type as t } from '@/constants/theme';
import type { RootStackParamList } from '@/navigation/types';
import type { LyricalAnalysis } from '@/types';
import { MESSAGES, messageFor } from '@/utils/errors';
import { formatDate, formatDuration } from '@/utils/format';

/** One lyrical analysis video: the shared player, its details, and a way back to the library. */
export function LyricalAnalysisVideoScreen() {
  const nav = useNavigation();
  const { id } = useRoute<RouteProp<RootStackParamList, 'LyricalAnalysisVideo'>>().params;
  const [item, setItem] = useState<LyricalAnalysis | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    repo
      .getLyricalAnalysis(id)
      .then((v) => {
        if (cancelled) return;
        if (!v) setNotFound(true); // draft, unpublished or removed
        else setItem(v);
      })
      .catch((e) => {
        if (!cancelled) setError(messageFor(e));
      });
    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  const back = () => nav.goBack();
  const meta = item ? [item.artistName, formatDate(item.publicationDate), formatDuration(item.duration)].filter(Boolean).join('  •  ') : '';

  return (
    <Screen>
      <TopBar title="Lyrical Analysis" onBack={back} />
      {notFound && !item ? (
        <ErrorState message="This analysis is no longer available." onRetry={back} />
      ) : error && !item ? (
        <ErrorState message={error} onRetry={() => setAttempt((a) => a + 1)} />
      ) : !item ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <LoadingSpinner label="LOADING PRAISE" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {item.videoUrl ? (
            <VideoPlayer uri={item.videoUrl} contentId={item.id} label={item.title} autoPlay />
          ) : (
            <ErrorState compact message={MESSAGES.video} />
          )}
          <View style={{ gap: 6 }}>
            <Text style={styles.cat}>LYRICAL ANALYSIS</Text>
            <Text style={styles.title} accessibilityRole="header">{item.title}</Text>
            {item.songTitle ? <Text style={styles.song}>{`Song: ${item.songTitle}`}</Text> : null}
            {meta ? <Text style={styles.meta}>{meta}</Text> : null}
          </View>
          {item.description ? <Text style={styles.desc}>{item.description}</Text> : null}
          <PrimaryButton title="Back to Lyrical Analysis" icon="arrow-back" variant="outline" onPress={back} />
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 18, paddingBottom: 40 },
  cat: { ...t.caps, color: colors.accent },
  title: { ...t.h1, fontSize: 24, color: colors.text },
  song: { ...t.body, color: colors.text, fontWeight: '700' },
  meta: { ...t.small, color: colors.textMuted },
  desc: { ...t.body, color: colors.text, lineHeight: 24 },
});
