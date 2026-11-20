import { useEffect, useRef, useState } from 'react';
import {
  checkDetailedServerMediaStatus,
  verifyMediaReachability,
  identifyProvider,
  getProviderDisplayName,
  isCloudinaryAvailable,
  isWorkerAvailable,
  workerBaseUrl,
  type ServerMediaStatus,
  type MediaVerifyResult,
} from '../mediaService';
import { Message } from '../components/Field';
import { Icon } from '../components/Icon';
import { ErrorState, GlassCard, PageHeader, SectionHeader, StatusBadge } from '../components/ui';

export function MediaManager() {
  const [serverStatus, setServerStatus] = useState<ServerMediaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [testUrl, setTestUrl] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<MediaVerifyResult | null>(null);

  const inFlight = useRef(false);

  const fetchStatus = async () => {
    if (inFlight.current) return; // ignore rapid repeat clicks
    inFlight.current = true;
    setLoading(true);
    try {
      const res = await checkDetailedServerMediaStatus();
      setLastChecked(res.lastChecked);
      if (res.ok && res.data) {
        setServerStatus(res.data);
        setStatusError(null);
        setIsStale(false);
      } else {
        setStatusError(res.error || 'Failed to fetch status from worker relay.');
        setIsStale((prev) => prev || serverStatus !== null);
      }
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testUrl.trim()) return;
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await verifyMediaReachability(testUrl.trim());
      setVerifyResult(res);
    } catch (e) {
      setVerifyResult({ verified: false, error: (e as Error)?.message || 'Verification failed.' });
    } finally {
      setVerifying(false);
    }
  };

  const bunnyConfigured = Boolean(serverStatus?.providers?.bunny?.configured);
  const bunnyHasAccessKey = serverStatus?.providers?.bunny?.hasAccessKey;
  const cloudinaryConfigured = isCloudinaryAvailable;
  const firebaseConfigured = Boolean(serverStatus?.providers?.firebase?.configured || import.meta.env.VITE_FIREBASE_PROJECT_ID);

  const bunnyBadge = bunnyConfigured ? { kind: 'ok' as const, text: 'Active' } : bunnyHasAccessKey === false ? { kind: 'warn' as const, text: 'Missing secret' } : serverStatus ? { kind: 'warn' as const, text: 'Needs config' } : { kind: 'draft' as const, text: 'Status unknown' };
  const unknown = (configuredText: string) => <span className="muted">{serverStatus ? configuredText : 'Unknown'}</span>;

  return (
    <>
      <PageHeader
        eyebrow="Content Studio"
        title="Media & Storage"
        sub="Where uploads go: Bunny Storage for large video and audio, Cloudinary for images, Firebase for data. Storage secrets stay on the Worker; this page only reads their status."
        actions={
          <>
            {lastChecked ? <span className="small muted">Checked {lastChecked.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}{isStale ? ' (stale)' : ''}</span> : null}
            <button type="button" className="btn ghost" onClick={() => void fetchStatus()} disabled={loading}>
              <Icon name="refresh" size={16} className={loading ? 'spinning' : undefined} />{loading ? 'Checking…' : 'Refresh status'}
            </button>
          </>
        }
      />

      {statusError ? (
        <ErrorState
          title="Couldn’t read the Worker’s storage status"
          message={<>{statusError} · Target: <code>{workerBaseUrl || 'not configured'}</code></>}
          onRetry={() => void fetchStatus()}
        />
      ) : null}

      <div className="provider-grid">
        <GlassCard>
          <div className="provider-head">
            <h3><span className="mark" style={{ background: '#FF8000' }}><Icon name="hardDrive" size={18} /></span>Bunny Storage</h3>
            {loading && !serverStatus ? <span className="skeleton" style={{ width: 80, height: 22 }} /> : <StatusBadge kind={bunnyBadge.kind}>{bunnyBadge.text}</StatusBadge>}
          </div>
          <p className="provider-role">For <b>audio testimonies, podcast files and large videos</b>. Uploads stream through the Worker, so the access key never reaches the browser.</p>
          <dl className="spec">
            <div><dt>Storage zone</dt><dd>{serverStatus?.providers?.bunny?.storageZone || unknown('Not set on the Worker')}</dd></div>
            <div><dt>CDN hostname</dt><dd>{serverStatus?.providers?.bunny?.cdnHostname || unknown('Not set on the Worker')}</dd></div>
            <div><dt>Edge endpoint</dt><dd>{serverStatus?.providers?.bunny?.endpoint || 'storage.bunnycdn.com'}</dd></div>
            <div><dt>Server secret</dt><dd>{serverStatus?.providers?.bunny?.hasAccessKey ? <span style={{ color: 'var(--success)' }}>Set on the Worker</span> : unknown('Missing from Worker secrets')}</dd></div>
          </dl>
        </GlassCard>

        <GlassCard>
          <div className="provider-head">
            <h3><span className="mark" style={{ background: '#3448C5' }}><Icon name="cloud" size={18} /></span>Cloudinary</h3>
            <StatusBadge kind={cloudinaryConfigured ? 'ok' : 'warn'}>{cloudinaryConfigured ? 'Configured' : 'Needs config'}</StatusBadge>
          </div>
          <p className="provider-role">For <b>images, thumbnails, article covers and promotion banners</b>, with automatic format optimisation (<code>f_auto,q_auto</code>).</p>
          <dl className="spec">
            <div><dt>Cloud name</dt><dd>{import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || <span className="muted">Not configured</span>}</dd></div>
            <div><dt>Upload preset</dt><dd>{import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || <span className="muted">Not configured</span>}</dd></div>
            <div><dt>Role</dt><dd>Images and graphics</dd></div>
          </dl>
        </GlassCard>

        <GlassCard>
          <div className="provider-head">
            <h3><span className="mark" style={{ background: '#E8860C' }}><Icon name="database" size={18} /></span>Firebase</h3>
            <StatusBadge kind={serverStatus?.providers?.firebase?.configured || firebaseConfigured ? 'ok' : 'warn'}>
              {serverStatus?.providers?.firebase?.configured ? 'Connected' : firebaseConfigured ? 'Configured locally' : 'Needs config'}
            </StatusBadge>
          </div>
          <p className="provider-role">Holds <b>Firestore data, sign-in and real-time presence</b>.</p>
          <dl className="spec">
            <div><dt>Project ID</dt><dd>{import.meta.env.VITE_FIREBASE_PROJECT_ID || 'Connected'}</dd></div>
            <div><dt>Auth mode</dt><dd>Admin token relay</dd></div>
            <div><dt>Relay Worker</dt><dd>{isWorkerAvailable ? 'Configured' : <span className="muted">Missing VITE_WORKER_URL</span>}</dd></div>
          </dl>
        </GlassCard>
      </div>

      <GlassCard>
        <SectionHeader icon="search" title="Check a media link" hint="Before linking media or migrating, confirm a URL answers HTTP 200 with real audio, video or image data." />
        <form onSubmit={handleVerify}>
          <div className="input-row">
            <input type="url" value={testUrl} onChange={(e) => setTestUrl(e.target.value)} placeholder="https://… (Bunny CDN, Cloudinary, HLS or another host)" aria-label="Media URL to test" required />
            <button type="submit" className="btn primary" disabled={verifying}>
              {verifying ? <span className="spin sm" aria-hidden="true" /> : <Icon name="check" size={16} />}{verifying ? 'Checking…' : 'Verify link'}
            </button>
          </div>
        </form>
        {testUrl ? <div className="provider-note" style={{ marginTop: 10 }}><Icon name="cloud" size={14} />Detected provider: <b>{getProviderDisplayName(identifyProvider(testUrl))}</b></div> : null}
        {verifyResult ? (
          verifyResult.verified ? (
            <Message kind="ok">
              <b>Reachable (HTTP {verifyResult.status}).</b>{' '}
              Content type <code>{verifyResult.contentType || 'n/a'}</code>
              {verifyResult.contentLength ? ` · ${Math.round(Number(verifyResult.contentLength) / 1024).toLocaleString()} KB` : ''}
            </Message>
          ) : (
            <Message kind="err">
              <b>Not reachable:</b> {verifyResult.error || `the server answered HTTP ${verifyResult.status}`}. Check the file exists and is public on the CDN.
            </Message>
          )
        ) : null}
      </GlassCard>

      <GlassCard>
        <SectionHeader icon="info" title="Setup guide" />
        <div className="guide">
          <h4>1. Bunny Storage</h4>
          <ol>
            <li>In the <b>Bunny.net</b> dashboard, create a <b>Storage Zone</b> (for example <code>top-media-storage</code>).</li>
            <li>Link a <b>Pull Zone</b> to it (for example <code>top-media.b-cdn.net</code> or a custom hostname).</li>
            <li>Copy the <b>Storage Password (AccessKey)</b> from Storage → FTP &amp; API Access.</li>
            <li>Add it to the Cloudflare Worker as a secret, never to this portal:
              <pre className="code-block">npx wrangler secret put BUNNY_STORAGE_ACCESS_KEY</pre>
            </li>
            <li>In <code>wrangler.toml</code>, set <code>BUNNY_STORAGE_ZONE_NAME</code> and <code>BUNNY_CDN_HOSTNAME</code>.</li>
          </ol>
          <h4>2. Migration safeguards</h4>
          <p style={{ margin: 0 }}>Existing media links (Cloudinary images and videos, HLS streams) are kept as they are. Never run destructive migrations. Before switching any document’s link, audit and verify:</p>
          <pre className="code-block">{'node scripts/media-migration.mjs --audit\nnode scripts/media-migration.mjs --verify'}</pre>
        </div>
      </GlassCard>
    </>
  );
}
