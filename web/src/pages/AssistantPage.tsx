import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, ChevronRight, Copy, HelpCircle, History, KeyRound, Library, LogIn, Mail, MessageCircle, MessagesSquare, Pencil, Plus, RotateCw, Search, Send, Square, Trash2, UserCircle, Video, type LucideIcon } from 'lucide-react';
import { askAssistant, AssistantError, type AssistantMessage, type AssistantReply } from '../api/assistant';
import { groupByDate, loadConversations, previewOf, saveConversations, titleFrom, type Conversation, type StoredTurn } from '../api/chatHistory';
import { useAuth } from '../context/AuthContext';
import { TopBar } from '../components/TopBar';
import { navigate, type Route } from '../router';
import { colors, radius } from '../theme';
import './assistant.css';

const MAX_CHARS = 1000;
/** The Worker accepts at most 12 messages per request, so only the latest ones are sent. */
const MAX_HISTORY_MESSAGES = 12;
/** Opens on KingsChat if the app is installed, otherwise in the browser. */
const SUPPORT_URL = 'https://kingschat.online/user/topappsupport';
const WELCOME_HINT = 'Discover testimonies, explore resources, get answers and find your way around Testimonies of Praise.';

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

interface Suggestion {
  label: string;
  icon: LucideIcon;
  prompt?: string;
  /** Opens the Account Help cards instead of sending a message. */
  accountHelp?: boolean;
  /** Focuses the message box instead of sending a message. */
  focus?: boolean;
}

const SUGGESTIONS: Suggestion[] = [
  { label: 'Find a testimony', icon: Search, prompt: 'Help me find a testimony.' },
  { label: 'Explore resources', icon: Library, prompt: 'What resources can I explore in the app?' },
  { label: 'Help with my account', icon: UserCircle, accountHelp: true },
  { label: 'Where can I watch live?', icon: Video, prompt: 'Where can I watch live?' },
  { label: 'Ask me anything', icon: MessageCircle, focus: true },
];

interface AccountItem {
  label: string;
  icon: LucideIcon;
  /** Opens a page on this site. */
  route?: Route;
  /** Otherwise, sends this message to the assistant. */
  prompt?: string;
}

const ACCOUNT_HELP: AccountItem[] = [
  { label: 'I forgot my password', icon: KeyRound, route: { name: 'forgot' } },
  { label: 'I cannot sign in', icon: LogIn, route: { name: 'signin' } },
  { label: 'Google sign-in is not working', icon: UserCircle, prompt: 'Google sign-in is not working for me. What should I try?' },
  { label: "I haven't received my verification code", icon: Mail, prompt: "I haven't received my verification code. What should I do?" },
  { label: 'I need help accessing my account', icon: HelpCircle, prompt: 'I need help accessing my account. What can I do?' },
];

const FOLLOW_UPS: { label: string; prompt: string }[] = [
  { label: 'Explain further', prompt: 'Please explain that in more detail.' },
  { label: 'Find related testimonies', prompt: 'Find testimonies related to that.' },
  { label: 'I need more help', prompt: 'I need more help with this.' },
];

const timeLabel = (at: number) => new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function withConversation(list: Conversation[], id: string, title: string, turns: StoredTurn[], now: number): Conversation[] {
  const existing = list.find((c) => c.id === id);
  const updated: Conversation = { id, title: existing?.title ?? title, updatedAt: now, turns };
  return [updated, ...list.filter((c) => c.id !== id)].sort((a, b) => b.updatedAt - a.updatedAt);
}

const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: colors.textSubtle, margin: 0 };
const card: React.CSSProperties = { display: 'block', padding: 10, borderRadius: radius.sm, border: `1px solid ${colors.border}`, background: colors.bg, color: colors.text, textDecoration: 'none' };
const iconButton: React.CSSProperties = { background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer', padding: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' };
const pill: React.CSSProperties = { padding: '10px 14px', borderRadius: radius.md, border: `1px solid ${colors.borderSoft}`, background: colors.surface, color: colors.text, cursor: 'pointer', font: 'inherit', fontSize: 14, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 8, textAlign: 'left' };

