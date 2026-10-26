import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { repo } from '@/api';
import { useAudioPlayer } from '@/audio/AudioPlayerContext';
import { useAuth } from '@/auth/AuthContext';
import { EmailVerifyBanner } from '@/components/EmailVerifyBanner';
import { ErrorState } from '@/components/ErrorState';
import { LiveBadge } from '@/components/LiveCard';
import { Logo } from '@/components/Logo';
import { PrimaryButton } from '@/components/PrimaryButton';
import { PromotionCard } from '@/components/PromotionCard';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { Skeleton } from '@/components/SkeletonCard';
import { IconButton } from '@/components/TopBar';
import { VideoCard } from '@/components/VideoCard';
import { WrittenTestimonyCard } from '@/components/WrittenTestimonyCard';
import { colors, gradients, radius, type as t } from '@/constants/theme';
import { useDrawer } from '@/context/DrawerContext';
import { useDownloads } from '@/downloads/DownloadsContext';
import { useLive, useTestimonies } from '@/hooks/useContent';
import { useVerificationOnForeground } from '@/hooks/useVerificationOnForeground';
import { audioTrack, radioTrack } from '@/screens/ListenScreen';
import type { Article, AudioTestimony, Promotion, RadioConfig, Testimony, WrittenTestimony } from '@/types';
import { messageFor } from '@/utils/errors';
import { formatDate, formatDuration } from '@/utils/format';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

// ADOTOPOC's own round badge (transparent corners), shown in place of an icon on its tile.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ADOTOPOC_LOGO = require('../../assets/LOG_xcvt3v.webp');

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function Hero({ live, featured, loading, onWatch, onPlay }: { live: ReturnType<typeof useLive>['live']; featured?: Testimony; loading: boolean; onWatch: () => void; onPlay: (id: string) => void }) {
  if (live?.isLive) {
    return (
      <Pressable onPress={onWatch} style={styles.hero} accessibilityRole="button" accessibilityLabel={`Live now: ${live.title ?? 'Live broadcast'}. Watch live`}>
        {live.thumbnail ? <Image source={live.thumbnail} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} /> : <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />}
        <LinearGradient colors={gradients.live} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
        <View style={styles.heroBody}>
          <LiveBadge />
          <Text style={styles.heroTitle} numberOfLines={2}>{live.title ?? 'We’re live now'}</Text>
          {live.description ? <Text style={styles.heroSub} numberOfLines={2}>{live.description}</Text> : null}
          <PrimaryButton title="Watch live" icon="play" onPress={onWatch} compact style={styles.heroBtn} />
        </View>
      </Pressable>
    );
  }
  if (!featured) {
    return loading ? <Skeleton style={[styles.hero, { borderWidth: 0 }]} /> : null;
  }
  const dur = formatDuration(featured.duration);
  return (
    <Pressable onPress={() => onPlay(featured.id)} style={styles.hero} accessibilityRole="button" accessibilityLabel={`Featured testimony: ${featured.title}. Play`}>
      <Image source={featured.thumbnail} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
      <LinearGradient colors={gradients.card} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} />
      <View style={styles.heroBody}>
        <View style={styles.chip}>
          <Ionicons name="star" size={11} color={colors.onAccent} />
          <Text style={styles.chipText}>{featured.isFeatured ? 'FEATURED' : (featured.category ?? 'NEW').toUpperCase()}</Text>
        </View>
        <Text style={styles.heroTitle} numberOfLines={2}>{featured.title}</Text>
        <Text style={styles.heroSub} numberOfLines={1}>{[featured.authorName, dur].filter(Boolean).join('  ·  ')}</Text>
        <PrimaryButton title="Watch testimony" icon="play" onPress={() => onPlay(featured.id)} compact style={styles.heroBtn} />
      </View>
    </Pressable>
  );
}

function Tile({ icon, image, label, onPress, badge }: { icon: IconName; image?: number; label: string; onPress: () => void; badge?: number }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tile, pressed && { opacity: 0.75 }]} accessibilityRole="button" accessibilityLabel={badge ? `${label}, ${badge}` : label}>
      <View style={styles.tileIcon}>
        {image ? (
          <Image source={image} style={styles.tileImage} contentFit="contain" accessible={false} />
        ) : (
          <Ionicons name={icon} size={22} color={colors.accent} />
        )}
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.tileLabel} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

