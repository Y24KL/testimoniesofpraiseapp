import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { useDailyDiscovery } from '@/editorial/useEditorial';
import type { FeaturedItem } from '@/editorial/service';
import { WEEKDAYS } from '@/editorial/rules';
import type { RootStackParamList } from '@/navigation/types';
import { colors, radius, spacing, type as t } from '@/constants/theme';
import { SectionHeader } from '@/components/SectionHeader';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const KIND_LABEL: Record<FeaturedItem['kind'], string> = { testimony: 'Testimony', lyrical: 'Lyrical analysis', article: 'Article', choir: 'Featured choir' };

/**
 * Home's "Daily discovery": one curated line, the next confirmed radio programme, and the admin's picks.
 * Each slot is shown only when it has real content. When nothing is configured, nothing is rendered.
 */
export function DailyDiscovery() {
  const nav = useNavigation<NavigationProp<RootStackParamList>>();
  const d = useDailyDiscovery();
  const hasAny = Boolean(d.inspiration || d.broadcast || d.featured.length || d.highlights.length);
  if (!d.ready || !hasAny) return null;

  const open = (item: FeaturedItem) => {
    if (item.kind === 'testimony') nav.navigate('TestimonyDetails', { id: item.id });
    else if (item.kind === 'lyrical') nav.navigate('LyricalAnalysisVideo', { id: item.id });
    else if (item.kind === 'article') nav.navigate('ArticleDetails', { id: item.id });
    else nav.navigate('FeaturedChoir', { id: item.id });
  };

  const all = [...d.featured, ...d.highlights];
  const when = d.broadcast ? broadcastLabel(d.broadcast.entry) : null;

  return (
    <View>
      <SectionHeader title="Daily discovery" subtitle="Chosen by the T.O.P. team" />
      <View style={styles.wrap}>
        {d.inspiration ? (
          <View style={styles.quote} accessibilityRole="text">
            <Ionicons name="sunny-outline" size={20} color={colors.accent} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.quoteText}>{d.inspiration.text}</Text>
              {d.inspiration.source ? <Text style={styles.meta}>{d.inspiration.source}</Text> : null}
            </View>
          </View>
        ) : null}

        {d.broadcast && when ? (
          <View style={styles.card} accessibilityRole="text">
            <Ionicons name="radio-outline" size={22} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{d.broadcast.entry.title}</Text>
              <Text style={styles.meta}>{when}</Text>
            </View>
          </View>
        ) : null}

        {all.map((item) => (
          <Pressable key={`${item.kind}-${item.id}`} onPress={() => open(item)} style={styles.card} accessibilityRole="link" accessibilityLabel={`${KIND_LABEL[item.kind]}: ${item.title}`}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.meta}>{KIND_LABEL[item.kind]}</Text>
              <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
              {item.subtitle ? <Text style={styles.meta} numberOfLines={1}>{item.subtitle}</Text> : null}
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** "Wednesday 13:00 GMT+1", from the admin's own entry. The zone label is never computed. */
export function broadcastLabel(entry: { weekday: (typeof WEEKDAYS)[number]; localTime: string; timeZoneLabel: string }): string {
  const day = DAY_NAMES[WEEKDAYS.indexOf(entry.weekday)];
  return [day, entry.localTime, entry.timeZoneLabel].filter(Boolean).join(' ');
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  quote: { flexDirection: 'row', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.accentSoft },
  quoteText: { ...t.body, color: colors.text, fontStyle: 'italic' },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder },
  cardTitle: { ...t.h3, color: colors.text },
  meta: { ...t.caption, color: colors.textSubtle },
});
