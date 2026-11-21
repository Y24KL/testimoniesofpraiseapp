import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './Icon';
import { Message as Notice } from './Field';
import { BUILT_IN_TEMPLATES, fillTemplate, type MessageTemplate } from '../messageTemplates';
import {
  ACTION_DESTINATIONS, CATEGORY_LABELS, authDetails, displayName, getUserCard, newMessageKey, sendMessage,
  type MessageAction, type Related, type SupportCategory, type UserCard,
} from '../support';

export interface ComposerContext {
  category: SupportCategory;
  related?: Related | null;
  /** Values for template placeholders, e.g. { groupName, songTitle }. */
  values?: Record<string, string | undefined>;
  /** Pre-selected template id. */
  templateId?: string;
}

const ROUTE_PATTERN = /^[a-z]+(?:\/[A-Za-z0-9_-]{1,100}){0,2}$/;

/**
 * Write a private message to one user: pick a template or write freely, add an optional action button,
 * preview it as the user will see it, review, then send. A new conversation needs a subject and category;
 * a follow-up (threadId) only needs the message. Sending is idempotent: the key is made once per message.
 */
export function MessageComposer({ uid, threadId, context, onClose, onSent }: {
  uid: string;
  threadId?: string;
  context?: ComposerContext;
  onClose: () => void;
  onSent: (threadId: string) => void;
}) {
  const [user, setUser] = useState<UserCard | null>(null);
  const [category, setCategory] = useState<SupportCategory>(context?.category ?? 'general');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [withAction, setWithAction] = useState(false);
  const [actionLabel, setActionLabel] = useState('');
  const [actionKind, setActionKind] = useState<'route' | 'url'>('route');
  const [actionRoute, setActionRoute] = useState('choir');
  const [actionUrl, setActionUrl] = useState('');
  const [step, setStep] = useState<'compose' | 'review'>('compose');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const key = useRef(newMessageKey());

  useEffect(() => {
    let live = true;
    void getUserCard(uid).then(async (card) => {
      const auth = await authDetails([uid]).catch(() => new Map());
      if (live) setUser({ ...card, ...(auth.get(uid) ?? {}) });
    });
    return () => { live = false; };
  }, [uid]);

  const values = useMemo(() => ({ name: user?.fullName?.split(/\s+/)[0], ...(context?.values ?? {}) }), [user, context]);
  const templates = BUILT_IN_TEMPLATES.filter((t) => t.category === category || (category === 'written_testimony' && t.category === 'testimony'));

  const applyTemplate = (t: MessageTemplate | undefined) => {
    if (!t) return;
    if (!threadId) setSubject(t.subject);
    setBody(fillTemplate(t.body, values));
    if (t.action) {
      setWithAction(true);
      setActionLabel(t.action.label);
      if (t.action.route) { setActionKind('route'); setActionRoute(t.action.route); }
      if (t.action.url) { setActionKind('url'); setActionUrl(t.action.url); }
    }
  };

  // Pre-fill once the recipient's name is known, so {name} is filled in.
  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current || !user || !context?.templateId) return;
    prefilled.current = true;
    applyTemplate(BUILT_IN_TEMPLATES.find((t) => t.id === context.templateId));
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const action: MessageAction | null = withAction ? (actionKind === 'route' ? { label: actionLabel.trim(), route: actionRoute.trim() } : { label: actionLabel.trim(), url: actionUrl.trim() }) : null;

  const problem = (): string => {
    if (!threadId && !subject.trim()) return 'Add a subject.';
    if (subject.length > 120) return 'Keep the subject under 120 characters.';
    if (!body.trim()) return 'Write the message.';
    if (body.length > 4000) return 'Keep the message under 4,000 characters.';
    if (action) {
      if (!action.label) return 'Give the button a label.';
      if (action.label.length > 40) return 'Keep the button label under 40 characters.';
      if (action.route !== undefined && !ROUTE_PATTERN.test(action.route)) return 'Choose a screen for the button.';
      if (action.url !== undefined && !/^https:\/\/[^\s@/]+\.[^\s]+$/.test(action.url)) return 'Button links must start with https://';
    }
    return '';
  };

  const send = async () => {
    setSending(true);
    setErr('');
    try {
      const r = await sendMessage({
        uid,
        clientMessageId: key.current,
        ...(threadId ? { threadId } : { subject: subject.trim(), category, related: context?.related ?? null }),
        body: body.trim(),
        action,
      });
      onSent(r.threadId);
    } catch (e) {
      setErr((e as Error).message);
      setSending(false);
    }
  };

  const destinationLabel = action?.route ? ACTION_DESTINATIONS.find((d) => d.route === action.route)?.label ?? `App screen: ${action.route}` : action?.url;

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !sending) onClose(); }}>
      <div className="modal composer" role="dialog" aria-modal="true" aria-labelledby="composer-title">
        <div className="composer-head">
          <h2 id="composer-title">{step === 'review' ? 'Review before sending' : threadId ? 'Reply' : 'New message'}</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose} disabled={sending}><Icon name="x" /></button>
        </div>

        <div className="recipient-card">
          <div className="avatar">{(user?.fullName ?? '?').charAt(0).toUpperCase()}</div>
          <div style={{ minWidth: 0 }}>
            <b>{user ? displayName(user) : 'Loading…'}</b>
            <div className="small muted">{user?.email ?? 'Email not available'}{user?.church ? ` · ${user.church}` : ''}{user?.zone ? ` · ${user.zone}` : ''}</div>
            <div className="small muted"><code>{uid}</code>{context?.related?.label ? ` · ${context.related.label}` : ''}</div>
          </div>
        </div>

        {err ? <Notice kind="err">{err}</Notice> : null}

        {step === 'compose' ? (
          <>
            {!threadId ? (
              <div className="two">
                <label className="f">
                  <span>Category</span>
                  <select value={category} onChange={(e) => setCategory(e.target.value as SupportCategory)}>
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </label>
                <label className="f">
                  <span>Template</span>
                  <select value="" onChange={(e) => applyTemplate(templates.find((t) => t.id === e.target.value))}>
                    <option value="">{templates.length ? 'Choose a template…' : 'No templates for this category'}</option>
                    {templates.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </label>
              </div>
            ) : (
              <label className="f">
                <span>Template</span>
                <select value="" onChange={(e) => applyTemplate(BUILT_IN_TEMPLATES.find((t) => t.id === e.target.value))}>
                  <option value="">Choose a template…</option>
                  {BUILT_IN_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{CATEGORY_LABELS[t.category]}: {t.label}</option>)}
                </select>
              </label>
            )}
            {!threadId ? (
              <label className="f">
                <span>Subject</span>
                <input type="text" value={subject} maxLength={120} onChange={(e) => setSubject(e.target.value)} placeholder="Action Required – Choir Feature Request" />
              </label>
            ) : null}
            <label className="f">
              <span>Message <span className="muted small">({body.length.toLocaleString()} / 4,000)</span></span>
              <textarea value={body} maxLength={4000} onChange={(e) => setBody(e.target.value)} style={{ minHeight: 180 }} placeholder="Write your message. Leave a blank line between paragraphs." />
            </label>

            <div className="action-config">
              <label className="check-row">
                <input type="checkbox" checked={withAction} onChange={(e) => setWithAction(e.target.checked)} />
                <span>Add an action button</span>
              </label>
              {withAction ? (
                <div className="two">
                  <label className="f">
                    <span>Button label</span>
                    <input type="text" value={actionLabel} maxLength={40} onChange={(e) => setActionLabel(e.target.value)} placeholder="Update submission" />
                  </label>
                  <label className="f">
                    <span>Goes to</span>
                    <select value={actionKind === 'url' ? '__url' : actionRoute} onChange={(e) => (e.target.value === '__url' ? setActionKind('url') : (setActionKind('route'), setActionRoute(e.target.value)))}>
                      {ACTION_DESTINATIONS.map((d) => <option key={d.route} value={d.route}>{d.label}</option>)}
                      <option value="__url">A web page (https://)</option>
                    </select>
                  </label>
                  {actionKind === 'url' ? (
                    <label className="f" style={{ gridColumn: '1 / -1' }}>
                      <span>Web address</span>
                      <input type="url" value={actionUrl} onChange={(e) => setActionUrl(e.target.value)} placeholder="https://" />
                    </label>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="small muted" style={{ margin: '12px 0 6px' }}>Preview: how it appears in the app</div>
            <MessagePreview subject={threadId ? undefined : subject} body={body} action={action} />

            <div className="modal-actions" style={{ marginTop: 16 }}>
              <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
              <button type="button" className="btn primary" onClick={() => { const p = problem(); if (p) setErr(p); else { setErr(''); setStep('review'); } }}>
                <Icon name="eye" size={16} />Review
              </button>
            </div>
          </>
        ) : (
          <>
            <dl className="review-list">
              <dt>To</dt><dd>{user ? displayName(user) : uid}{user?.email ? ` (${user.email})` : ''}</dd>
              {!threadId ? (<><dt>Subject</dt><dd>{subject}</dd><dt>Category</dt><dd>{CATEGORY_LABELS[category]}</dd></>) : null}
              {context?.related ? (<><dt>About</dt><dd>{context.related.label || context.related.id}</dd></>) : null}
              {action ? (<><dt>Button</dt><dd>“{action.label}” → {destinationLabel}</dd></>) : null}
              <dt>Push notification</dt><dd>“Message from Testimonies of Praise”. The message itself is not shown on the lock screen.</dd>
            </dl>
            <MessagePreview subject={threadId ? undefined : subject} body={body} action={action} />
            <div className="modal-actions" style={{ marginTop: 16 }}>
              <button type="button" className="btn ghost" onClick={() => setStep('compose')} disabled={sending}><Icon name="arrowLeft" size={16} />Edit</button>
              <button type="button" className="btn primary" onClick={() => void send()} disabled={sending}>
                {sending ? <span className="spin sm" aria-hidden="true" /> : <Icon name="send" size={16} />}{sending ? 'Sending…' : 'Send message'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** The message as the user will see it: support-team bubble, paragraphs, and the action button. */
export function MessagePreview({ subject, body, action }: { subject?: string; body: string; action: MessageAction | null }) {
  return (
    <div className="msg-preview">
      <div className="msg-sender"><img src="/logo.png" alt="" /> Testimonies of Praise Support Team</div>
      {subject ? <div className="msg-subject">{subject}</div> : null}
      <div className="bubble admin">
        {body.trim() ? body.trim().split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>) : <p className="muted">Your message will appear here.</p>}
        {action?.label ? <span className="msg-action">{action.label}<Icon name="chevronRight" size={14} /></span> : null}
      </div>
    </div>
  );
}
