import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { repo } from '@/api';
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
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load('refresh')} tintColor={colors.accent} />}
        >
          <LinearGradient colors={gradients.hero} style={styles.banner}>
            <Text style={styles.bannerTitle} accessibilityRole="header">
              Worship with your LoveWorld Singers
            </Text>
          </LinearGradient>

          <View style={styles.searchBox}>
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
  banner: { borderRadius: radius.lg, padding: 20, minHeight: 120, justifyContent: 'flex-end' },
  bannerTitle: { ...t.h1, fontSize: 24, color: colors.text },
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
