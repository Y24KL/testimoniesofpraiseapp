import { useEffect, useState } from 'react';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { isHttpUrl } from '../lib';
import type { AdotopocSettings } from '../types';
import { Check, Field, Message } from '../components/Field';
import { Icon } from '../components/Icon';
import { ErrorState, GlassCard, LoadingList, PageHeader, SectionHeader } from '../components/ui';

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
    } catch (ex) {
      setErr((ex as Error).message || 'Failed to save settings.');
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) {
    return (
      <>
        <PageHeader eyebrow="Content Studio" title="ADOTOPOC Resource Centre" />
        {err ? <ErrorState title="Couldn’t load the configuration" message={err} /> : <GlassCard><LoadingList rows={3} /></GlassCard>}
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Content Studio"
        title="ADOTOPOC Resource Centre"
        sub="The resource platform embedded in the app, and the branded intro video people see when they open it."
        actions={isHttpUrl(resourceUrl) ? <a className="btn ghost" href={resourceUrl} target="_blank" rel="noreferrer"><Icon name="external" size={16} />Open resource centre</a> : undefined}
      />

      {err ? <Message kind="err">{err}</Message> : null}
      {ok ? <Message kind="ok">{ok}</Message> : null}

      <form onSubmit={save}>
        <div className="split">
          <GlassCard>
            <SectionHeader icon="globe" title="Resource platform" />
            <Field label="Resource platform link *" hint="The page the app opens inside the ADOTOPOC section.">
              <input type="url" value={resourceUrl} onChange={(e) => setResourceUrl(e.target.value)} placeholder={DEFAULT_RESOURCE_URL} required />
            </Field>
            <SectionHeader icon="film" title="Intro video" as="h3" />
            <Field label="Intro video link" hint="An MP4 link. It plays once when someone opens the section.">
              <input type="url" value={introVideoUrl} onChange={(e) => setIntroVideoUrl(e.target.value)} placeholder="https://… .mp4" />
            </Field>
            <Check label="Play the intro video when the section opens" checked={introEnabled} onChange={setIntroEnabled} />
            <div className="form-actions">
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  setResourceUrl(DEFAULT_RESOURCE_URL);
                  setIntroVideoUrl(DEFAULT_INTRO_VIDEO);
                  setIntroEnabled(true);
                }}
              >
                <Icon name="undo" size={14} />Reset to defaults
              </button>
              <button type="submit" className="btn primary" disabled={busy}>
                {busy ? <span className="spin sm" aria-hidden="true" /> : <Icon name="check" size={16} />}{busy ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </GlassCard>
          <GlassCard>
            <SectionHeader icon="eye" title="Intro preview" hint={introEnabled ? 'Plays when the section opens.' : 'Turned off: people go straight to the resources.'} />
            {introVideoUrl && isHttpUrl(introVideoUrl) ? <video className="preview" src={introVideoUrl} controls preload="metadata" style={introEnabled ? undefined : { opacity: 0.5 }} /> : <div className="cover-empty">No intro video link</div>}
          </GlassCard>
        </div>
      </form>
    </>
  );
}
