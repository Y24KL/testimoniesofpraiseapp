import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, doc, limit, onSnapshot, orderBy, query, where, type QueryConstraint } from 'firebase/firestore';
import { db } from '../firebase';
import { fmtDate } from '../lib';
import { Message as Notice } from '../components/Field';
import { Icon } from '../components/Icon';
import { MessageComposer, type ComposerContext } from '../components/MessageComposer';
import { EmptyState, FilterTabs, GlassCard, LoadingList, PageHeader, SearchInput, SectionHeader, StatusBadge, type BadgeKind } from '../components/ui';
import {
  CATEGORY_LABELS, authDetails, displayName, getUserCards, markThreadReadByAdmin, newMessageKey, searchUsers, sendMessage, setThreadStatus,
  type Message, type Thread, type ThreadStatus, type UserCard,
} from '../support';
import type { Route } from '../types';

type Tab = 'all' | 'unread' | 'awaiting_user' | 'awaiting_admin' | 'resolved';
const STATUS: Record<ThreadStatus, { label: string; kind: BadgeKind }> = {
  awaiting_admin: { label: 'Needs reply', kind: 'warn' },
  awaiting_user: { label: 'Waiting for user', kind: 'info' },
  resolved: { label: 'Resolved', kind: 'ok' },
};
const RELATED_ROUTE: Record<string, Route['name']> = {
  choir_request: 'choirRequests', sponsorship: 'sponsorships', testimony_submission: 'submissions', feedback: 'userFeedback', report: 'reports', comment: 'comments', written_testimony: 'written',
};

/**
 * Admin "User Communication": find any user, read and answer private conversations, and resolve them.
 * Conversations are created by the Worker when an admin sends a first message (also from record pages).
 */
