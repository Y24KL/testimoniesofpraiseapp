import { useState } from 'react';
import { DATA_COLLECTIONS, downloadJson, exportEverything, resetEverything, type ResetResult } from '../dataOps';
import { Message } from '../components/Field';
import { Icon } from '../components/Icon';
import { useConfirm } from '../components/feedback';
import { usePendingCounts } from '../hooks/usePendingCounts';
import { GlassCard, PageHeader, SectionHeader } from '../components/ui';
import { TagBackfill } from '../components/TagBackfill';

const CONFIRM_PHRASE = 'DELETE EVERYTHING';

export function DataSettings() {
  const confirm = useConfirm();
  const { refresh: refreshCounts } = usePendingCounts();
  // --- export ---
  const [exporting, setExporting] = useState(false);
  const [exportStep, setExportStep] = useState('');
  const [exportErr, setExportErr] = useState('');

  const runExport = async () => {
    setExporting(true);
    setExportErr('');
    try {
      const data = await exportEverything(setExportStep);
      downloadJson(data, `testimonies-of-praise-export-${new Date().toISOString().slice(0, 10)}.json`);
    } catch (e) {
      setExportErr((e as Error).message);
    }
    setExporting(false);
    setExportStep('');
  };

  // --- reset ---
  const [step, setStep] = useState<'idle' | 'running' | 'done'>('idle');
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<ResetResult | null>(null);
  const [resetErr, setResetErr] = useState('');

  const askReset = async () => {
    const yes = await confirm({
      title: 'Permanently delete all app data?',
      message: (
        <>
          <p style={{ marginTop: 0 }}>This deletes every document in:</p>
          <div className="chips" style={{ marginBottom: 12 }}>{DATA_COLLECTIONS.map((c) => <span key={c} className="tag">{c}</span>)}</div>
          <p style={{ margin: 0 }}>plus live chat and live viewer records, and puts the live stream back to offline. Admin accounts are kept. Nothing is backed up automatically.</p>
        </>
      ),
      confirmLabel: 'Permanently delete',
      danger: true,
      requireText: CONFIRM_PHRASE,
    });
    if (!yes) return;
    setStep('running');
    setResetErr('');
    try {
      const r = await resetEverything(setProgress);
      setResult(r);
      setStep('done');
      refreshCounts();
    } catch (e) {
      setResetErr((e as Error).message);
      setStep('idle');
    }
  };

  const removed = result ? Object.entries(result.counts) : [];
  const total = removed.reduce((n, [, v]) => n + (Number(v) || 0), 0);

  return (
    <>
      <PageHeader eyebrow="System" title="Data Management" sub="Tag content for recommendations, back up everything the portal collects, or wipe it to start fresh before launch." />

      <TagBackfill />

      <div className="split">
        <GlassCard>
          <SectionHeader icon="download" title="Download everything" hint="One JSON file, generated in your browser." />
          <p className="muted small" style={{ marginTop: 0 }}>
            Every testimony, submission, notification, sponsorship, push token and analytics event. Admin accounts, live chat and live viewer presence aren’t included: the first is identity data, and the other two are temporary.
          </p>
          <div className="chips" style={{ marginBottom: 16 }}>{DATA_COLLECTIONS.map((c) => <span key={c} className="tag">{c}</span>)}</div>
          {exportErr ? <Message kind="err">{exportErr}</Message> : null}
          <button type="button" className="btn primary" disabled={exporting} onClick={() => void runExport()}>
            {exporting ? <span className="spin sm" aria-hidden="true" /> : <Icon name="download" size={16} />}
            {exporting ? `Exporting ${exportStep}…` : 'Download data (.json)'}
          </button>
        </GlassCard>

        <GlassCard className="danger-zone">
          <SectionHeader icon="alert" title="Reset everything" hint="Danger zone" />
          <p className="small" style={{ marginTop: 0 }}>
            Permanently deletes every testimony, submission, notification, sponsorship, push token, analytics event, live chat message and live viewer record, and sets the live stream to offline.
          </p>
          <ul className="small muted" style={{ paddingLeft: 18 }}>
            <li><b style={{ color: 'var(--text)' }}>Admin accounts are never touched</b>, so you can’t lock yourself out.</li>
            <li>This can’t be undone. Download the data first if you want a copy.</li>
            <li>You’ll be asked to type <b className="gold">{CONFIRM_PHRASE}</b>.</li>
          </ul>
          {resetErr ? <Message kind="err">Reset stopped: {resetErr}</Message> : null}
          {step === 'running' ? (
            <div className="row gap" role="status"><span className="spin sm" aria-hidden="true" />Deleting {progress}… Keep this page open.</div>
          ) : (
            <button type="button" className="btn danger" onClick={() => void askReset()}><Icon name="trash" size={16} />Reset everything…</button>
          )}
        </GlassCard>
      </div>

      {step === 'done' && result ? (
        <GlassCard>
          <SectionHeader icon="checkCircle" title="Reset complete" hint={`${total.toLocaleString()} records removed`} actions={<button type="button" className="btn ghost small" onClick={() => { setStep('idle'); setResult(null); }}>Close</button>} />
          <div className="table-wrap">
            <table>
              <thead><tr><th>Collection</th><th>Removed</th></tr></thead>
              <tbody>{removed.map(([name, n]) => <tr key={name}><td><code>{name}</code></td><td className="tabular">{String(n)}</td></tr>)}</tbody>
            </table>
          </div>
        </GlassCard>
      ) : null}
    </>
  );
}