export function AssistantPage({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const lastQuestion = useRef<string | null>(null);
  const latest = useRef<Conversation[]>([]);
  const uidRef = useRef<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const active = conversations.find((c) => c.id === activeId) ?? null;
  const turns = active?.turns ?? [];

  // Load this account's chats. Switching account or signing out clears what is on screen first.
  useEffect(() => {
    uidRef.current = uid;
    abortRef.current?.abort();
    setActiveId(null);
    setError(null);
    setBusy(false);
    const list = uid ? loadConversations(uid) : [];
    latest.current = list;
    setConversations(list);
  }, [uid]);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns.length, busy]);

  const commit = (next: Conversation[]) => {
    const sorted = [...next].sort((a, b) => b.updatedAt - a.updatedAt);
    latest.current = sorted;
    setConversations(sorted);
    const owner = uidRef.current;
    if (owner) saveConversations(owner, sorted);
  };

  const send = async (text?: string) => {
    const question = (text ?? input).trim();
    if (!question || busy) return;
    if (question.length > MAX_CHARS) return setError(`Keep your question under ${MAX_CHARS} characters.`);
    setError(null);
    lastQuestion.current = question;

    const now = Date.now();
    const id = activeId ?? `c${now}`;
    const base = latest.current.find((c) => c.id === id);
    const sent: StoredTurn[] = [...(base?.turns ?? []), { id: `u${now}`, role: 'user', content: question, at: now }];
    commit(withConversation(latest.current, id, titleFrom(question), sent, now));
    setActiveId(id);
    setInput('');
    setBusy(true);

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const history: AssistantMessage[] = sent.slice(-MAX_HISTORY_MESSAGES).map(({ role, content }) => ({ role, content }));
      const answer: AssistantReply = await askAssistant(history, controller.signal);
      const replyAt = Date.now();
      const reply: StoredTurn = {
        id: `a${replyAt}`,
        role: 'assistant',
        content: answer.reply || 'I could not find an answer to that.',
        at: replyAt,
        testimonies: answer.testimonies,
        clips: answer.clips,
        sources: answer.sources,
        navigate: answer.navigate,
      };
      commit(withConversation(latest.current, id, titleFrom(question), [...sent, reply], replyAt));
    } catch (e) {
      if ((e as Error).name === 'AbortError') setError('Stopped. You can ask again.');
      else setError(e instanceof AssistantError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  };

  const newChat = () => {
    setActiveId(null);
    setError(null);
    setHistoryOpen(false);
    inputRef.current?.focus();
  };

  const openChat = (c: Conversation) => {
    setActiveId(c.id);
    setError(null);
    setHistoryOpen(false);
  };

  const deleteChat = (c: Conversation) => {
    if (!window.confirm(`Delete “${c.title}”? It will be removed from this browser.`)) return;
    commit(latest.current.filter((x) => x.id !== c.id));
    if (activeId === c.id) setActiveId(null);
  };

  const saveRename = () => {
    const title = renameText.trim();
    if (renamingId && title) commit(latest.current.map((c) => (c.id === renamingId ? { ...c, title: title.slice(0, 80) } : c)));
    setRenamingId(null);
  };

  const copy = async (turn: StoredTurn) => {
    try {
      await navigator.clipboard.writeText(turn.content);
      setCopiedId(turn.id);
      setTimeout(() => setCopiedId((cur) => (cur === turn.id ? null : cur)), 1500);
    } catch {
      setError('Could not copy. Select the text and copy it instead.');
    }
  };

  const runSuggestion = (s: Suggestion) => {
    if (s.accountHelp) setAccountOpen((open) => !open);
    else if (s.focus) inputRef.current?.focus();
    else if (s.prompt) void send(s.prompt);
  };

  const runAccount = (item: AccountItem) => {
    if (item.route) navigate(item.route);
    else if (item.prompt) void send(item.prompt);
  };

  /** Desktop: show or hide the side panel. Phone: open or close the full-screen panel. */
  const toggleHistory = () => {
    if (window.matchMedia('(min-width: 900px)').matches) setCollapsed((c) => !c);
    else setHistoryOpen((open) => !open);
  };

  const filtered = search.trim()
    ? conversations.filter((c) => `${c.title} ${previewOf(c)}`.toLowerCase().includes(search.trim().toLowerCase()))
    : conversations;
  const groups = groupByDate(filtered);
  const lastTurn = turns[turns.length - 1];

  return (
    <div data-page className="ast-layout" style={{ background: colors.bg }}>
      <aside
        className={`ast-sidebar${historyOpen ? ' open' : ''}${collapsed ? ' collapsed' : ''}`}
        aria-label="Chat history"
        style={{ flexDirection: 'column', background: colors.surface, borderRight: `1px solid ${colors.borderSoft}`, width: historyOpen ? '100%' : undefined }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderBottom: `1px solid ${colors.borderSoft}` }}>
          <strong style={{ color: colors.text, fontSize: 15 }}>Chat history</strong>
          <div style={{ display: 'flex', gap: 4 }}>
            <button type="button" onClick={newChat} style={iconButton} aria-label="New chat" title="New chat">
              <Plus size={18} />
            </button>
            <button type="button" onClick={() => setHistoryOpen(false)} style={{ ...iconButton, display: historyOpen ? 'inline-flex' : 'none' }} aria-label="Close chat history">
              <ChevronRight size={18} style={{ transform: 'rotate(180deg)' }} />
            </button>
          </div>
        </div>
        <div style={{ padding: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: '8px 10px', background: colors.bg }}>
            <Search size={16} color={colors.textSubtle} aria-hidden="true" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chats"
              aria-label="Search saved chats"
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: colors.text, font: 'inherit', fontSize: 14, minWidth: 0 }}
            />
          </label>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {groups.length === 0 ? (
            <p style={{ ...label, fontWeight: 400, textAlign: 'center', marginTop: 16 }}>
              {uid ? 'No saved chats yet. Ask a question to start one.' : 'Sign in to save your chats in this browser.'}
            </p>
          ) : null}
          {groups.map((group) => (
            <div key={group.label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <p style={{ ...label, textTransform: 'uppercase' }}>{group.label}</p>
              {group.items.map((c) =>
                renamingId === c.id ? (
                  <form
                    key={c.id}
                    onSubmit={(e) => {
                      e.preventDefault();
                      saveRename();
                    }}
                    style={{ display: 'flex', gap: 6, alignItems: 'center' }}
                  >
                    <input
                      value={renameText}
                      onChange={(e) => setRenameText(e.target.value)}
                      maxLength={80}
                      autoFocus
                      aria-label="Chat name"
                      style={{ flex: 1, minWidth: 0, padding: '6px 8px', borderRadius: radius.sm, border: `1px solid ${colors.accent}`, background: colors.bg, color: colors.text, font: 'inherit', fontSize: 14 }}
                    />
                    <button type="submit" style={{ background: 'none', border: 'none', color: colors.accent, fontWeight: 800, cursor: 'pointer' }}>
                      Save
                    </button>
                  </form>
                ) : (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: 8, borderRadius: radius.sm, background: activeId === c.id ? colors.bg : 'transparent' }}>
                    <button
                      type="button"
                      onClick={() => openChat(c)}
                      aria-label={`Open ${c.title}`}
                      style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: colors.text, display: 'flex', flexDirection: 'column', gap: 2 }}
                    >
                      <strong style={{ fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</strong>
                      <span style={{ fontSize: 12, color: colors.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{previewOf(c)}</span>
                      <span style={{ fontSize: 11, color: colors.textSubtle }}>{timeLabel(c.updatedAt)}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRenamingId(c.id);
                        setRenameText(c.title);
                      }}
                      aria-label={`Rename ${c.title}`}
                      style={iconButton}
                    >
                      <Pencil size={14} />
                    </button>
                    <button type="button" onClick={() => deleteChat(c)} aria-label={`Delete ${c.title}`} style={iconButton}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ),
              )}
            </div>
          ))}
          <p style={{ ...label, fontWeight: 400, marginTop: 'auto' }}>Chats are kept in this browser, for this account only. They are not synced to other devices yet.</p>
        </div>
      </aside>

      <div className="ast-main">
        <TopBar
          title="T.O.P AI Assistant"
          onBack={onBack}
          actions={[
            { icon: RotateCw, label: 'Refresh page', onClick: () => window.location.reload() },
            { icon: History, label: collapsed ? 'Show chat history' : 'Chat history', onClick: toggleHistory },
            ...(active ? [{ icon: Trash2, label: 'Delete this chat', onClick: () => deleteChat(active) }] : []),
          ]}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 16px', color: colors.textMuted, fontSize: 13 }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: busy ? colors.accent : colors.textSubtle }} aria-hidden="true" />
          <span>{busy ? 'Thinking…' : 'Ready'}</span>
          {uid ? <span style={{ marginLeft: 'auto', color: colors.textSubtle }}>Chats are saved in this browser only.</span> : null}
        </div>

        <div className="ast-thread" aria-live="polite">
          {turns.length === 0 ? (
            <section style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 0' }}>
              <h2 style={{ margin: 0, fontSize: 26, color: colors.text, fontWeight: 700 }}>Hello! I’m your TOP AI Assistant.</h2>
              <p style={{ margin: 0, fontSize: 17, color: colors.text }}>How can I help you today?</p>
              <p style={{ margin: 0, fontSize: 14, color: colors.textMuted }}>{WELCOME_HINT}</p>
              <div className="ast-cards" style={{ marginTop: 6 }}>
                {SUGGESTIONS.map((s) => (
                  <button key={s.label} type="button" onClick={() => runSuggestion(s)} style={pill} aria-expanded={s.accountHelp ? accountOpen : undefined}>
                    <s.icon size={20} color={colors.accent} aria-hidden="true" />
                    <span>{s.label}</span>
                  </button>
                ))}
              </div>
              {accountOpen ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8, padding: 14, borderRadius: radius.md, background: colors.surface, border: `1px solid ${colors.borderSoft}` }}>
                  <p style={{ margin: 0, fontWeight: 700, color: colors.text }}>How can I help with your account?</p>
                  {ACCOUNT_HELP.map((item) => (
                    <button key={item.label} type="button" onClick={() => runAccount(item)} style={{ ...pill, background: colors.bg }}>
                      <item.icon size={18} color={colors.accent} aria-hidden="true" />
                      <span style={{ flex: 1 }}>{item.label}</span>
                      <ChevronRight size={16} color={colors.textSubtle} aria-hidden="true" />
                    </button>
                  ))}
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: colors.textMuted }}>
                    Still having trouble? Contact the Testimonies of Praise support team for further assistance.
                  </p>
                  <a
                    href={SUPPORT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ ...pill, alignSelf: 'flex-start', background: colors.accent, color: colors.onAccent, border: 'none', textDecoration: 'none' }}
                  >
                    <MessagesSquare size={18} aria-hidden="true" />
                    Contact @topappsupport on KingsChat
                  </a>
                </div>
              ) : null}
            </section>
          ) : null}

          {turns.map((t, index) => {
            const isLast = index === turns.length - 1;
            return (
              <div key={t.id} style={{ display: 'flex', flexDirection: 'column', alignItems: t.role === 'user' ? 'flex-end' : 'flex-start', gap: 4 }}>
                <div
                  className="ast-bubble"
                  style={
                    t.role === 'user'
                      ? { maxWidth: '82%', padding: '10px 16px', borderRadius: '20px 20px 6px 20px', background: colors.accent, color: colors.onAccent, display: 'flex', flexDirection: 'column', gap: 8 }
                      : { width: '100%', maxWidth: 680, padding: '4px 2px', color: colors.text, display: 'flex', flexDirection: 'column', gap: 10 }
                  }
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

                  {t.role === 'assistant' ? (
                    <button type="button" onClick={() => void copy(t)} aria-label="Copy response" style={{ ...iconButton, alignSelf: 'flex-start', padding: 0, gap: 4, fontSize: 12, color: colors.textMuted }}>
                      {copiedId === t.id ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                      <span>{copiedId === t.id ? 'Copied' : 'Copy'}</span>
                    </button>
                  ) : null}
                </div>
                <span style={{ fontSize: 12, color: colors.textSubtle, padding: '0 4px' }}>{timeLabel(t.at)}</span>

                {isLast && t.role === 'assistant' && !busy ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {FOLLOW_UPS.map((f) => (
                      <button
                        key={f.label}
                        type="button"
                        onClick={() => void send(f.prompt)}
                        style={{ padding: '6px 10px', borderRadius: 16, border: `1px solid ${colors.accent}`, background: 'none', color: colors.accent, fontSize: 12, fontWeight: 700, cursor: 'pointer', font: 'inherit' }}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}

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
          <div ref={endRef} />
        </div>

        <form
          className="ast-composer"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          style={{ display: 'flex', alignItems: 'flex-end', gap: 6, padding: '6px 6px 6px 16px', borderRadius: 26, border: `1px solid ${colors.border}`, background: colors.surface, maxWidth: 760, width: 'calc(100% - 24px)', margin: '0 auto calc(12px + var(--player-h, 0px))', boxSizing: 'border-box' }}
        >
          <textarea
            ref={inputRef}
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
            style={{ flex: 1, resize: 'none', minHeight: 40, maxHeight: 140, border: 'none', outline: 'none', background: 'transparent', color: colors.text, padding: '10px 0', fontFamily: 'inherit', fontSize: 16, lineHeight: 1.4 }}
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            aria-label="Send"
            style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 20, border: 'none', background: colors.accent, color: colors.onAccent, cursor: 'pointer', opacity: busy || !input.trim() ? 0.4 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {busy ? <Square size={16} /> : <Send size={18} />}
          </button>
        </form>
      </div>
    </div>
  );
}
