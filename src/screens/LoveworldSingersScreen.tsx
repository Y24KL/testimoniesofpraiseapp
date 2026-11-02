import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { useEvent } from 'expo';
import { VideoView, useVideoPlayer } from 'expo-video';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { repo } from '@/api';
import { PrimaryButton } from '@/components/PrimaryButton';
import { LOVEWORLD_EYEBROW, LOVEWORLD_HERO_VIDEO, LOVEWORLD_TITLE } from '@/constants/loveworldSingers';
import { getLoveworldHeroVideo } from '@/api/loveworldSingersConfig';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Screen } from '@/components/Screen';
import { SkeletonCard } from '@/components/SkeletonCard';
import { TopBar } from '@/components/TopBar';
import { colors, gradients, radius, type as t } from '@/constants/theme';
import { downloadKey, useDownloads } from '@/downloads/DownloadsContext';
import type { LoveworldSingersVideo } from '@/types';
import { messageFor } from '@/utils/errors';
import { formatDate, formatDuration } from '@/utils/format';

const LIBRARY_LIMIT = 100;

/** "Worship with your LoveWorld Singers": published videos only (the query enforces it). */
export function LoveworldSingersScreen() {
  const nav = useNavigation();
  const [items, setItems] = useState<LoveworldSingersVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [search, setSearch] = useState('');
  const busy = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const [libraryY, setLibraryY] = useState(0);
  const [heroVideo, setHeroVideo] = useState(LOVEWORLD_HERO_VIDEO);
  const player = useVideoPlayer(heroVideo || null, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  useEffect(() => {
    void getLoveworldHeroVideo().then(setHeroVideo);
  }, []);
  const { status } = useEvent(player, 'statusChange', { status: player.status });

  const load = useCallback(async (mode: 'initial' | 'refresh') => {
    if (busy.current) return;
    busy.current = true;
    if (mode === 'refresh') setRefreshing(true);
    else setLoading(true);
    try {
      setItems(await repo.getLoveworldSingersVideos(LIBRARY_LIMIT));
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      busy.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load('initial');
  }, [load]);

  const { featured, recent } = useMemo(() => {
    const q = search.trim().toLowerCase();
    const shown = items.filter((v) => !q || [v.title, v.description].some((s) => s.toLowerCase().includes(q)));
    return {
      featured: shown.filter((v) => v.isFeatured),
      recent: shown
        .filter((v) => !v.isFeatured)
        .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '')),
    };
  }, [items, search]);

  const open = (v: LoveworldSingersVideo) => nav.navigate('LoveworldSingerVideo', { id: v.id });
  const noMatches = items.length > 0 && featured.length === 0 && recent.length === 0;

  return (
    <Screen>
      <TopBar title="LoveWorld Singers" onBack={() => nav.goBack()} />
      {loading ? (
        <View style={{ padding: 16, gap: 16 }}>
          {[0, 1, 2].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </View>
      ) : error && items.length === 0 ? (
        <ErrorState message={messageFor(error)} onRetry={() => void load('initial')} />
      ) : (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load('refresh')} tintColor={colors.accent} />}
        >
          <View style={styles.hero}>
            <LinearGradient colors={['#4B006E', '#2E0044', '#12001C']} style={StyleSheet.absoluteFill} />
            {heroVideo ? (
              <VideoView player={player} style={[StyleSheet.absoluteFill, status !== 'readyToPlay' && { opacity: 0 }]} contentFit="cover" nativeControls={false} allowsFullscreen={false} allowsPictureInPicture={false} />
            ) : null}
            <LinearGradient colors={['rgba(18,0,28,0.1)', 'rgba(18,0,28,0.9)']} style={StyleSheet.absoluteFill} />
            <View style={styles.heroCopy}>
              <Text style={styles.eyebrow}>{LOVEWORLD_EYEBROW}</Text>
              <Text style={styles.heroTitle} accessibilityRole="header">
                {LOVEWORLD_TITLE}
              </Text>
              <View style={{ marginTop: 20 }}>
                <PrimaryButton title="BROWSE VIDEOS" icon="play-circle-outline" onPress={() => scrollRef.current?.scrollTo({ y: libraryY, animated: true })} />
              </View>
            </View>
          </View>

          <View style={styles.searchBox} onLayout={(e) => setLibraryY(e.nativeEvent.layout.y)}>
            <Ionicons name="search" size={18} color={colors.textSubtle} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search songs"
              placeholderTextColor={colors.textSubtle}
              style={styles.searchInput}
              returnKeyType="search"
              accessibilityLabel="Search LoveWorld Singers videos"
            />
            {search ? (
              <Pressable onPress={() => setSearch('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
                <Ionicons name="close-circle" size={18} color={colors.textSubtle} />
              </Pressable>
            ) : null}
          </View>

          {items.length === 0 ? (
            <EmptyState icon="musical-notes-outline" title="No videos yet" message="New videos from the LoveWorld Singers will appear here." />
          ) : noMatches ? (
            <EmptyState icon="search-outline" title="No matches" message="Try another song or word." />
          ) : (
            <>
              {featured.length ? (
                <View style={{ gap: 10 }}>
                  <Text style={styles.sectionTitle}>Featured</Text>
                  <FlatList
                    horizontal
                    data={featured}
                    keyExtractor={(v) => v.id}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 12 }}
                    renderItem={({ item }) => <VideoTile video={item} onPress={() => open(item)} />}
                  />
                </View>
              ) : null}
              {recent.length ? (
                <View style={{ gap: 12 }}>
                  <Text style={styles.sectionTitle}>Recent</Text>
                  {recent.map((v) => (
                    <VideoRow key={v.id} video={v} onPress={() => open(v)} />
                  ))}
                </View>
              ) : null}
            </>
          )}
          {error && items.length > 0 ? <Text style={styles.note}>{messageFor(error)}</Text> : null}
        </ScrollView>
      )}
    </Screen>
  );
}

