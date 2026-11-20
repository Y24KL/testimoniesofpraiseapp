import { useEffect, useState } from 'react';
import { collection, deleteDoc, doc, limitToLast, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { fmtDate } from '../lib';
import { Message } from './Field';
import { Icon } from './Icon';
import { FilterTabs, StatusBadge } from './ui';

interface ChatMessage {
  id: string;
  uid: string;
  name: string;
  text: string;
  createdAt?: { toDate(): Date };
}
interface Report {
  id: string;
  messageId: string;
  text: string;
  authorUid: string;
  reporterUid: string;
  createdAt?: { toDate(): Date };
}

/** Live chat moderation for the current stream: delete any message, review reported ones. */
export function ChatModeration({ sessionId }: { sessionId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [tab, setTab] = useState<'all' | 'reported'>('all');
  const [err, setErr] = useState('');

  useEffect(
    () =>
      onSnapshot(
        query(collection(db, 'liveChat', sessionId, 'messages'), orderBy('createdAt', 'asc'), limitToLast(200)),
        (s) => setMessages(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ChatMessage, 'id'>) }))),
        (e) => setErr(`Couldn’t load the chat: ${e.message}`),
      ),
    [sessionId],
  );

  useEffect(
    () =>
      onSnapshot(
        query(collection(db, 'liveChatReports'), where('sessionId', '==', sessionId)),
        (s) => setReports(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Report, 'id'>) }))),
        (e) => setErr(`Couldn’t load chat reports: ${e.message}`),
      ),
    [sessionId],
  );

  const removeMessage = (messageId: string) =>
    deleteDoc(doc(db, 'liveChat', sessionId, 'messages', messageId))
      .then(() => setErr(''))
      .catch((e: Error) => setErr(`Couldn’t delete the message: ${e.message}`));
  const dismissReport = (reportId: string) =>
    deleteDoc(doc(db, 'liveChatReports', reportId))
      .then(() => setErr(''))
      .catch((e: Error) => setErr(`Couldn’t dismiss the report: ${e.message}`));

  const reportedIds = new Set(reports.map((r) => r.messageId));
  const shown = tab === 'reported' ? messages.filter((m) => reportedIds.has(m.id)) : messages;

  return (
    <div className="stack-sm">
      <FilterTabs
        label="Chat messages"
        value={tab}
        onChange={setTab}
        options={[
          { id: 'all', label: 'All', count: messages.length },
          { id: 'reported', label: 'Reported', count: reportedIds.size },
        ]}
      />
      {err ? <Message kind="err">{err}</Message> : null}
      <div className="chat-list" aria-live="polite">
        {shown.length === 0 ? (
          <p className="muted small">{tab === 'reported' ? 'No reported messages.' : 'No messages yet.'}</p>
        ) : (
          shown.map((m) => {
            const flagged = reportedIds.has(m.id);
            return (
              <div key={m.id} className={`chat-msg ${flagged ? 'flagged' : ''}`}>
                <div style={{ minWidth: 0 }}>
                  <div className="who">{m.name}{flagged ? <StatusBadge kind="bad">Reported</StatusBadge> : null}</div>
                  <div className="txt">{m.text}</div>
                  <div className="when">{fmtDate(m.createdAt as never)}</div>
                </div>
                <div className="row">
                  {flagged
                    ? reports.filter((r) => r.messageId === m.id).map((r) => (
                        <button key={r.id} type="button" className="btn small ghost" onClick={() => void dismissReport(r.id)}>Dismiss report</button>
                      ))
                    : null}
                  <button type="button" className="btn small danger" aria-label={`Delete message from ${m.name}`} onClick={() => void removeMessage(m.id)}><Icon name="trash" size={14} /></button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
