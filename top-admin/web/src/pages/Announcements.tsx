import { useEffect, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { describePush, pushEnabled, sendPush } from '../push';
import { fmtDate } from '../lib';
import type { Announcement } from '../types';
import { Check, Field, Message } from '../components/Field';
import { Icon } from '../components/Icon';
import { useConfirm, useToast } from '../components/feedback';
import { EmptyState, GlassCard, LoadingList, PageHeader, SectionHeader, StatusBadge } from '../components/ui';

export function Announcements() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState<'announcement' | 'featured'>('announcement');
  const [contentId, setContentId] = useState('');
  const [sendPush_, setSendPush] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [list, setList] = useState<Announcement[] | null>(null);
  const [options, setOptions] = useState<{ id: string; title: string }[]>([]);
  const confirm = useConfirm();
  const toast = useToast();

  useEffect(
    () =>
      onSnapshot(
        query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(50)),
        (s) => setList(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Announcement, 'id'>) }))),
        (e) => setErr(e.message),
      ),
    [],
  );

  // Published testimonies that a "featured" notification can open.
  useEffect(() => {
    getDocs(query(collection(db, 'testimonies'), orderBy('createdAt', 'desc'), limit(100)))
      .then((s) => setOptions(s.docs.filter((d) => d.data().isPublished === true).map((d) => ({ id: d.id, title: (d.data().title as string) || d.id }))))
      .catch(() => undefined);
  }, []);

  const send = async () => {
    setErr(''); setOk('');
    if (!title.trim() || !message.trim()) return setErr('Please enter a title and a message.');
    if (type === 'featured' && !contentId) return setErr('Choose which testimony to feature.');
    if (sendPush_ && !(await confirm({ title: 'Send this push notification now?', message: `“${title.trim()}” goes to every app user who has announcements turned on.`, confirmLabel: 'Send now' }))) return;
    setBusy(true);
    try {
      let pushNote = '';
      if (sendPush_ && pushEnabled) {
        const r = await sendPush({ pref: 'announcements', title: title.trim(), body: message.trim(), data: { type, ...(type === 'featured' ? { contentId } : {}) } });
        if (!r.ok) {
          setErr(`The push notification failed: ${r.error}. Nothing was saved. Try again.`);
          setBusy(false);
          return;
        }
        pushNote = ` ${describePush(r)}`;
      } else if (sendPush_) {
        pushNote = ' (Push isn’t set up, so it was added to the in-app list only.)';
      }
      await addDoc(collection(db, 'notifications'), {
        title: title.trim(),
        message: message.trim(),
        type,
        ...(type === 'featured' ? { contentId } : {}),
        published: true,
        skipPush: true, // the push is sent by the portal, not by a server function
        createdAt: serverTimestamp(),
      });
      setTitle(''); setMessage(''); setContentId('');
      setOk(`Added to the app’s notification list.${pushNote}`);
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  };

  const remove = async (n: Announcement) => {
    if (!(await confirm({ title: 'Remove this notification?', message: `“${n.title}” is removed from the app’s notification list. Push messages already delivered stay on people’s phones.`, confirmLabel: 'Remove', danger: true }))) return;
    try {
      await deleteDoc(doc(db, 'notifications', n.id));
      toast.ok('Removed from the notification list.');
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const show = async (n: Announcement) => {
    try {
      await updateDoc(doc(db, 'notifications', n.id), { published: true });
      toast.ok('Now shown in the app.');
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const counter = (v: string, max: number) => <span className={`char-count ${v.length > max * 0.9 ? 'near' : ''}`}>{v.length}/{max}</span>;
  const now = new Date();

  return (
    <>
      <PageHeader
        eyebrow="Communication"
        title="Announcements"
        sub="Send a message to everyone who has notifications on. Testimony and live alerts are sent automatically, so you don’t need to create them here."
      />
      {err ? <Message kind="err">{err}</Message> : null}
      {ok ? <Message kind="ok">{ok}</Message> : null}
      {!pushEnabled ? <Message kind="warn">Push isn’t configured for this portal (VITE_PUSH_URL), so announcements go to the in-app list only.</Message> : null}

      <GlassCard>
        <SectionHeader icon="send" title="Compose" hint="Keep it short: phones cut long titles." />
        <div className="compose">
          <div>
            <Field label="Type">
              <select value={type} onChange={(e) => setType(e.target.value as 'announcement' | 'featured')}>
                <option value="announcement">Announcement</option>
                <option value="featured">Featured testimony</option>
              </select>
            </Field>
            {type === 'featured' ? (
              <Field label="Testimony to open when tapped" hint={options.length === 0 ? 'No published testimonies found yet.' : undefined}>
                <select value={contentId} onChange={(e) => setContentId(e.target.value)}>
                  <option value="">Choose…</option>
                  {options.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
                </select>
              </Field>
            ) : null}
            <label className="f">
              <span>Title {counter(title, 70)}</span>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={70} placeholder="e.g. Join us live this Sunday" />
            </label>
            <label className="f">
              <span>Message {counter(message, 240)}</span>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={240} style={{ minHeight: 100 }} placeholder="What should people know?" />
            </label>
            <Check checked={sendPush_} onChange={setSendPush} label="Send as a push notification" hint="Untick to only show it inside the app’s notification list." />
            <button type="button" className="btn primary" disabled={busy} onClick={() => void send()}>
              {busy ? <span className="spin sm" aria-hidden="true" /> : <Icon name="send" size={16} />}
              {busy ? 'Sending…' : sendPush_ ? 'Send announcement' : 'Add to notification list'}
            </button>
          </div>
          <div className="phone" aria-label="Preview of the notification on a phone">
            <div className="screen">
              <div className="clock">{now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</div>
              <div className="date">{now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
              <div className="push-card">
                <img src="/logo.png" alt="" />
                <div style={{ minWidth: 0 }}>
                  <div className="app"><span>Testimonies of Praise</span><span>now</span></div>
                  <div className="pt">{title.trim() || 'Your title'}</div>
                  <div className="pb">{message.trim() || 'Your message appears here.'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </GlassCard>

      <GlassCard className="table-card">
        <div style={{ padding: '20px 24px 0' }}>
          <SectionHeader icon="bell" title="Notification feed" hint="The latest 50 items in the app’s notification list" />
        </div>
        {!list ? (
          <div style={{ padding: 20 }}><LoadingList rows={4} /></div>
        ) : list.length === 0 ? (
          <EmptyState icon="bell" title="Nothing sent yet">Announcements and automatic alerts appear here.</EmptyState>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Title</th><th>Type</th><th>Sent</th><th aria-label="Actions"></th></tr></thead>
              <tbody>
                {list.map((n) => (
                  <tr key={n.id}>
                    <td><b>{n.title}</b><div className="small muted">{n.message}</div></td>
                    <td><StatusBadge kind={n.published ? 'info' : 'draft'} plain>{n.type}{n.published ? '' : ' · hidden'}</StatusBadge></td>
                    <td className="small muted nowrap">{fmtDate(n.createdAt)}</td>
                    <td>
                      <div className="row-actions">
                        {n.published ? null : <button type="button" className="btn small ghost" onClick={() => void show(n)}><Icon name="eye" size={14} />Show</button>}
                        <button type="button" className="btn small danger" onClick={() => void remove(n)}><Icon name="trash" size={14} />Remove</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </>
  );
}
