import { useEffect, useState } from 'react';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { describe, notifyLiveStarted } from '../notify';
import { isHls, isHttpUrl, isYouTubeUrl, parseYouTubeId } from '../lib';
import { Check, Field, Message } from '../components/Field';
import { StreamPreview } from '../components/StreamPreview';

type SourceType = 'hls' | 'youtube' | 'unknown';
const sourceTypeOf = (url: string): SourceType => (isYouTubeUrl(url) ? 'youtube' : isHls(url) ? 'hls' : 'unknown');

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
    const type = sourceTypeOf(streamUrl);
    if (streamUrl && !isHttpUrl(streamUrl)) return setErr('The stream link must start with https://');
    if (thumbnail && !isHttpUrl(thumbnail)) return setErr('The thumbnail link must start with https://');
    if (live && !streamUrl) return setErr('Add a stream link (YouTube, or an HLS .m3u8 link) before going live.');
    if (live && type === 'unknown') return setErr('That link isn’t a YouTube link or an HLS (.m3u8) link.');
    if (live && !isLive && notifyOnStart && !confirm('Going live sends a push notification to app users. Continue?')) return;
    setBusy(true);
    try {
      await setDoc(liveRef, { isLive: live, streamUrl: streamUrl.trim(), sourceType: type, title: title.trim(), description: description.trim(), thumbnail: thumbnail.trim(), notifyOnStart, updatedAt: serverTimestamp() }, { merge: true });
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
        <Field label="Stream link *" hint="A YouTube video/live link, or an HLS (.m3u8) playback URL from your streaming provider or server (the one OBS publishes to).">
          <input type="url" placeholder="https://youtube.com/watch?v=… or https://…/stream.m3u8" value={streamUrl} onChange={(e) => setStreamUrl(e.target.value)} />
        </Field>
        {streamUrl && sourceTypeOf(streamUrl) === 'unknown' ? (
          <Message kind="err">That doesn’t look like a YouTube link or an HLS (.m3u8) link.</Message>
        ) : null}
        <div className="row" style={{ marginBottom: 14 }}>
          <button className="btn ghost small" disabled={!streamUrl || sourceTypeOf(streamUrl) === 'unknown'} onClick={() => setPreview(streamUrl)}>Test this stream</button>
          {streamUrl ? <a className="small" href={streamUrl} target="_blank" rel="noreferrer">Open link</a> : null}
          {streamUrl && sourceTypeOf(streamUrl) !== 'unknown' ? <span className="pill">{sourceTypeOf(streamUrl).toUpperCase()}</span> : null}
        </div>
        {preview ? (
          parseYouTubeId(preview) ? (
            <div className="preview" style={{ position: 'relative', paddingTop: '56.25%' }}>
              <iframe
                title="Stream preview"
                src={`https://www.youtube.com/embed/${parseYouTubeId(preview)}`}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, borderRadius: 12 }}
                allow="autoplay; encrypted-media"
                allowFullScreen
              />
            </div>
          ) : (
            <StreamPreview url={preview} />
          )
        ) : null}
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
