import { useEffect, useState } from 'react';
import { collection, doc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { describe, notifyLiveStarted } from '../notify';
import { isHls, isHttpUrl, isYouTubeUrl, parseYouTubeId } from '../lib';
import { Check, Field, Message } from '../components/Field';
import { Icon } from '../components/Icon';
import { useConfirm } from '../components/feedback';
import { ErrorState, GlassCard, LoadingList, PageHeader, SectionHeader, StatusBadge } from '../components/ui';
import { StreamPreview } from '../components/StreamPreview';
import { ChatModeration } from '../components/ChatModeration';
import { ViewerCount } from '../components/ViewerCount';

// 'file' is a plain video file (e.g. an MP4 on Bunny). The app and website play any non-YouTube link in their
// normal video player, so a file works as the live source too; it just isn't a synchronised broadcast.
type SourceType = 'hls' | 'youtube' | 'file' | 'unknown';
// Pre-live media may also be a plain video file (e.g. an MP4 on Bunny/Cloudinary).
const isVideoFile = (url: string) => /\.(mp4|m4v|mov|webm)(\?|#|$)/i.test(url);
const sourceTypeOf = (url: string): SourceType => (isYouTubeUrl(url) ? 'youtube' : isHls(url) ? 'hls' : isVideoFile(url) ? 'file' : 'unknown');
const SOURCE_LABEL: Record<Exclude<SourceType, 'unknown'>, string> = { hls: 'HLS', youtube: 'YouTube', file: 'Video file' };
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
  const confirm = useConfirm();

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
    if (live && type === 'unknown') return setErr('That link isn’t a YouTube link, an HLS (.m3u8) link or a video file (.mp4, .mov, .webm).');
    if (live && !isLive && notifyOnStart && !(await confirm({ title: 'Go live and notify app users?', message: 'Going live sends a push notification to everyone with live alerts on.', confirmLabel: 'Go live' }))) return;
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

  const endStream = async () => {
    if (!(await confirm({ title: 'End the live stream?', message: 'The app switches to “Live stream is currently offline” straight away, and chat closes.', confirmLabel: 'End stream', danger: true }))) return;
    void write(false, 'Stream ended. The app now shows it as offline.');
  };
  const yt = (url: string, label: string) => (
    <div className="yt-frame">
      <iframe title={label} src={`https://www.youtube.com/embed/${parseYouTubeId(url)}`} allow="autoplay; encrypted-media" allowFullScreen />
    </div>
  );

  if (!loaded) {
    return (
      <>
        <PageHeader eyebrow="Broadcast & Media" title="Live Stream" />
        {err ? <ErrorState title="Couldn’t load the live settings" message={err} /> : <GlassCard><LoadingList rows={3} /></GlassCard>}
      </>
    );
  }
  const kind = sourceTypeOf(streamUrl);
  return (
    <>
      <PageHeader eyebrow="Broadcast & Media" title="Live Stream" sub="The app shows “LIVE NOW” the moment you go live, and “Live stream is currently offline” when you end it." />
      {err ? <Message kind="err">{err}</Message> : null}
      {ok ? <Message kind="ok">{ok}</Message> : null}

      <GlassCard className={`broadcast-hero ${isLive ? 'on' : ''}`} aria-label="Broadcast status">
        <div className="state">
          <div className="row gap">
            <span className={`on-air ${isLive ? 'live' : 'off'}`}><span className="pulse" />{isLive ? 'ON AIR' : 'OFF AIR'}</span>
            {isLive && sessionId ? <ViewerCount sessionId={sessionId} /> : null}
          </div>
          <h2>{title.trim() || (isLive ? 'Live broadcast' : 'Ready when you are')}</h2>
          <span className="small muted">Viewers see now: <b style={{ color: 'var(--text)' }}>{viewersSee}</b></span>
        </div>
        {isLive ? (
          <button type="button" className="btn danger xl" disabled={busy} onClick={() => void endStream()}><Icon name="x" size={18} />END STREAM</button>
        ) : (
          <button type="button" className="btn live xl" disabled={busy} onClick={() => void write(true, 'You’re live. The app is showing the stream.')}><Icon name="radioTower" size={18} />GO LIVE</button>
        )}
      </GlassCard>

      <div className="split">
        <GlassCard>
          <SectionHeader icon="radioTower" title="Stream details" hint={isLive ? 'Changes apply to viewers as soon as you save.' : 'Set these up before going live.'} />
          <Field label="Stream link *" hint="A YouTube video or live link, an HLS (.m3u8) playback URL from your streaming provider or server (the one OBS publishes to), or a video file link (.mp4, .mov, .webm) such as one on Bunny Storage.">
            <input type="url" placeholder="https://youtube.com/watch?v=… or https://…/stream.m3u8" value={streamUrl} onChange={(e) => setStreamUrl(e.target.value)} />
          </Field>
          {streamUrl && kind === 'unknown' ? <Message kind="err">That doesn’t look like a YouTube link, an HLS (.m3u8) link or a video file (.mp4, .mov, .webm).</Message> : null}
          {kind === 'file' ? (
            <Message kind="warn">
              This is a video file, not a live broadcast. Each viewer starts it from the beginning when they open the Live tab, so people won’t be at the same moment, and every viewer downloads the file separately. Chat still works.
            </Message>
          ) : null}
          <div className="two">
            <Field label="Title"><input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Sunday Testimony Service" /></Field>
            <Field label="Thumbnail link (optional)"><input type="url" value={thumbnail} onChange={(e) => setThumbnail(e.target.value)} placeholder="https://" /></Field>
          </div>
          <Field label="Description"><textarea value={description} onChange={(e) => setDescription(e.target.value)} style={{ minHeight: 80 }} /></Field>
          <Check checked={notifyOnStart} onChange={setNotify} label="Send a push notification when I go live" />
          <div className="form-actions">
            <span className="small muted">{isLive ? 'You’re live: saving updates what viewers see.' : 'Saving doesn’t start the stream.'}</span>
            <button type="button" className="btn primary" disabled={busy} onClick={() => void write(isLive, 'Saved.')}><Icon name="check" size={16} />Save details</button>
          </div>
        </GlassCard>

        <GlassCard>
          <SectionHeader
            icon="eye"
            title="Stream preview"
            hint="Check the link plays before you go live."
            actions={streamUrl && kind !== 'unknown' ? <StatusBadge kind="info" plain>{SOURCE_LABEL[kind as Exclude<SourceType, 'unknown'>]}</StatusBadge> : undefined}
          />
          {preview ? (parseYouTubeId(preview) ? yt(preview, 'Stream preview') : <StreamPreview url={preview} />) : thumbnail && isHttpUrl(thumbnail) ? <img className="cover-preview" src={thumbnail} alt="Stream thumbnail" /> : <div className="cover-empty">Press “Test this stream” to load it here.</div>}
          <div className="row" style={{ marginTop: 12 }}>
            <button type="button" className="btn ghost small" disabled={!streamUrl || kind === 'unknown'} onClick={() => setPreview(streamUrl)}><Icon name="play" size={14} />Test this stream</button>
            {streamUrl && isHttpUrl(streamUrl) ? <a className="btn ghost small" href={streamUrl} target="_blank" rel="noreferrer"><Icon name="external" size={14} />Open link</a> : null}
          </div>
        </GlassCard>
      </div>

      {isLive && sessionId ? (
        <GlassCard>
          <SectionHeader icon="messageSquare" title="Live chat" hint="Every message has its own delete button. Reported messages are flagged in red." />
          <ChatModeration sessionId={sessionId} />
        </GlassCard>
      ) : null}

      <GlassCard>
        <SectionHeader icon="film" title="Pre-live playback" hint="A video people can watch on the Live tab while you’re not live." actions={<StatusBadge kind={saved.enabled ? 'ok' : 'draft'}>{saved.enabled ? 'On' : 'Off'}</StatusBadge>} />
        <p className="muted small" style={{ marginTop: 0 }}>
          When you press GO LIVE the live stream replaces it automatically, so the two never play together. When you end the stream, the pre-live video comes back only if this is on.
        </p>
        <div className="status-strip">
          <div><div className="k">Saved setting</div><div className="v">{saved.enabled ? 'Enabled' : 'Disabled'}</div></div>
          <div><div className="k">Live status now</div><div className="v">{isLive ? 'Live' : 'Offline'}</div></div>
          <div><div className="k">Viewers see now</div><div className="v">{viewersSee}</div></div>
        </div>
        {preErr ? <Message kind="err">{preErr}</Message> : null}
        {preOk ? <Message kind="ok">{preOk}</Message> : null}
        <div className="split" style={{ marginBottom: 0 }}>
          <div>
            <Check checked={preEnabled} onChange={setPreEnabled} disabled={preBusy} label="Enable pre-live playback" hint="Takes effect when you save the pre-live settings." />
            <Field label="Video to play while not live" hint="Pick a published testimony, or paste a YouTube, HLS (.m3u8) or video file (.mp4) link.">
              <input type="url" placeholder="https://…" value={preUrl} onChange={(e) => setPreUrl(e.target.value)} />
            </Field>
            {preUrl.trim() && !preLiveKind(preUrl.trim()) ? <Message kind="warn">This link isn’t a YouTube, HLS (.m3u8) or video file (.mp4) link, so it can’t be used.</Message> : null}
            <div className="row" style={{ marginBottom: 14 }}>
              <button type="button" className="btn ghost small" onClick={() => void loadPicks()}><Icon name="video" size={14} />Choose a published testimony</button>
              <button type="button" className="btn ghost small" disabled={!preLiveKind(preUrl.trim())} onClick={() => setPrePreview(preUrl.trim())}><Icon name="play" size={14} />Test this video</button>
              {preLiveKind(preUrl.trim()) ? <StatusBadge kind="info" plain>{preLiveKind(preUrl.trim())}</StatusBadge> : null}
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
            <div className="two">
              <Field label="Title shown to viewers"><input type="text" value={preTitle} onChange={(e) => setPreTitle(e.target.value)} placeholder="Watch while you wait" /></Field>
              <Field label="Thumbnail link (optional)"><input type="url" value={preThumb} onChange={(e) => setPreThumb(e.target.value)} placeholder="https://" /></Field>
            </div>
            <Field label="Description (optional)"><textarea value={preDescription} onChange={(e) => setPreDescription(e.target.value)} style={{ minHeight: 70 }} /></Field>
            <button type="button" className="btn primary" disabled={preBusy} onClick={() => void savePreLive(preEnabled)}>
              {preBusy ? <span className="spin sm" aria-hidden="true" /> : <Icon name="check" size={16} />}{preBusy ? 'Saving…' : 'Save pre-live settings'}
            </button>
          </div>
          <div>
            {prePreview ? (
              parseYouTubeId(prePreview) ? yt(prePreview, 'Pre-live preview') : isHls(prePreview) ? <StreamPreview url={prePreview} /> : <video className="preview" src={prePreview} controls />
            ) : preThumb && isHttpUrl(preThumb) ? <img className="cover-preview" src={preThumb} alt="Pre-live thumbnail" /> : <div className="cover-empty">Press “Test this video” to preview it here.</div>}
          </div>
        </div>
      </GlassCard>
    </>
  );
}
