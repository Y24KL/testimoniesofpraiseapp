import { useEffect, useRef, useState } from 'react';
import { collection, getDocs, limit, query, type Timestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Message } from './Field';
import { Icon } from './Icon';
import { EmptyState, GlassCard, LoadingList, SectionHeader, StatusBadge } from './ui';
import { sendTestNotification, testDeliveryStatus, type TestDevice, type TestPerson } from '../push';
import { displayName, getUserCards, type UserCard } from '../support';

interface DeviceRow {
  id: string;
  uid: string;
  platform: string;
  provider: 'fcm' | 'expo' | 'webpush';
  appVersion: string | null;
  updatedAt: Date | null;
  credFailures: number;
}

const RECEIPT_TEXT: Record<string, string> = {
  ok: 'Delivered to Google/Apple (receipt ok)',
  pending: 'Waiting for the delivery receipt…',
  not_available: 'Sent directly through Firebase (no receipt is given)',
  DeviceNotRegistered: 'The app is no longer installed on that phone',
  InvalidCredentials: 'That phone runs an app build from another Expo project',
  MessageTooBig: 'The message was too large',
  MessageRateExceeded: 'Too many messages to that phone',
};

/**
 * "Send test to my device" and per-person tests through the real production pipeline, with each stage shown,
 * plus the list of registered devices (never the tokens themselves).
 */
