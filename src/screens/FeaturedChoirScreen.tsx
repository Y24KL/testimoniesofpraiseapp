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
import type { FeaturedChoir } from '@/types';
import { MESSAGES, messageFor } from '@/utils/errors';
import { formatDuration } from '@/utils/format';

/** Playback of one featured choir/group video, with a way back to the showcase. */
export function FeaturedChoirScreen() {
  const nav = useNavigation();
  const { id } = useRoute<RouteProp<RootStackParamList, 'FeaturedChoir'>>().params;
  const [item, setItem] = useState<FeaturedChoir | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    repo
      .getFeaturedChoir(id)
      .then((c) => {
        if (cancelled) return;
        if (!c) setNotFound(true);
        else setItem(c);
      })
      .catch((e) => {
        if (!cancelled) setError(messageFor(e));
      });
    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  const back = () => nav.goBack();

  return (
    <Screen>
      <TopBar title="Featured choirs" onBack={back} />
      {notFound && !item ? (
        <ErrorState message="This video is no longer available." onRetry={back} />
      ) : error && !item ? (
        <ErrorState message={error} onRetry={() => setAttempt((a) => a + 1)} />
      ) : !item ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <LoadingSpinner label="LOADING PRAISE" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {item.videoUrl ? <VideoPlayer uri={item.videoUrl} label={`${item.groupName}: ${item.songTitle}`} autoPlay /> : <ErrorState compact message={MESSAGES.video} />}
          <View style={{ gap: 6 }}>
            <Text style={styles.group} accessibilityRole="header">{item.groupName}</Text>
            <Text style={styles.song}>{item.songTitle}</Text>
            {item.duration ? <Text style={styles.meta}>{formatDuration(item.duration)}</Text> : null}
          </View>
          <PrimaryButton title="Back to featured choirs" icon="arrow-back" variant="outline" onPress={back} />
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 18, paddingBottom: 40 },
  group: { ...t.h1, fontSize: 24, color: colors.text },
  song: { ...t.body, color: colors.text },
  meta: { ...t.small, color: colors.textMuted },
});