function Thumb({ uri, width, height }: { uri?: string; width: number; height: number }) {
  return (
    <View style={[styles.thumb, { width, height }]}>
      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Ionicons name="musical-notes" size={28} color={colors.primaryLight} />}
    </View>
  );
}

function SavedBadge({ id }: { id: string }) {
  const saved = useDownloads().get(downloadKey('singers', id));
  if (saved?.status !== 'done') return null;
  return (
    <View style={styles.badge} accessibilityLabel="Downloaded">
      <Ionicons name="checkmark-circle" size={13} color={colors.success} />
      <Text style={styles.badgeText}>SAVED</Text>
    </View>
  );
}

function VideoTile({ video, onPress }: { video: LoveworldSingersVideo; onPress: () => void }) {
  return (
    <Pressable style={styles.tile} onPress={onPress} accessibilityRole="button" accessibilityLabel={`Play ${video.title}`}>
      <Thumb uri={video.thumbnail} width={220} height={124} />
      <Text style={styles.rowTitle} numberOfLines={2}>{video.title}</Text>
      <Text style={styles.meta} numberOfLines={1}>{[formatDate(video.publishedAt), formatDuration(video.duration)].filter(Boolean).join('  •  ')}</Text>
    </Pressable>
  );
}

function VideoRow({ video, onPress }: { video: LoveworldSingersVideo; onPress: () => void }) {
  return (
    <Pressable style={styles.row} onPress={onPress} accessibilityRole="button" accessibilityLabel={`Play ${video.title}`}>
      <Thumb uri={video.thumbnail} width={112} height={64} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.rowTitle} numberOfLines={2}>{video.title}</Text>
        <Text style={styles.meta} numberOfLines={1}>{[formatDate(video.publishedAt), formatDuration(video.duration)].filter(Boolean).join('  •  ')}</Text>
        <SavedBadge id={video.id} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  hero: { height: 380, borderRadius: radius.lg, overflow: 'hidden', justifyContent: 'flex-end', backgroundColor: '#2E0044' },
  heroCopy: { padding: 20 },
  eyebrow: { ...t.caps, color: '#F5C542', letterSpacing: 1.5 },
  heroTitle: { ...t.display, fontSize: 30, lineHeight: 36, color: '#fff', marginTop: 10 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 15, paddingVertical: 0 },
  sectionTitle: { ...t.h3, color: colors.text },
  tile: { width: 220, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { ...t.h3, fontSize: 15, color: colors.text },
  meta: { ...t.small, color: colors.textMuted },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  badgeText: { ...t.label, fontSize: 10, color: colors.success, fontWeight: '800' },
  note: { ...t.caption, color: colors.textSubtle, textAlign: 'center' },
});
