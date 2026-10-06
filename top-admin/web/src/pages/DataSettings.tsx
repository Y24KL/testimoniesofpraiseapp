import { useState } from 'react';
import { DATA_COLLECTIONS, downloadJson, exportEverything, resetEverything, type ResetResult } from '../dataOps';
import { Message } from '../components/Field';

const CONFIRM_PHRASE = 'DELETE EVERYTHING';

export function DataSettings() {
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
  const [confirmText, setConfirmText] = useState('');
  const [step, setStep] = useState<'idle' | 'confirming' | 'running' | 'done'>('idle');
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<ResetResult | null>(null);
  const [resetErr, setResetErr] = useState('');

  const runReset = async () => {
    setStep('running');
    setResetErr('');
    try {
      const r = await resetEverything(setProgress);
      setResult(r);
      setStep('done');
    } catch (e) {
      setResetErr((e as Error).message);
      setStep('confirming');
    }
  };

  return (
    <>
      <h1>Data</h1>
      <p className="muted">Back up everything the portal collects, or wipe it to start fresh before launch.</p>

      <div className="card">
        <h2>Download everything</h2>
        <p className="muted small">
          One JSON file with every testimony, submission, notification, sponsorship, push token, and analytics
          event. (Admin accounts, live chat, and live viewer presence aren't included — the first is identity
          data, the other two are transient and not meant to be backed up.)
        </p>
        {exportErr ? <Message kind="err">{exportErr}</Message> : null}
        <button className="btn" disabled={exporting} onClick={() => void runExport()}>
          {exporting ? `Exporting ${exportStep}…` : 'DOWNLOAD DATA (.json)'}
        </button>
      </div>

      <div className="card" style={{ borderColor: 'var(--danger)' }}>
        <h2 style={{ color: 'var(--danger)' }}>Reset everything</h2>
        <p className="muted small">
          Permanently deletes every testimony, submission, notification, sponsorship, push token registration,
          analytics event, live chat message, and live viewer record — and puts the live stream back to
          offline. <b>Admin accounts are never touched</b> — you can't lock yourself out this way. This cannot
          be undone; there is no backup made automatically, so download the data above first if you want one.
        </p>

        {step === 'idle' ? (
          <button className="btn danger" onClick={() => setStep('confirming')}>
            RESET EVERYTHING
          </button>
        ) : null}

        {step === 'confirming' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {resetErr ? <Message kind="err">{resetErr}</Message> : null}
            <p>
              This deletes data from: <code>{DATA_COLLECTIONS.join(', ')}</code>, plus live chat and live
              viewer records, across every testimony and every user. Type <b>{CONFIRM_PHRASE}</b> to confirm.
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={CONFIRM_PHRASE}
              autoComplete="off"
            />
            <div className="row">
              <button className="btn danger" disabled={confirmText !== CONFIRM_PHRASE} onClick={() => void runReset()}>
                PERMANENTLY DELETE
              </button>
              <button
                className="btn ghost"
                onClick={() => {
                  setStep('idle');
                  setConfirmText('');
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {step === 'running' ? <p>Deleting {progress}…</p> : null}

        {step === 'done' && result ? (
          <div>
            <Message kind="ok">Done. Here's what was removed:</Message>
            <ul className="small">
              {Object.entries(result.counts).map(([name, n]) => (
                <li key={name}>
                  {name}: {n}
                </li>
              ))}
            </ul>
            <button
              className="btn ghost"
              onClick={() => {
                setStep('idle');
                setConfirmText('');
                setResult(null);
              }}
            >
              Close
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
}
