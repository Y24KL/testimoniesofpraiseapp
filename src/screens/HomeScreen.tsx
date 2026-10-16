import React, { useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { repo } from '@/api';
import { EmailVerifyBanner } from '@/components/EmailVerifyBanner';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { LiveCard } from '@/components/LiveCard';
import { PrimaryButton } from '@/components/PrimaryButton';
import { PromotionCard } from '@/components/PromotionCard';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { SkeletonCard } from '@/components/SkeletonCard';
import { TestimonyCard } from '@/components/TestimonyCard';
import { TopBar } from '@/components/TopBar';
import { VideoCard } from '@/components/VideoCard';
import { colors, radius, type as t } from '@/constants/theme';
import { useLive, useTestimonies } from '@/hooks/useContent';
import { useVerificationOnForeground } from '@/hooks/useVerificationOnForeground';
import type { Promotion, RadioConfig } from '@/types';
import { messageFor } from '@/utils/errors';

export function HomeScreen() {
  const nav = useNavigation();
  const feat = useTestimonies({ featuredOnly: true, limit: 1 });
  const latest = useTestimonies({ limit: 10 });
  const { live } = useLive();
  useVerificationOnForeground();

  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [radioConfig, setRadioConfig] = useState<RadioConfig | null>(null);

  useEffect(() => {
    repo.getPromotions().then(setPromotions).catch(() => undefined);
    const unsub = repo.subscribeRadio(setRadioConfig);
    return unsub;
  }, []);

  const hero = feat.items[0] ?? latest.items[0];
  const rest = latest.items.filter((i) => i.id !== hero?.id);
  const refreshing = latest.refreshing || feat.refreshing;
  const onRefresh = () => {
    void feat.refresh();
    void latest.refresh();
    void repo.getPromotions().then(setPromotions).catch(() => undefined);
  };

  return (
    <Screen>
      <TopBar
        brand
        onSearch={() => nav.navigate('Search')}
        onNotifications={() => nav.navigate('Notifications')}
        onProfile={() => nav.navigate('Profile')}
      />
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <EmailVerifyBanner />

        {/* Live Radio Quick Bar (shown when radio is on air) */}
        {radioConfig?.isLive ? (
          <Pressable
            style={styles.radioQuickBar}
            onPress={() => nav.navigate('Radio')}
            accessibilityRole="button"
            accessibilityLabel="Listen to live radio"
          >
            <View style={styles.radioLiveIndicator}>
              <View style={styles.radioDot} />
              <Ionicons name="radio" size={16} color="#34C759" />
            </View>
            <View style={styles.radioInfo}>
              <Text style={styles.radioBarTitle} numberOfLines={1}>
                {radioConfig.currentProgramme || 'TOP Radio — On Air'}
              </Text>
              <Text style={styles.radioBarSub}>Tap to tune in live</Text>
            </View>
            <View style={styles.radioPlayPill}>
              <Ionicons name="play" size={14} color={colors.bg} />
              <Text style={styles.radioPlayText}>LISTEN</Text>
            </View>
          </Pressable>
        ) : null}

        {/* Quick Discover Navigation Grid */}
        <View style={styles.discoverGrid}>
          <Pressable
            style={styles.gridTile}
            onPress={() => nav.navigate('Radio')}
            accessibilityRole="button"
            accessibilityLabel="TOP Radio"
          >
            <View style={[styles.tileIconCircle, { backgroundColor: 'rgba(245, 197, 66, 0.15)' }]}>
              <Ionicons name="radio-outline" size={20} color={colors.accent} />
            </View>
            <Text style={styles.tileTitle}>TOP Radio</Text>
            <Text style={styles.tileSubtitle}>24/7 Audio Stream</Text>
          </Pressable>

          <Pressable
            style={styles.gridTile}
            onPress={() => nav.navigate('Adotopoc')}
            accessibilityRole="button"
            accessibilityLabel="ADOTOPOC Resource Center"
          >
            <View style={[styles.tileIconCircle, { backgroundColor: 'rgba(127, 4, 4, 0.35)' }]}>
              <Ionicons name="library-outline" size={20} color="#FBFAF5" />
            </View>
            <Text style={styles.tileTitle}>ADOTOPOC</Text>
            <Text style={styles.tileSubtitle}>Resource Center</Text>
          </Pressable>

          <Pressable
            style={styles.gridTile}
            onPress={() => nav.navigate('Articles')}
            accessibilityRole="button"
            accessibilityLabel="Articles and Insights"
          >
            <View style={[styles.tileIconCircle, { backgroundColor: 'rgba(186, 104, 200, 0.2)' }]}>
              <Ionicons name="book-outline" size={20} color={colors.primaryLight} />
            </View>
            <Text style={styles.tileTitle}>Articles</Text>
            <Text style={styles.tileSubtitle}>Publications & Study</Text>
          </Pressable>

          <Pressable
            style={styles.gridTile}
            onPress={() => nav.navigate('Promotions')}
            accessibilityRole="button"
            accessibilityLabel="Highlights and Promotions"
          >
            <View style={[styles.tileIconCircle, { backgroundColor: 'rgba(245, 197, 66, 0.15)' }]}>
              <Ionicons name="megaphone-outline" size={20} color={colors.accent} />
            </View>
            <Text style={styles.tileTitle}>Highlights</Text>
            <Text style={styles.tileSubtitle}>Events & Programs</Text>
          </Pressable>
        </View>

        {/* Promotions Carousel */}
        {promotions.length > 0 ? (
          <>
            <SectionHeader
              title="HIGHLIGHTS & EVENTS"
              action="See all"
              onAction={() => nav.navigate('Promotions')}
            />
            <FlatList
              horizontal
              data={promotions}
              keyExtractor={(i) => i.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
              renderItem={({ item }) => <PromotionCard item={item} compact />}
            />
          </>
        ) : null}

        {/* Hero & Latest Testimonies */}
        {latest.loading && !hero ? (
          <View style={{ paddingHorizontal: 16, gap: 16, marginTop: 12 }}>
            <SkeletonCard />
            <SkeletonCard horizontal />
            <SkeletonCard horizontal />
          </View>
        ) : latest.error && !hero ? (
          <ErrorState message={messageFor(latest.error)} onRetry={latest.retry} />
        ) : hero ? (
          <>
            <SectionHeader title="FEATURED" />
            <TestimonyCard
              item={hero}
              variant="hero"
              onPress={() => nav.navigate('TestimonyDetails', { id: hero.id })}
            />

            <SectionHeader
              title="LATEST TESTIMONIES"
              action="See all"
              onAction={() => nav.navigate('Tabs', { screen: 'Testimonies' })}
            />
            {rest.length ? (
              <FlatList
                horizontal
                data={rest}
                keyExtractor={(i) => i.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
                renderItem={({ item }) => (
                  <VideoCard
                    item={item}
                    onPress={() => nav.navigate('TestimonyDetails', { id: item.id })}
                  />
                )}
              />
            ) : null}
          </>
        ) : (
          <EmptyState
            icon="videocam-outline"
            title="No testimonies yet"
            message="New testimonies will appear here as soon as they’re published."
          />
        )}

        <SectionHeader title="WATCH LIVE" />
        <LiveCard live={live} onPress={() => nav.navigate('Tabs', { screen: 'Live' })} />

        <View style={styles.cta}>
          <Text style={styles.ctaTitle}>Share your testimony</Text>
          <Text style={styles.ctaText}>What has God done for you? Someone needs to hear it.</Text>
          <PrimaryButton
            title="SHARE YOUR TESTIMONY"
            icon="heart-outline"
            onPress={() => nav.navigate('ShareTestimony')}
          />
        </View>

        {rest.length > 3 ? (
          <>
            <SectionHeader title="RECENTLY ADDED" />
            {rest.slice(-3).map((i) => (
              <TestimonyCard
                key={i.id}
                item={i}
                onPress={() => nav.navigate('TestimonyDetails', { id: i.id })}
              />
            ))}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  radioQuickBar: {
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(52, 199, 89, 0.3)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  radioLiveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  radioDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34C759',
  },
  radioInfo: {
    flex: 1,
    gap: 2,
  },
  radioBarTitle: {
    ...t.h3,
    fontSize: 13,
    color: colors.text,
  },
  radioBarSub: {
    ...t.caption,
    fontSize: 11,
    color: colors.textMuted,
  },
  radioPlayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  radioPlayText: {
    ...t.label,
    fontSize: 10,
    fontWeight: '800',
    color: colors.bg,
  },
  discoverGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
    gap: 10,
  },
  gridTile: {
    width: '48.5%',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 12,
    gap: 6,
  },
  tileIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileTitle: {
    ...t.h3,
    fontSize: 14,
    color: colors.text,
  },
  tileSubtitle: {
    ...t.caption,
    fontSize: 11,
    color: colors.textMuted,
  },
  cta: {
    margin: 16,
    marginTop: 24,
    padding: 18,
    gap: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.primaryLight,
  },
  ctaTitle: { ...t.h2, color: colors.text },
  ctaText: { ...t.body, color: colors.textMuted },
});
