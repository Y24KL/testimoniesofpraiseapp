import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { repo } from '@/api';
import { ErrorState } from '@/components/ErrorState';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { colors, radius, type as t } from '@/constants/theme';
import type { RootStackParamList } from '@/navigation/types';
import type { Article } from '@/types';
import { markArticleAsRead } from '@/utils/articleReadState';
import { messageFor } from '@/utils/errors';
import { formatDate } from '@/utils/format';

function FormattedBody({ body }: { body: string }) {
  const paragraphs = body.split(/\n\s*\n/);

  return (
    <View style={styles.bodyContainer}>
      {paragraphs.map((para, idx) => {
        const trimmed = para.trim();
        if (!trimmed) return null;

        if (trimmed.startsWith('### ')) {
          return (
            <Text key={idx} style={styles.h3}>
              {trimmed.replace(/^###\s+/, '')}
            </Text>
          );
        }
        if (trimmed.startsWith('## ')) {
          return (
            <Text key={idx} style={styles.h2}>
              {trimmed.replace(/^##\s+/, '')}
            </Text>
          );
        }
        if (trimmed.startsWith('# ')) {
          return (
            <Text key={idx} style={styles.h1}>
              {trimmed.replace(/^#\s+/, '')}
            </Text>
          );
        }
        if (trimmed.startsWith('> ')) {
          return (
            <View key={idx} style={styles.quoteBlock}>
              <Text style={styles.quoteText}>{trimmed.replace(/^>\s+/, '')}</Text>
            </View>
          );
        }
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const lines = trimmed.split('\n');
          return (
            <View key={idx} style={styles.listBlock}>
              {lines.map((line, lIdx) => (
                <View key={lIdx} style={styles.bulletRow}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.bulletText}>{line.replace(/^[-*]\s+/, '')}</Text>
                </View>
              ))}
            </View>
          );
        }

        return (
          <Text key={idx} style={styles.paragraph}>
            {trimmed}
          </Text>
        );
      })}
    </View>
  );
}

export function ArticleDetailsScreen() {
  const nav = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'ArticleDetails'>>();
  const { id } = route.params;

  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const item = await repo.getArticle(id);
        if (!mounted) return;
        setArticle(item);
        if (item) {
          void markArticleAsRead(item.id);
        }
      } catch (e) {
        if (mounted) setError(messageFor(e));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  const handleShare = async () => {
    if (!article) return;
    try {
      await Share.share({
        title: article.title,
        message: `${article.title}\n\nRead more on Testimonies of Praise:\nhttps://testimoniesofpraiseweb.onrender.com/articles/${article.id}`,
      });
    } catch {
      /* ignore */
    }
  };

  return (
    <Screen>
      <TopBar
        title="Article"
        onBack={() => nav.goBack()}
        right={
          article ? (
            <Pressable
              onPress={handleShare}
              accessibilityRole="button"
              accessibilityLabel="Share article"
              hitSlop={8}
            >
              <Ionicons name="share-outline" size={22} color={colors.accent} />
            </Pressable>
          ) : undefined
        }
      />

      {loading ? (
        <LoadingSpinner label="LOADING ARTICLE" />
      ) : error || !article ? (
        <ErrorState
          message={error ?? 'Article not found or no longer available.'}
          onRetry={() => {
            setError(null);
            setLoading(true);
            void repo.getArticle(id).then((a) => {
              setArticle(a);
              setLoading(false);
            });
          }}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {article.coverImageUrl ? (
            <View style={styles.coverWrapper}>
              <Image source={article.coverImageUrl} style={styles.cover} contentFit="cover" transition={250} />
            </View>
          ) : null}

          <View style={styles.header}>
            {article.category ? (
              <View style={styles.chip}>
                <Text style={styles.chipText}>{article.category.toUpperCase()}</Text>
              </View>
            ) : null}

            <Text style={styles.title}>{article.title}</Text>

            <View style={styles.metaRow}>
              {article.author ? (
                <View style={styles.authorBadge}>
                  <Ionicons name="person-circle-outline" size={16} color={colors.accent} />
                  <Text style={styles.authorText}>{article.author}</Text>
                </View>
              ) : null}
              <Text style={styles.dateText}>
                {formatDate(article.publishedAt ?? article.createdAt)}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <FormattedBody body={article.body} />
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: 48,
  },
  coverWrapper: {
    width: '100%',
    height: 220,
    backgroundColor: colors.surface,
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  header: {
    padding: 20,
    gap: 12,
  },
  chip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(245, 197, 66, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(245, 197, 66, 0.4)',
  },
  chipText: {
    ...t.label,
    color: colors.accent,
    fontSize: 10,
    fontWeight: '700',
  },
  title: {
    ...t.h1,
    fontSize: 24,
    lineHeight: 32,
    color: colors.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  authorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  authorText: {
    ...t.caption,
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  dateText: {
    ...t.caption,
    color: colors.textMuted,
    fontSize: 13,
  },
  divider: {
    height: 1,
    backgroundColor: colors.cardBorder,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  bodyContainer: {
    paddingHorizontal: 20,
    gap: 16,
  },
  paragraph: {
    ...t.body,
    fontSize: 16,
    lineHeight: 26,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  h1: {
    ...t.h1,
    fontSize: 22,
    color: colors.text,
    marginTop: 8,
  },
  h2: {
    ...t.h2,
    fontSize: 18,
    color: colors.accent,
    marginTop: 8,
  },
  h3: {
    ...t.h3,
    fontSize: 16,
    color: colors.text,
    marginTop: 4,
  },
  quoteBlock: {
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
    paddingLeft: 14,
    marginVertical: 4,
    backgroundColor: 'rgba(245, 197, 66, 0.05)',
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
  quoteText: {
    ...t.body,
    fontStyle: 'italic',
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  listBlock: {
    gap: 8,
    paddingLeft: 4,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bulletDot: {
    color: colors.accent,
    fontSize: 18,
    lineHeight: 22,
  },
  bulletText: {
    ...t.body,
    fontSize: 16,
    lineHeight: 24,
    color: 'rgba(255, 255, 255, 0.9)',
    flex: 1,
  },
});
