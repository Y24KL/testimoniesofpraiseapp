import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { repo } from '@/api';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { colors, radius, type as t } from '@/constants/theme';
import type { Article } from '@/types';
import { getReadArticleIds } from '@/utils/articleReadState';
import { messageFor } from '@/utils/errors';
import { formatDate } from '@/utils/format';

export function ArticlesScreen() {
  const nav = useNavigation();
  const [items, setItems] = useState<Article[] | null>(null);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [articles, read] = await Promise.all([repo.getArticles(50), getReadArticleIds()]);
      setItems(articles ?? []);
      setReadIds(read ?? new Set());
    } catch (e) {
      setError(messageFor(e));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const handleRetry = () => {
    setItems(null);
    setError(null);
    void load();
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <Screen>
      <TopBar title="Articles & Insights" onBack={() => nav.goBack()} />
      {error ? (
        <ErrorState message={error} onRetry={handleRetry} />
      ) : !items ? (
        <LoadingSpinner label="LOADING ARTICLES" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={colors.accent}
              onRefresh={handleRefresh}
            />
          }
          renderItem={({ item }) => {
            const isRead = readIds.has(item.id);
            const dateStr = formatDate(item.publishedAt ?? item.createdAt);
            return (
              <Pressable
                onPress={() => nav.navigate('ArticleDetails', { id: item.id })}
                style={styles.card}
                accessibilityRole="button"
                accessibilityLabel={`${item.title}, ${isRead ? 'read' : 'unread'}`}
              >
                {item.coverImageUrl ? (
                  <Image source={item.coverImageUrl} style={styles.thumb} contentFit="cover" transition={200} />
                ) : (
                  <View style={styles.thumbPlaceholder}>
                    <Ionicons name="document-text-outline" size={28} color={colors.accent} />
                  </View>
                )}

                <View style={styles.body}>
                  <View style={styles.metaRow}>
                    {item.category ? (
                      <View style={styles.chip}>
                        <Text style={styles.chipText}>{item.category.toUpperCase()}</Text>
                      </View>
                    ) : null}
                    {!isRead ? (
                      <View style={styles.newBadge}>
                        <View style={styles.newDot} />
                        <Text style={styles.newText}>NEW</Text>
                      </View>
                    ) : (
                      <View style={styles.readBadge}>
                        <Ionicons name="checkmark" size={12} color={colors.textMuted} />
                        <Text style={styles.readText}>READ</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.title} numberOfLines={2}>
                    {item.title}
                  </Text>

                  <Text style={styles.subMeta} numberOfLines={1}>
                    {[item.author, dateStr].filter(Boolean).join('  •  ')}
                  </Text>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              icon="book-outline"
              title="No Articles Published"
              message="Inspiring write-ups and study publications will appear here."
            />
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    padding: 16,
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
    padding: 12,
    gap: 12,
    alignItems: 'center',
  },
  thumb: {
    width: 84,
    height: 84,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
  },
  thumbPlaceholder: {
    width: 84,
    height: 84,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  body: {
    flex: 1,
    gap: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(245, 197, 66, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 197, 66, 0.35)',
  },
  chipText: {
    ...t.label,
    fontSize: 9,
    color: colors.accent,
    fontWeight: '700',
  },
  newBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 197, 66, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  newDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  newText: {
    ...t.label,
    fontSize: 9,
    color: colors.accent,
    fontWeight: '800',
  },
  readBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  readText: {
    ...t.label,
    fontSize: 9,
    color: colors.textMuted,
    fontWeight: '600',
  },
  title: {
    ...t.h3,
    fontSize: 15,
    color: colors.text,
    lineHeight: 20,
  },
  subMeta: {
    ...t.caption,
    color: colors.textMuted,
    fontSize: 11,
  },
});