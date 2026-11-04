import { useEffect, useState } from 'react';
import { collection, doc, getCountFromServer, getDoc, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Message } from '../components/Field';
import type { Route } from '../types';

interface Stats {
  users: number;
  published: number;
  drafts: number;
  pending: number;
  writtenPublished: number;
  resources: number;
  videos: number;
  android: number;
  ios: number;
  isLive: boolean;
  events: Record<string, number>;
  top: { id: string; title: string; plays: number }[];
  recent: { id: string; title: string; type: string }[];
}

const count = async (q: ReturnType<typeof query>) => (await getCountFromServer(q)).data().count;

/** A count or list that may be blocked by rules or missing indexes. A failure shows as zero, not a broken page. */
async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

const QUICK_ACTIONS: { label: string; route: Route }[] = [
  { label: 'Add a testimony', route: { name: 'editor' } as Route },
  { label: 'Go live', route: { name: 'live' } },
  { label: 'Add a LoveWorld video', route: { name: 'singers' } },
  { label: 'Write an article', route: { name: 'articles' } },
  { label: 'Send an announcement', route: { name: 'announcements' } },
  { label: 'Publish a promotion', route: { name: 'promotions' } },
];

export function Dashboard({ go }: { go: (r: Route) => void }) {
  const [s, setS] = useState<Stats | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const t = collection(db, 'testimonies');
        const [users, published, drafts, pending, writtenPublished, resources, videos, android, ios, live] = await Promise.all([
          safe(() => count(query(collection(db, 'users'))), 0),
          count(query(t, where('isPublished', '==', true))),
          count(query(t, where('isPublished', '==', false))),
          count(query(collection(db, 'testimonySubmissions'), where('status', '==', 'pending'))),
          safe(() => count(query(collection(db, 'writtenTestimonies'), where('isPublished', '==', true))), 0),
          safe(() => count(query(collection(db, 'adotopocResources'))), 0),
          safe(() => count(query(collection(db, 'loveworldSingersVideos'))), 0),
          count(query(collection(db, 'pushTokens'), where('platform', '==', 'android'))),
          count(query(collection(db, 'pushTokens'), where('platform', '==', 'ios'))),
          safe(() => getDoc(doc(db, 'settings', 'live')), null),
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
        const top = await Promise.all(
          ranked.map(async ([id, n]) => ({ id, title: ((await getDoc(doc(db, 'testimonies', id))).data()?.title as string | undefined) ?? id, plays: n })),
        );
        const recentSnap = await safe(() => getDocs(query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(5))), null);
        const recent = recentSnap
          ? recentSnap.docs.map((d) => ({ id: d.id, title: String(d.data().title ?? 'Notification'), type: String(d.data().type ?? '') }))
          : [];
        setS({
          users,
          published,
          drafts,
          pending,
          writtenPublished,
          resources,
          videos,
          android,
          ios,
          isLive: live?.exists() ? live.data()?.isLive === true : false,
          events,
          top,
          recent,
        });
      } catch (e) {
        setErr((e as Error).message);
      }
    })();
  }, []);

  if (err) return <Message kind="err">{err}</Message>;
  if (!s) return <p className="muted">Loading…</p>;

  const ev = (k: string) => s.events[k] ?? 0;
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <>
      <h1>Dashboard</h1>
      <p className="muted">{today}. Figures come from the app's data; activity covers the most recent 300 events.</p>

      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <b>Live stream</b>
          <div className="small muted">{s.isLive ? 'On air now' : 'Off air'}</div>
        </div>
        <button className="btn ghost" onClick={() => go({ name: 'live' } as Route)}>Open live stream</button>
      </div>

      <div className="grid">
        <div className="stat"><b>{s.users}</b><span>Registered users</span></div>
        <div className="stat"><b>{s.published + s.drafts}</b><span>Testimonies ({s.published} published · {s.drafts} drafts)</span></div>
        <div className="stat"><b>{s.pending}</b><span>Pending submissions</span></div>
        <div className="stat"><b>{s.writtenPublished}</b><span>Published written testimonies</span></div>
        <div className="stat"><b>{s.videos}</b><span>LoveWorld Singers videos</span></div>
        <div className="stat"><b>{s.resources}</b><span>ADOTOPOC resources</span></div>
        <div className="stat"><b>{s.android + s.ios}</b><span>Devices with push ({s.android} Android · {s.ios} iOS)</span></div>
      </div>

      <div className="card">
        <h2>Quick actions</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {QUICK_ACTIONS.map((a) => (
            <button key={a.label} className="btn ghost" onClick={() => go(a.route)}>{a.label}</button>
          ))}
        </div>
      </div>

      <div className="grid">
        <div className="stat"><b>{ev('app_open')}</b><span>App opens</span></div>
        <div className="stat"><b>{ev('video_play')}</b><span>Video plays</span></div>
        <div className="stat"><b>{ev('video_complete')}</b><span>Videos finished</span></div>
        <div className="stat"><b>{ev('download_complete')}</b><span>Downloads</span></div>
        <div className="stat"><b>{ev('notification_open')}</b><span>Notification opens</span></div>
      </div>

      <div className="card">
        <h2>Recent activity</h2>
        {s.recent.length === 0 ? <p className="muted">No recent notifications.</p> : (
          <table><thead><tr><th>NOTIFICATION</th><th>TYPE</th></tr></thead>
            <tbody>{s.recent.map((r) => <tr key={r.id}><td>{r.title}</td><td>{r.type || '—'}</td></tr>)}</tbody></table>
        )}
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
