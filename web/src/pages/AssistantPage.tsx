import React, { useRef, useState } from 'react';
import { ArrowRight, Send, Square, Trash2 } from 'lucide-react';
import { askAssistant, AssistantError, type AssistantMessage, type AssistantReply } from '../api/assistant';
import { TopBar } from '../components/TopBar';
import { navigate, type Route } from '../router';
import { colors, radius } from '../theme';

interface Turn extends AssistantMessage {
  id: string;
  testimonies?: AssistantReply['testimonies'];
  clips?: AssistantReply['clips'];
  sources?: AssistantReply['sources'];
  navigate?: string | null;
}

const MAX_CHARS = 1000;
const WELCOME = 'Hi, I’m the T.O.P AI Assistant. Ask me how to use the app, find a testimony by what it is about, or ask a general question.';

/** Server screen names mapped to this site's routes. */
const ROUTE_FOR: Record<string, Route> = {
  live: { name: 'live' },
  radio: { name: 'listen' },
  adotopoc: { name: 'adotopoc' },
  written: { name: 'written' },
  testimonies: { name: 'testimonies' },
  sponsor: { name: 'sponsor' },
  downloads: { name: 'downloads' },
};

const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: colors.textSubtle, margin: 0 };
const card: React.CSSProperties = { display: 'block', padding: 10, borderRadius: radius.sm, border: `1px solid ${colors.border}`, background: colors.bg, color: colors.text, textDecoration: 'none' };

export function AssistantPage({ onBack }: { onBack: () => void }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastQuestion = useRef<string | null>(null);

  const send = async (text?: string) => {
    const question = (text ?? input).trim();
    if (!question || busy) return;
    if (question.length > MAX_CHARS) return setError(`Keep your question under ${MAX_CHARS} characters.`);
    setError(null);
    lastQuestion.current = question;
    const next: Turn[] = [...turns, { id: `u${Date.now()}`, role: 'user', content: question }];
    setTurns(next);
    setInput('');
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const answer = await askAssistant(next.map(({ role, content }) => ({ role, content })), controller.signal);
      setTurns((cur) => [
        ...cur,
        { id: `a${Date.now()}`, role: 'assistant', content: answer.reply || 'I could not find an answer to that.', testimonies: answer.testimonies, clips: answer.clips, sources: answer.sources, navigate: answer.navigate },
      ]);
    } catch (e) {
      if ((e as Error).name === 'AbortError') setError('Stopped. You can ask again.');
      else setError(e instanceof AssistantError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  };

  const clear = () => {
    if (!window.confirm('Clear this chat?')) return;
    setTurns([]);
    setError(null);
  };

  const data: Turn[] = turns.length ? turns : [{ id: 'welcome', role: 'assistant', content: WELCOME }];

  return (
    <div data-page style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: colors.bg }}>
      <TopBar
        title="T.O.P AI Assistant"
        onBack={onBack}
        actions={turns.length > 0 ? [{ icon: Trash2, label: 'Clear chat', onClick: clear }] : undefined}
      />

      <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 760, width: '100%', margin: '0 auto', boxSizing: 'border-box' }} aria-live="polite">
        {data.map((t) => (
          <div
            key={t.id}
            style={{
              maxWidth: '88%',
              alignSelf: t.role === 'user' ? 'flex-end' : 'flex-start',
              padding: 12,
              borderRadius: radius.md,
              background: t.role === 'user' ? colors.accent : colors.surface,
              border: t.role === 'user' ? 'none' : `1px solid ${colors.borderSoft}`,
              color: t.role === 'user' ? colors.onAccent : colors.text,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <span style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{t.content}</span>

            {t.testimonies && t.testimonies.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <p style={label}>From the app</p>
                {t.testimonies.map((tm) => (
                  <a key={tm.id} href={`#/testimony/${encodeURIComponent(tm.id)}`} style={card}>
                    <strong style={{ fontSize: 14 }}>{tm.title}</strong>
                    {tm.description ? <div style={{ fontSize: 12, color: colors.textMuted }}>{tm.description}</div> : null}
                  </a>
                ))}
              </div>
            ) : null}

            {t.clips && t.clips.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <p style={label}>Moments in videos</p>
                {t.clips.map((c) => (
                  <button
                    key={`${c.testimonyId}-${c.startSec}`}
                    type="button"
                    onClick={() => navigate({ name: 'testimony', id: c.testimonyId, startAt: c.startSec })}
                    style={{ ...card, textAlign: 'left', cursor: 'pointer', font: 'inherit' }}
                  >
                    <strong style={{ fontSize: 14 }}>{c.title}</strong>
                    {c.description ? <div style={{ fontSize: 12, color: colors.textMuted }}>{c.description}</div> : null}
                    <div style={{ fontSize: 12, color: colors.accent, fontWeight: 700 }}>Watch at {c.startLabel}</div>
                  </button>
                ))}
              </div>
            ) : null}

            {t.sources && t.sources.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <p style={label}>From the web (not from the app)</p>
                {t.sources.map((s) => (
                  <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" style={card}>
                    <strong style={{ fontSize: 14 }}>{s.title}</strong>
                    <div style={{ fontSize: 12, color: colors.accent, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.url}</div>
                  </a>
                ))}
              </div>
            ) : null}

            {t.navigate && ROUTE_FOR[t.navigate] ? (
              <button
                type="button"
                onClick={() => navigate(ROUTE_FOR[t.navigate!])}
                style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: colors.accent, fontWeight: 700, cursor: 'pointer', padding: 0 }}
              >
                Open this page <ArrowRight size={16} />
              </button>
            ) : null}
          </div>
        ))}

        {busy ? (
          <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 10, color: colors.textMuted }}>
            <span className="spinner light" aria-hidden="true" />
            <span>Thinking…</span>
            <button type="button" onClick={() => abortRef.current?.abort()} style={{ background: 'none', border: 'none', color: colors.danger, fontWeight: 700, cursor: 'pointer' }}>
              Stop
            </button>
          </div>
        ) : null}

        {error ? (
          <div className="err-box" role="alert" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <span>{error}</span>
            {lastQuestion.current && !busy ? (
              <button type="button" onClick={() => void send(lastQuestion.current!)} style={{ background: 'none', border: 'none', color: colors.accent, fontWeight: 800, cursor: 'pointer' }}>
                Retry
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        style={{ position: 'sticky', bottom: 0, display: 'flex', gap: 8, padding: 12, background: colors.bg, borderTop: `1px solid ${colors.borderSoft}` }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question…"
          maxLength={MAX_CHARS}
          rows={1}
          disabled={busy}
          aria-label="Message the assistant"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          style={{ flex: 1, resize: 'none', minHeight: 44, borderRadius: radius.md, border: `1px solid ${colors.border}`, background: colors.surface, color: colors.text, padding: '10px 12px', font: 'inherit' }}
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          aria-label="Send"
          style={{ width: 44, height: 44, borderRadius: 22, border: 'none', background: colors.accent, color: colors.onAccent, cursor: 'pointer', opacity: busy || !input.trim() ? 0.4 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {busy ? <Square size={16} /> : <Send size={18} />}
        </button>
      </form>
    </div>
  );
}
