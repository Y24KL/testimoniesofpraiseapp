import { useEffect, useState } from 'react';
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
import { Field, Message } from '../components/Field';

export function MediaManager() {
  const [serverStatus, setServerStatus] = useState<ServerMediaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [testUrl, setTestUrl] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<MediaVerifyResult | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    const res = await checkDetailedServerMediaStatus();
    setLastChecked(res.lastChecked);
    if (res.ok && res.data) {
      setServerStatus(res.data);
      setStatusError(null);
      setIsStale(false);
    } else {
      setStatusError(res.error || 'Failed to fetch status from worker relay.');
      if (serverStatus) {
        setIsStale(true);
      }
    }
    setLoading(false);
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
    } catch (e: any) {
      setVerifyResult({ verified: false, error: e?.message || 'Verification failed.' });
    } finally {
      setVerifying(false);
    }
  };

  const bunnyConfigured = Boolean(serverStatus?.providers?.bunny?.configured);
  const bunnyHasAccessKey = serverStatus?.providers?.bunny?.hasAccessKey;
  const cloudinaryConfigured = isCloudinaryAvailable;
  const firebaseConfigured = Boolean(serverStatus?.providers?.firebase?.configured || import.meta.env.VITE_FIREBASE_PROJECT_ID);

  return (
    <>
      <div className="row between" style={{ alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1>Media & Storage Infrastructure</h1>
          <p className="muted" style={{ margin: '4px 0 0 0' }}>
            Multi-cloud media management with Bunny Storage, Cloudinary, and Firebase.
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <button className="btn ghost" onClick={fetchStatus} disabled={loading}>
            {loading ? 'Refreshing…' : '↻ Refresh Status'}
          </button>
          {lastChecked ? (
            <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
              Last checked: {lastChecked.toLocaleTimeString()} {isStale ? '(stale)' : ''}
            </div>
          ) : null}
        </div>
      </div>

      {statusError ? (
        <div style={{ marginBottom: 20 }}>
          <Message kind="err">
            <div className="row between" style={{ alignItems: 'center' }}>
              <div>
                <b>Worker Status Error:</b> {statusError}
                <div style={{ fontSize: 12, marginTop: 4, opacity: 0.9 }}>
                  Target: <code>{workerBaseUrl || 'Not configured'}</code>
                </div>
              </div>
              <button
                className="btn primary"
                style={{ fontSize: 12, padding: '4px 12px', minHeight: 32 }}
                onClick={fetchStatus}
                disabled={loading}
              >
                Retry
              </button>
            </div>
          </Message>
        </div>
      ) : null}

      {/* Storage Providers Overview Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 24 }}>
        {/* Bunny Storage Card */}
        <div className="card" style={{ borderTop: '4px solid #FF8000' }}>
          <div className="row between" style={{ alignItems: 'center' }}>
            <h3 style={{ margin: 0, color: '#FF8000' }}>🐰 Bunny Storage</h3>
            <span
              className={`pill ${
                bunnyConfigured ? 'ok' : bunnyHasAccessKey === false ? 'warn' : 'ghost'
              }`}
            >
              {bunnyConfigured
                ? 'Active & Ready'
                : bunnyHasAccessKey === false
                ? 'Missing Secret'
                : 'Needs Config'}
            </span>
          </div>
          <p className="small muted" style={{ marginTop: 8 }}>
            Assigned for <b>audio testimonies, podcast files, and large video files</b>.
            Uploads are streamed securely server-side so access keys are never exposed.
          </p>
          <div style={{ fontSize: 13, background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 8, marginTop: 12 }}>
            <div>
              <b>Storage Zone:</b> {serverStatus?.providers?.bunny?.storageZone || <span className="muted">Not set in worker</span>}
            </div>
            <div style={{ marginTop: 4 }}>
              <b>CDN Hostname:</b> {serverStatus?.providers?.bunny?.cdnHostname || <span className="muted">Not set in worker</span>}
            </div>
            <div style={{ marginTop: 4 }}>
              <b>Edge Endpoint:</b> {serverStatus?.providers?.bunny?.endpoint || 'storage.bunnycdn.com'}
            </div>
            <div style={{ marginTop: 4 }}>
              <b>Server Secret:</b>{' '}
              {serverStatus?.providers?.bunny?.hasAccessKey ? (
                <span style={{ color: '#4CAF50' }}>Configured on Worker</span>
              ) : (
                <span className="muted">Missing in Worker Secrets</span>
              )}
            </div>
          </div>
        </div>

        {/* Cloudinary Card */}
        <div className="card" style={{ borderTop: '4px solid #3448C5' }}>
          <div className="row between" style={{ alignItems: 'center' }}>
            <h3 style={{ margin: 0, color: '#4A72FF' }}>☁️ Cloudinary</h3>
            <span className={`pill ${cloudinaryConfigured ? 'ok' : 'ghost'}`}>
              {cloudinaryConfigured ? 'Configured (Client)' : 'Needs Config'}
            </span>
          </div>
          <p className="small muted" style={{ marginTop: 8 }}>
            Assigned for <b>images, thumbnails, article covers, and promotion banners</b>.
            Supports automatic format optimization (<code style={{ color: '#F5C542' }}>f_auto,q_auto</code>).
          </p>
          <div style={{ fontSize: 13, background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 8, marginTop: 12 }}>
            <div><b>Cloud Name:</b> {import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || <span className="muted">Not configured</span>}</div>
            <div style={{ marginTop: 4 }}><b>Upload Preset:</b> {import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || <span className="muted">Not configured</span>}</div>
            <div style={{ marginTop: 4 }}><b>Role:</b> Visual & Graphical Assets</div>
          </div>
        </div>

        {/* Firebase Card */}
        <div className="card" style={{ borderTop: '4px solid #FFA000' }}>
          <div className="row between" style={{ alignItems: 'center' }}>
            <h3 style={{ margin: 0, color: '#FFA000' }}>🔥 Firebase</h3>
            <span className={`pill ${serverStatus?.providers?.firebase?.configured ? 'ok' : 'ghost'}`}>
              {serverStatus?.providers?.firebase?.configured ? 'Configured & Connected' : firebaseConfigured ? 'Configured (Local)' : 'Needs Config'}
            </span>
          </div>
          <p className="small muted" style={{ marginTop: 8 }}>
            Handles <b>structured Firestore metadata, authentication tokens, real-time presence</b>, and listener heartbeats.
          </p>
          <div style={{ fontSize: 13, background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 8, marginTop: 12 }}>
            <div><b>Project ID:</b> {import.meta.env.VITE_FIREBASE_PROJECT_ID || 'Connected'}</div>
            <div style={{ marginTop: 4 }}><b>Auth Mode:</b> Admin Token Relay</div>
            <div style={{ marginTop: 4 }}><b>Relay Worker:</b> {isWorkerAvailable ? 'Configured' : <span className="muted">Missing VITE_WORKER_URL</span>}</div>
          </div>
        </div>
      </div>

      {/* URL Reachability & Migration Safeguard Tester */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3>🔍 Media Reachability & URL Verification Tool</h3>
        <p className="muted small">
          Before linking media or applying migrations, test any URL here to verify that it responds with HTTP 200 OK
          and outputs valid audio/video/image byte streams.
        </p>

        <form onSubmit={handleVerify} style={{ marginTop: 16 }}>
          <Field label="Media URL to test">
            <div className="row gap" style={{ alignItems: 'center' }}>
              <input
                type="url"
                value={testUrl}
                onChange={(e) => setTestUrl(e.target.value)}
                placeholder="https://... (Bunny CDN, Cloudinary, HLS, or external URL)"
                style={{ flex: 1 }}
                required
              />
              <button type="submit" className="btn primary" disabled={verifying}>
                {verifying ? 'Checking…' : 'Verify URL'}
              </button>
            </div>
          </Field>
        </form>

        {testUrl ? (
          <div style={{ marginTop: 8, fontSize: 12, color: '#aaa' }}>
            Detected Provider:{' '}
            <b style={{ color: '#F5C542' }}>{getProviderDisplayName(identifyProvider(testUrl))}</b>
          </div>
        ) : null}

        {verifyResult ? (
          <div style={{ marginTop: 16 }}>
            {verifyResult.verified ? (
              <Message kind="ok">
                <b>Reachability Verified (HTTP {verifyResult.status})!</b>
                <div style={{ marginTop: 4, fontSize: 12 }}>
                  Content-Type: <code>{verifyResult.contentType || 'N/A'}</code>
                  {verifyResult.contentLength ? ` • Size: ${Math.round(Number(verifyResult.contentLength) / 1024)} KB` : ''}
                </div>
              </Message>
            ) : (
              <Message kind="err">
                <b>Verification Failed:</b> {verifyResult.error || `Server responded with HTTP ${verifyResult.status}`}.
                Please make sure the file exists and is publicly accessible via CDN.
              </Message>
            )}
          </div>
        ) : null}
      </div>

      {/* Setup & Architecture Guide */}
      <div className="card">
        <h3>📋 Setup & Configuration Guide</h3>
        <div style={{ fontSize: 13, lineHeight: '20px', color: '#ccc' }}>
          <h4 style={{ color: '#F5C542', margin: '12px 0 6px 0' }}>1. Setting up Bunny Storage</h4>
          <ol style={{ paddingLeft: 20, margin: 0 }}>
            <li>Log into your <b>Bunny.net</b> dashboard and create a <b>Storage Zone</b> (e.g. <code>top-media-storage</code>).</li>
            <li>Link a <b>Pull Zone</b> to it (e.g. <code>top-media.b-cdn.net</code> or a custom hostname).</li>
            <li>Copy the <b>Storage Password (AccessKey)</b> from Bunny.net &gt; Storage &gt; FTP &amp; API Access.</li>
            <li>Add secrets to your Cloudflare Worker:
              <pre style={{ background: '#12001C', padding: 8, borderRadius: 6, margin: '6px 0', overflowX: 'auto' }}>
npx wrangler secret put BUNNY_STORAGE_ACCESS_KEY
              </pre>
            </li>
            <li>In <code>wrangler.toml</code> set <code>BUNNY_STORAGE_ZONE_NAME</code> and <code>BUNNY_CDN_HOSTNAME</code>.</li>
          </ol>

          <h4 style={{ color: '#F5C542', margin: '16px 0 6px 0' }}>2. Migration Safeguards</h4>
          <p style={{ margin: 0 }}>
            Existing media URLs (Cloudinary images/videos, HLS livestreams) are preserved automatically.
            Never run destructive migrations. Before switching any document URL, run the audit &amp; verification tool:
          </p>
          <pre style={{ background: '#12001C', padding: 8, borderRadius: 6, margin: '6px 0', overflowX: 'auto' }}>
node scripts/media-migration.mjs --audit
node scripts/media-migration.mjs --verify
          </pre>
        </div>
      </div>
    </>
  );
}
