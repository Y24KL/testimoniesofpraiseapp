import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { useAuth } from '@/auth/AuthContext';
import { SectionHeader } from '@/components/SectionHeader';
import { colors, radius, type as t } from '@/constants/theme';
import { cachedHome, clearHomeCache, fetchHome, markOpened, markShown, type HomeItem, type HomeSections } from '@/discovery/home';
import { getDiscoverySettings, saveDiscoverySettings } from '@/discovery/interests';
import { INTEREST_LABELS, INTEREST_TAGS, type InterestTag } from '@/discovery/rules';
import type { RootStackParamList } from '@/navigation/types';
import { formatDuration } from '@/utils/format';

const TYPE_LABEL: Record<HomeItem['type'], string> = { testimony: 'Testimony', written: 'Written', article: 'Article', lyrical: 'Lyrical Analysis', loveworld: 'LoveWorld Singers' };
const TYPE_ICON: Record<HomeItem['type'], React.ComponentProps<typeof Ionicons>['name']> = { testimony: 'play-circle', written: 'document-text', article: 'book', lyrical: 'musical-notes', loveworld: 'mic' };

/**
 * Personal sections on the home screen for signed-in people: Continue, For You, New in your interests,
 * Featured, and Your interests. Shows the cached copy at once and refreshes in the background. If the
 * service is unreachable, the cached copy (or nothing) is shown; the rest of the home screen is unaffected.
 */
