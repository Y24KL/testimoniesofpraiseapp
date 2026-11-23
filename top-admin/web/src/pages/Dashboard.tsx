import { useCallback, useEffect, useState } from 'react';
import { collection, doc, getCountFromServer, getDoc, getDocs, limit, onSnapshot, orderBy, query, where, type Query, type Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import type { Route } from '../types';
import { QUICK_ACTIONS } from '../nav';
import { usePendingCounts } from '../hooks/usePendingCounts';
import { Icon, type IconName } from '../components/Icon';
import { ViewerCount } from '../components/ViewerCount';
import { BarChart, Donut, EmptyState, ErrorState, GlassCard, LoadingList, PageHeader, SectionHeader, StatCard, StatusBadge, type Metric } from '../components/ui';

/* The dashboard reads live figures straight from Firestore. Every widget loads and fails on its own,
   so one blocked query never hides the rest, and a failed count reads "Unavailable", never zero. */

const SAMPLE = 300;
const LOADING: Metric = { state: 'loading' };

async function countOf(q: Query): Promise<Metric> {
  try {
    return { state: 'ready', value: (await getCountFromServer(q)).data().count };
  } catch (e) {
    return { state: 'error', message: (e as Error).message };
  }
}

type CardKey = 'users' | 'total' | 'published' | 'drafts' | 'pending' | 'written' | 'singers' | 'resources' | 'android' | 'ios';
const CARDS: { key: CardKey; label: string; icon: IconName; note: string; gold?: boolean; q: () => Query }[] = [
  { key: 'users', label: 'Registered Users', icon: 'users', note: 'Accounts in the users collection', gold: true, q: () => query(collection(db, 'users')) },
  { key: 'total', label: 'Total Video Testimonies', icon: 'video', note: 'Published and drafts', q: () => query(collection(db, 'testimonies')) },
  { key: 'published', label: 'Published', icon: 'checkCircle', note: 'Visible in the app', q: () => query(collection(db, 'testimonies'), where('isPublished', '==', true)) },
  { key: 'drafts', label: 'Drafts', icon: 'edit', note: 'Not yet published', q: () => query(collection(db, 'testimonies'), where('isPublished', '==', false)) },
  { key: 'pending', label: 'Pending Submissions', icon: 'inbox', note: 'Awaiting review', gold: true, q: () => query(collection(db, 'testimonySubmissions'), where('status', '==', 'pending')) },
  { key: 'written', label: 'Published Written', icon: 'fileText', note: 'Written testimonies live', q: () => query(collection(db, 'writtenTestimonies'), where('isPublished', '==', true)) },
  { key: 'singers', label: 'LoveWorld Singers Videos', icon: 'mic', note: 'All videos in the library', q: () => query(collection(db, 'loveworldSingersVideos')) },
  { key: 'resources', label: 'ADOTOPOC Resources', icon: 'globe', note: 'Resource centre items', q: () => query(collection(db, 'adotopocResources')) },
  { key: 'android', label: 'Android Push Devices', icon: 'smartphone', note: 'Registered for notifications', q: () => query(collection(db, 'pushTokens'), where('platform', '==', 'android')) },
  { key: 'ios', label: 'iOS Push Devices', icon: 'smartphone', note: 'Registered for notifications', q: () => query(collection(db, 'pushTokens'), where('platform', '==', 'ios')) },
];
const ALL_LOADING = Object.fromEntries(CARDS.map((c) => [c.key, LOADING])) as Record<CardKey, Metric>;

const EVENTS: { key: string; label: string }[] = [
  { key: 'app_open', label: 'App opens' },
  { key: 'video_play', label: 'Video plays' },
  { key: 'video_complete', label: 'Videos finished' },
  { key: 'download_complete', label: 'Downloads' },
  { key: 'notification_open', label: 'Notification opens' },
];

interface Analytics {
  size: number;
  from: Date | null;
  to: Date | null;
  events: Record<string, number>;
  platforms: Record<string, number>;
  top: { id: string; title: string; thumbnail: string; plays: number; missing: boolean }[];
}
type Load<T> = { state: 'loading' } | { state: 'ready'; data: T } | { state: 'error'; message: string };

interface LiveDoc { isLive?: boolean; title?: string; thumbnail?: string; sourceType?: string; sessionId?: string; preLiveEnabled?: boolean; updatedAt?: Timestamp }
interface Activity { id: string; title: string; message: string; type: string; at: Date | null }

const toDate = (t: unknown): Date | null => (t && typeof (t as Timestamp).toDate === 'function' ? (t as Timestamp).toDate() : null);

function ago(d: Date | null): string {
  if (!d) return '';
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const days = Math.round(h / 24);
  return days < 7 ? `${days} d ago` : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

const TYPE_ICON: Record<string, IconName> = { testimony: 'video', live: 'radioTower', article: 'newspaper', choir: 'users', announcement: 'send', written: 'fileText', singers: 'mic', promotion: 'megaphone' };

async function loadAnalytics(): Promise<Analytics> {
  const snap = await getDocs(query(collection(db, 'analyticsEvents'), orderBy('ts', 'desc'), limit(SAMPLE)));
  const events: Record<string, number> = {};
  const platforms: Record<string, number> = {};
  const plays: Record<string, number> = {};
  let from: Date | null = null;
  let to: Date | null = null;
  snap.docs.forEach((d) => {
    const x = d.data();
    events[x.event] = (events[x.event] ?? 0) + 1;
    if (x.platform) platforms[x.platform] = (platforms[x.platform] ?? 0) + 1;
    const id = x.params?.contentId;
    if (x.event === 'video_play' && typeof id === 'string' && id) plays[id] = (plays[id] ?? 0) + 1;
    const at = toDate(x.ts);
    if (at) {
      if (!to || at > to) to = at;
      if (!from || at < from) from = at;
    }
  });
  const ranked = Object.entries(plays).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const top = await Promise.all(
    ranked.map(async ([id, n]) => {
      try {
        const t = await getDoc(doc(db, 'testimonies', id));
        return { id, title: String(t.data()?.title ?? id), thumbnail: String(t.data()?.thumbnail ?? ''), plays: n, missing: !t.exists() };
      } catch {
        return { id, title: id, thumbnail: '', plays: n, missing: false };
      }
    }),
  );
  return { size: snap.size, from, to, events, platforms, top };
}

async function loadActivity(): Promise<Activity[]> {
  const snap = await getDocs(query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(6)));
  return snap.docs.map((d) => {
    const x = d.data();
    return { id: d.id, title: String(x.title ?? 'Notification'), message: String(x.message ?? ''), type: String(x.type ?? ''), at: toDate(x.createdAt) };
  });
}

const PENDING_TASKS: { key: 'submissions' | 'choirRequests' | 'feedback' | 'sponsorships' | 'reports'; label: string; icon: IconName; route: Route }[] = [
  { key: 'submissions', label: 'Testimony submissions to review', icon: 'inbox', route: { name: 'submissions' } },
  { key: 'choirRequests', label: 'Choir feature requests', icon: 'userPlus', route: { name: 'choirRequests' } },
  { key: 'reports', label: 'Open content reports', icon: 'flag', route: { name: 'reports' } },
  { key: 'feedback', label: 'New user feedback', icon: 'messageCircle', route: { name: 'userFeedback' } },
  { key: 'sponsorships', label: 'Sponsorship receipts to verify', icon: 'heart', route: { name: 'sponsorships' } },
];

export function Dashboard({ go }: { go: (r: Route) => void }) {
  const pending = usePendingCounts();
  const [cards, setCards] = useState<Record<CardKey, Metric>>(ALL_LOADING);
  const [analytics, setAnalytics] = useState<Load<Analytics>>({ state: 'loading' });
  const [activity, setActivity] = useState<Load<Activity[]>>({ state: 'loading' });
  const [live, setLive] = useState<Load<LiveDoc | null>>({ state: 'loading' });
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    setCards(ALL_LOADING);
    setAnalytics({ state: 'loading' });
    setActivity({ state: 'loading' });
    const counts = Promise.all(CARDS.map(async (c) => [c.key, await countOf(c.q())] as const)).then((entries) => setCards(Object.fromEntries(entries) as Record<CardKey, Metric>));
    const an = loadAnalytics().then(
      (data) => setAnalytics({ state: 'ready', data }),
      (e: Error) => setAnalytics({ state: 'error', message: e.message }),
    );
    const ac = loadActivity().then(
      (data) => setActivity({ state: 'ready', data }),
      (e: Error) => setActivity({ state: 'error', message: e.message }),
    );
    await Promise.allSettled([counts, an, ac]);
    setRefreshedAt(new Date());
    setBusy(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // The live monitor follows the broadcast in real time.
  useEffect(
    () =>
      onSnapshot(
        doc(db, 'settings', 'live'),
        (s) => setLive({ state: 'ready', data: s.exists() ? (s.data() as LiveDoc) : null }),
        (e) => setLive({ state: 'error', message: e.message }),
      ),
    [],
  );

  const refresh = () => {
    pending.refresh();
    void load();
  };

  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const android = cards.android;
  const ios = cards.ios;

  return (
    <>
      <PageHeader
        eyebrow={today}
        title="Welcome back, Administrator"
        sub="Here's what's happening across Testimonies of Praise today."
        actions={
          <>
            <span className="small muted" aria-live="polite">
              {refreshedAt ? `Last refreshed ${refreshedAt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}` : 'Loading…'}
            </span>
            <button type="button" className="btn ghost" onClick={refresh} disabled={busy}>
              <Icon name="refresh" size={16} className={busy ? 'spinning' : undefined} />
              {busy ? 'Refreshing…' : 'Refresh'}
            </button>
          </>
        }
      />

      <div className="stat-grid">
        {CARDS.map((c) => (
          <StatCard key={c.key} icon={c.icon} label={c.label} metric={cards[c.key]} note={c.note} gold={c.gold} />
        ))}
      </div>

      <LiveMonitor live={live} open={() => go({ name: 'live' })} />

      <div className="split">
        <GlassCard>
          <SectionHeader
            icon="activity"
            title="App activity"
            hint={
              analytics.state === 'ready' && analytics.data.from && analytics.data.to
                ? `${analytics.data.from.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} – ${analytics.data.to.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
                : undefined
            }
            actions={<span className="sample-note"><Icon name="info" size={13} />Sample of the latest {SAMPLE} events{analytics.state === 'ready' && analytics.data.size < SAMPLE ? ` (${analytics.data.size} recorded)` : ''}</span>}
          />
          {analytics.state === 'loading' ? <LoadingList rows={3} /> : null}
          {analytics.state === 'error' ? <ErrorState title="Couldn't load activity" message={analytics.message} onRetry={refresh} /> : null}
          {analytics.state === 'ready' ? (
            <BarChart rows={EVENTS.map((e) => ({ label: e.label, value: analytics.data.events[e.key] ?? 0 }))} empty="No app activity has been recorded yet." />
          ) : null}
        </GlassCard>

        <GlassCard>
          <SectionHeader icon="smartphone" title="Push-enabled devices" hint="Devices registered for notifications, by platform" />
          {android.state === 'ready' && ios.state === 'ready' ? (
            <Donut
              centre="devices"
              segments={[
                { label: 'Android', value: android.value, color: '#3DDC97' },
                { label: 'iOS', value: ios.value, color: '#F5C542' },
              ]}
            />
          ) : android.state === 'error' || ios.state === 'error' ? (
            <ErrorState title="Device counts unavailable" message={android.state === 'error' ? android.message : ios.state === 'error' ? ios.message : ''} onRetry={refresh} />
          ) : (
            <LoadingList rows={2} />
          )}
        </GlassCard>
      </div>

      <div className="split">
        <GlassCard>
          <SectionHeader icon="trendingUp" title="Most played testimonies" hint={`From video plays in the latest ${SAMPLE} events`} />
          {analytics.state === 'loading' ? <LoadingList rows={4} /> : null}
          {analytics.state === 'error' ? <ErrorState title="Couldn't load plays" message={analytics.message} onRetry={refresh} /> : null}
          {analytics.state === 'ready' && analytics.data.top.length === 0 ? <EmptyState icon="play" title="No plays recorded yet">Plays appear here once people start watching.</EmptyState> : null}
          {analytics.state === 'ready' && analytics.data.top.length > 0 ? (
            <div className="rank-list">
              {analytics.data.top.map((t, i) => (
                <div key={t.id} className="rank-item">
                  <span className="rank-no">{i + 1}</span>
                  {t.thumbnail ? <img className="rank-thumb" src={t.thumbnail} alt="" loading="lazy" /> : <span className="rank-thumb" aria-hidden="true" />}
                  <div className="rank-body">
                    <div className="t" title={t.title}>
                      {t.missing ? <span className="muted">Removed testimony ({t.id})</span> : t.title}
                    </div>
                    <div className="bar" aria-hidden="true"><i style={{ width: `${(t.plays / analytics.data.top[0].plays) * 100}%` }} /></div>
                  </div>
                  <div className="row gap" style={{ gap: 8 }}>
                    <b className="tabular">{t.plays}</b>
                    <span className="small muted">plays</span>
                    {!t.missing ? (
                      <button type="button" className="icon-btn small" aria-label={`Open ${t.title}`} onClick={() => go({ name: 'editor', id: t.id })}>
                        <Icon name="external" size={15} />
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </GlassCard>

        <GlassCard>
          <SectionHeader icon="checkCircle" title="Pending tasks" hint="Items waiting for an admin" />
          <div className="stack-sm">
            {PENDING_TASKS.map((t) => {
              const m = pending.counts[t.key];
              const has = m.state === 'ready' && m.value > 0;
              return (
                <button key={t.key} type="button" className={`task-link ${has ? 'has' : ''}`} onClick={() => go(t.route)}>
                  <Icon name={t.icon} size={18} />
                  <span>{t.label}</span>
                  <span className="n">
                    {m.state === 'loading' ? <span className="skeleton" style={{ width: 24, height: 18, display: 'inline-block' }} /> : m.state === 'error' ? <span className="small" style={{ color: 'var(--danger)' }} title={m.message}>Unavailable</span> : m.value}
                  </span>
                </button>
              );
            })}
          </div>
        </GlassCard>
      </div>

      <div className="split">
        <GlassCard>
          <SectionHeader icon="bell" title="Recent activity" hint="Latest notifications published to the app" actions={<button type="button" className="btn ghost small" onClick={() => go({ name: 'announcements' })}>View all</button>} />
          {activity.state === 'loading' ? <LoadingList rows={4} /> : null}
          {activity.state === 'error' ? <ErrorState title="Couldn't load recent activity" message={activity.message} onRetry={refresh} /> : null}
          {activity.state === 'ready' && activity.data.length === 0 ? <EmptyState icon="bell" title="Nothing published yet">New testimonies, live alerts and announcements appear here.</EmptyState> : null}
          {activity.state === 'ready' && activity.data.length > 0 ? (
            <div className="list">
              {activity.data.map((a) => (
                <div key={a.id} className="list-item">
                  <span className="ic"><Icon name={TYPE_ICON[a.type] ?? 'bell'} size={16} /></span>
                  <div className="body">
                    <div className="t">{a.title}</div>
                    <div className="s">{a.message || a.type || 'Notification'}</div>
                  </div>
                  <span className="small muted nowrap">{ago(a.at)}</span>
                </div>
              ))}
            </div>
          ) : null}
        </GlassCard>

        <GlassCard>
          <SectionHeader icon="zap" title="Quick actions" />
          <div className="quick-grid">
            {QUICK_ACTIONS.map((a) => (
              <button key={a.label} type="button" className="quick-btn" onClick={() => go(a.route)}>
                <span className="ic"><Icon name={a.icon} size={18} /></span>
                {a.label}
              </button>
            ))}
          </div>
        </GlassCard>
      </div>
    </>
  );
}

function LiveMonitor({ live, open }: { live: Load<LiveDoc | null>; open: () => void }) {
  const d = live.state === 'ready' ? live.data : null;
  const on = d?.isLive === true;
  return (
    <GlassCard className={`live-panel ${on ? 'on' : ''}`} aria-label="Live stream monitor">
      <div className="stack">
        <div className="row gap">
          {live.state === 'loading' ? <span className="skeleton" style={{ width: 110, height: 30 }} /> : null}
          {live.state === 'error' ? <StatusBadge kind="bad">Status unavailable</StatusBadge> : null}
          {live.state === 'ready' ? (
            <span className={`on-air ${on ? 'live' : 'off'}`}><span className="pulse" />{on ? 'ON AIR' : 'OFF AIR'}</span>
          ) : null}
          {on && d?.sessionId ? <ViewerCount sessionId={d.sessionId} /> : null}
          {!on && d?.preLiveEnabled ? <StatusBadge kind="info">Pre-live video playing</StatusBadge> : null}
        </div>
        <div>
          <h2 style={{ margin: '0 0 4px' }}>{d?.title?.trim() || (on ? 'Live broadcast' : 'Live stream')}</h2>
          <p className="muted small" style={{ margin: 0 }}>
            {live.state === 'error'
              ? `Couldn't read the live status: ${live.message}`
              : on
                ? `Streaming now${d?.sourceType && d.sourceType !== 'unknown' ? ` via ${d.sourceType === 'hls' ? 'HLS' : d.sourceType === 'file' ? 'a video file' : 'YouTube'}` : ''}. Chat and viewers are live in the app.`
                : `Nothing is broadcasting.${d?.updatedAt ? ` Last change ${ago(toDate(d.updatedAt))}.` : ''}`}
          </p>
        </div>
        <div>
          <button type="button" className={`btn ${on ? 'live' : 'primary'}`} onClick={open}>
            <Icon name="radioTower" size={16} />OPEN BROADCAST CONTROL
          </button>
        </div>
      </div>
      <div className="live-preview">
        {d?.thumbnail ? <img src={d.thumbnail} alt="" /> : <span className="row gap small"><Icon name={on ? 'radioTower' : 'wifiOff'} />{on ? 'No thumbnail set' : 'Off air'}</span>}
      </div>
    </GlassCard>
  );
}
