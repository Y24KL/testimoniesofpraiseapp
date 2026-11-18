import React, { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { useAuth } from '@/auth/AuthContext';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { SkeletonCard } from '@/components/SkeletonCard';
import { TextField } from '@/components/TextField';
import { TopBar } from '@/components/TopBar';
import { colors, radius, spacing, type as t } from '@/constants/theme';
import type { RootStackParamList } from '@/navigation/types';
import { addToCollection, libraryKey, removeFromCollection, validCollectionName, type LibraryKind } from '@/library/rules';
import { useCollections, useHistory, useSavedItems, type LiveList } from '@/library/hooks';
import { createCollection, deleteCollection, deleteHistoryItem, setCollectionItems, unsaveItem, type Collection, type HistoryItem, type SavedItem } from '@/library/service';
import { messageFor } from '@/utils/errors';

type Tab = 'saved' | 'collections' | 'history';
const TABS: { id: Tab; label: string }[] = [
  { id: 'saved', label: 'Saved' },
  { id: 'collections', label: 'Collections' },
  { id: 'history', label: 'History' },
];

const clock = (sec: number) => {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
};

/** Opens the screen for a saved or remembered item. */
function useOpenItem() {
  const nav = useNavigation<NavigationProp<RootStackParamList>>();
  return (kind: LibraryKind, id: string) => {
    if (kind === 'lyrical') nav.navigate('LyricalAnalysisVideo', { id });
    else nav.navigate('TestimonyDetails', { id });
  };
}

export function MyTopScreen() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [tab, setTab] = useState<Tab>('saved');
  const nav = useNavigation<NavigationProp<RootStackParamList>>();

  return (
    <Screen>
      <TopBar title="My T.O.P." onBack={() => nav.goBack()} />
      {!uid ? (
        <EmptyState icon="bookmark-outline" title="Sign in to use My T.O.P." message="Your saved items, collections and listening history follow your account to every device." />
      ) : (
        <View style={{ flex: 1 }}>
          <View style={styles.tabs} accessibilityRole="tablist">
            {TABS.map((x) => {
              const active = tab === x.id;
              return (
                <Pressable key={x.id} onPress={() => setTab(x.id)} accessibilityRole="tab" accessibilityState={{ selected: active }} style={[styles.tab, active && styles.tabActive]}>
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>{x.label}</Text>
                </Pressable>
              );
            })}
          </View>
          {tab === 'saved' && <SavedTab uid={uid} />}
          {tab === 'collections' && <CollectionsTab uid={uid} />}
          {tab === 'history' && <HistoryTab uid={uid} />}
        </View>
      )}
    </Screen>
  );
}

function ListState<T>({ list, empty, children }: { list: LiveList<T>; empty: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; message: string }; children: React.ReactNode }) {
  if (list.status === 'loading') {
    return (
      <View style={{ padding: spacing.lg, gap: spacing.md }} accessibilityLabel="Loading">
        <SkeletonCard horizontal />
        <SkeletonCard horizontal />
        <SkeletonCard horizontal />
      </View>
    );
  }
  if (list.status === 'error') return <ErrorState message={list.error ?? undefined} />;
  if (list.items.length === 0) return <EmptyState icon={empty.icon} title={empty.title} message={empty.message} />;
  return <>{children}</>;
}

