import { useEffect, useState } from 'react';
import { collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Check, Message } from '../components/Field';
import { Icon } from '../components/Icon';
import { dispatchNow } from '../push';
import { DeliveryTools } from '../components/DeliveryTools';
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
  copyMode: CopyMode;
  aiCopy: boolean;
  targeting: Targeting;
}

type CopyMode = 'review' | 'automatic' | 'manual';
type Targeting = 'everyone' | 'interested_first' | 'interested_only';

type CampaignStatus = 'awaiting_approval' | 'scheduled' | 'fanning_out' | 'queued' | 'finished' | 'cancelled' | 'expired' | 'invalid';

interface Campaign {
  id: string;
  title: string;
  body: string;
  type: string;
  category: string;
  status: CampaignStatus;
  delivery?: 'immediate' | 'window';
  source?: string;
  copySource?: 'ai' | 'edited' | 'template';
  template?: { title: string; body: string };
  draft?: { title: string; body: string };
  draftError?: string;
  tags?: string[];
  createdAt?: number;
  counts?: Partial<Record<'queued' | 'notQueued' | 'sent' | 'inApp' | 'skipped' | 'failed' | 'expired', number>>;
}

/** One person's failed delivery (notificationQueue item with status "failed"). */
interface Failure {
  id: string;
  uid?: string;
  title?: string;
  category?: string;
  lastError?: string;
  attempts?: number;
  finishedAt?: number;
}

/** Plain-language meaning of the delivery errors the engine records. */
const FAILURE_HELP: Record<string, string> = {
  WebPushNotConfigured: 'A website (browser) subscription, but web push is not set up on the server (VAPID keys missing).',
  NoDevices: 'The person had no usable device left when it was sent (app removed or signed out).',
  DeviceNotRegistered: 'The app was uninstalled or notifications were reset on that phone. The token has been removed.',
  SubscriptionGone: 'The browser subscription expired. It has been removed.',
  InvalidCredentials: 'Expo could not use the push credentials for this app build (FCM/APNs keys on Expo).',
  MessageTooBig: 'The notification text was too long.',
  MessageRateExceeded: 'Too many notifications to that device in a short time.',
  NetworkError: 'The push service could not be reached after several tries.',
  interrupted: 'A send was interrupted (Worker restart) and was not retried.',
};
const failureHelp = (code?: string) => (code ? FAILURE_HELP[code] ?? (code.startsWith('HTTP_') ? `The push service answered ${code.slice(5)}.` : code) : 'Unknown');

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

const CANCELLABLE: CampaignStatus[] = ['awaiting_approval', 'scheduled', 'fanning_out', 'queued'];
const STATUS_BADGE: Record<CampaignStatus, BadgeKind> = { awaiting_approval: 'warn', scheduled: 'info', fanning_out: 'info', queued: 'ok', finished: 'ok', cancelled: 'draft', expired: 'draft', invalid: 'bad' };
const STATUS_LABEL: Record<CampaignStatus, string> = { awaiting_approval: 'Awaiting approval', scheduled: 'Starting', fanning_out: 'Sending', queued: 'Delivering', finished: 'Finished', cancelled: 'Cancelled', expired: 'Expired', invalid: 'Invalid' };

const utcDay = () => new Date().toISOString().slice(0, 10);
const sum = (o?: Record<string, number>) => Object.values(o ?? {}).reduce((a, b) => a + (Number(b) || 0), 0);
const metric = (stats: Stats | null | undefined, value: (s: Stats) => number): Metric =>
  stats === undefined ? { state: 'loading' } : { state: 'ready', value: stats ? value(stats) : 0 };
