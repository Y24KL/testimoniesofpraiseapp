import React, { useEffect, useRef, useState } from 'react';
import {
  addDoc,
  collection,
  limitToLast,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import { Send, Flag, AlertTriangle } from 'lucide-react';
import { db } from '../api/firebase';
import { useAuth } from '../context/AuthContext';
import { colors, radius } from '../theme';
import type { ChatMessage } from '../types';

const MAX_LEN = 300;
const SEND_COOLDOWN_MS = 2000;

export function LiveChat({ sessionId }: { sessionId: string }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [reportingMsg, setReportingMsg] = useState<ChatMessage | null>(null);
  const [reportedSuccess, setReportedSuccess] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([]);
    setError('');
    const col = collection(db, 'liveChat', sessionId, 'messages');
    const q = query(col, orderBy('createdAt', 'asc'), limitToLast(150));

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ChatMessage, 'id'>),
        }));
        setMessages(list);
        setTimeout(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          }
        }, 100);
      },
      (err) => {
        console.error('Chat load error:', err);
        setError('Live chat is unavailable at the moment.');
      }
    );

    return () => unsubscribe();
  }, [sessionId]);

  const send = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const val = text.trim();
    if (!val || !user || sending) return;

    setSending(true);
    setText('');
    try {
      await addDoc(collection(db, 'liveChat', sessionId, 'messages'), {
        uid: user.uid,
        name: user.displayName?.trim() || (user.email ? user.email.split('@')[0] : 'Friend'),
        text: val.slice(0, MAX_LEN),
        createdAt: serverTimestamp(),
      });
    } catch (err: any) {
      console.error('Chat send error:', err);
      setError("Your message couldn't be sent.");
    } finally {
      setTimeout(() => setSending(false), SEND_COOLDOWN_MS);
    }
  };

  const handleReport = async (msg: ChatMessage) => {
    if (!user || msg.uid === user.uid) return;
    try {
      await addDoc(collection(db, 'liveChatReports'), {
        sessionId,
        messageId: msg.id,
        text: msg.text,
        reporterUid: user.uid,
        createdAt: serverTimestamp(),
      });
      setReportedSuccess(true);
      setTimeout(() => {
        setReportedSuccess(false);
        setReportingMsg(null);
      }, 2000);
    } catch (err) {
      console.error('Report error:', err);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '380px',
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        border: `1px solid ${colors.border}`,
        overflow: 'hidden',
        position: 'relative',
        boxSizing: 'border-box',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${colors.border}`,
          backgroundColor: colors.card,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: '12px', fontWeight: '800', letterSpacing: '1px', color: colors.accent, textTransform: 'uppercase' }}>
          Live Community Chat
        </span>
        <span style={{ fontSize: '12px', color: colors.textMuted }}>
          {messages.length} messages
        </span>
      </div>

      {/* Messages Scroll Area */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {messages.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textMuted, fontSize: '13px' }}>
            {error || 'Be the first to say amen and share praise!'}
          </div>
        ) : (
          messages.map((m) => {
            const isMe = m.uid === user?.uid;
            return (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  alignSelf: isMe ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      color: isMe ? colors.accent : colors.textMuted,
                    }}
                  >
                    {m.name}
                  </span>
                  {!isMe && (
                    <button
                      type="button"
                      onClick={() => setReportingMsg(m)}
                      title="Report message"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: colors.textMuted,
                        cursor: 'pointer',
                        padding: '2px',
                        opacity: 0.6,
                      }}
                    >
                      <Flag size={11} />
                    </button>
                  )}
                </div>
                <div
                  style={{
                    backgroundColor: isMe ? colors.primary : colors.card,
                    border: `1px solid ${isMe ? colors.primaryLight : colors.border}`,
                    borderRadius: radius.md,
                    padding: '8px 12px',
                    fontSize: '14px',
                    color: colors.text,
                    wordBreak: 'break-word',
                    lineHeight: '1.4',
                  }}
                >
                  {m.text}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Report Modal */}
      {reportingMsg && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.85)',
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            gap: '12px',
            textAlign: 'center',
          }}
        >
          {reportedSuccess ? (
            <div style={{ color: colors.success, fontSize: '14px', fontWeight: '700' }}>
              ✓ Report received. Thank you for keeping our community safe.
            </div>
          ) : (
            <>
              <AlertTriangle size={32} color={colors.danger} />
              <div style={{ fontSize: '15px', fontWeight: '700', color: colors.text }}>Report this message?</div>
              <div style={{ fontSize: '13px', color: colors.textMuted, fontStyle: 'italic', maxWidth: '90%' }}>
                "{reportingMsg.text}"
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setReportingMsg(null)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: radius.pill,
                    backgroundColor: colors.surface,
                    border: `1px solid ${colors.border}`,
                    color: colors.text,
                    cursor: 'pointer',
                    fontSize: '13px',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleReport(reportingMsg)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: radius.pill,
                    backgroundColor: colors.danger,
                    border: 'none',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '700',
                  }}
                >
                  Report
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Input Composer */}
      {user ? (
        <form
          onSubmit={send}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 12px',
            borderTop: `1px solid ${colors.border}`,
            backgroundColor: colors.card,
          }}
        >
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your message..."
            maxLength={MAX_LEN}
            style={{
              flex: 1,
              backgroundColor: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: radius.pill,
              padding: '8px 14px',
              fontSize: '16px',
              color: colors.text,
              outline: 'none',
            }}
          />
          <button
            type="submit"
            disabled={!text.trim() || sending}
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              backgroundColor: colors.accent,
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: !text.trim() || sending ? 'default' : 'pointer',
              opacity: !text.trim() || sending ? 0.5 : 1,
              flexShrink: 0,
            }}
          >
            <Send size={16} color={colors.bg} />
          </button>
        </form>
      ) : (
        <div
          style={{
            padding: '12px',
            textAlign: 'center',
            fontSize: '13px',
            color: colors.textMuted,
            borderTop: `1px solid ${colors.border}`,
            backgroundColor: colors.card,
          }}
        >
          Sign in to join the conversation
        </div>
      )}
    </div>
  );
}
