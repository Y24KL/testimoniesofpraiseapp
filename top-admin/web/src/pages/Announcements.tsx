import { useEffect, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { pushEnabled, sendPush } from '../push';
import { fmtDate } from '../lib';
import type { Announcement } from '../types';
import { Check, Field, Message } from '../components/Field';

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
    if (sendPush_ && !confirm('This sends a push notification to app users now. Continue?')) return;
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
        pushNote = ` Push sent to ${r.sent} device${r.sent === 1 ? '' : 's'}.`;
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

  return (
    <>
      <h1>Announcements</h1>
      <p className="muted">Send a message to everyone who has notifications on. Testimony and live alerts are sent automatically, so you don’t need to create them here.</p>
      {err ? <Message kind="err">{err}</Message> : null}
      {ok ? <Message kind="ok">{ok}</Message> : null}
      <div className="card">
        <Field label="Type">
          <select value={type} onChange={(e) => setType(e.target.value as 'announcement' | 'featured')}>
            <option value="announcement">Announcement</option>
            <option value="featured">Featured testimony</option>
          </select>
        </Field>
        {type === 'featured' ? (
          <Field label="Testimony to open when tapped">
            <select value={contentId} onChange={(e) => setContentId(e.target.value)}>
              <option value="">Choose…</option>
              {options.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
            </select>
          </Field>
        ) : null}
        <Field label="Title"><input type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={70} /></Field>
        <Field label="Message"><textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={240} style={{ minHeight: 90 }} /></Field>
        <Check checked={sendPush_} onChange={setSendPush} label="Send as a push notification" hint="Untick to only show it inside the app’s notification list." />
        <button className="btn" disabled={busy} onClick={() => void send()}>{busy ? 'Sending…' : 'SEND'}</button>
      </div>

      <div className="card table-wrap">
        <h2>Notification feed</h2>
        {!list ? <p className="muted">Loading…</p> : list.length === 0 ? <p className="muted">Nothing yet.</p> : (
          <table><thead><tr><th>TITLE</th><th>TYPE</th><th>SENT</th><th></th></tr></thead>
            <tbody>{list.map((n) => (
              <tr key={n.id}>
                <td><b>{n.title}</b><div className="small muted">{n.message}</div></td>
                <td><span className="pill">{n.type}</span></td>
                <td className="small muted">{fmtDate(n.createdAt)}</td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn small danger" onClick={() => { if (confirm('Remove this from the app’s notification list?')) void deleteDoc(doc(db, 'notifications', n.id)); }}>Remove</button>
                  {n.published ? null : <button className="btn small ghost" onClick={() => void updateDoc(doc(db, 'notifications', n.id), { published: true })}>Show</button>}
                </td>
              </tr>
            ))}</tbody></table>
        )}
      </div>
    </>
  );
}