const when = (ms?: number) => (typeof ms === 'number' ? new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—');

export function NotificationCentre() {
  const [config, setConfig] = useState<EngineConfig | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [stats, setStats] = useState<Stats | null | undefined>(undefined);
  const [failures, setFailures] = useState<Failure[] | null>(null);
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
            copyMode: d.copyMode === 'automatic' || d.copyMode === 'manual' ? d.copyMode : 'review',
            aiCopy: d.aiCopy !== false,
            targeting: d.targeting === 'everyone' || d.targeting === 'interested_only' ? d.targeting : 'interested_first',
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
        query(collection(db, 'notificationQueue'), where('status', '==', 'failed'), limit(50)),
        (s) =>
          setFailures(
            s.docs
              .map((d) => ({ id: d.id, ...(d.data() as Omit<Failure, 'id'>) }))
              .sort((a, b) => (Number(b.finishedAt) || 0) - (Number(a.finishedAt) || 0)),
          ),
        () => setFailures([]),
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

  const saveSetting = async (patch: Partial<Pick<EngineConfig, 'copyMode' | 'aiCopy' | 'targeting'>>, message: string) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return setErr('You are signed out.');
    setBusy(true);
    setErr('');
    setOk('');
    try {
      await setDoc(doc(db, 'settings', 'notificationEngine'), { ...patch, updatedAt: serverTimestamp(), updatedBy: uid }, { merge: true });
      setOk(message);
    } catch (e) {
      setErr(`Could not save: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  /** Sends a draft that awaits approval, with the AI text, an edited text or the template. */
  const approve = async (c: Campaign, copy: { title: string; body: string }, copySource: 'ai' | 'edited' | 'template') => {
    const uid = auth.currentUser?.uid;
    if (!uid) return setErr('You are signed out.');
    const title = copy.title.trim();
    const body = copy.body.trim();
    if (!title || !body) return setErr('The title and message cannot be empty.');
    if (title.length > 100 || body.length > 300) return setErr('Keep the title under 100 characters and the message under 300.');
    setBusy(true);
    setErr('');
    setOk('');
    try {
      await updateDoc(doc(db, 'notificationCampaigns', c.id), { status: 'scheduled', dueAt: 0, title, body, copySource, approvedBy: uid, approvedAt: serverTimestamp() });
      await dispatchNow();
      setOk(`Approved. “${title}” is being sent now.`);
    } catch (e) {
      setErr(`Could not approve: ${(e as Error).message}`);
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
  const awaiting = (campaigns ?? []).filter((c) => c.status === 'awaiting_approval');

  return (
    <>
      <PageHeader
        eyebrow="Communication"
        title="Notification Centre"
        sub="Published content is sent to phones straight away, within each person’s categories and daily limit, at any time of day. Live broadcasts always send at once."
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
          {awaiting.length ? (
            <GlassCard>
              <SectionHeader icon="sparkles" title={`Awaiting approval (${awaiting.length})`} hint="Praxiom wrote these from the published content. Nothing is sent until you choose." />
              {awaiting.map((c) => <DraftCard key={c.id} campaign={c} busy={busy} onApprove={approve} onCancel={cancel} />)}
            </GlassCard>
          ) : null}

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
                          <td className="title-cell">
                            <b>{c.title}</b>
                            <div className="small muted">
                              {c.category}{c.delivery === 'window' ? ' · time slot' : ''}
                              {c.copySource === 'ai' ? ' · Praxiom' : c.copySource === 'edited' ? ' · Praxiom, edited' : c.copySource === 'template' && c.source === 'event' ? ' · template' : ''}
                            </div>
                          </td>
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

          <DeliveryTools />

          <GlassCard className="table-card">
            <SectionHeader icon="alert" title="Failed deliveries" hint="One row per person a notification could not reach, newest first" />
            {failures === null ? (
              <div style={{ padding: 20 }}><LoadingList rows={2} /></div>
            ) : failures.length === 0 ? (
              <EmptyState icon="checkCircle" title="No failed deliveries">Every notification reached the people it was meant for.</EmptyState>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Notification</th><th>Reason</th><th>Person</th><th>Tries</th><th>When</th></tr></thead>
                  <tbody>
                    {failures.map((f) => (
                      <tr key={f.id}>
                        <td className="title-cell"><b>{f.title ?? '—'}</b><div className="small muted">{f.category ?? ''}</div></td>
                        <td><code>{f.lastError ?? 'Unknown'}</code><div className="small muted">{failureHelp(f.lastError)}</div></td>
                        <td className="small muted" title={f.uid}><code>{f.uid ? `${f.uid.slice(0, 6)}…` : '—'}</code></td>
                        <td className="tabular">{f.attempts ?? 1}</td>
                        <td className="small muted nowrap">{when(f.finishedAt)}</td>
                      </tr>
                    ))}
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
              Each person controls their own categories and daily limit (default 5) in the app. Quiet hours are off unless someone turns them on for themselves.
            </p>
          </GlassCard>

          <GlassCard aria-labelledby="praxiom-settings">
            <SectionHeader icon="sparkles" title="Praxiom" as="h3" />
            {config === null ? (
              <LoadingList rows={3} />
            ) : (
              <>
                <Check checked={config.aiCopy} disabled={busy} onChange={(v) => void saveSetting({ aiCopy: v }, v ? 'Praxiom will write messages for published content.' : 'Praxiom is off. Published content uses the standard template.')} label="Praxiom writes the messages" hint="From the published item’s own title, description and topics only. Every message is checked; anything doubtful falls back to the template." />
                <div className="f" style={{ marginTop: 12 }}>
                  <span>When content is published</span>
                  <select value={config.copyMode} disabled={busy} onChange={(e) => void saveSetting({ copyMode: e.target.value as CopyMode }, 'Saved.')}>
                    <option value="review">Review: Praxiom’s message waits for my approval</option>
                    <option value="automatic">Automatic: send Praxiom’s message straight away</option>
                    <option value="manual">Manual: don’t notify; I’ll send announcements myself</option>
                  </select>
                </div>
                <div className="f" style={{ marginTop: 12 }}>
                  <span>Who hears first</span>
                  <select value={config.targeting} disabled={busy} onChange={(e) => void saveSetting({ targeting: e.target.value as Targeting }, 'Saved.')}>
                    <option value="interested_first">Interested people first, everyone else 3 hours later</option>
                    <option value="interested_only">Only people interested in that topic</option>
                    <option value="everyone">Everyone at once</option>
                  </select>
                </div>
                <p className="small muted" style={{ marginTop: 12 }}>Topics come from the item’s interest tags and each person’s chosen interests. People without interests, untagged content, announcements and live broadcasts always go to everyone.</p>
              </>
            )}
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

/** One Praxiom draft awaiting approval: the draft next to the template, with approve, edit, template and cancel. */
function DraftCard({ campaign: c, busy, onApprove, onCancel }: {
  campaign: Campaign;
  busy: boolean;
  onApprove: (c: Campaign, copy: { title: string; body: string }, source: 'ai' | 'edited' | 'template') => Promise<void>;
  onCancel: (c: Campaign) => Promise<void>;
}) {
  const draft = c.draft ?? { title: c.title, body: c.body };
  const template = c.template ?? { title: c.title, body: c.body };
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(draft.title);
  const [body, setBody] = useState(draft.body);
  return (
    <article className="item-card" style={{ padding: '14px 0', borderTop: '1px solid var(--glass-border)' }}>
      <div className="row" style={{ justifyContent: 'space-between', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span className="small muted">{c.category}{c.tags?.length ? ` · ${c.tags.join(', ')}` : ''}</span>
        <span className="small muted nowrap">{when(c.createdAt)}</span>
      </div>
      <div className="two" style={{ marginTop: 8 }}>
        <div className="push-card" style={{ margin: 0 }}>
          <img src="/logo.png" alt="" />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="app"><span>Praxiom’s message</span></div>
            {editing ? (
              <>
                <input type="text" value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} aria-label="Title" style={{ width: '100%', marginBottom: 6 }} />
                <textarea value={body} maxLength={300} onChange={(e) => setBody(e.target.value)} aria-label="Message" style={{ width: '100%', minHeight: 70 }} />
              </>
            ) : (
              <>
                <div className="pt">{draft.title}</div>
                <div className="pb">{draft.body}</div>
              </>
            )}
          </div>
        </div>
        <div className="push-card" style={{ margin: 0, opacity: 0.75 }}>
          <img src="/logo.png" alt="" />
          <div style={{ minWidth: 0 }}>
            <div className="app"><span>Standard template</span></div>
            <div className="pt">{template.title}</div>
            <div className="pb">{template.body}</div>
          </div>
        </div>
      </div>
      <div className="actions" style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {editing ? (
          <>
            <button type="button" className="btn small success" disabled={busy} onClick={() => void onApprove(c, { title, body }, 'edited')}><Icon name="send" size={14} />Send edited message</button>
            <button type="button" className="btn small ghost" disabled={busy} onClick={() => { setEditing(false); setTitle(draft.title); setBody(draft.body); }}>Discard edits</button>
          </>
        ) : (
          <>
            <button type="button" className="btn small success" disabled={busy} onClick={() => void onApprove(c, draft, 'ai')}><Icon name="check" size={14} />Approve and send</button>
            <button type="button" className="btn small ghost" disabled={busy} onClick={() => setEditing(true)}><Icon name="edit" size={14} />Edit</button>
            <button type="button" className="btn small ghost" disabled={busy} onClick={() => void onApprove(c, template, 'template')}><Icon name="fileText" size={14} />Use template instead</button>
          </>
        )}
        <button type="button" className="btn small ghost" disabled={busy} onClick={() => void onCancel(c)}><Icon name="x" size={14} />Don’t send</button>
      </div>
    </article>
  );
}
