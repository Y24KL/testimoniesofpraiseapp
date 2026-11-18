import { useEffect, useState } from 'react';
import { collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, type Timestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { fmtDate } from '../lib';
import { Check, Field, Message } from '../components/Field';

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
    } catch (e) {
      setErr(`Could not update: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) return <p>Loading notification settings…</p>;

  const pending = (queue ?? []).filter((q) => q.status === 'pending');
  const approved = (queue ?? []).filter((q) => q.status === 'approved');
  const recent = (queue ?? []).filter((q) => q.status !== 'pending' && q.status !== 'approved');

  return (
    <div style={{ display: 'grid', gap: 24, maxWidth: 960 }}>
      <header>
        <h1 style={{ margin: 0 }}>Notification centre</h1>
        <p style={{ margin: '4px 0 0', opacity: 0.8 }}>
          New content is queued here. Nothing is sent until you approve it. Last engine run: {lastRun ? lastRun.toLocaleString() : 'not yet'}.
        </p>
      </header>

      {err && <Message kind="err">{err}</Message>}
      {ok && <Message kind="ok">{ok}</Message>}

      <section style={{ display: 'grid', gap: 12 }} aria-labelledby="engine-controls">
        <h2 id="engine-controls" style={{ margin: 0 }}>Engine controls</h2>
        <Check
          checked={settings.enabled}
          disabled={busy}
          onChange={(v) => setSettings({ ...settings, enabled: v })}
          label="Notification engine is on"
          hint="Turn this off to stop all automatic notifications immediately. Approved items wait."
        />
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Field label="Quiet hours start (local time)">
            <input type="time" value={toHHMM(settings.quietHours.startMin)} onChange={(e) => setSettings({ ...settings, quietHours: { ...settings.quietHours, startMin: toMinutes(e.target.value) } })} />
          </Field>
          <Field label="Quiet hours end (local time)">
            <input type="time" value={toHHMM(settings.quietHours.endMin)} onChange={(e) => setSettings({ ...settings, quietHours: { ...settings.quietHours, endMin: toMinutes(e.target.value) } })} />
          </Field>
          <Check checked={settings.quietHours.enabled} onChange={(v) => setSettings({ ...settings, quietHours: { ...settings.quietHours, enabled: v } })} label="Use quiet hours" />
        </div>
        <Field label="Most notifications per person per day">
          <input type="number" min={0} max={10} value={settings.maxPerDay} onChange={(e) => setSettings({ ...settings, maxPerDay: Math.max(0, Math.min(10, Number(e.target.value) || 0)) })} />
        </Field>
        <fieldset style={{ display: 'grid', gap: 6 }}>
          <legend>Categories</legend>
          {CATEGORIES.map((c) => (
            <Check
              key={c}
              checked={settings.categories[c]?.enabled !== false}
              onChange={(v) => setSettings({ ...settings, categories: { ...settings.categories, [c]: { enabled: v } } })}
              label={c}
            />
          ))}
        </fieldset>
        <div>
          <button type="button" disabled={busy} onClick={() => void saveSettings(settings)}>
            Save engine settings
          </button>
        </div>
      </section>

      <section style={{ display: 'grid', gap: 12 }} aria-labelledby="awaiting">
        <h2 id="awaiting" style={{ margin: 0 }}>Awaiting approval ({pending.length})</h2>
        {queue === null && <p>Loading…</p>}
        {queue !== null && pending.length === 0 && <p>Nothing is waiting for approval.</p>}
        {pending.map((q) => (
          <QueueCard key={q.id} entry={q} busy={busy} onApprove={() => void decide(q, 'approved')} onCancel={() => void decide(q, 'cancelled')} />
        ))}
      </section>

      <section style={{ display: 'grid', gap: 12 }} aria-labelledby="approved">
        <h2 id="approved" style={{ margin: 0 }}>Approved, waiting to send ({approved.length})</h2>
        {approved.length === 0 && <p>None.</p>}
        {approved.map((q) => (
          <QueueCard key={q.id} entry={q} busy={busy} onCancel={() => void decide(q, 'cancelled')} />
        ))}
      </section>

      <section style={{ display: 'grid', gap: 12 }} aria-labelledby="recent">
        <h2 id="recent" style={{ margin: 0 }}>Recent decisions and outcomes</h2>
        {recent.length === 0 && <p>None yet.</p>}
        {recent.map((q) => (
          <QueueCard key={q.id} entry={q} busy />
        ))}
      </section>

      <section style={{ display: 'grid', gap: 12 }} aria-labelledby="history">
        <h2 id="history" style={{ margin: 0 }}>Delivery history</h2>
        {history === null && <p>Loading…</p>}
        {history !== null && history.length === 0 && <p>No completed notifications yet.</p>}
        {history?.map((h) => (
          <div key={h.id} style={{ borderTop: '1px solid #ddd', paddingTop: 8 }}>
            <strong>{h.title}</strong> · {h.category} · {h.completedAt ? fmtDate(h.completedAt) : ''}
            <div style={{ opacity: 0.8 }}>
              Sent {h.sent} · failed {h.failed} · no device {h.noDevice} · capped {h.capped} · dead tokens removed {h.removedTokens}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

function QueueCard({ entry, busy, onApprove, onCancel }: { entry: QueueEntry; busy: boolean; onApprove?: () => void; onCancel?: () => void }) {
  return (
    <article style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <strong>{entry.title}</strong>
        <span style={{ opacity: 0.8 }}>
          {entry.status} · {entry.category} · copy: {entry.copySource === 'ai' ? 'AI (validated)' : 'template'}
        </span>
      </div>
      <div>{entry.body}</div>
      <div style={{ opacity: 0.7, fontSize: 13 }}>
        {entry.type} · {entry.contentId} {entry.createdAt ? `· queued ${fmtDate(entry.createdAt)}` : ''}
      </div>
      {(onApprove || onCancel) && (
        <div style={{ display: 'flex', gap: 8 }}>
          {onApprove && (
            <button type="button" disabled={busy} onClick={onApprove}>
              Approve
            </button>
          )}
          {onCancel && (
            <button type="button" disabled={busy} onClick={onCancel}>
              Cancel
            </button>
          )}
        </div>
      )}
    </article>
  );
}