export function UserCommunication({ threadId: initialThread, uid: initialUid, go }: { threadId?: string; uid?: string; go: (r: Route) => void }) {
  const [tab, setTab] = useState<Tab>('all');
  const [filter, setFilter] = useState('');
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [users, setUsers] = useState<Map<string, UserCard>>(new Map());
  const [selected, setSelected] = useState<string | null>(initialThread ?? null);
  const [userFilter, setUserFilter] = useState<string | null>(initialUid ?? null);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<UserCard[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [composeFor, setComposeFor] = useState<{ uid: string; threadId?: string; context?: ComposerContext } | null>(null);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  useEffect(() => {
    const c: QueryConstraint[] = [];
    if (userFilter) c.push(where('uid', '==', userFilter));
    if (tab === 'awaiting_user' || tab === 'awaiting_admin' || tab === 'resolved') c.push(where('status', '==', tab));
    if (tab === 'unread') c.push(where('unreadForAdmin', '>', 0));
    const q = tab === 'unread' ? query(collection(db, 'supportThreads'), ...c, limit(100)) : query(collection(db, 'supportThreads'), ...c, orderBy('lastMessageAt', 'desc'), limit(100));
    setThreads(null);
    return onSnapshot(
      q,
      (s) => setThreads(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Thread, 'id'>) })).sort((a, b) => (b.lastMessageAt?.toMillis() ?? 0) - (a.lastMessageAt?.toMillis() ?? 0))),
      (e) => { setErr(e.message); setThreads([]); },
    );
  }, [tab, userFilter]);

  useEffect(() => {
    const missing = (threads ?? []).map((t) => t.uid).filter((u) => !users.has(u));
    if (missing.length) void getUserCards(missing).then((m) => setUsers((cur) => new Map([...cur, ...m])));
  }, [threads]); // eslint-disable-line react-hooks/exhaustive-deps

  const runSearch = async () => {
    setSearching(true);
    setErr('');
    try {
      const found = await searchUsers(search);
      const auth = await authDetails(found.map((u) => u.uid)).catch(() => new Map());
      setResults(found.map((u) => ({ ...u, ...(auth.get(u.uid) ?? {}) })));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSearching(false);
    }
  };

  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return threads ?? [];
    return (threads ?? []).filter((t) => [t.subject, t.lastMessagePreview, CATEGORY_LABELS[t.category], t.related?.label, displayName(users.get(t.uid))].some((s) => s?.toLowerCase().includes(f)));
  }, [threads, filter, users]);

  const current = shown.find((t) => t.id === selected) ?? threads?.find((t) => t.id === selected) ?? null;

  return (
    <>
      <PageHeader
        eyebrow="Communication"
        title="User Communication"
        sub="Message any registered user privately, answer their replies, and resolve issues. Users read these in the app under Messages."
      />
      {err ? <Notice kind="err">{err}</Notice> : null}
      {ok ? <Notice kind="ok">{ok}</Notice> : null}

      <GlassCard>
        <SectionHeader icon="search" title="Find a user" hint="Name, church or zone (start of the word), email address, or user ID" />
        <form className="row gap" style={{ gap: 8, flexWrap: 'wrap' }} onSubmit={(e) => { e.preventDefault(); void runSearch(); }}>
          <div style={{ flex: 1, minWidth: 220 }}><SearchInput value={search} onChange={setSearch} placeholder="e.g. Grace, Lagos Zone 1, name@example.com" label="Find a user" /></div>
          <button type="submit" className="btn primary" disabled={searching || search.trim().length < 2}>{searching ? <span className="spin sm" aria-hidden="true" /> : <Icon name="search" size={16} />}Search</button>
        </form>
        {results ? (
          results.length === 0 ? <p className="small muted" style={{ marginTop: 12 }}>No users found. Names are matched from the start of the word, exactly as saved.</p> : (
            <div className="user-results">
              {results.map((u) => (
                <div key={u.uid} className="user-row">
                  <div className="avatar">{(u.fullName ?? '?').charAt(0).toUpperCase()}</div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <b>{displayName(u)}</b>
                    <div className="small muted">{[u.email, u.church, u.zone].filter(Boolean).join(' · ') || 'No profile details'}</div>
                    <div className="small muted"><code>{u.uid}</code>{u.lastSignInAt ? ` · last signed in ${new Date(u.lastSignInAt).toLocaleDateString()}` : ''}</div>
                  </div>
                  <div className="row gap" style={{ gap: 6 }}>
                    <button type="button" className="btn small ghost" onClick={() => { setUserFilter(u.uid); setTab('all'); setUsers((c) => new Map(c).set(u.uid, u)); }}><Icon name="messageCircle" size={14} />Conversations</button>
                    <button type="button" className="btn small primary" onClick={() => setComposeFor({ uid: u.uid })}><Icon name="send" size={14} />Message</button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : null}
      </GlassCard>

      <div className="comm-layout">
        <GlassCard className="thread-list-card">
          <div className="toolbar" style={{ flexWrap: 'wrap', gap: 8 }}>
            <FilterTabs label="Conversation status" value={tab} onChange={setTab} options={[
              { id: 'all', label: 'All' }, { id: 'unread', label: 'Unread' }, { id: 'awaiting_admin', label: 'Needs reply' }, { id: 'awaiting_user', label: 'Waiting for user' }, { id: 'resolved', label: 'Resolved' },
            ]} />
          </div>
          {userFilter ? (
            <div className="chip-filter">Showing {displayName(users.get(userFilter))} <button type="button" className="link" onClick={() => setUserFilter(null)}>Show everyone</button></div>
          ) : null}
          <SearchInput value={filter} onChange={setFilter} placeholder="Filter by subject, person, record…" label="Filter conversations" />
          {threads === null ? <LoadingList rows={4} /> : shown.length === 0 ? (
            <EmptyState icon="messageSquare" title="No conversations here">Start one with <b>Find a user</b>, or from a choir request, sponsorship or submission.</EmptyState>
          ) : (
            <ul className="thread-list" role="list">
              {shown.map((t) => (
                <li key={t.id}>
                  <button type="button" className={`thread-row ${t.id === selected ? 'active' : ''} ${(t.unreadForAdmin ?? 0) > 0 ? 'unread' : ''}`} onClick={() => setSelected(t.id)}>
                    <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
                      <b className="ellipsis">{displayName(users.get(t.uid))}</b>
                      <span className="small muted nowrap">{t.lastMessageAt ? fmtDate(t.lastMessageAt) : ''}</span>
                    </div>
                    <div className="ellipsis">{t.subject}</div>
                    <div className="small muted ellipsis">{t.lastSender === 'user' ? 'User: ' : 'You: '}{t.lastMessagePreview}</div>
                    <div className="row" style={{ gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                      <StatusBadge kind={STATUS[t.status]?.kind ?? 'draft'}>{STATUS[t.status]?.label ?? t.status}</StatusBadge>
                      <span className="tag">{CATEGORY_LABELS[t.category] ?? t.category}</span>
                      {t.correction?.state === 'received' ? <span className="tag gold">Correction received</span> : null}
                      {(t.unreadForAdmin ?? 0) > 0 ? <span className="dot-count" aria-label={`${t.unreadForAdmin} unread`}>{t.unreadForAdmin}</span> : null}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>

        <div>
          {current ? (
            <ThreadView
              key={current.id}
              thread={current}
              user={users.get(current.uid)}
              onCompose={() => setComposeFor({ uid: current.uid, threadId: current.id })}
              go={go}
              onError={setErr}
              onOk={setOk}
            />
          ) : (
            <GlassCard><EmptyState icon="messageCircle" title="Choose a conversation">Select one on the left to read and reply.</EmptyState></GlassCard>
          )}
        </div>
      </div>

      {composeFor ? (
        <MessageComposer
          uid={composeFor.uid}
          threadId={composeFor.threadId}
          context={composeFor.context}
          onClose={() => setComposeFor(null)}
          onSent={(id) => { setComposeFor(null); setSelected(id); setTab('all'); setOk('Message sent. The user has it in their Messages, and a notification went to their phones.'); }}
        />
      ) : null}
    </>
  );
}

function ThreadView({ thread: t, user, onCompose, onError, onOk, go }: { thread: Thread; user?: UserCard; onCompose: () => void; onError: (m: string) => void; onOk: (m: string) => void; go: (r: Route) => void }) {
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const key = useRef(newMessageKey());
  const end = useRef<HTMLDivElement>(null);

  useEffect(
    () => onSnapshot(query(collection(doc(db, 'supportThreads', t.id), 'messages'), orderBy('createdAt', 'asc'), limit(300)), (s) => setMessages(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Message, 'id'>) }))), (e) => onError(e.message)),
    [t.id, onError],
  );
  useEffect(() => { void authDetails([t.uid]).then((m) => setEmail(m.get(t.uid)?.email ?? null)).catch(() => undefined); }, [t.uid]);
  useEffect(() => {
    if (messages) void markThreadReadByAdmin(t, messages);
    end.current?.scrollIntoView({ block: 'end' });
  }, [messages]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendReply = async () => {
    if (!reply.trim()) return;
    setBusy(true);
    try {
      await sendMessage({ uid: t.uid, clientMessageId: key.current, threadId: t.id, body: reply.trim() });
      key.current = newMessageKey();
      setReply('');
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (s: ThreadStatus) => {
    setBusy(true);
    try {
      await setThreadStatus(t, s);
      onOk(s === 'resolved' ? 'Conversation resolved.' : 'Conversation reopened.');
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const relatedRoute = t.related ? RELATED_ROUTE[t.related.type] : undefined;

  return (
    <GlassCard className="thread-view">
      <div className="thread-head">
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0 }}>{t.subject}</h2>
          <div className="small muted">
            {displayName(user)}{email ? ` · ${email}` : ''}{user?.church ? ` · ${user.church}` : ''}{user?.zone ? ` · ${user.zone}` : ''}
          </div>
          <div className="row" style={{ gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            <StatusBadge kind={STATUS[t.status]?.kind ?? 'draft'}>{STATUS[t.status]?.label ?? t.status}</StatusBadge>
            <span className="tag">{CATEGORY_LABELS[t.category] ?? t.category}</span>
            {t.related ? <span className="tag">{t.related.label || t.related.id}</span> : null}
            {t.correction?.state === 'received' ? <span className="tag gold">Correction received — ready for review</span> : null}
          </div>
        </div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {relatedRoute ? <button type="button" className="btn small ghost" onClick={() => go({ name: relatedRoute } as Route)}><Icon name="external" size={14} />Open record</button> : null}
          {t.status === 'resolved'
            ? <button type="button" className="btn small ghost" disabled={busy} onClick={() => void setStatus('awaiting_admin')}><Icon name="undo" size={14} />Reopen</button>
            : <button type="button" className="btn small success" disabled={busy} onClick={() => void setStatus('resolved')}><Icon name="checkCircle" size={14} />Mark resolved</button>}
        </div>
      </div>

      <div className="messages" aria-live="polite">
        {messages === null ? <LoadingList rows={3} /> : messages.map((m) => (
          <div key={m.id} className={`msg-row ${m.senderType}`}>
            <div className={`bubble ${m.senderType}`}>
              {m.body.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}
              {m.action ? <span className="msg-action">{m.action.label}<Icon name="chevronRight" size={14} /></span> : null}
            </div>
            <div className="msg-meta">
              {m.senderType === 'admin' ? 'Support team' : displayName(user)} · {m.createdAt ? fmtDate(m.createdAt) : 'sending…'}
              {m.senderType === 'admin' ? (m.readAt ? ' · Read' : ' · Sent') : ''}
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>

      <div className="reply-box">
        <textarea value={reply} onChange={(e) => setReply(e.target.value)} maxLength={4000} placeholder={`Reply to ${displayName(user)}…`} aria-label="Reply" onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void sendReply(); }} />
        <div className="row" style={{ gap: 6, justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <button type="button" className="btn small ghost" onClick={onCompose}><Icon name="plus" size={14} />Message with template or button</button>
          <button type="button" className="btn primary" disabled={busy || !reply.trim()} onClick={() => void sendReply()}>
            {busy ? <span className="spin sm" aria-hidden="true" /> : <Icon name="send" size={16} />}Send reply
          </button>
        </div>
      </div>
    </GlassCard>
  );
}
