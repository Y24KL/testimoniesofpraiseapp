import { useEffect, useState } from 'react';
import { collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, type Timestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { fmtDate } from '../lib';
import { Check, Field, Message } from '../components/Field';
import { Icon } from '../components/Icon';
import { usePendingCounts } from '../hooks/usePendingCounts';
import { EmptyState, ErrorState, FilterTabs, GlassCard, LoadingList, PageHeader, SectionHeader, StatusBadge, type BadgeKind } from '../components/ui';

/** Categories the engine can send. Must match PUSH_CATEGORIES in top-admin/worker/src/engine/copy.js. */
const CATEGORIES = ['testimonies', 'live', 'announcements', 'promotions', 'choirs', 'loveworld', 'articles'] as const;

interface Settings {
  enabled: boolean;
  categories: Record<string, { enabled: boolean }>;
  quietHours: { enabled: boolean; startMin: number; endMin: number };
  maxPerDay: number;
  perCategoryPerDay: Record<string, number>;
}

interface QueueEntry {
  id: string;
  status: 'pending' | 'approved' | 'sending' | 'sent' | 'failed' | 'cancelled';
  type: string;
  contentId: string;
  category: string;
  title: string;
  body: string;
  copySource: 'template' | 'ai';
  sendAfter?: Timestamp;
  createdAt?: Timestamp;
  decidedBy?: string | null;
}

interface HistoryEntry {
  id: string;
  title: string;
  category: string;
  sent: number;
  failed: number;
  noDevice: number;
  capped: number;
  removedTokens: number;
  completedAt?: Timestamp;
}

const DEFAULT_SETTINGS: Settings = {
  enabled: false,
  categories: Object.fromEntries(CATEGORIES.map((c) => [c, { enabled: true }])),
  quietHours: { enabled: true, startMin: 22 * 60, endMin: 7 * 60 },
  maxPerDay: 3,
  perCategoryPerDay: {},
};

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return Number.isInteger(h) && Number.isInteger(m) ? h * 60 + m : 0;
};
const toHHMM = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

