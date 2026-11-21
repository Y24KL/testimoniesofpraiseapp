import { useEffect, useState } from 'react';
import { collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Check, Message } from '../components/Field';
import { Icon } from '../components/Icon';
import { EmptyState, ErrorState, GlassCard, LoadingList, PageHeader, SectionHeader, StatCard, StatusBadge, type BadgeKind, type Metric } from '../components/ui';

/**
 * Monitors and controls the notification engine that runs on the Worker (top-admin/worker/src/notify).
 * Data: settings/notificationEngine (config), notificationCampaigns (one per published item or
 * announcement), notificationStats/{UTC day} (counters). Engine timestamps are milliseconds.
 */

interface EngineConfig {
  enabled: boolean;
  windows: { id?: string; time: string; categories: string[] }[] | null;
  defaultTimezone: string | null;
}

type CampaignStatus = 'scheduled' | 'fanning_out' | 'queued' | 'finished' | 'cancelled' | 'expired' | 'invalid';

interface Campaign {
  id: string;
  title: string;
  body: string;
  type: string;
  category: string;
  status: CampaignStatus;
  delivery?: 'immediate' | 'window';
  source?: string;
  createdAt?: number;
  counts?: Partial<Record<'queued' | 'notQueued' | 'sent' | 'inApp' | 'skipped' | 'failed' | 'expired', number>>;
}

type Stats = {
  events?: Record<string, number>;
  channels?: Record<string, number>;
  deferReasons?: Record<string, number>;
  tickets?: Record<string, number>;
};

/** Delivery windows the engine uses when none are configured (worker src/notify/engine.js DEFAULT_WINDOWS). */
const DEFAULT_WINDOWS = [
  { time: '08:00', categories: ['dailyPraise'] },
  { time: '11:30', categories: ['testimonies'] },
  { time: '14:30', categories: ['loveworldMusic', 'lyricalAnalysis'] },
  { time: '17:30', categories: ['community', 'featuredChoirs', 'articles', 'announcements'] },
  { time: '20:00', categories: ['live', '*'] },
];

const CANCELLABLE: CampaignStatus[] = ['scheduled', 'fanning_out', 'queued'];
const STATUS_BADGE: Record<CampaignStatus, BadgeKind> = { scheduled: 'info', fanning_out: 'info', queued: 'ok', finished: 'ok', cancelled: 'draft', expired: 'draft', invalid: 'bad' };
const STATUS_LABEL: Record<CampaignStatus, string> = { scheduled: 'Starting', fanning_out: 'Sending', queued: 'Delivering', finished: 'Finished', cancelled: 'Cancelled', expired: 'Expired', invalid: 'Invalid' };

const utcDay = () => new Date().toISOString().slice(0, 10);
const sum = (o?: Record<string, number>) => Object.values(o ?? {}).reduce((a, b) => a + (Number(b) || 0), 0);
const metric = (stats: Stats | null | undefined, value: (s: Stats) => number): Metric =>
  stats === undefined ? { state: 'loading' } : { state: 'ready', value: stats ? value(stats) : 0 };
