import React, { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/theme';
import { TestimonyCard } from '@/components/TestimonyCard';
import { searchExternalWithDeepSeek, searchTestimoniesByMeaning, type ExternalSearchSource } from '@/ai/search';
import type { Testimony } from '@/types';

interface Props {
  query: string;
  onSelectTestimony: (id: string) => void;
}

export function AISearchPanel({ query, onSelectTestimony }: Props) {
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState('');
  const [sources, setSources] = useState<ExternalSearchSource[]>([]);
  const [testimonies, setTestimonies] = useState<Testimony[]>([]);
  const [semanticError, setSemanticError] = useState('');
  const [webError, setWebError] = useState('');
  const requestId = useRef(0);

  useEffect(() => {
    requestId.current += 1;
    setBusy(false);
    setAnswer('');
    setSources([]);
    setTestimonies([]);
    setSemanticError('');
    setWebError('');
  }, [query]);
  useEffect(() => () => { requestId.current += 1; }, []);

  const runSearch = async () => {
    const question = query.trim();
    if (!question || busy) return;
    const activeRequest = ++requestId.current;
    setBusy(true);
    setAnswer('');
    setSources([]);
    setTestimonies([]);
    setSemanticError('');
    setWebError('');
    const [internal, external] = await Promise.allSettled([
      searchTestimoniesByMeaning(question),
      searchExternalWithDeepSeek(question),
    ]);
    if (activeRequest !== requestId.current) return;
    if (internal.status === 'fulfilled') setTestimonies(internal.value);
    else setSemanticError(internal.reason instanceof Error ? internal.reason.message : 'Internal semantic search is temporarily unavailable.');
    if (external.status === 'fulfilled') {
      setAnswer(external.value.answer);
      setSources(external.value.sources);
    } else {
      setWebError(external.reason instanceof Error ? external.reason.message : 'External AI search is temporarily unavailable.');
    }
    setBusy(false);
  };

  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>AI Search</Text>
      <Text style={styles.copy}>Find published testimonies by meaning and search the web for relevant information.</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Search testimonies and the web with AI" onPress={() => void runSearch()} disabled={busy || !query.trim()} style={[styles.button, (busy || !query.trim()) && styles.buttonDisabled]}>
        <Text style={styles.buttonText}>{busy ? 'Searching…' : 'Search with AI'}</Text>
      </Pressable>
      {semanticError ? <Text style={styles.error}>Testimony search: {semanticError}</Text> : null}
      {testimonies.length ? (
        <View style={styles.results}>
          <Text style={styles.subheading}>Relevant testimonies</Text>
          {testimonies.map((item) => <TestimonyCard key={item.id} item={item} variant="row" onPress={() => onSelectTestimony(item.id)} />)}
        </View>
      ) : null}
      {webError ? <Text style={styles.error}>Web search: {webError}</Text> : null}
      {answer ? <View style={styles.answer}><Text style={styles.subheading}>DeepSeek answer</Text><Text style={styles.answerText}>{answer}</Text></View> : null}
      {sources.length ? (
        <View style={styles.results}>
          <Text style={styles.subheading}>Sources</Text>
          {sources.map((source) => (
            <Pressable key={source.url} onPress={() => void Linking.openURL(source.url)} accessibilityRole="link" style={styles.source}>
              <Text style={styles.sourceTitle}>{source.title}</Text>
              {source.snippet ? <Text style={styles.sourceSnippet}>{source.snippet}</Text> : null}
              <Text style={styles.sourceUrl}>{source.url}</Text>
            </Pressable>
          ))}
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
  answer: { padding: 12, backgroundColor: colors.bg, borderRadius: 12, gap: 4 },
  answerText: { color: colors.text, fontSize: 14, lineHeight: 21 },
  source: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  sourceTitle: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  sourceSnippet: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 4 },
  sourceUrl: { color: colors.textSubtle, fontSize: 10, marginTop: 4 },
});
