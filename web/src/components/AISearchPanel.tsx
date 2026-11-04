import React, { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { colors } from '../theme';
import { TestimonyCard } from './TestimonyCard';
import { searchTestimoniesByMeaning } from '../ai/search';
import type { Testimony } from '../types';

interface Props { query: string; onSelectTestimony: (id: string) => void }

export function AISearchPanel({ query, onSelectTestimony }: Props) {
  const [busy, setBusy] = useState(false);
  const [testimonies, setTestimonies] = useState<Testimony[]>([]);
  const [semanticError, setSemanticError] = useState('');
  const requestId = useRef(0);

  useEffect(() => {
    requestId.current += 1;
    setBusy(false); setTestimonies([]); setSemanticError('');
  }, [query]);
  useEffect(() => () => { requestId.current += 1; }, []);

  const runSearch = async () => {
    const question = query.trim();
    if (!question || busy) return;
    const activeRequest = ++requestId.current;
    setBusy(true); setTestimonies([]); setSemanticError('');
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
    <section style={{ margin: '16px', padding: '16px', borderRadius: 16, background: colors.surface, border: `1px solid ${colors.border}`, display: 'grid', gap: 12 }} aria-label="AI Search">
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Search size={20} color={colors.accent} />
        <h2 style={{ color: colors.accent, fontSize: 18, margin: 0 }}>AI Search</h2>
      </div>
      <p style={{ color: colors.textMuted, margin: 0, fontSize: 13, lineHeight: 1.5 }}>Find published testimonies by meaning.</p>
      <button type="button" onClick={() => void runSearch()} disabled={busy || !query.trim()} style={{ border: 0, borderRadius: 10, padding: '12px 16px', background: colors.accent, color: '#1A1024', fontWeight: 800, cursor: busy || !query.trim() ? 'not-allowed' : 'pointer', opacity: busy || !query.trim() ? 0.5 : 1 }}>
        {busy ? 'Searching…' : 'Search with AI'}
      </button>
      {semanticError ? <p role="status" style={{ color: '#ff8898', margin: 0, fontSize: 12 }}>Testimony search: {semanticError}</p> : null}
      {testimonies.length ? <div style={{ display: 'grid', gap: 6 }}><h3 style={{ margin: '4px 0', color: colors.text, fontSize: 14 }}>Relevant testimonies</h3>{testimonies.map((item) => <TestimonyCard key={item.id} item={item} variant="row" onClick={() => onSelectTestimony(item.id)} />)}</div> : null}
    </section>
  );
}
