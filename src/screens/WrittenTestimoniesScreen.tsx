import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { repo } from '@/api';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Screen } from '@/components/Screen';
import { SkeletonCard } from '@/components/SkeletonCard';
import { TopBar } from '@/components/TopBar';
import { WrittenTestimonyCard } from '@/components/WrittenTestimonyCard';
import { colors, radius, type as t } from '@/constants/theme';
import type { WrittenTestimony } from '@/types';
import { messageFor } from '@/utils/errors';

const PAGE = 15;
const ALL = 'All';

/** Library of published written testimonies: search, category chips, pull-to-refresh, paging. */
export function WrittenTestimoniesScreen() {
  const nav = useNavigation();
  const [items, setItems] = useState<WrittenTestimony[]>([]);
  const [cursor, setCursor] = useState<unknown>(undefined);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [moreError, setMoreError] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(ALL);
  const busy = useRef(false);

  const loadFirst = useCallback(async (mode: 'initial' | 'refresh') => {
    if (busy.current) return;
    busy.current = true;
    if (mode === 'refresh') setRefreshing(true);
    else setLoading(true);
    try {
      const page = await repo.getWrittenTestimonies({ limit: PAGE });
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
      const page = await repo.getWrittenTestimonies({ limit: PAGE, cursor });
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

  const categories = useMemo(() => {
    const set = new Set(items.map((i) => i.category).filter((c): c is string => !!c));
    return set.size ? [ALL, ...Array.from(set).sort()] : [];
  }, [items]);

  const q = search.trim().toLowerCase();
  const shown = items.filter(
    (i) =>
      (category === ALL || i.category === category) &&
      (!q || [i.title, i.authorName, i.churchZone, i.body].some((v) => v?.toLowerCase().includes(q))),
  );

  const header = (
    <View style={styles.header}>
      <Text style={styles.lead}>Read what God is doing in the lives of people around the world.</Text>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={colors.textSubtle} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name, church or words"
          placeholderTextColor={colors.textSubtle}
          style={styles.searchInput}
          returnKeyType="search"
          accessibilityLabel="Search written testimonies"
        />
        {search ? (
          <Pressable onPress={() => setSearch('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={18} color={colors.textSubtle} />
          </Pressable>
        ) : null}
      </View>
      {categories.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {categories.map((c) => (
            <Pressable
              key={c}
              onPress={() => setCategory(c)}
              style={[styles.chip, category === c && styles.chipOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: category === c }}
            >
              <Text style={[styles.chipText, category === c && styles.chipTextOn]}>{c}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      {q && hasMore ? <Text style={styles.note}>Searching the testimonies loaded so far. Scroll down to load more.</Text> : null}
    </View>
  );

  return (
    <Screen>
      <TopBar title="Written testimonies" onBack={() => nav.goBack()} />
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
          renderItem={({ item }) => <WrittenTestimonyCard item={item} onPress={() => nav.navigate('WrittenTestimony', { id: item.id })} />}
          onEndReached={() => void loadMore()}
          onEndReachedThreshold={0.5}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadFirst('refresh')} tintColor={colors.accent} />}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            items.length === 0 ? (
              <EmptyState icon="document-text-outline" title="No written testimonies yet" message="New testimonies will appear here as soon as they are published." />
            ) : (
              <EmptyState icon="search-outline" title="No matches" message="Try another name, church or word." />
            )
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator color={colors.accent} style={{ margin: 16 }} />
            ) : moreError ? (
              <Pressable onPress={() => void loadMore()} style={{ padding: 16 }} accessibilityRole="button">
                <Text style={[styles.note, { color: colors.accent }]}>Couldn’t load more. Tap to try again.</Text>
              </Pressable>
            ) : (
              <View style={{ height: 24 }} />
            )
          }
          initialNumToRender={6}
          windowSize={7}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 14, gap: 12 },
  lead: { ...t.body, color: colors.textMuted },
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
  chips: { gap: 8, paddingRight: 16 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { ...t.small, color: colors.textMuted, fontWeight: '700' },
  chipTextOn: { color: colors.onAccent },
  note: { ...t.caption, color: colors.textSubtle, textAlign: 'center' },
});