export function HomeScreen() {
  const nav = useNavigation();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const { openDrawer } = useDrawer();
  const player = useAudioPlayer();
  const downloads = useDownloads();
  const feat = useTestimonies({ featuredOnly: true, limit: 1 });
  const latest = useTestimonies({ limit: 10 });
  const { live } = useLive();
  useVerificationOnForeground();

  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [radio, setRadio] = useState<RadioConfig | null>(null);
  const [audio, setAudio] = useState<AudioTestimony[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [written, setWritten] = useState<WrittenTestimony[]>([]);

  const loadExtras = useCallback(() => {
    // Secondary sections are best-effort: a failure hides the section instead of blocking Home.
    repo.getPromotions().then(setPromotions).catch(() => undefined);
    repo.getAudioTestimonies(3).then(setAudio).catch(() => undefined);
    repo.getArticles(5).then(setArticles).catch(() => undefined);
    repo.getWrittenTestimonies({ limit: 2 }).then((p) => setWritten(p.items)).catch(() => undefined);
  }, []);

  useEffect(() => {
    loadExtras();
    return repo.subscribeRadio(setRadio, () => undefined);
  }, [loadExtras]);

  const hero = feat.items[0] ?? latest.items[0];
  const rest = useMemo(() => latest.items.filter((i) => i.id !== hero?.id), [latest.items, hero?.id]);
  const saved = downloads.items.filter((d) => d.status === 'done').length;
  const radioOn = Boolean(radio?.isLive && radio.streamUrl);
  const firstName = user?.displayName?.trim().split(/\s+/)[0];
  const tileWidth = Math.floor((Math.min(width, 640) - 40 - 3 * 10) / 4);

  const openTestimony = (id: string) => nav.navigate('TestimonyDetails', { id });
  const refreshing = latest.refreshing || feat.refreshing;
  const onRefresh = () => {
    void feat.refresh();
    void latest.refresh();
    loadExtras();
  };

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Logo size={36} />
          <View style={{ flexShrink: 1 }}>
            <Text style={styles.hello} numberOfLines={1}>{greeting()}{firstName ? `,` : ''}</Text>
            <Text style={styles.name} numberOfLines={1} accessibilityRole="header">{firstName ?? 'Welcome'}</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <IconButton name="search" label="Search" onPress={() => nav.navigate('Search')} />
          <IconButton name="notifications-outline" label="Notifications" onPress={() => nav.navigate('Notifications')} />
          <IconButton name="menu" label="Open navigation menu" onPress={openDrawer} size={24} />
        </View>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <EmailVerifyBanner />

        <Hero live={live} featured={hero} loading={latest.loading || feat.loading} onWatch={() => nav.navigate('Tabs', { screen: 'Live' })} onPlay={openTestimony} />

        {/* Real broadcast state only. When the video broadcast is off, point to what IS available. */}
        {live && !live.isLive ? (
          <Pressable
            style={styles.status}
            onPress={() => (radioOn ? nav.navigate('Tabs', { screen: 'Listen' }) : nav.navigate('Tabs', { screen: 'Live' }))}
            accessibilityRole="button"
            accessibilityLabel={radioOn ? 'Live broadcast is offline. TOP Radio is on air, listen now' : 'Live broadcast is offline. Open Live'}
          >
            <View style={[styles.statusDot, radioOn && { backgroundColor: colors.live }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.statusTitle}>{radioOn ? 'TOP Radio is on air' : 'Live broadcast is offline'}</Text>
              <Text style={styles.statusSub} numberOfLines={1}>
                {radioOn ? radio?.currentProgramme || 'Listen live, even with your screen locked' : 'We’ll notify you when we go live'}
              </Text>
            </View>
            {radioOn ? (
              <Pressable
                onPress={() => radio && player.play(radioTrack(radio))}
                style={styles.statusPlay}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Play TOP Radio"
              >
                <Ionicons name="play" size={16} color={colors.onAccent} style={{ marginLeft: 2 }} />
              </Pressable>
            ) : (
              <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
            )}
          </Pressable>
        ) : null}

        <SectionHeader title="Explore" />
        <View style={styles.grid}>
          {(
            [
              ['play-circle-outline', 'Testimonies', () => nav.navigate('Tabs', { screen: 'Testimonies' })],
              ['headset-outline', 'Listen', () => nav.navigate('Tabs', { screen: 'Listen' })],
              ['videocam-outline', 'Live', () => nav.navigate('Tabs', { screen: 'Live' })],
              ['book-outline', 'Articles', () => nav.navigate('Articles')],
              ['globe-outline', 'ADOTOPOC', () => nav.navigate('Adotopoc'), ADOTOPOC_LOGO],
              ['megaphone-outline', 'Events', () => nav.navigate('Promotions')],
              ['heart-outline', 'Share', () => nav.navigate('ShareTestimony')],
              ['cloud-download-outline', 'Saved', () => nav.navigate('Tabs', { screen: 'Downloads' })],
            ] as [IconName, string, () => void, number?][]
          ).map(([icon, label, onPress, image]) => (
            <View key={label} style={{ width: tileWidth }}>
              <Tile icon={icon} image={image} label={label} onPress={onPress} badge={label === 'Saved' ? saved : undefined} />
            </View>
          ))}
        </View>

        {promotions.length > 0 ? (
          <>
            <SectionHeader title="Highlights & events" action="See all" onAction={() => nav.navigate('Promotions')} />
            <FlatList
              horizontal
              data={promotions}
              keyExtractor={(i) => i.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
              renderItem={({ item }) => <PromotionCard item={item} compact />}
            />
          </>
        ) : null}

        <SectionHeader title="Latest testimonies" subtitle="Stories of God’s faithfulness" action="See all" onAction={() => nav.navigate('Tabs', { screen: 'Testimonies' })} />
        {latest.loading && !latest.items.length ? (
          <View style={styles.rowSkeleton}>
            <Skeleton style={styles.tileSkeleton} />
            <Skeleton style={styles.tileSkeleton} />
          </View>
        ) : latest.error && !latest.items.length ? (
          <ErrorState message={messageFor(latest.error)} onRetry={latest.retry} />
        ) : rest.length ? (
          <FlatList
            horizontal
            data={rest}
            keyExtractor={(i) => i.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}
            renderItem={({ item }) => <VideoCard item={item} onPress={() => openTestimony(item.id)} />}
          />
        ) : (
          <Text style={styles.empty}>{hero ? 'More testimonies are on the way.' : 'New testimonies will appear here as soon as they’re published.'}</Text>
        )}

        {written.length > 0 ? (
          <>
            <SectionHeader title="Written testimonies" subtitle="Read what God has done" action="See all" onAction={() => nav.navigate('WrittenTestimonies')} />
            <View style={{ marginHorizontal: 4 }}>
              {written.map((w) => (
                <WrittenTestimonyCard key={w.id} item={w} onPress={() => nav.navigate('WrittenTestimony', { id: w.id })} />
              ))}
            </View>
          </>
        ) : null}

        {audio.length > 0 ? (
          <>
            <SectionHeader title="Listen now" subtitle="Audio testimonies" action="All audio" onAction={() => nav.navigate('Tabs', { screen: 'Listen' })} />
            <View style={{ paddingHorizontal: 20, gap: 10 }}>
              {audio.map((a) => {
                const tr = audioTrack(a);
                const playing = player.track?.id === tr.id && player.status === 'playing';
                return (
                  <View key={a.id} style={styles.audioRow}>
                    <Pressable style={styles.audioPlay} onPress={() => (playing ? player.pause() : player.play(tr))} hitSlop={6} accessibilityRole="button" accessibilityLabel={`${playing ? 'Pause' : 'Play'} ${a.title}`}>
                      <Ionicons name={playing ? 'pause' : 'play'} size={16} color={colors.onAccent} style={playing ? undefined : { marginLeft: 2 }} />
                    </Pressable>
                    <Pressable style={{ flex: 1 }} onPress={() => nav.navigate('AudioTestimony', { id: a.id })} accessibilityRole="button" accessibilityLabel={`Open ${a.title}: details and comments`}>
                      <Text style={styles.audioTitle} numberOfLines={1}>{a.title}</Text>
                      <Text style={styles.audioMeta} numberOfLines={1}>{[a.speaker, formatDuration(a.duration)].filter(Boolean).join('  ·  ')}</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </>
        ) : null}

        {articles.length > 0 ? (
          <>
            <SectionHeader title="Articles & insights" action="See all" onAction={() => nav.navigate('Articles')} />
            <FlatList
              horizontal
              data={articles}
              keyExtractor={(i) => i.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}
              renderItem={({ item }) => (
                <Pressable style={styles.article} onPress={() => nav.navigate('ArticleDetails', { id: item.id })} accessibilityRole="button" accessibilityLabel={`Article: ${item.title}`}>
                  <View style={styles.articleCover}>
                    {item.coverImageUrl ? <Image source={item.coverImageUrl} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : <Ionicons name="book" size={28} color={colors.accent} />}
                  </View>
                  {item.category ? <Text style={styles.articleCat}>{item.category.toUpperCase()}</Text> : null}
                  <Text style={styles.articleTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.audioMeta} numberOfLines={1}>{[item.author, formatDate(item.publishedAt ?? item.createdAt)].filter(Boolean).join('  ·  ')}</Text>
                </Pressable>
              )}
            />
          </>
        ) : null}

        {saved > 0 ? (
          <Pressable style={styles.saved} onPress={() => nav.navigate('Tabs', { screen: 'Downloads' })} accessibilityRole="button">
            <Ionicons name="cloud-done-outline" size={22} color={colors.success} />
            <Text style={styles.savedText}>
              {saved} {saved === 1 ? 'testimony' : 'testimonies'} saved for offline viewing
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
          </Pressable>
        ) : null}

        <View style={styles.cta}>
          <LinearGradient colors={['#5A0E82', '#3A0058']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <Ionicons name="sparkles" size={22} color={colors.accent} />
          <Text style={styles.ctaTitle}>What has God done for you?</Text>
          <Text style={styles.ctaText}>Share your testimony. Someone needs to hear it today.</Text>
          <View style={styles.ctaRow}>
            <PrimaryButton title="Share testimony" icon="heart" onPress={() => nav.navigate('ShareTestimony')} compact />
            <PrimaryButton title="Sponsor" variant="outline" onPress={() => nav.navigate('Sponsor')} compact />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hello: { ...t.small, color: colors.textSubtle },
  name: { ...t.h3, fontSize: 18, color: colors.text },
  hero: { height: 300, marginHorizontal: 20, marginTop: 8, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: colors.card, justifyContent: 'flex-end', borderWidth: 1, borderColor: colors.borderSoft },
  heroBody: { padding: 18, gap: 8 },
  heroTitle: { ...t.h1, color: colors.text },
  heroSub: { ...t.small, color: colors.textMuted },
  heroBtn: { alignSelf: 'flex-start', marginTop: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: colors.accent, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { ...t.caps, fontSize: 10, color: colors.onAccent },
  status: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 20, marginTop: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSoft },
  statusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.textSubtle },
  statusTitle: { ...t.h3, fontSize: 14, color: colors.text },
  statusSub: { ...t.caption, color: colors.textSubtle, marginTop: 1 },
  statusPlay: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: 10, rowGap: 16 },
  tile: { alignItems: 'center', gap: 8 },
  tileIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: 'rgba(245,197,66,0.18)', alignItems: 'center', justifyContent: 'center' },
  tileImage: { width: 50, height: 50 },
  tileLabel: { ...t.small, fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  badge: { position: 'absolute', top: -4, right: -6, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.bg },
  badgeText: { fontSize: 10, fontWeight: '800', color: colors.onAccent },
  rowSkeleton: { flexDirection: 'row', gap: 14, paddingHorizontal: 20 },
  tileSkeleton: { width: 220, height: 124, borderRadius: radius.md },
  empty: { ...t.small, color: colors.textSubtle, paddingHorizontal: 20 },
  audioRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSoft },
  audioPlay: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  audioTitle: { ...t.h3, fontSize: 14, color: colors.text },
  audioMeta: { ...t.caption, color: colors.textSubtle, marginTop: 2 },
  article: { width: 220, gap: 6 },
  articleCover: { height: 124, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  articleCat: { ...t.caps, fontSize: 10, color: colors.accent, marginTop: 2 },
  articleTitle: { ...t.h3, fontSize: 15, color: colors.text },
  saved: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 20, marginTop: 24, padding: 14, borderRadius: radius.md, backgroundColor: 'rgba(61,220,151,0.08)', borderWidth: 1, borderColor: 'rgba(61,220,151,0.3)' },
  savedText: { ...t.small, flex: 1, color: colors.text, fontWeight: '600' },
  cta: { marginHorizontal: 20, marginTop: 28, padding: 20, gap: 8, borderRadius: radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(245,197,66,0.25)' },
  ctaTitle: { ...t.h2, color: colors.text },
  ctaText: { ...t.body, color: colors.textMuted },
  ctaRow: { flexDirection: 'row', gap: 10, marginTop: 8, flexWrap: 'wrap' },
});