export function PersonalHome({ refreshKey }: { refreshKey: number }) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const nav = useNavigation<NavigationProp<RootStackParamList>>();
  const [sections, setSections] = useState<HomeSections | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const shownFor = useRef(0);

  const load = useCallback(
    async (refresh: boolean) => {
      if (!uid) return;
      const cached = await cachedHome(uid);
      if (cached) setSections(cached.sections);
      if (cached?.fresh && !refresh) return;
      setLoading(!cached);
      try {
        setSections(await fetchHome(uid, refresh));
      } catch {
        /* keep the cached copy; the rest of the home screen still works */
      } finally {
        setLoading(false);
      }
    },
    [uid],
  );

  useEffect(() => {
    setSections(null);
    void load(false);
  }, [load]);

  useEffect(() => {
    if (refreshKey > 0) void load(true);
  }, [refreshKey, load]);

  useEffect(() => {
    if (uid && sections && sections.generatedAt !== shownFor.current) {
      shownFor.current = sections.generatedAt;
      void markShown(uid, sections.forYou);
    }
  }, [uid, sections]);

  if (!uid) return null;

  const open = (item: HomeItem) => {
    void markOpened(uid, item);
    if (item.type === 'testimony') nav.navigate('TestimonyDetails', { id: item.id, ...(item.positionSec ? { startAt: item.positionSec } : {}) });
    else if (item.type === 'written') nav.navigate('WrittenTestimony', { id: item.id });
    else if (item.type === 'article') nav.navigate('ArticleDetails', { id: item.id });
    else if (item.type === 'lyrical') nav.navigate('LyricalAnalysisVideo', { id: item.id });
    else nav.navigate('LoveworldSingerVideo', { id: item.id });
  };

  const onSaved = () => {
    setEditing(false);
    void clearHomeCache(uid).then(() => load(true));
  };

  if (!sections) {
    return loading ? (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} />
      </View>
    ) : null;
  }

  return (
    <View>
      {sections.continue.length ? (
        <>
          <SectionHeader title="Continue where you left off" />
          <Row items={sections.continue} onOpen={open} showProgress />
        </>
      ) : null}

      {sections.personalized && sections.forYou.length ? (
        <>
          <SectionHeader title="For you" subtitle="Picked from your interests and what you watch" />
          <Row items={sections.forYou} onOpen={open} />
        </>
      ) : null}

      {sections.newInInterests.length ? (
        <>
          <SectionHeader title="New in your interests" />
          <Row items={sections.newInInterests} onOpen={open} />
        </>
      ) : null}

      {sections.featured.length ? (
        <>
          <SectionHeader title="Featured you haven’t seen" />
          <Row items={sections.featured} onOpen={open} />
        </>
      ) : null}

      <SectionHeader title="Your interests" action={sections.personalized ? 'Edit' : undefined} onAction={() => setEditing(true)} />
      {!sections.personalized ? (
        <Prompt icon="eye-off-outline" title="Personal recommendations are off" body="Your home screen shows the same content for everyone." action="Turn on" onPress={() => setEditing(true)} />
      ) : sections.interests.length ? (
        <View style={styles.chips}>
          {sections.interests.map((tag) => (
            <Pressable key={tag} style={styles.chip} onPress={() => setEditing(true)} accessibilityRole="button" accessibilityLabel={`${INTEREST_LABELS[tag as InterestTag] ?? tag}. Edit interests`}>
              <Text style={styles.chipText}>{INTEREST_LABELS[tag as InterestTag] ?? tag}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Prompt icon="sparkles-outline" title="What inspires you?" body="Choose a few topics and we’ll recommend testimonies and worship you’ll love." action="Choose interests" onPress={() => setEditing(true)} />
      )}

      {editing ? <InterestsSheet uid={uid} onClose={() => setEditing(false)} onSaved={onSaved} /> : null}
    </View>
  );
}

function Row({ items, onOpen, showProgress }: { items: HomeItem[]; onOpen: (i: HomeItem) => void; showProgress?: boolean }) {
  return (
    <FlatList
      horizontal
      data={items}
      keyExtractor={(i) => `${i.type}:${i.id}`}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
      renderItem={({ item }) => <Card item={item} onPress={() => onOpen(item)} showProgress={showProgress} />}
    />
  );
}

function Card({ item, onPress, showProgress }: { item: HomeItem; onPress: () => void; showProgress?: boolean }) {
  const pct = showProgress && item.durationSec ? Math.min(1, (item.positionSec ?? 0) / item.durationSec) : 0;
  return (
    <Pressable onPress={onPress} style={styles.card} accessibilityRole="button" accessibilityLabel={`${TYPE_LABEL[item.type]}: ${item.title}. ${item.reasonText}`}>
      <View style={styles.thumb}>
        {item.thumbnail ? <Image source={{ uri: item.thumbnail }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> : <Ionicons name={TYPE_ICON[item.type]} size={34} color={colors.textSubtle} />}
        {item.duration && !showProgress ? <Text style={styles.duration}>{formatDuration(item.duration)}</Text> : null}
        {pct > 0 ? (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(pct * 100)}%` }]} />
          </View>
        ) : null}
      </View>
      <Text style={styles.kind}>{TYPE_LABEL[item.type].toUpperCase()}</Text>
      <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
      <View style={styles.reasonRow}>
        <Ionicons name={item.reason === 'continue' ? 'time-outline' : 'sparkles'} size={12} color={colors.accent} />
        <Text style={styles.reason} numberOfLines={1}>{item.reasonText}</Text>
      </View>
    </Pressable>
  );
}

function Prompt({ icon, title, body, action, onPress }: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; body: string; action: string; onPress: () => void }) {
  return (
    <View style={styles.prompt}>
      <Ionicons name={icon} size={22} color={colors.accent} />
      <View style={{ flex: 1 }}>
        <Text style={styles.promptTitle}>{title}</Text>
        <Text style={styles.promptBody}>{body}</Text>
      </View>
      <Pressable onPress={onPress} style={styles.promptBtn} accessibilityRole="button" accessibilityLabel={action}>
        <Text style={styles.promptBtnText}>{action}</Text>
      </Pressable>
    </View>
  );
}

/** Choose interests and switch personal recommendations on or off. Saved to users/{uid}/private/discovery. */
function InterestsSheet({ uid, onClose, onSaved }: { uid: string; onClose: () => void; onSaved: () => void }) {
  const [interests, setInterests] = useState<InterestTag[]>([]);
  const [personal, setPersonal] = useState(true);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getDiscoverySettings(uid)
      .then((s) => {
        setInterests(s.interests);
        setPersonal(!s.optOut);
      })
      .catch(() => setError('Could not load your interests. You can still choose new ones.'))
      .finally(() => setReady(true));
  }, [uid]);

  const toggle = (tag: InterestTag) => setInterests((cur) => (cur.includes(tag) ? cur.filter((x) => x !== tag) : [...cur, tag]));

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await saveDiscoverySettings(uid, { interests, optOut: !personal });
      onSaved();
    } catch {
      setError('Could not save. Check your connection and try again.');
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle} accessibilityRole="header">Your interests</Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </Pressable>
          </View>
          {!ready ? (
            <ActivityIndicator color={colors.accent} style={{ marginVertical: 32 }} />
          ) : (
            <ScrollView>
              <Text style={styles.sheetBody}>Choose the topics you enjoy. We use them, and what you watch in the app, to recommend content. Nothing is shared.</Text>
              <View style={[styles.chips, { paddingHorizontal: 0 }]}>
                {INTEREST_TAGS.map((tag) => {
                  const on = interests.includes(tag);
                  return (
                    <Pressable key={tag} onPress={() => toggle(tag)} style={[styles.chip, on && styles.chipOn]} disabled={!personal} accessibilityRole="checkbox" accessibilityState={{ checked: on, disabled: !personal }} accessibilityLabel={INTEREST_LABELS[tag]}>
                      {on ? <Ionicons name="checkmark" size={14} color={colors.onAccent} /> : null}
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>{INTEREST_LABELS[tag]}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.promptTitle}>Personal recommendations</Text>
                  <Text style={styles.promptBody}>When off, we stop using your activity and show everyone the same home screen.</Text>
                </View>
                <Switch value={personal} onValueChange={setPersonal} trackColor={{ true: colors.accentDeep, false: colors.border }} thumbColor={personal ? colors.accent : colors.textSubtle} accessibilityLabel="Personal recommendations" />
              </View>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Pressable onPress={() => void save()} disabled={saving} style={[styles.saveBtn, saving && { opacity: 0.6 }]} accessibilityRole="button" accessibilityLabel="Save interests">
                {saving ? <ActivityIndicator color={colors.onAccent} /> : <Text style={styles.saveText}>Save</Text>}
              </Pressable>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const CARD_W = 220;
const styles = StyleSheet.create({
  loading: { paddingVertical: 24, alignItems: 'center' },
  card: { width: CARD_W },
  thumb: { width: CARD_W, height: Math.round((CARD_W * 9) / 16), borderRadius: radius.md, backgroundColor: colors.card, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  duration: { position: 'absolute', right: 8, bottom: 8, ...t.label, color: colors.text, backgroundColor: colors.overlay, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm },
  progressTrack: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 4, backgroundColor: 'rgba(255,255,255,0.25)' },
  progressFill: { height: 4, backgroundColor: colors.accent },
  kind: { ...t.label, color: colors.textSubtle, marginTop: 8 },
  title: { ...t.h3, color: colors.text, marginTop: 2 },
  reasonRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  reason: { ...t.caption, color: colors.accent, flexShrink: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceRaised },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { ...t.small, color: colors.text, fontWeight: '600' },
  chipTextOn: { color: colors.onAccent },
  prompt: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 20, padding: 16, borderRadius: radius.lg, backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.borderSoft },
  promptTitle: { ...t.h3, color: colors.text },
  promptBody: { ...t.small, color: colors.textMuted, marginTop: 2 },
  promptBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.accent },
  promptBtnText: { ...t.small, color: colors.onAccent, fontWeight: '800' },
  backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: { maxHeight: '85%', backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: 20, paddingBottom: 32 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sheetTitle: { ...t.h2, color: colors.text },
  sheetBody: { ...t.body, color: colors.textMuted, marginBottom: 16 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.borderSoft },
  error: { ...t.small, color: colors.danger, marginTop: 12 },
  saveBtn: { marginTop: 24, height: 50, borderRadius: radius.pill, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  saveText: { ...t.h3, color: colors.onAccent },
});