export function NotificationCentre() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [queue, setQueue] = useState<QueueEntry[] | null>(null);
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const [lastRun, setLastRun] = useState<Date | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [view, setView] = useState<'pending' | 'approved' | 'recent' | 'history'>('pending');
  const { refresh: refreshCounts } = usePendingCounts();

  useEffect(
    () =>
      onSnapshot(
        doc(db, 'settings', 'notifications'),
        (s) => {
          const d = (s.data() ?? {}) as Partial<Settings>;
          setSettings({
            enabled: d.enabled === true,
            categories: { ...DEFAULT_SETTINGS.categories, ...(d.categories ?? {}) },
            quietHours: d.quietHours ?? DEFAULT_SETTINGS.quietHours,
            maxPerDay: typeof d.maxPerDay === 'number' ? d.maxPerDay : DEFAULT_SETTINGS.maxPerDay,
            perCategoryPerDay: d.perCategoryPerDay ?? {},
          });
          setLoaded(true);
        },
        (e) => setErr(e.message),
      ),
    [],
  );

  useEffect(
    () =>
      onSnapshot(
        query(collection(db, 'notification_queue'), orderBy('createdAt', 'desc'), limit(50)),
        (s) => setQueue(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<QueueEntry, 'id'>) }))),
        (e) => setErr(e.message),
      ),
    [],
  );

  useEffect(
    () =>
      onSnapshot(
        query(collection(db, 'notification_history'), orderBy('completedAt', 'desc'), limit(20)),
        (s) => setHistory(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<HistoryEntry, 'id'>) }))),
        () => setHistory([]),
      ),
    [],
  );

  useEffect(
    () =>
      onSnapshot(doc(db, 'settings', 'notificationEngine'), (s) => {
        const ts = s.data()?.lastRunAt as Timestamp | undefined;
        setLastRun(ts ? ts.toDate() : null);
      }, () => setLastRun(null)),
    [],
  );

  const flash = (message: string) => {
    setOk(message);
    setErr('');
  };

  const saveSettings = async (next: Settings) => {
    setBusy(true);
    setErr('');
    try {
      // The full document is written, because the Firestore rules accept only these keys.
      await setDoc(doc(db, 'settings', 'notifications'), {
        enabled: next.enabled,
        categories: next.categories,
        quietHours: next.quietHours,
        maxPerDay: next.maxPerDay,
        perCategoryPerDay: next.perCategoryPerDay,
        updatedAt: serverTimestamp(),
      });
      flash(next.enabled ? 'Saved. The engine is on.' : 'Saved. The engine is off.');
    } catch (e) {
      setErr(`Could not save: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const decide = async (entry: QueueEntry, status: 'approved' | 'cancelled') => {
    const uid = auth.currentUser?.uid;
    if (!uid) return setErr('You are signed out.');
    setBusy(true);
    setErr('');
    try {
      await updateDoc(doc(db, 'notification_queue', entry.id), { status, decidedBy: uid, decidedAt: serverTimestamp() });
      flash(status === 'approved' ? 'Approved. It will send at the next run, within quiet hours and caps.' : 'Cancelled.');
      refreshCounts();
    } catch (e) {
      setErr(`Could not update: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) {
    return (
      <>
        <PageHeader eyebrow="Communication" title="Notification Centre" />
        {err ? <ErrorState title="Couldn’t load notification settings" message={err} /> : <GlassCard><LoadingList rows={4} /></GlassCard>}
      </>
    );
  }

  const pending = (queue ?? []).filter((q) => q.status === 'pending');
  const approved = (queue ?? []).filter((q) => q.status === 'approved');
  const recent = (queue ?? []).filter((q) => q.status !== 'pending' && q.status !== 'approved');
  const sections: { id: typeof view; label: string; count?: number }[] = [
    { id: 'pending', label: 'Awaiting approval', count: queue ? pending.length : undefined },
    { id: 'approved', label: 'Approved', count: queue ? approved.length : undefined },
    { id: 'recent', label: 'Recent outcomes', count: queue ? recent.length : undefined },
    { id: 'history', label: 'Delivery history', count: history ? history.length : undefined },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Communication"
        title="Notification Centre"
        sub={<>New content is queued here, and nothing is sent until you approve it. Last engine run: <b style={{ color: 'var(--text)' }}>{lastRun ? lastRun.toLocaleString() : 'not yet'}</b>.</>}
      />

      {err ? <Message kind="err">{err}</Message> : null}
      {ok ? <Message kind="ok">{ok}</Message> : null}

      <div className="editor-layout">
        <div>
          <div className="toolbar">
            <FilterTabs label="Queue sections" value={view} onChange={setView} options={sections} />
          </div>

          {view !== 'history' && queue === null ? <GlassCard><LoadingList rows={3} /></GlassCard> : null}

          {view === 'pending' && queue !== null ? (
            pending.length === 0 ? (
              <GlassCard><EmptyState icon="checkCircle" title="Nothing is waiting for approval">New testimonies, articles and other content queue here automatically.</EmptyState></GlassCard>
            ) : (
              pending.map((q) => <QueueCard key={q.id} entry={q} busy={busy} onApprove={() => void decide(q, 'approved')} onCancel={() => void decide(q, 'cancelled')} />)
            )
          ) : null}

          {view === 'approved' && queue !== null ? (
            approved.length === 0 ? (
              <GlassCard><EmptyState icon="clock" title="Nothing approved and waiting">Approved notifications send at the next engine run, within quiet hours and caps.</EmptyState></GlassCard>
            ) : (
              approved.map((q) => <QueueCard key={q.id} entry={q} busy={busy} onCancel={() => void decide(q, 'cancelled')} />)
            )
          ) : null}

          {view === 'recent' && queue !== null ? (
            recent.length === 0 ? (
              <GlassCard><EmptyState icon="activity" title="No decisions yet">Sent, failed and cancelled notifications appear here.</EmptyState></GlassCard>
            ) : (
              recent.map((q) => <QueueCard key={q.id} entry={q} busy />)
            )
          ) : null}

          {view === 'history' ? (
            <GlassCard className="table-card">
              {history === null ? (
                <div style={{ padding: 20 }}><LoadingList rows={3} /></div>
              ) : history.length === 0 ? (
                <EmptyState icon="send" title="No completed notifications yet">Each send is recorded here with its delivery counts.</EmptyState>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Notification</th><th>Sent</th><th>Failed</th><th>No device</th><th>Capped</th><th>Dead tokens</th><th>Completed</th></tr></thead>
                    <tbody>
                      {history.map((h) => (
                        <tr key={h.id}>
                          <td className="title-cell"><b>{h.title}</b><div className="small muted">{h.category}</div></td>
                          <td className="tabular" style={{ color: 'var(--success)', fontWeight: 700 }}>{h.sent}</td>
                          <td className="tabular" style={h.failed ? { color: 'var(--danger)', fontWeight: 700 } : undefined}>{h.failed}</td>
                          <td className="tabular">{h.noDevice}</td>
                          <td className="tabular">{h.capped}</td>
                          <td className="tabular">{h.removedTokens}</td>
                          <td className="small muted nowrap">{h.completedAt ? fmtDate(h.completedAt) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </GlassCard>
          ) : null}
        </div>

        <aside className="editor-side">
          <GlassCard aria-labelledby="engine-controls">
            <SectionHeader icon="cpu" title="Engine controls" as="h3" />
            <div className={`engine-switch ${settings.enabled ? 'on' : ''}`}>
              <Check
                checked={settings.enabled}
                disabled={busy}
                onChange={(v) => setSettings({ ...settings, enabled: v })}
                label="Notification engine on"
                hint="Off stops all automatic notifications; approved items wait."
              />
            </div>
            <Check checked={settings.quietHours.enabled} onChange={(v) => setSettings({ ...settings, quietHours: { ...settings.quietHours, enabled: v } })} label="Use quiet hours" hint="Local time on each person’s phone." />
            <div className="two">
              <Field label="Quiet from">
                <input type="time" value={toHHMM(settings.quietHours.startMin)} disabled={!settings.quietHours.enabled} onChange={(e) => setSettings({ ...settings, quietHours: { ...settings.quietHours, startMin: toMinutes(e.target.value) } })} />
              </Field>
              <Field label="Until">
                <input type="time" value={toHHMM(settings.quietHours.endMin)} disabled={!settings.quietHours.enabled} onChange={(e) => setSettings({ ...settings, quietHours: { ...settings.quietHours, endMin: toMinutes(e.target.value) } })} />
              </Field>
            </div>
            <Field label="Most notifications per person per day">
              <input type="number" min={0} max={10} value={settings.maxPerDay} onChange={(e) => setSettings({ ...settings, maxPerDay: Math.max(0, Math.min(10, Number(e.target.value) || 0)) })} />
            </Field>
            <div className="f" style={{ marginBottom: 12 }}>
              <span>Categories</span>
              <div className="chips">
                {CATEGORIES.map((c) => {
                  const on = settings.categories[c]?.enabled !== false;
                  return (
                    <button key={c} type="button" className="chip-check" aria-pressed={on} onClick={() => setSettings({ ...settings, categories: { ...settings.categories, [c]: { enabled: !on } } })}>
                      <Icon name={on ? 'checkCircle' : 'x'} size={14} />{c}
                    </button>
                  );
                })}
              </div>
            </div>
            <button type="button" className="btn primary block" disabled={busy} onClick={() => void saveSettings(settings)}>
              {busy ? <span className="spin sm" aria-hidden="true" /> : <Icon name="check" size={16} />}Save engine settings
            </button>
          </GlassCard>
        </aside>
      </div>
    </>
  );
}

const QUEUE_BADGE: Record<QueueEntry['status'], BadgeKind> = { pending: 'warn', approved: 'info', sending: 'info', sent: 'ok', failed: 'bad', cancelled: 'draft' };

function QueueCard({ entry, busy, onApprove, onCancel }: { entry: QueueEntry; busy: boolean; onApprove?: () => void; onCancel?: () => void }) {
  return (
    <GlassCard as="article" className="item-card queue-card">
      <div className="item-head">
        <div className="row gap" style={{ gap: 8 }}>
          <StatusBadge kind={QUEUE_BADGE[entry.status] ?? 'draft'}>{entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}</StatusBadge>
          <span className="tag">{entry.category}</span>
          <span className={`tag ${entry.copySource === 'ai' ? 'gold' : ''}`}><Icon name={entry.copySource === 'ai' ? 'sparkles' : 'fileText'} size={11} />{entry.copySource === 'ai' ? 'AI copy (validated)' : 'Template copy'}</span>
        </div>
        <span className="small muted nowrap">{entry.createdAt ? `Queued ${fmtDate(entry.createdAt)}` : ''}</span>
      </div>
      <div className="push-card">
        <img src="/logo.png" alt="" />
        <div style={{ minWidth: 0 }}>
          <div className="app"><span>Testimonies of Praise</span></div>
          <div className="pt">{entry.title}</div>
          <div className="pb">{entry.body}</div>
        </div>
      </div>
      <div className="context-line">{entry.type} · <code>{entry.contentId}</code>{entry.sendAfter ? ` · not before ${fmtDate(entry.sendAfter)}` : ''}</div>
      {onApprove || onCancel ? (
        <div className="actions">
          {onApprove ? <button type="button" className="btn small success" disabled={busy} onClick={onApprove}><Icon name="check" size={14} />Approve</button> : null}
          {onCancel ? <button type="button" className="btn small ghost" disabled={busy} onClick={onCancel}><Icon name="x" size={14} />Cancel</button> : null}
        </div>
      ) : null}
    </GlassCard>
  );
}
