import { useEffect, useState } from 'react';
import { collection, deleteDoc, doc, limitToLast, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { fmtDate } from '../lib';

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

  useEffect(
    () =>
      onSnapshot(query(collection(db, 'liveChat', sessionId, 'messages'), orderBy('createdAt', 'asc'), limitToLast(200)), (s) =>
        setMessages(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ChatMessage, 'id'>) }))),
      ),
    [sessionId],
  );

  useEffect(
    () =>
      onSnapshot(query(collection(db, 'liveChatReports'), where('sessionId', '==', sessionId)), (s) =>
        setReports(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Report, 'id'>) }))),
      ),
    [sessionId],
  );

  const removeMessage = (messageId: string) => deleteDoc(doc(db, 'liveChat', sessionId, 'messages', messageId)).catch(() => undefined);
  const dismissReport = (reportId: string) => deleteDoc(doc(db, 'liveChatReports', reportId)).catch(() => undefined);

  const reportedIds = new Set(reports.map((r) => r.messageId));
  const shown = tab === 'reported' ? messages.filter((m) => reportedIds.has(m.id)) : messages;

  return (
    <div>
      <div className="row" style={{ marginBottom: 10 }}>
        <button className={`btn small ${tab === 'all' ? '' : 'ghost'}`} onClick={() => setTab('all')}>ALL ({messages.length})</button>
        <button className={`btn small ${tab === 'reported' ? '' : 'ghost'}`} onClick={() => setTab('reported')}>REPORTED ({reportedIds.size})</button>
      </div>
      <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {shown.length === 0 ? (
          <p className="muted small">{tab === 'reported' ? 'No reported messages.' : 'No messages yet.'}</p>
        ) : (
          shown.map((m) => (
            <div key={m.id} className="row between" style={{ padding: '6px 10px', borderRadius: 10, background: 'var(--card)' }}>
              <div>
                <b className="small">{m.name}</b>
                {reportedIds.has(m.id) ? <span className="pill bad small" style={{ marginLeft: 8 }}>REPORTED</span> : null}
                <div className="small">{m.text}</div>
                <div className="small muted">{fmtDate(m.createdAt as never)}</div>
              </div>
              <div className="row">
                {reportedIds.has(m.id)
                  ? reports.filter((r) => r.messageId === m.id).map((r) => (
                      <button key={r.id} className="btn small ghost" onClick={() => void dismissReport(r.id)}>Dismiss report</button>
                    ))
                  : null}
                <button className="btn small danger" onClick={() => void removeMessage(m.id)}>Delete</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
