import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
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
import type { LyricalAnalysis } from '@/types';
import { messageFor } from '@/utils/errors';
import { formatDate, formatDuration } from '@/utils/format';

const PAGE = 12;

/**
 * Lyrical Analysis library: published analysis videos, newest admin order first, loaded a page at a
 * time. Thumbnails load lazily and are cached by the image layer; no video is requested until a card is opened.
 */
export function LyricalAnalysisScreen() {
  const nav = useNavigation();
  const [items, setItems] = useState<LyricalAnalysis[]>([]);
  const [cursor, setCursor] = useState<unknown>(undefined);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [moreError, setMoreError] = useState(false);
  const [search, setSearch] = useState('');
  const busy = useRef(false);

  const loadFirst = useCallback(async (mode: 'initial' | 'refresh') => {
    if (busy.current) return;
    busy.current = true;
    if (mode === 'refresh') setRefreshing(true);
    else setLoading(true);
    try {
      const page = await repo.getLyricalAnalyses({ limit: PAGE });
      setItems(page.items);
      setCursor(page.cursor);
      setHasMore(page.hasMore);
      setError(null);
      setMoreError(false);
    } catch (e) {
      setError(e);
    } finally {
      busy.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (busy.current || !hasMore || error) return;
    busy.current = true;
    setLoadingMore(true);
    try {
      const page = await repo.getLyricalAnalyses({ limit: PAGE, cursor });
      setItems((cur) => [...cur, ...page.items.filter((n) => !cur.some((c) => c.id === n.id))]);
      setCursor(page.cursor);
      setHasMore(page.hasMore);
      setMoreError(false);
    } catch {
      setMoreError(true);
    } finally {
      busy.current = false;
      setLoadingMore(false);
    }
  }, [cursor, hasMore, error]);

  useEffect(() => {
    void loadFirst('initial');
  }, [loadFirst]);

  const q = search.trim().toLowerCase();
  const shown = items.filter(
    (i) => !q || [i.title, i.songTitle, i.artistName, i.description].some((v) => v?.toLowerCase().includes(q)),
  );

  const header = (
    <View style={styles.header}>
      <LinearGradient colors={gradients.hero} style={styles.hero}>
        <Ionicons name="musical-notes" size={26} color={colors.accent} />
        <Text style={styles.heroTitle} accessibilityRole="header">
          Lyrical Analysis
        </Text>
        <Text style={styles.heroSub}>Discover the message, inspiration and depth behind the songs of the LoveWorld Singers.</Text>
      </LinearGradient>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={colors.textSubtle} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by song, singer or topic"
          placeholderTextColor={colors.textSubtle}
          style={styles.searchInput}
          returnKeyType="search"
          accessibilityLabel="Search lyrical analyses"
        />
        {search ? (
          <Pressable onPress={() => setSearch('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={18} color={colors.textSubtle} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  return (
    <Screen>
      <TopBar title="Lyrical Analysis" onBack={() => nav.goBack()} />
      {loading ? (
        <View style={{ padding: 16, gap: 16 }}>
          {[0, 1, 2].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </View>
      ) : error && items.length === 0 ? (
        <ErrorState message={messageFor(error)} onRetry={() => void loadFirst('initial')} />
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(i) => i.id}
          ListHeaderComponent={header}
          renderItem={({ item }) => (
            <AnalysisCard item={item} onPress={() => nav.navigate('LyricalAnalysisVideo', { id: item.id })} />
          )}
          onEndReached={() => void loadMore()}
          onEndReachedThreshold={0.5}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadFirst('refresh')} tintColor={colors.accent} />}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 24, gap: 16 }}
          ListEmptyComponent={
            items.length === 0 ? (
              <EmptyState
                icon="musical-notes-outline"
                title="Coming soon"
                message={'New lyrical analyses are coming soon.\nCheck back to discover more about the songs of the LoveWorld Singers.'}
              />
            ) : (
              <EmptyState icon="search-outline" title="No matches" message="Try another song, singer or word." />
            )
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator color={colors.accent} style={{ margin: 16 }} />
            ) : moreError ? (
              <Pressable onPress={() => void loadMore()} style={{ padding: 16 }} accessibilityRole="button">
                <Text style={styles.note}>Couldn’t load more. Tap to try again.</Text>
              </Pressable>
            ) : null
          }
          initialNumToRender={6}
          windowSize={7}
        />
      )}
    </Screen>
  );
}

/** One analysis: thumbnail, analysis title, song, singer or minister, short description, date and duration. */
function AnalysisCard({ item, onPress }: { item: LyricalAnalysis; onPress: () => void }) {
  const meta = [formatDate(item.publicationDate), formatDuration(item.duration)].filter(Boolean).join('  •  ');
  return (
    <Pressable style={styles.card} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${item.title}, ${item.songTitle}`}>
      <View style={styles.thumb}>
        {item.thumbnailUrl ? (
          <Image source={{ uri: item.thumbnailUrl }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" recyclingKey={item.id} />
        ) : (
          <Ionicons name="musical-notes" size={34} color={colors.primaryLight} />
        )}
        <View style={styles.play}>
          <Ionicons name="play" size={18} color={colors.onAccent} />
        </View>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.song} numberOfLines={1}>{item.songTitle}</Text>
        {item.artistName ? <Text style={styles.artist} numberOfLines={1}>{item.artistName}</Text> : null}
        {item.description ? <Text style={styles.desc} numberOfLines={2}>{item.description}</Text> : null}
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 6, gap: 14 },
  hero: { borderRadius: radius.lg, padding: 20, gap: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.accentSoft },
  heroTitle: { ...t.display, fontSize: 28, lineHeight: 34, color: colors.text },
  heroSub: { ...t.body, color: colors.textMuted },
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
  card: { marginHorizontal: 16, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  thumb: { width: '100%', aspectRatio: 16 / 9, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  play: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { padding: 14, gap: 4 },
  cardTitle: { ...t.h3, fontSize: 17, color: colors.text },
  song: { ...t.small, color: colors.accent, fontWeight: '700' },
  artist: { ...t.small, color: colors.textMuted },
  desc: { ...t.body, fontSize: 14, color: colors.textMuted, marginTop: 4 },
  meta: { ...t.caption, color: colors.textSubtle, marginTop: 4 },
  note: { ...t.caption, color: colors.textSubtle, textAlign: 'center' },
});