const when = (ms?: number) => (typeof ms === 'number' ? new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—');

export function NotificationCentre() {
  const [config, setConfig] = useState<EngineConfig | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [stats, setStats] = useState<Stats | null | undefined>(undefined);
  const [loadErr, setLoadErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  useEffect(
    () =>
      onSnapshot(
        doc(db, 'settings', 'notificationEngine'),
        (s) => {
          const d = s.data() ?? {};
          setConfig({
            enabled: d.enabled !== false,
            windows: Array.isArray(d.windows) && d.windows.length ? d.windows : null,
            defaultTimezone: typeof d.defaultTimezone === 'string' ? d.defaultTimezone : null,
          });
        },
        (e) => setLoadErr(e.message),
      ),
    [],
  );

  useEffect(
    () =>
      onSnapshot(
        query(collection(db, 'notificationCampaigns'), orderBy('createdAt', 'desc'), limit(30)),
        (s) => setCampaigns(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Campaign, 'id'>) }))),
        (e) => setLoadErr(e.message),
      ),
    [],
  );

  useEffect(
    () =>
      onSnapshot(
        doc(db, 'notificationStats', utcDay()),
        (s) => setStats(s.exists() ? (s.data() as Stats) : null),
        () => setStats(null),
      ),
    [],
  );

  const setEnabled = async (enabled: boolean) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return setErr('You are signed out.');
    if (!enabled && !window.confirm('Switch the notification engine off? No notifications will be sent until it is switched back on.')) return;
    setBusy(true);
    setErr('');
    setOk('');
    try {
      await setDoc(doc(db, 'settings', 'notificationEngine'), { enabled, updatedAt: serverTimestamp(), updatedBy: uid }, { merge: true });
      setOk(enabled ? 'The notification engine is on.' : 'The notification engine is off. Nothing will be sent.');
    } catch (e) {
      setErr(`Could not save: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (c: Campaign) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return setErr('You are signed out.');
    if (!window.confirm(`Cancel “${c.title}”? People who have not received it yet will not get it.`)) return;
    setBusy(true);
    setErr('');
    setOk('');
    try {
      await updateDoc(doc(db, 'notificationCampaigns', c.id), { status: 'cancelled', cancelledAt: serverTimestamp(), cancelledBy: uid });
      setOk('Cancelled. Anyone still waiting for it will not receive it.');
    } catch (e) {
      setErr(`Could not cancel: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  if (loadErr) {
    return (
      <>
        <PageHeader eyebrow="Communication" title="Notification Centre" />
        <ErrorState title="Couldn’t load the notification engine" message={loadErr} />
      </>
    );
  }

  const windows = config?.windows ?? DEFAULT_WINDOWS;

  return (
    <>
      <PageHeader
        eyebrow="Communication"
        title="Notification Centre"
        sub="Published content is sent to phones straight away, within each person’s settings, quiet hours and daily limit. Live broadcasts always send at once."
      />

      {err ? <Message kind="err">{err}</Message> : null}
      {ok ? <Message kind="ok">{ok}</Message> : null}
      {config && !config.enabled ? <Message kind="warn">The notification engine is off. Nothing is being sent.</Message> : null}

      <div className="stat-grid">
        <StatCard icon="send" label="Sent today" metric={metric(stats, (s) => s.events?.notification_sent ?? 0)} note="Push and in-app (UTC day)" gold />
        <StatCard icon="smartphone" label="Pushes today" metric={metric(stats, (s) => s.channels?.push ?? 0)} />
        <StatCard icon="bell" label="In-app only" metric={metric(stats, (s) => s.channels?.in_app ?? 0)} note="App was open" />
        <StatCard icon="clock" label="Held for later" metric={metric(stats, (s) => sum(s.deferReasons))} note="Quiet hours or daily limit" />
        <StatCard icon="alert" label="Failed today" metric={metric(stats, (s) => s.events?.notification_failed ?? 0)} />
      </div>

      <div className="editor-layout">
        <div>
          <GlassCard className="table-card">
            <SectionHeader icon="activity" title="Recent notifications" hint="One row per published item or announcement" />
            {campaigns === null ? (
              <div style={{ padding: 20 }}><LoadingList rows={4} /></div>
            ) : campaigns.length === 0 ? (
              <EmptyState icon="send" title="No notifications yet">Publish a testimony or send an announcement and it appears here.</EmptyState>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Notification</th><th>Status</th><th>Phones</th><th>Sent</th><th>In-app</th><th>Not sent</th><th>Failed</th><th>Created</th><th /></tr></thead>
                  <tbody>
                    {campaigns.map((c) => {
                      const n = c.counts ?? {};
                      return (
                        <tr key={c.id}>
                          <td className="title-cell"><b>{c.title}</b><div className="small muted">{c.category}{c.delivery === 'window' ? ' · time slot' : ''}</div></td>
                          <td><StatusBadge kind={STATUS_BADGE[c.status] ?? 'draft'}>{STATUS_LABEL[c.status] ?? c.status}</StatusBadge></td>
                          <td className="tabular">{n.queued ?? 0}</td>
                          <td className="tabular" style={{ color: 'var(--success)', fontWeight: 700 }}>{n.sent ?? 0}</td>
                          <td className="tabular">{n.inApp ?? 0}</td>
                          <td className="tabular" title="Category off, already seen, expired or limited">{(n.notQueued ?? 0) + (n.skipped ?? 0) + (n.expired ?? 0)}</td>
                          <td className="tabular" style={n.failed ? { color: 'var(--danger)', fontWeight: 700 } : undefined}>{n.failed ?? 0}</td>
                          <td className="small muted nowrap">{when(c.createdAt)}</td>
                          <td>
                            {CANCELLABLE.includes(c.status) ? (
                              <button type="button" className="btn small ghost" disabled={busy} onClick={() => void cancel(c)}><Icon name="x" size={14} />Cancel</button>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        </div>

        <aside className="editor-side">
          <GlassCard aria-labelledby="engine-controls">
            <SectionHeader icon="cpu" title="Engine" as="h3" />
            {config === null ? (
              <LoadingList rows={2} />
            ) : (
              <div className={`engine-switch ${config.enabled ? 'on' : ''}`}>
                <Check checked={config.enabled} disabled={busy} onChange={(v) => void setEnabled(v)} label="Notification engine on" hint="Off stops every automatic and manual notification at once." />
              </div>
            )}
            <p className="small muted" style={{ marginTop: 12 }}>
              Each person controls their own categories, quiet hours (default 22:00–07:00) and daily limit (default 3) in the app.
            </p>
          </GlassCard>

          <GlassCard aria-labelledby="engine-windows">
            <SectionHeader icon="clock" title="Scheduled time slots" as="h3" />
            <p className="small muted">Used only for scheduled campaigns. Published content and live broadcasts do not wait for a slot.</p>
            <ul className="plain-list small">
              {windows.map((w) => (
                <li key={`${w.time}-${w.categories.join(',')}`}><b className="tabular">{w.time}</b> · {w.categories.map((c) => (c === '*' ? 'anything else' : c)).join(', ')}</li>
              ))}
            </ul>
            <p className="small muted">Timezone when a phone has none: {config?.defaultTimezone ?? 'Africa/Lagos'}</p>
          </GlassCard>
        </aside>
      </div>
    </>
  );
}
