import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { repo } from '@/api';
import { CommentsSection } from '@/components/CommentsSection';
import { ErrorState } from '@/components/ErrorState';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { TestifierAvatar } from '@/components/WrittenTestimonyCard';
import { CONFIG } from '@/constants/config';
import { colors, gradients, radius, type as t } from '@/constants/theme';
import type { RootStackParamList } from '@/navigation/types';
import type { WrittenTestimony } from '@/types';
import { messageFor } from '@/utils/errors';
import { formatDate } from '@/utils/format';

/** Public web address of one written testimony (the website has the same reading page). */
export const writtenTestimonyUrl = (id: string) => `${CONFIG.websiteUrl.replace(/\/+$/, '')}/#/written/${encodeURIComponent(id)}`;

/**
 * Reading screen laid out like the Testimonies of Praise quote cards: brand ribbon, gold-ringed
 * photo, testifier name and church/zone, a large quote mark and the full testimony on a light
 * "paper" card for comfortable reading, then sharing and comments.
 */
export function WrittenTestimonyScreen() {
  const nav = useNavigation();
  const { id } = useRoute<RouteProp<RootStackParamList, 'WrittenTestimony'>>().params;
  const [item, setItem] = useState<WrittenTestimony | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    repo
      .getWrittenTestimony(id)
      .then((w) => {
        if (cancelled) return;
        if (w) setItem(w);
        else setNotFound(true);
      })
      .catch((e) => !cancelled && setError(messageFor(e)));
    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  const share = () => {
    if (!item) return;
    const by = item.authorName ? `\n— ${item.authorName}${item.churchZone ? `, ${item.churchZone}` : ''}` : '';
    void Share.share({
      title: item.title,
      message: `${item.title}${by}\n\n“${item.excerpt}”\n\nRead the full testimony: ${writtenTestimonyUrl(item.id)}`,
    });
  };

  // Keep the author's paragraphs; collapse runs of blank lines.
  const paragraphs = item ? item.body.split(/\n\s*\n|\n/).map((p) => p.trim()).filter(Boolean) : [];

  return (
    <Screen>
      <TopBar title="Written testimony" onBack={() => nav.goBack()} />
      {notFound && !item ? (
        <ErrorState message="This testimony is no longer available." onRetry={() => nav.goBack()} />
      ) : error && !item ? (
        <ErrorState message={error} onRetry={() => setAttempt((a) => a + 1)} />
      ) : !item ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <LoadingSpinner label="LOADING PRAISE" />
        </View>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
              <LinearGradient colors={gradients.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ribbon}>
                <Text style={styles.ribbonText}>TESTIMONIES OF PRAISE</Text>
              </LinearGradient>

              <View style={styles.paper}>
                <View style={styles.who}>
                  <TestifierAvatar name={item.authorName} photoUrl={item.authorPhotoUrl} size={72} />
                  <View style={{ flex: 1 }}>
                    {item.authorName ? <Text style={styles.name}>{item.authorName}</Text> : null}
                    {item.churchZone ? <Text style={styles.zone}>{item.churchZone}</Text> : null}
                  </View>
                  <Text style={styles.quote} accessibilityElementsHidden importantForAccessibility="no">
                    ”
                  </Text>
                </View>

                <Text style={styles.title} accessibilityRole="header">
                  {item.title}
                </Text>
                {paragraphs.map((p, i) => (
                  <Text key={i} style={styles.para} selectable>
                    {p}
                  </Text>
                ))}
                <Text style={styles.meta}>{[item.category, formatDate(item.publishedAt ?? item.createdAt)].filter(Boolean).join('  •  ')}</Text>
              </View>
            </LinearGradient>

            <View style={styles.below}>
              <PrimaryButton title="Share this testimony" icon="share-social-outline" variant="outline" onPress={share} />
              <CommentsSection type="written" mediaId={item.id} mediaTitle={item.title} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </Screen>
  );
}

const PAPER_TEXT = '#14063A';

const styles = StyleSheet.create({
  content: { paddingBottom: 40 },
  hero: { margin: 16, borderRadius: radius.xl, padding: 14, paddingTop: 0, overflow: 'hidden' },
  ribbon: { alignSelf: 'flex-end', marginRight: 8, paddingHorizontal: 16, paddingVertical: 8, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
  ribbonText: { fontSize: 13, fontWeight: '900', letterSpacing: 2, color: '#fff' },
  paper: { marginTop: 12, backgroundColor: '#FFFFFF', borderRadius: radius.lg, padding: 18, gap: 12 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  name: { fontSize: 18, lineHeight: 23, fontWeight: '900', color: colors.primary },
  zone: { ...t.small, fontWeight: '700', color: '#2B1B9A', marginTop: 2 },
  quote: { fontSize: 60, lineHeight: 60, fontWeight: '900', color: colors.primaryLight, alignSelf: 'flex-start' },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '800', color: colors.primary },
  para: { fontSize: 17, lineHeight: 27, fontWeight: '600', color: PAPER_TEXT },
  meta: { ...t.caption, color: '#6B5A86', marginTop: 4 },
  below: { paddingHorizontal: 16, gap: 18 },
});
