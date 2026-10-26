import { useEffect, useState } from 'react';
import { collection, doc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { describe, notifyLiveStarted } from '../notify';
import { isHls, isHttpUrl, isYouTubeUrl, parseYouTubeId } from '../lib';
import { Check, Field, Message } from '../components/Field';
import { StreamPreview } from '../components/StreamPreview';
import { ChatModeration } from '../components/ChatModeration';
import { ViewerCount } from '../components/ViewerCount';

type SourceType = 'hls' | 'youtube' | 'unknown';
const sourceTypeOf = (url: string): SourceType => (isYouTubeUrl(url) ? 'youtube' : isHls(url) ? 'hls' : 'unknown');
// Pre-live media may also be a plain video file (e.g. an MP4 on Bunny/Cloudinary).
const isVideoFile = (url: string) => /\.(mp4|m4v|mov|webm)(\?|#|$)/i.test(url);
const preLiveKind = (url: string) => (isYouTubeUrl(url) ? 'YOUTUBE' : isHls(url) ? 'HLS' : isVideoFile(url) ? 'VIDEO FILE' : '');
interface PickItem { id: string; title: string; url: string; thumbnail: string }

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
  const [sessionId, setSessionId] = useState('');
  // Pre-live playback: the SAVED setting (from Firestore) is kept apart from the form being edited.
  const [saved, setSaved] = useState({ enabled: false, url: '' });
  const [preEnabled, setPreEnabled] = useState(false);
  const [preUrl, setPreUrl] = useState('');
  const [preTitle, setPreTitle] = useState('');
  const [preDescription, setPreDescription] = useState('');
  const [preThumb, setPreThumb] = useState('');
  const [preBusy, setPreBusy] = useState(false);
  const [preErr, setPreErr] = useState('');
  const [preOk, setPreOk] = useState('');
  const [prePreview, setPrePreview] = useState('');
  const [picks, setPicks] = useState<PickItem[] | null>(null);

  // Load once; the form is then edited locally so live typing isn't overwritten.
  useEffect(
    () =>
      onSnapshot(liveRef, (s) => {
        const x = s.data() ?? {};
        setIsLive(x.isLive === true);
        setSessionId(x.sessionId ?? '');
        setSaved({ enabled: x.preLiveEnabled === true, url: x.preLiveUrl ?? '' });
        if (!loaded) {
          setPreEnabled(x.preLiveEnabled === true); setPreUrl(x.preLiveUrl ?? ''); setPreTitle(x.preLiveTitle ?? '');
          setPreDescription(x.preLiveDescription ?? ''); setPreThumb(x.preLiveThumbnail ?? '');
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
      // A fresh session id each time we go live (offline -> live) resets the chat for the new stream.
      const goingLive = live && !isLive;
      const newSessionId = goingLive ? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` : sessionId;
      await setDoc(
        liveRef,
        {
          isLive: live,
          streamUrl: streamUrl.trim(),
          sourceType: type,
          sessionId: newSessionId,
          title: title.trim(),
          description: description.trim(),
          thumbnail: thumbnail.trim(),
          notifyOnStart,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      if (goingLive) setSessionId(newSessionId);
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

  const loadPicks = async () => {
    setPreErr('');
    try {
      const snap = await getDocs(query(collection(db, 'testimonies'), where('isPublished', '==', true), orderBy('createdAt', 'desc'), limit(50)));
      setPicks(
        snap.docs
          .map((d) => ({ id: d.id, title: String(d.get('title') ?? ''), url: String(d.get('videoUrl') ?? '').trim(), thumbnail: String(d.get('thumbnail') ?? '') }))
          .filter((t) => isHttpUrl(t.url) && preLiveKind(t.url)),
      );
    } catch (e) {
      setPreErr(`Couldn't load testimonies: ${(e as Error).message}`);
    }
  };

  const savePreLive = async (enabled: boolean) => {
    setPreErr(''); setPreOk('');
    const url = preUrl.trim();
    if (url && !/^https:\/\/\S+$/i.test(url)) return setPreErr('The pre-live link must start with https://');
    if (enabled && !url) return setPreErr('Add the video to play before turning pre-live playback on.');
    if (enabled && !preLiveKind(url)) return setPreErr('Use a YouTube link, an HLS (.m3u8) link, or a video file link (.mp4, .m4v, .mov, .webm).');
    if (preThumb.trim() && !isHttpUrl(preThumb.trim())) return setPreErr('The thumbnail link must start with https://');
    setPreBusy(true);
    try {
      await setDoc(
        liveRef,
        {
          preLiveEnabled: enabled,
          preLiveUrl: url,
          preLiveTitle: preTitle.trim(),
          preLiveDescription: preDescription.trim(),
          preLiveThumbnail: preThumb.trim(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      setPreOk(
        enabled
          ? isLive
            ? 'Saved: pre-live playback is ON. You are live right now, so viewers keep seeing the live stream; the pre-live video shows after you end it.'
            : 'Saved: pre-live playback is ON. Viewers now see “We’re not live yet — watch while you wait”.'
          : 'Saved: pre-live playback is OFF. Viewers see the normal offline screen, and any pre-live video stops.',
      );
    } catch (e) {
      setPreErr(`Not saved: ${(e as Error).message}`);
    }
    setPreBusy(false);
  };

  const viewersSee = isLive ? 'The live stream' : saved.enabled && saved.url ? 'The pre-live video (“Watch while you wait”)' : 'The offline screen';

  if (!loaded) return <p className="muted">Loading…</p>;
  return (
    <>
      <h1>Live stream</h1>
      <p className="muted">The app shows “LIVE NOW” the moment you go live, and “Live stream is currently offline” when you end it.</p>
      {err ? <Message kind="err">{err}</Message> : null}
      {ok ? <Message kind="ok">{ok}</Message> : null}

      <div className="card">
        <div className="row between">
          <div>
            <span className={`dot ${isLive ? 'on' : ''}`} /><b>{isLive ? 'LIVE NOW' : 'Offline'}</b>
            {isLive && sessionId ? <ViewerCount sessionId={sessionId} /> : null}
          </div>
          {isLive
            ? <button className="btn danger" disabled={busy} onClick={() => void write(false, 'Stream ended. The app now shows it as offline.')}>END STREAM</button>
            : <button className="btn live" disabled={busy} onClick={() => void write(true, 'You’re live. The app is showing the stream.')}>GO LIVE</button>}
        </div>
      </div>

      {isLive && sessionId ? (
        <div className="card">
          <h2>Live chat</h2>
          <p className="muted small">Long-press (or right-click) isn't needed here — every message has its own delete button. Reported messages are flagged below.</p>
          <ChatModeration sessionId={sessionId} />
        </div>
      ) : null}

      <div className="card">
        <div className="row between">
          <h2 style={{ margin: 0 }}>Pre-live playback</h2>
          <span className={`pill ${saved.enabled ? 'ok' : 'draft'}`}>{saved.enabled ? 'ON' : 'OFF'}</span>
        </div>
        <p className="muted small">
          A video people can watch on the Live tab (app and website) while you're not live. When you press GO LIVE the live stream automatically replaces it, so the two never play together. When you end the stream, the pre-live video comes back only if this is ON.
        </p>
        <div className="grid" style={{ marginBottom: 12 }}>
          <div className="small"><div className="muted">Saved setting</div><b>{saved.enabled ? 'Enabled' : 'Disabled'}</b></div>
          <div className="small"><div className="muted">Live status now</div><b>{isLive ? 'LIVE' : 'Offline'}</b></div>
          <div className="small"><div className="muted">Viewers see now</div><b>{viewersSee}</b></div>
        </div>
        {preErr ? <Message kind="err">{preErr}</Message> : null}
        {preOk ? <Message kind="ok">{preOk}</Message> : null}
        <Check checked={preEnabled} onChange={setPreEnabled} disabled={preBusy} label="Enable Pre-Live Playback" hint="Takes effect when you press Save pre-live settings below." />
        <Field label="Video to play while not live" hint="Pick a published testimony, or paste a YouTube, HLS (.m3u8) or video file (.mp4) link from your media storage.">
          <input type="url" placeholder="https://…" value={preUrl} onChange={(e) => setPreUrl(e.target.value)} />
        </Field>
        {preUrl.trim() && !preLiveKind(preUrl.trim()) ? <Message kind="warn">This link isn't a YouTube, HLS (.m3u8) or video file (.mp4) link, so it can't be used.</Message> : null}
        <div className="row" style={{ marginBottom: 14 }}>
          <button className="btn ghost small" onClick={() => void loadPicks()}>Choose from published testimonies</button>
          <button className="btn ghost small" disabled={!preLiveKind(preUrl.trim())} onClick={() => setPrePreview(preUrl.trim())}>Test this video</button>
          {preLiveKind(preUrl.trim()) ? <span className="pill">{preLiveKind(preUrl.trim())}</span> : null}
        </div>
        {picks ? (
          picks.length === 0 ? <p className="small muted">No published testimonies with a playable video link were found.</p> : (
            <Field label="Published testimonies">
              <select defaultValue="" onChange={(e) => { const t = picks.find((x) => x.id === e.target.value); if (t) { setPreUrl(t.url); setPreTitle(t.title); setPreThumb(t.thumbnail); } }}>
                <option value="" disabled>Select a testimony…</option>
                {picks.map((t) => <option key={t.id} value={t.id}>{t.title || t.id}</option>)}
              </select>
            </Field>
          )
        ) : null}
        {prePreview ? (
          parseYouTubeId(prePreview) ? (
            <div className="preview" style={{ position: 'relative', paddingTop: '56.25%', marginBottom: 14 }}>
              <iframe title="Pre-live preview" src={`https://www.youtube.com/embed/${parseYouTubeId(prePreview)}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, borderRadius: 12 }} allow="autoplay; encrypted-media" allowFullScreen />
            </div>
          ) : isHls(prePreview) ? <StreamPreview url={prePreview} /> : <video src={prePreview} controls style={{ width: '100%', borderRadius: 12, marginBottom: 14 }} />
        ) : null}
        <div className="two">
          <Field label="Title shown to viewers"><input type="text" value={preTitle} onChange={(e) => setPreTitle(e.target.value)} placeholder="Watch while you wait" /></Field>
          <Field label="Thumbnail link (optional)"><input type="url" value={preThumb} onChange={(e) => setPreThumb(e.target.value)} placeholder="https://" /></Field>
        </div>
        <Field label="Description (optional)"><textarea value={preDescription} onChange={(e) => setPreDescription(e.target.value)} style={{ minHeight: 70 }} /></Field>
        <button className="btn" disabled={preBusy} onClick={() => void savePreLive(preEnabled)}>{preBusy ? 'Saving…' : 'SAVE PRE-LIVE SETTINGS'}</button>
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