function SavedTab({ uid }: { uid: string }) {
  const saved = useSavedItems(uid);
  const collections = useCollections(uid);
  const open = useOpenItem();
  const [picking, setPicking] = useState<string | null>(null);

  const remove = (item: SavedItem) =>
    Alert.alert('Remove from My T.O.P.?', item.title, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void unsaveItem(uid, item.kind, item.id).catch((e) => Alert.alert('Could not remove', messageFor(e))) },
    ]);

  const toggleCollection = async (col: Collection, key: string) => {
    const next = col.itemIds.includes(key) ? removeFromCollection(col.itemIds, key) : addToCollection(col.itemIds, key).itemIds;
    if (!col.itemIds.includes(key) && addToCollection(col.itemIds, key).result === 'full') return Alert.alert('This collection is full', 'Remove something first.');
    try {
      await setCollectionItems(uid, col.id, next);
    } catch (e) {
      Alert.alert('Could not update collection', messageFor(e));
    }
  };

  return (
    <ListState list={saved} empty={{ icon: 'bookmark-outline', title: 'Nothing saved yet', message: 'Save testimonies and lyrical analyses to find them here.' }}>
      <FlatList
        data={saved.items}
        keyExtractor={(i) => i.key}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Pressable style={styles.row} onPress={() => open(item.kind, item.id)} accessibilityRole="button" accessibilityLabel={`Open ${item.title}`}>
              <Thumb uri={item.thumbnail} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.meta}>{item.kind === 'lyrical' ? 'Lyrical analysis' : 'Testimony'}</Text>
              </View>
            </Pressable>
            <View style={styles.actions}>
              <PrimaryButton compact variant="outline" title={picking === item.key ? 'Done' : 'Collections'} icon="albums-outline" onPress={() => setPicking(picking === item.key ? null : item.key)} />
              <PrimaryButton compact variant="outline" title="Remove" icon="trash-outline" onPress={() => remove(item)} />
            </View>
            {picking === item.key && (
              <View style={styles.picker}>
                {collections.items.length === 0 && <Text style={styles.meta}>Create a collection on the Collections tab first.</Text>}
                {collections.items.map((c) => {
                  const key = libraryKey(item.kind, item.id) ?? '';
                  const on = c.itemIds.includes(key);
                  return (
                    <Pressable key={c.id} onPress={() => void toggleCollection(c, key)} style={styles.pickRow} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
                      <Ionicons name={on ? 'checkbox' : 'square-outline'} size={20} color={on ? colors.accent : colors.textMuted} />
                      <Text style={styles.pickText}>{c.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        )}
      />
    </ListState>
  );
}

function CollectionsTab({ uid }: { uid: string }) {
  const collections = useCollections(uid);
  const saved = useSavedItems(uid);
  const open = useOpenItem();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const savedByKey = useMemo(() => new Map(saved.items.map((s) => [s.key, s])), [saved.items]);

  const create = async () => {
    const clean = validCollectionName(name);
    if (!clean) return Alert.alert('Name your collection', 'Use 1 to 60 characters.');
    setBusy(true);
    try {
      await createCollection(uid, clean);
      setName('');
    } catch (e) {
      Alert.alert('Could not create collection', messageFor(e));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = (c: Collection) =>
    Alert.alert('Delete collection?', `"${c.name}" will be removed. The saved items stay in My T.O.P.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void deleteCollection(uid, c.id).catch((e) => Alert.alert('Could not delete', messageFor(e))) },
    ]);

  const removeFrom = async (c: Collection, key: string) => {
    try {
      await setCollectionItems(uid, c.id, removeFromCollection(c.itemIds, key));
    } catch (e) {
      Alert.alert('Could not update collection', messageFor(e));
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.createRow}>
        <View style={{ flex: 1 }}>
          <TextField label="New collection" value={name} onChangeText={setName} maxLength={60} placeholder="For example: Evening prayers" returnKeyType="done" onSubmitEditing={() => void create()} />
        </View>
        <PrimaryButton compact title="Create" onPress={() => void create()} loading={busy} disabled={!validCollectionName(name)} />
      </View>
      <ListState list={collections} empty={{ icon: 'albums-outline', title: 'No collections yet', message: 'Group what you love into collections, such as "Healing" or "Sunday mornings".' }}>
        <FlatList
          data={collections.items}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.list}
          renderItem={({ item: c }) => {
            const open_ = expanded === c.id;
            const members = c.itemIds.map((k) => savedByKey.get(k)).filter((x): x is SavedItem => Boolean(x));
            return (
              <View style={styles.card}>
                <Pressable style={styles.row} onPress={() => setExpanded(open_ ? null : c.id)} accessibilityRole="button" accessibilityState={{ expanded: open_ }}>
                  <Ionicons name="albums-outline" size={22} color={colors.accent} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title}>{c.name}</Text>
                    <Text style={styles.meta}>{c.itemIds.length} {c.itemIds.length === 1 ? 'item' : 'items'}</Text>
                  </View>
                  <Ionicons name={open_ ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
                </Pressable>
                {open_ && (
                  <View style={{ gap: spacing.sm }}>
                    {members.length === 0 && <Text style={styles.meta}>Nothing here yet. Add items from the Saved tab.</Text>}
                    {members.map((m) => (
                      <View key={m.key} style={styles.memberRow}>
                        <Pressable style={{ flex: 1 }} onPress={() => open(m.kind, m.id)} accessibilityRole="button" accessibilityLabel={`Open ${m.title}`}>
                          <Text style={styles.pickText} numberOfLines={1}>{m.title}</Text>
                        </Pressable>
                        <PrimaryButton compact variant="outline" title="Remove" onPress={() => void removeFrom(c, m.key)} />
                      </View>
                    ))}
                    <PrimaryButton compact variant="danger" title="Delete collection" icon="trash-outline" onPress={() => confirmDelete(c)} />
                  </View>
                )}
              </View>
            );
          }}
        />
      </ListState>
    </View>
  );
}

function HistoryTab({ uid }: { uid: string }) {
  const history = useHistory(uid);
  const open = useOpenItem();

  return (
    <ListState list={history} empty={{ icon: 'time-outline', title: 'No listening history yet', message: 'Videos you start appear here, so you can carry on from any device.' }}>
      <FlatList
        data={history.items}
        keyExtractor={(h) => h.key}
        contentContainerStyle={styles.list}
        renderItem={({ item }: { item: HistoryItem }) => {
          const pct = item.durationSec > 0 ? Math.min(1, item.positionSec / item.durationSec) : 0;
          return (
            <View style={styles.card}>
              <Pressable style={styles.row} onPress={() => open(item.kind, item.id)} accessibilityRole="button" accessibilityLabel={`${item.completed ? 'Watch again' : 'Continue'} ${item.title}`}>
                <Thumb uri={item.thumbnail} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
                  <View style={styles.bar} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}>
                    <View style={[styles.barFill, { width: `${Math.round(pct * 100)}%` }]} />
                  </View>
                  <Text style={styles.meta}>{item.completed ? 'Finished' : item.positionSec > 0 ? `Continue at ${clock(item.positionSec)}` : 'Not started'}</Text>
                </View>
              </Pressable>
              <View style={styles.actions}>
                <PrimaryButton compact variant="outline" title="Remove" icon="trash-outline" onPress={() => void deleteHistoryItem(uid, item.kind, item.id).catch((e) => Alert.alert('Could not remove', messageFor(e)))} />
              </View>
            </View>
          );
        }}
      />
    </ListState>
  );
}

function Thumb({ uri }: { uri?: string }) {
  return uri ? (
    <Image source={{ uri }} style={styles.thumb} contentFit="cover" cachePolicy="memory-disk" />
  ) : (
    <View style={[styles.thumb, styles.thumbEmpty]}>
      <Ionicons name="play" size={18} color={colors.textSubtle} />
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  tab: { flex: 1, paddingVertical: 10, borderRadius: radius.pill, alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  tabActive: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  tabText: { ...t.small, color: colors.textMuted, fontWeight: '700' },
  tabTextActive: { color: colors.accent },
  list: { padding: spacing.lg, gap: spacing.md },
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.cardBorder, padding: spacing.md, gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  title: { ...t.h3, color: colors.text },
  meta: { ...t.caption, color: colors.textSubtle },
  actions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  picker: { gap: spacing.sm, paddingTop: spacing.xs, borderTopWidth: 1, borderTopColor: colors.borderSoft },
  pickRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', minHeight: 40 },
  pickText: { ...t.body, color: colors.text, flexShrink: 1 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  createRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  thumb: { width: 96, height: 60, borderRadius: radius.sm, backgroundColor: colors.surfaceLight },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  bar: { height: 4, borderRadius: 2, backgroundColor: colors.borderSoft, overflow: 'hidden' },
  barFill: { height: 4, backgroundColor: colors.accent },
});
