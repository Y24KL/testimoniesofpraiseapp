import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { repo } from '@/api';
import { EmptyState } from '@/components/EmptyState';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { TestimonyCard } from '@/components/TestimonyCard';
import { TopBar } from '@/components/TopBar';
import { colors, radius, type as t } from '@/constants/theme';
import { cacheGet, cacheSet } from '@/storage/cache';
import type { Testimony } from '@/types';

const LIMIT = 100;

/**
 * Client-side search over the newest 100 testimonies (title, name, category, keywords).
 * For a large catalogue, move this to server-side search (Firestore prefix queries, Algolia, Typesense).
 */
export function SearchScreen() {
  const nav = useNavigation();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [testimonies, setT] = useState<Testimony[] | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const t = await repo.getTestimonies({ limit: LIMIT });
        setT(t.items);
        void cacheSet('search:t', t.items);
      } catch {
        setT((await cacheGet<Testimony[]>('search:t')) ?? (await cacheGet<Testimony[]>(`testimonies:all:12`)) ?? []);
      }
    })();
  }, []);

  useEffect(() => {
    const h = setTimeout(() => setDebounced(q.trim().toLowerCase()), 200);
    return () => clearTimeout(h);
  }, [q]);

  const match = (hay: string[]) => hay.some((h) => h?.toLowerCase().includes(debounced));
  const tRes = useMemo(
    () => (debounced && testimonies ? testimonies.filter((x) => match([x.title, x.authorName ?? '', x.category ?? '', ...x.keywords])) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [debounced, testimonies],
  );
  const loading = testimonies === null;
  const none = debounced && !loading && !tRes.length;

  return (
    <Screen>
      <TopBar title="Search" onBack={() => nav.goBack()} />
      <View style={styles.box}>
        <Ionicons name="search" size={20} color={colors.textMuted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search testimonies"
          placeholderTextColor={colors.textMuted + '99'}
          style={styles.input}
          autoFocus
          returnKeyType="search"
          autoCorrect={false}
          accessibilityLabel="Search"
        />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 32 }}>
        {loading ? (
          <LoadingSpinner label="LOADING PRAISE" />
        ) : none ? (
          <EmptyState icon="search-outline" title="No results found." />
        ) : (
          <>
            {tRes.length ? <SectionHeader title="TESTIMONIES" /> : null}
            {tRes.map((i) => <TestimonyCard key={i.id} item={i} onPress={() => nav.navigate('TestimonyDetails', { id: i.id })} />)}
            {!debounced ? <Text style={styles.hint}>Search by title, name, category or keyword.</Text> : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, paddingHorizontal: 14, minHeight: 48, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border },
  input: { flex: 1, color: colors.text, fontSize: 16, paddingVertical: 10 },
  hint: { ...t.body, color: colors.textMuted, textAlign: 'center', padding: 24 },
});
