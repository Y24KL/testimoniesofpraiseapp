import { useEffect, useRef, useState } from 'react';
import { ChevronRight, ExternalLink, MessageCircle, Send } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { useAuth } from '../context/AuthContext';
import { navigate, type Route } from '../router';
import { CATEGORY_LABELS, MAX_REPLY, markRead, sendReply, subscribeMessages, subscribeThread, subscribeThreads, type SupportMessage, type SupportThread } from '../api/supportMessages';

const when = (ms: number) => {
  if (!ms) return '';
  const d = new Date(ms);
  return d.toDateString() === new Date().toDateString() ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString();
};
const stamp = (ms: number) => new Date(ms).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Action buttons from the support team: known in-app screens only, or https links in a new tab. */
function openAction(action: { route?: string; url?: string }) {
  if (action.url) {
    if (/^https:\/\//i.test(action.url)) window.open(action.url, '_blank', 'noopener,noreferrer');
    return;
  }
  const [first, second] = (action.route ?? '').replace(/^\/+/, '').split('/');
  const id = second && /^[A-Za-z0-9_-]{1,100}$/.test(second) ? second : undefined;
  const map: Record<string, Route | undefined> = {
    messages: id ? { name: 'messages', threadId: id } : { name: 'messages' },
    choir: { name: 'choirRequest' },
    sponsor: { name: 'sponsor' },
    share: { name: 'share' },
    profile: { name: 'profile' },
    feedback: { name: 'feedback' },
    notifications: { name: 'notifications' },
    live: { name: 'live' },
    radio: { name: 'listen' },
    testimony: id ? { name: 'testimony', id } : undefined,
    written: id ? { name: 'writtenTestimony', id } : undefined,
    article: id ? { name: 'article', id } : undefined,
    lyrical: id ? { name: 'lyricalVideo', id } : undefined,
    singers: id ? { name: 'singer', id } : undefined,
    correction: id === 'choir' || second === 'choir' ? { name: 'choirRequest' } : second === 'sponsorship' ? { name: 'sponsor' } : undefined,
  };
  const target = map[first];
  if (target) navigate(target);
}

/** Private messages from the Testimonies of Praise support team: the list, or one conversation. */
export function MessagesPage({ threadId, onBack }: { threadId?: string; onBack: () => void }) {
  return threadId ? <Conversation threadId={threadId} onBack={onBack} /> : <Inbox onBack={onBack} />;
}

function Inbox({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const [threads, setThreads] = useState<SupportThread[] | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!user) return;
    setError('');
    return subscribeThreads(user.uid, setThreads, () => setError('We couldn’t load your messages. Check your connection.'));
  }, [user, attempt]);

  return (
    <div className="msg-page">
      <TopBar title="Messages" onBack={onBack} />
      <div className="msg-body">
        {!user ? (
          <EmptyState title="Sign in to see your messages" />
        ) : error ? (
          <ErrorState message={error} onRetry={() => setAttempt((n) => n + 1)} />
        ) : threads === null ? (
          <div className="skeleton" style={{ height: 120 }} aria-hidden="true" />
        ) : threads.length === 0 ? (
          <EmptyState icon={<MessageCircle size={40} />} title="No messages yet" message="When the Testimonies of Praise team writes to you about a request, a submission or your account, it appears here." />
        ) : (
          <ul className="msg-list" role="list">
            {threads.map((t) => {
              const unread = t.unreadForUser > 0;
              return (
                <li key={t.id}>
                  <button type="button" className={`msg-item${unread ? ' unread' : ''}`} onClick={() => navigate({ name: 'messages', threadId: t.id })} aria-label={`${unread ? 'Unread. ' : ''}${t.subject}. ${t.lastMessagePreview}`}>
                    <span className="msg-ic"><MessageCircle size={18} /></span>
                    <span className="msg-main">
                      <span className="msg-top"><b>{t.subject}</b><span className="msg-when">{when(t.lastMessageAt)}</span></span>
                      <span className="msg-from">Testimonies of Praise Support Team{t.related?.label ? ` · ${t.related.label}` : CATEGORY_LABELS[t.category] ? ` · ${CATEGORY_LABELS[t.category]}` : ''}</span>
                      <span className="msg-prev">{t.lastSender === 'user' ? 'You: ' : ''}{t.lastMessagePreview}</span>
                      {t.status === 'resolved' ? <span className="msg-resolved">Resolved</span> : null}
                    </span>
                    {unread ? <span className="msg-count">{t.unreadForUser > 9 ? '9+' : t.unreadForUser}</span> : <ChevronRight size={18} />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function Conversation({ threadId, onBack }: { threadId: string; onBack: () => void }) {
  const { user } = useAuth();
  const [thread, setThread] = useState<SupportThread | null | undefined>(undefined);
  const [messages, setMessages] = useState<SupportMessage[] | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => subscribeThread(threadId, setThread, () => setThread(null)), [threadId]);
  useEffect(() => subscribeMessages(threadId, setMessages, () => setError('We couldn’t load this conversation.')), [threadId]);
  useEffect(() => {
    if (thread && messages) void markRead(thread, messages);
    end.current?.scrollIntoView({ block: 'end' });
  }, [thread, messages]);

  const send = async () => {
    if (!user || !reply.trim()) return;
    setSending(true);
    setError('');
    try {
      await sendReply(threadId, user.uid, reply);
      setReply('');
    } catch {
      setError('Your reply was not sent. Check your connection and try again.');
    } finally {
      setSending(false);
    }
  };

  if (thread === null) {
    return (
      <div className="msg-page">
        <TopBar title="Message" onBack={onBack} />
        <EmptyState title="Conversation not found" message="It may have been removed, or it belongs to another account." />
      </div>
    );
  }

  return (
    <div className="msg-page">
      <TopBar title={thread?.subject ?? 'Message'} onBack={onBack} />
      <div className="msg-body">
        {thread?.related?.label ? <p className="msg-about">About: {thread.related.label}</p> : null}
        <div className="msg-thread" aria-live="polite">
          {messages === null ? <div className="skeleton" style={{ height: 120 }} aria-hidden="true" /> : messages.map((m) => {
            const mine = m.senderType === 'user';
            return (
              <div key={m.id} className={`msg-row ${mine ? 'mine' : 'theirs'}`}>
                {!mine ? <span className="msg-sender">Testimonies of Praise Support Team</span> : null}
                <div className={`msg-bubble ${mine ? 'mine' : 'theirs'}`}>
                  {m.body.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}
                  {m.action ? (
                    <button type="button" className="msg-action" onClick={() => openAction(m.action!)}>
                      {m.action.label}{m.action.url ? <ExternalLink size={14} /> : <ChevronRight size={14} />}
                    </button>
                  ) : null}
                </div>
                <span className="msg-meta">{stamp(m.createdAt)}{mine && m.readAt ? ' · Seen' : ''}</span>
              </div>
            );
          })}
          <div ref={end} />
        </div>
        {error ? <p className="msg-error" role="alert">{error}</p> : null}
        {thread?.status === 'resolved' ? <p className="msg-note">This conversation is resolved. You can still reply if you need more help.</p> : null}
        <form className="msg-compose" onSubmit={(e) => { e.preventDefault(); void send(); }}>
          <textarea value={reply} onChange={(e) => setReply(e.target.value)} maxLength={MAX_REPLY} placeholder="Write a reply…" aria-label="Reply" onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void send(); }} />
          <button type="submit" className="msg-send" disabled={sending || !reply.trim()} aria-label="Send reply"><Send size={18} /></button>
        </form>
      </div>
    </div>
  );
}
