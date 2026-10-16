import { useEffect, useState } from 'react';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { isHttpUrl } from '../lib';
import type { AdotopocSettings } from '../types';
import { Check, Field, Message } from '../components/Field';

const DEFAULT_RESOURCE_URL = 'https://testimoniesofpraiseweb.onrender.com/adotopoc';
const DEFAULT_INTRO_VIDEO = 'https://res.cloudinary.com/duw6xrnpn/video/upload/v1792135475/ADOTOP_LOGO_OUTRO_m1awjk.mp4';

export function AdotopocConfig() {
  const settingsRef = doc(db, 'settings', 'adotopoc');
  const [resourceUrl, setResourceUrl] = useState(DEFAULT_RESOURCE_URL);
  const [introVideoUrl, setIntroVideoUrl] = useState(DEFAULT_INTRO_VIDEO);
  const [introEnabled, setIntroEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  useEffect(() => {
    return onSnapshot(
      settingsRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as AdotopocSettings;
          if (data.resourcePageUrl) setResourceUrl(data.resourcePageUrl);
          if (data.introVideoUrl) setIntroVideoUrl(data.introVideoUrl);
          if (data.introEnabled !== undefined) setIntroEnabled(data.introEnabled);
        }
        setLoaded(true);
      },
      (e) => setErr(e.message)
    );
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setOk('');

    if (!resourceUrl.trim() || !isHttpUrl(resourceUrl)) {
      return setErr('Please provide a valid https:// resource URL.');
    }
    if (introEnabled && (!introVideoUrl.trim() || !isHttpUrl(introVideoUrl))) {
      return setErr('Please provide a valid https:// intro video URL or disable the intro video.');
    }

    setBusy(true);
    try {
      await setDoc(
        settingsRef,
        {
          resourcePageUrl: resourceUrl.trim(),
          introVideoUrl: introVideoUrl.trim(),
          introEnabled,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setOk('ADOTOPOC Resource Center configuration saved.');
    } catch (ex: any) {
      setErr(ex.message || 'Failed to save settings.');
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) return <p className="muted">Loading configuration…</p>;

  return (
    <>
      <h1>ADOTOPOC Resource Center Configuration</h1>
      <p className="muted">
        Configure the embedded resource center platform and branded intro video parameters.
      </p>

      {err ? <Message kind="err">{err}</Message> : null}
      {ok ? <Message kind="ok">{ok}</Message> : null}

      <form onSubmit={save} className="card" style={{ maxWidth: 640 }}>
        <Field label="ADOTOPOC Resource Platform URL *">
          <input
            type="url"
            value={resourceUrl}
            onChange={(e) => setResourceUrl(e.target.value)}
            placeholder="https://testimoniesofpraiseweb.onrender.com/adotopoc"
            required
          />
        </Field>

        <Field label="Branded Intro Video URL">
          <input
            type="url"
            value={introVideoUrl}
            onChange={(e) => setIntroVideoUrl(e.target.value)}
            placeholder="https://... (.mp4 video link)"
          />
        </Field>

        <div style={{ margin: '14px 0' }}>
          <Check
            label="Enable Intro Video on section entry"
            checked={introEnabled}
            onChange={setIntroEnabled}
          />
        </div>

        {introVideoUrl ? (
          <div style={{ marginTop: 12, marginBottom: 16 }}>
            <p className="small muted" style={{ marginBottom: 6 }}>Video Preview:</p>
            <video
              src={introVideoUrl}
              controls
              style={{ width: '100%', maxHeight: 200, borderRadius: 6, backgroundColor: '#000' }}
            />
          </div>
        ) : null}

        <div className="row between" style={{ marginTop: 20 }}>
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              setResourceUrl(DEFAULT_RESOURCE_URL);
              setIntroVideoUrl(DEFAULT_INTRO_VIDEO);
              setIntroEnabled(true);
            }}
          >
            Reset Defaults
          </button>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </>
  );
}
