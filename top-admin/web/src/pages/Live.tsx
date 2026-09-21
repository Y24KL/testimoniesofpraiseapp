import { useEffect, useState } from 'react';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { describe, notifyLiveStarted } from '../notify';
import { isHttpUrl } from '../lib';
import { Check, Field, Message } from '../components/Field';
import { StreamPreview } from '../components/StreamPreview';

export function Live() {
  const liveRef = doc(db, 'settings', 'live');
  const [isLive, setIsLive] = useState(false);
  const [streamUrl, setStreamUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [thumbnail, setThumbnail] = useState('');
  const [notifyOnStart, setNotify] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [preview, setPreview] = useState('');

  // Load once; the form is then edited locally so live typing isn't overwritten.
  useEffect(
    () =>
      onSnapshot(liveRef, (s) => {
        const x = s.data() ?? {};
        setIsLive(x.isLive === true);
        if (!loaded) {
          setStreamUrl(x.streamUrl ?? ''); setTitle(x.title ?? ''); setDescription(x.description ?? ''); setThumbnail(x.thumbnail ?? '');
          setLoaded(true);
        }
      }, (e) => setErr(e.message)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const write = async (live: boolean, message: string) => {
    setErr(''); setOk('');
    if (streamUrl && !isHttpUrl(streamUrl)) return setErr('The stream link must start with https://');
    if (thumbnail && !isHttpUrl(thumbnail)) return setErr('The thumbnail link must start with https://');
    if (live && !streamUrl) return setErr('Add the stream link (HLS .m3u8) before going live.');
    if (live && !isLive && notifyOnStart && !confirm('Going live sends a push notification to app users. Continue?')) return;
    setBusy(true);
    try {
      await setDoc(liveRef, { isLive: live, streamUrl: streamUrl.trim(), title: title.trim(), description: description.trim(), thumbnail: thumbnail.trim(), notifyOnStart, updatedAt: serverTimestamp() }, { merge: true });
      if (live && !isLive && notifyOnStart) {
        const r = await notifyLiveStarted(title.trim());
        setOk(`${message} ${describe(r)}`);
      } else {
        setOk(message);
      }
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  };

  if (!loaded) return <p className="muted">Loading…</p>;
  return (
    <>
      <h1>Live stream</h1>
      <p className="muted">The app shows “LIVE NOW” the moment you go live, and “Live stream is currently offline” when you end it.</p>
      {err ? <Message kind="err">{err}</Message> : null}
      {ok ? <Message kind="ok">{ok}</Message> : null}

      <div className="card">
        <div className="row between">
          <div><span className={`dot ${isLive ? 'on' : ''}`} /><b>{isLive ? 'LIVE NOW' : 'Offline'}</b></div>
          {isLive
            ? <button className="btn danger" disabled={busy} onClick={() => void write(false, 'Stream ended. The app now shows it as offline.')}>END STREAM</button>
            : <button className="btn live" disabled={busy} onClick={() => void write(true, 'You’re live. The app is showing the stream.')}>GO LIVE</button>}
        </div>
      </div>

      <div className="card">
        <h2>Stream details</h2>
        <Field label="Stream link (HLS .m3u8) *" hint="The playback URL from your streaming provider or server, the one OBS publishes to.">
          <input type="url" placeholder="https://…/stream.m3u8" value={streamUrl} onChange={(e) => setStreamUrl(e.target.value)} />
        </Field>
        <div className="row" style={{ marginBottom: 14 }}>
          <button className="btn ghost small" disabled={!streamUrl} onClick={() => setPreview(streamUrl)}>Test this stream</button>
          {streamUrl ? <a className="small" href={streamUrl} target="_blank" rel="noreferrer">Open link</a> : null}
        </div>
        {preview ? <StreamPreview url={preview} /> : null}
        <div className="two" style={{ marginTop: 14 }}>
          <Field label="Title"><input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Sunday Testimony Service" /></Field>
          <Field label="Thumbnail link (optional)"><input type="url" value={thumbnail} onChange={(e) => setThumbnail(e.target.value)} placeholder="https://" /></Field>
        </div>
        <Field label="Description"><textarea value={description} onChange={(e) => setDescription(e.target.value)} style={{ minHeight: 80 }} /></Field>
        <Check checked={notifyOnStart} onChange={setNotify} label="Send a push notification when I go live" />
        <button className="btn" disabled={busy} onClick={() => void write(isLive, 'Saved.')}>SAVE DETAILS</button>
        {isLive ? <span className="small muted" style={{ marginLeft: 12 }}>Changes apply to viewers immediately.</span> : null}
      </div>
    </>
  );
}
