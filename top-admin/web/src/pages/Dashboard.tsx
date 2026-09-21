import { useEffect, useState } from 'react';
import { collection, doc, getCountFromServer, getDoc, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Message } from '../components/Field';

interface Stats {
  published: number;
  drafts: number;
  pending: number;
  android: number;
  ios: number;
  events: Record<string, number>;
  top: { id: string; title: string; plays: number }[];
}

const count = async (q: ReturnType<typeof query>) => (await getCountFromServer(q)).data().count;

export function Dashboard() {
  const [s, setS] = useState<Stats | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const t = collection(db, 'testimonies');
        const [published, drafts, pending, android, ios] = await Promise.all([
          count(query(t, where('isPublished', '==', true))),
          count(query(t, where('isPublished', '==', false))),
          count(query(collection(db, 'testimonySubmissions'), where('status', '==', 'pending'))),
          count(query(collection(db, 'pushTokens'), where('platform', '==', 'android'))),
          count(query(collection(db, 'pushTokens'), where('platform', '==', 'ios'))),
        ]);
        const ev = await getDocs(query(collection(db, 'analyticsEvents'), orderBy('ts', 'desc'), limit(300)));
        const events: Record<string, number> = {};
        const plays: Record<string, number> = {};
        ev.docs.forEach((d) => {
          const x = d.data();
          events[x.event] = (events[x.event] ?? 0) + 1;
          if (x.event === 'video_play' && x.params?.contentId) plays[x.params.contentId] = (plays[x.params.contentId] ?? 0) + 1;
        });
        const ranked = Object.entries(plays).sort((a, b) => b[1] - a[1]).slice(0, 5);
        const top = await Promise.all(ranked.map(async ([id, n]) => ({ id, title: ((await getDoc(doc(db, 'testimonies', id))).data()?.title as string | undefined) ?? id, plays: n })));
        setS({ published, drafts, pending, android, ios, events, top });
      } catch (e) {
        setErr((e as Error).message);
      }
    })();
  }, []);

  if (err) return <Message kind="err">{err}</Message>;
  if (!s) return <p className="muted">Loading…</p>;

  const ev = (k: string) => s.events[k] ?? 0;
  return (
    <>
      <h1>Dashboard</h1>
      <p className="muted">A quick look at the app. Activity figures cover the most recent 300 events.</p>
      <div className="grid">
        <div className="stat"><b>{s.published}</b><span>Published testimonies</span></div>
        <div className="stat"><b>{s.drafts}</b><span>Drafts</span></div>
        <div className="stat"><b>{s.pending}</b><span>Submissions to review</span></div>
        <div className="stat"><b>{s.android + s.ios}</b><span>Devices with push ({s.android} Android · {s.ios} iOS)</span></div>
      </div>
      <div className="grid">
        <div className="stat"><b>{ev('app_open')}</b><span>App opens</span></div>
        <div className="stat"><b>{ev('video_play')}</b><span>Video plays</span></div>
        <div className="stat"><b>{ev('video_complete')}</b><span>Videos finished</span></div>
        <div className="stat"><b>{ev('download_complete')}</b><span>Downloads</span></div>
        <div className="stat"><b>{ev('notification_open')}</b><span>Notification opens</span></div>
      </div>
      <div className="card">
        <h2>Most played testimonies</h2>
        {s.top.length === 0 ? <p className="muted">No plays recorded yet.</p> : (
          <table><thead><tr><th>TESTIMONY</th><th>PLAYS</th></tr></thead>
            <tbody>{s.top.map((t) => <tr key={t.id}><td>{t.title}</td><td>{t.plays}</td></tr>)}</tbody></table>
        )}
      </div>
    </>
  );
}
