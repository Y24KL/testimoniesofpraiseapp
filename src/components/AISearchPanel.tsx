import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/theme';
import { TestimonyCard } from '@/components/TestimonyCard';
import { searchTestimoniesByMeaning } from '@/ai/search';
import type { Testimony } from '@/types';

interface Props {
  query: string;
  onSelectTestimony: (id: string) => void;
}

export function AISearchPanel({ query, onSelectTestimony }: Props) {
  const [busy, setBusy] = useState(false);
  const [testimonies, setTestimonies] = useState<Testimony[]>([]);
  const [semanticError, setSemanticError] = useState('');
  const requestId = useRef(0);

  useEffect(() => {
    requestId.current += 1;
    setBusy(false);
    setTestimonies([]);
    setSemanticError('');
  }, [query]);
  useEffect(() => () => { requestId.current += 1; }, []);

  const runSearch = async () => {
    const question = query.trim();
    if (!question || busy) return;
    const activeRequest = ++requestId.current;
    setBusy(true);
    setTestimonies([]);
    setSemanticError('');
    try {
      const found = await searchTestimoniesByMeaning(question);
      if (activeRequest !== requestId.current) return;
      setTestimonies(found);
    } catch (error) {
      if (activeRequest !== requestId.current) return;
      setSemanticError(error instanceof Error ? error.message : 'Testimony search is temporarily unavailable.');
    } finally {
      if (activeRequest === requestId.current) setBusy(false);
    }
  };

  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>AI Search</Text>
      <Text style={styles.copy}>Find published testimonies by meaning.</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Search testimonies with AI" onPress={() => void runSearch()} disabled={busy || !query.trim()} style={[styles.button, (busy || !query.trim()) && styles.buttonDisabled]}>
        <Text style={styles.buttonText}>{busy ? 'Searching…' : 'Search with AI'}</Text>
      </Pressable>
      {semanticError ? <Text style={styles.error}>Testimony search: {semanticError}</Text> : null}
      {testimonies.length ? (
        <View style={styles.results}>
          <Text style={styles.subheading}>Relevant testimonies</Text>
          {testimonies.map((item) => <TestimonyCard key={item.id} item={item} variant="row" onPress={() => onSelectTestimony(item.id)} />)}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { margin: 16, padding: 16, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 10 },
  heading: { color: colors.accent, fontSize: 18, fontWeight: '800' },
  subheading: { color: colors.text, fontSize: 14, fontWeight: '800', marginBottom: 6 },
  copy: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  button: { minHeight: 44, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#1A1024', fontWeight: '800' },
  error: { color: colors.danger, fontSize: 12, lineHeight: 17 },
  results: { gap: 6, marginTop: 4 },
});
