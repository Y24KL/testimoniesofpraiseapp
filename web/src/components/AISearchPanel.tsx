import React, { useEffect, useRef, useState } from 'react';
import { Search, ExternalLink } from 'lucide-react';
import { colors } from '../theme';
import { TestimonyCard } from './TestimonyCard';
import { searchExternalWithDeepSeek, searchTestimoniesByMeaning, type ExternalSearchSource } from '../ai/search';
import type { Testimony } from '../types';

interface Props { query: string; onSelectTestimony: (id: string) => void }

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
    setBusy(false); setAnswer(''); setSources([]); setTestimonies([]); setSemanticError(''); setWebError('');
  }, [query]);
  useEffect(() => () => { requestId.current += 1; }, []);

  const runSearch = async () => {
    const question = query.trim();
    if (!question || busy) return;
    const activeRequest = ++requestId.current;
    setBusy(true); setAnswer(''); setSources([]); setTestimonies([]); setSemanticError(''); setWebError('');
    const [internal, external] = await Promise.allSettled([
      searchTestimoniesByMeaning(question),
      searchExternalWithDeepSeek(question),
    ]);
    if (activeRequest !== requestId.current) return;
    if (internal.status === 'fulfilled') setTestimonies(internal.value);
    else setSemanticError(internal.reason instanceof Error ? internal.reason.message : 'Internal semantic search is temporarily unavailable.');
    if (external.status === 'fulfilled') { setAnswer(external.value.answer); setSources(external.value.sources); }
    else setWebError(external.reason instanceof Error ? external.reason.message : 'External AI search is temporarily unavailable.');
    setBusy(false);
  };

  return (
    <section style={{ margin: '16px', padding: '16px', borderRadius: 16, background: colors.surface, border: `1px solid ${colors.border}`, display: 'grid', gap: 12 }} aria-label="AI Search">
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Search size={20} color={colors.accent} />
        <h2 style={{ color: colors.accent, fontSize: 18, margin: 0 }}>AI Search</h2>
      </div>
      <p style={{ color: colors.textMuted, margin: 0, fontSize: 13, lineHeight: 1.5 }}>Find published testimonies by meaning and search the web for relevant information.</p>
      <button type="button" onClick={() => void runSearch()} disabled={busy || !query.trim()} style={{ border: 0, borderRadius: 10, padding: '12px 16px', background: colors.accent, color: '#1A1024', fontWeight: 800, cursor: busy || !query.trim() ? 'not-allowed' : 'pointer', opacity: busy || !query.trim() ? 0.5 : 1 }}>
        {busy ? 'Searching…' : 'Search with AI'}
      </button>
      {semanticError ? <p role="status" style={{ color: '#ff8898', margin: 0, fontSize: 12 }}>Testimony search: {semanticError}</p> : null}
      {testimonies.length ? <div style={{ display: 'grid', gap: 6 }}><h3 style={{ margin: '4px 0', color: colors.text, fontSize: 14 }}>Relevant testimonies</h3>{testimonies.map((item) => <TestimonyCard key={item.id} item={item} variant="row" onClick={() => onSelectTestimony(item.id)} />)}</div> : null}
      {webError ? <p role="status" style={{ color: '#ff8898', margin: 0, fontSize: 12 }}>Web search: {webError}</p> : null}
      {answer ? <div style={{ padding: 12, background: colors.bg, borderRadius: 12 }}><h3 style={{ margin: '0 0 8px', color: colors.text, fontSize: 14 }}>DeepSeek answer</h3><p style={{ whiteSpace: 'pre-wrap', color: colors.text, margin: 0, fontSize: 14, lineHeight: 1.6 }}>{answer}</p></div> : null}
      {sources.length ? <div style={{ display: 'grid', gap: 4 }}><h3 style={{ margin: '4px 0', color: colors.text, fontSize: 14 }}>Sources</h3>{sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', padding: '10px 0', borderBottom: `1px solid ${colors.border}`, textDecoration: 'none' }}><span style={{ color: colors.accent, fontWeight: 700, fontSize: 13 }}>{source.title} <ExternalLink size={12} style={{ verticalAlign: 'middle' }} /></span>{source.snippet ? <span style={{ display: 'block', color: colors.textMuted, marginTop: 4, fontSize: 12, lineHeight: 1.45 }}>{source.snippet}</span> : null}<span style={{ display: 'block', color: colors.textMuted, marginTop: 4, fontSize: 10, overflowWrap: 'anywhere' }}>{source.url}</span></a>)}</div> : null}
    </section>
  );
}