export function DeliveryTools() {
  const [devices, setDevices] = useState<DeviceRow[] | null>(null);
  const [people, setPeople] = useState<Map<string, UserCard>>(new Map());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [run, setRun] = useState<{ who: string; campaignId: string | null; devices: TestDevice[]; people: TestPerson[] | null; at: number } | null>(null);
  const timer = useRef<number | null>(null);

  const loadDevices = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'pushTokens'), limit(500)));
      const rows: DeviceRow[] = snap.docs.map((d) => {
        const v = d.data();
        return {
          id: d.id.slice(0, 8),
          uid: String(v.uid ?? ''),
          platform: String(v.platform ?? 'unknown'),
          provider: v.fcmToken ? 'fcm' : v.web ? 'webpush' : 'expo',
          appVersion: typeof v.appVersion === 'string' ? v.appVersion : null,
          updatedAt: (v.updatedAt as Timestamp | undefined)?.toDate?.() ?? null,
          credFailures: Number(v.credFailures) || 0,
        };
      });
      rows.sort((a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0));
      setDevices(rows);
      setPeople(await getUserCards(rows.map((r) => r.uid)).catch(() => new Map()));
    } catch (e) {
      setErr((e as Error).message);
      setDevices([]);
    }
  };

  useEffect(() => { void loadDevices(); return () => { if (timer.current) window.clearTimeout(timer.current); }; }, []);

  const poll = (campaignId: string, startedAt: number) => {
    const tick = async () => {
      try {
        const st = await testDeliveryStatus(campaignId);
        setRun((r) => (r && r.campaignId === campaignId ? { ...r, people: st.people } : r));
        const waiting = st.people.some((p) => p.receipt === 'pending' || (!p.accepted && !p.error));
        if (waiting && Date.now() - startedAt < 20 * 60 * 1000) timer.current = window.setTimeout(() => void tick(), 20000);
      } catch (e) {
        setErr((e as Error).message);
      }
    };
    void tick();
  };

  const test = async (uid: string, who: string) => {
    if (uid !== 'me' && !window.confirm(`Send a real test notification to ${who}'s phone(s)? They will see “Test notification from Testimonies of Praise”.`)) return;
    setBusy(true);
    setErr('');
    if (timer.current) window.clearTimeout(timer.current);
    try {
      const out = await sendTestNotification(uid);
      const at = Date.now();
      setRun({ who, campaignId: out.campaignId, devices: out.devices, people: null, at });
      if (out.campaignId) poll(out.campaignId, at);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const myUid = auth.currentUser?.uid;
  const counts = (devices ?? []).reduce((m, d) => ((m[d.platform] = (m[d.platform] ?? 0) + 1), m), {} as Record<string, number>);
  const usersWithDevice = new Set((devices ?? []).map((d) => d.uid)).size;

  return (
    <>
      <GlassCard>
        <SectionHeader icon="smartphone" title="Delivery test" hint="Sends a real notification through the production engine and shows each step" />
        {err ? <Message kind="err">{err}</Message> : null}
        <div className="row gap" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn primary" disabled={busy} onClick={() => void test('me', 'you')}>
            {busy ? <span className="spin sm" aria-hidden="true" /> : <Icon name="send" size={16} />}Send test to my device
          </button>
          <span className="small muted" style={{ alignSelf: 'center' }}>Or use “Test” next to anyone in the device list below.</span>
        </div>
        {run ? (
          <div className="stage-list" style={{ marginTop: 14 }}>
            <Stage ok label="Campaign created" detail={run.campaignId ? `For ${run.who}` : `Not created: ${run.who === 'you' ? 'you have' : `${run.who} has`} no registered device. Open the app on the phone, allow notifications, then try again.`} bad={!run.campaignId} />
            {run.campaignId ? (
              <>
                <Stage ok={run.devices.length > 0} label="Registered devices" detail={run.devices.map((d) => `${d.platform} via ${d.provider === 'fcm' ? 'Firebase' : d.provider === 'webpush' ? 'web push' : 'Expo'}${d.appVersion ? ` (app ${d.appVersion})` : ''}`).join(', ')} />
                {run.people === null ? <Stage label="Sending…" detail="Running the engine" pending /> : run.people.map((p, i) => (
                  <div key={i}>
                    <Stage ok label="Queued" detail={p.deferredBy ? `Held: ${p.deferredBy}` : 'Ready to send'} />
                    <Stage ok={p.accepted} bad={!p.accepted && Boolean(p.error)} pending={!p.accepted && !p.error} label="Provider accepted" detail={p.accepted ? `Accepted by ${p.provider === 'fcm' ? 'Firebase Cloud Messaging' : p.provider === 'in_app' ? 'the in-app inbox (app was open)' : 'Expo'}` : p.error ? `Failed: ${p.error}` : 'Waiting'} />
                    {p.accepted ? <Stage ok={p.receipt === 'ok' || p.receipt === 'not_available'} bad={Boolean(p.receipt && !['ok', 'pending', 'not_available'].includes(p.receipt))} pending={p.receipt === 'pending'} label="Delivery receipt" detail={RECEIPT_TEXT[p.receipt ?? ''] ?? p.receipt ?? '—'} /> : null}
                    <Stage label="Shown and opened" detail="Only the phone can confirm this: check that the banner appeared (app closed, in background and open), then tap it." pending />
                  </div>
                ))}
              </>
            ) : null}
          </div>
        ) : null}
      </GlassCard>

      <GlassCard className="table-card">
        <SectionHeader icon="smartphone" title="Registered devices" hint={devices ? `${devices.length} devices · ${usersWithDevice} people · ${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(' · ') || 'none'}` : undefined} actions={<button type="button" className="btn small ghost" onClick={() => void loadDevices()}><Icon name="refresh" size={14} />Refresh</button>} />
        {devices === null ? <div style={{ padding: 20 }}><LoadingList rows={3} /></div> : devices.length === 0 ? (
          <EmptyState icon="smartphone" title="No registered devices">Phones appear here after someone signs in and allows notifications.</EmptyState>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Person</th><th>Platform</th><th>Delivery</th><th>App</th><th>Last registered</th><th>Health</th><th /></tr></thead>
              <tbody>
                {devices.map((d) => (
                  <tr key={`${d.uid}-${d.id}`}>
                    <td className="title-cell"><b>{displayName(people.get(d.uid))}</b><div className="small muted"><code>{d.uid.slice(0, 10)}…</code>{d.uid === myUid ? ' · you' : ''}</div></td>
                    <td>{d.platform}</td>
                    <td>{d.provider === 'fcm' ? <span className="tag gold">Firebase (shows when app is asleep)</span> : d.provider === 'webpush' ? 'Web push' : <span className="tag">Expo only (needs app 2.2+ for sleep-proof)</span>}</td>
                    <td className="small">{d.appVersion ?? <span className="muted">unknown</span>}</td>
                    <td className="small muted nowrap">{d.updatedAt ? d.updatedAt.toLocaleString() : '—'}</td>
                    <td>{d.credFailures > 0 ? <StatusBadge kind="bad">Wrong app build ({d.credFailures}/3)</StatusBadge> : <StatusBadge kind="ok">OK</StatusBadge>}</td>
                    <td><button type="button" className="btn small ghost" disabled={busy} onClick={() => void test(d.uid === myUid ? 'me' : d.uid, d.uid === myUid ? 'you' : displayName(people.get(d.uid)))}><Icon name="send" size={14} />Test</button></td>
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

function Stage({ label, detail, ok, bad, pending }: { label: string; detail: string; ok?: boolean; bad?: boolean; pending?: boolean }) {
  const icon = bad ? 'x' : ok ? 'checkCircle' : pending ? 'clock' : 'info';
  return (
    <div className={`stage ${bad ? 'bad' : ok ? 'ok' : 'pending'}`}>
      <Icon name={icon} size={16} />
      <div><b>{label}</b><div className="small muted">{detail}</div></div>
    </div>
  );
}
