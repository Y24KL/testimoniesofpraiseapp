import { useEffect, useRef, useState } from 'react';
import { collection, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { MAX_VIDEO_MB, uploadToCloudinary, uploadsEnabled } from '../uploads';
import { describe, notifyTestimonyPublished } from '../notify';
import { CATEGORIES, fmtDuration, isHls, isHttpUrl, parseDuration, readVideoDuration, testimonyFromDoc } from '../lib';
import type { Route, Testimony } from '../types';
import { Check, Field, Message } from '../components/Field';

interface Props {
  id?: string;
  prefill?: Partial<Testimony>;
  go: (r: Route) => void;
}

export function TestimonyEditor({ id, prefill, go }: Props) {
  // The document id is created up front so uploads can live under testimonies/{id}/
  const [docId] = useState(() => id ?? doc(collection(db, 'testimonies')).id);
  const isNew = !id;
  const [loading, setLoading] = useState(!!id);
  const [existing, setExisting] = useState<Testimony | null>(null);

  const [title, setTitle] = useState(prefill?.title ?? '');
  const [description, setDescription] = useState(prefill?.description ?? '');
  const [authorName, setAuthorName] = useState(prefill?.authorName ?? '');
  const [category, setCategory] = useState(prefill?.category ?? '');
  const [keywords, setKeywords] = useState('');
  const [durationText, setDurationText] = useState('');
  const [thumbnail, setThumbnail] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [isPublished, setPublished] = useState(false);
  const [isFeatured, setFeatured] = useState(false);
  const [isDownloadable, setDownloadable] = useState(false);
  const [notifyOnPublish, setNotify] = useState(true);

  const [thumbPct, setThumbPct] = useState<number | null>(null);
  const [videoPct, setVideoPct] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const dirty = useRef(false);

  useEffect(() => {
    if (!id) return;
    getDoc(doc(db, 'testimonies', id)).then((s) => {
      if (!s.exists()) {
        setErr('This testimony no longer exists.');
      } else {
        const t = testimonyFromDoc(s);
        setExisting(t);
        setTitle(t.title); setDescription(t.description); setAuthorName(t.authorName); setCategory(t.category);
        setKeywords(t.keywords.join(', ')); setDurationText(fmtDuration(t.duration)); setThumbnail(t.thumbnail);
        setVideoUrl(t.videoUrl); setPublished(t.isPublished); setFeatured(t.isFeatured); setDownloadable(t.isDownloadable); setNotify(t.notifyOnPublish);
      }
      setLoading(false);
    }).catch((e: Error) => { setErr(e.message); setLoading(false); });
  }, [id]);

  const hls = isHls(videoUrl);
  const mark = <T,>(set: (v: T) => void) => (v: T) => { dirty.current = true; set(v); };

  const pickThumb = async (file?: File) => {
    if (!file) return;
    setErr('');
    if (!file.type.startsWith('image/')) return setErr('Please choose an image file.');
    try {
      setThumbPct(0);
      mark(setThumbnail)(await uploadToCloudinary(file, 'image', setThumbPct));
    } catch (e) { setErr(`Thumbnail upload failed. ${(e as Error).message}`); }
    setThumbPct(null);
  };

  const pickVideo = async (file?: File) => {
    if (!file) return;
    setErr('');
    if (!file.type.startsWith('video/')) return setErr('Please choose a video file (MP4 works best).');
    try {
      setVideoPct(0);
      const secs = await readVideoDuration(file);
      if (secs && !durationText) setDurationText(fmtDuration(secs));
      mark(setVideoUrl)(await uploadToCloudinary(file, 'video', setVideoPct));
    } catch (e) { setErr(`Video upload failed. ${(e as Error).message}`); }
    setVideoPct(null);
  };

  const save = async () => {
    setErr(''); setOk('');
    if (!title.trim()) return setErr('Please enter a title.');
    if (videoUrl && !isHttpUrl(videoUrl)) return setErr('The video link must start with https://');
    if (thumbnail && !isHttpUrl(thumbnail)) return setErr('The thumbnail link must start with https://');
    if (isPublished && !videoUrl) return setErr('Add a video before publishing (or save as a draft).');
    const newlyPublished = isPublished && !existing?.isPublished;
    if (newlyPublished && notifyOnPublish && !confirm('Publishing sends a push notification to app users. Continue?')) return;

    setSaving(true);
    try {
      await setDoc(
        doc(db, 'testimonies', docId),
        {
          title: title.trim(),
          description: description.trim(),
          authorName: authorName.trim(),
          category: category.trim(),
          keywords: keywords.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean),
          duration: parseDuration(durationText),
          thumbnail: thumbnail.trim(),
          videoUrl: videoUrl.trim(),
          isPublished,
          isFeatured,
          isDownloadable: isDownloadable && !hls, // HLS streams can't be saved for offline use
          notifyOnPublish,
          updatedAt: serverTimestamp(),
          ...(isNew ? { createdAt: serverTimestamp() } : {}),
          ...(newlyPublished ? { publishedAt: serverTimestamp() } : {}),
        },
        { merge: true },
      );
      dirty.current = false;
      if (newlyPublished && notifyOnPublish) {
        const r = await notifyTestimonyPublished(docId);
        if (r.status === 'failed') {
          setErr(`Saved and published, but ${describe(r)} Use Announcements to tell people, or try again.`);
          setSaving(false);
          return;
        }
      }
      go({ name: 'testimonies' });
    } catch (e) {
      setErr((e as Error).message);
      setSaving(false);
    }
  };

  const back = () => { if (!dirty.current || confirm('Discard your unsaved changes?')) go({ name: 'testimonies' }); };
  if (loading) return <p className="muted">Loading…</p>;
  const busy = saving || thumbPct !== null || videoPct !== null;

  return (
    <>
      <div className="row between"><h1>{isNew ? 'New testimony' : 'Edit testimony'}</h1><button className="btn ghost" onClick={back}>← Back</button></div>
      {err ? <Message kind="err">{err}</Message> : null}
      {ok ? <Message kind="ok">{ok}</Message> : null}

      <div className="card">
        <h2>Details</h2>
        <Field label="Title *"><input type="text" value={title} onChange={(e) => mark(setTitle)(e.target.value)} maxLength={160} /></Field>
        <div className="two">
          <Field label="Testifier name"><input type="text" value={authorName} onChange={(e) => mark(setAuthorName)(e.target.value)} /></Field>
          <Field label="Category">
            <input type="text" list="cats" value={category} onChange={(e) => mark(setCategory)(e.target.value)} />
            <datalist id="cats">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
          </Field>
        </div>
        <Field label="Description"><textarea value={description} onChange={(e) => mark(setDescription)(e.target.value)} /></Field>
        <Field label="Search keywords" hint="Comma-separated. Helps people find it in the app’s search."><input type="text" value={keywords} onChange={(e) => mark(setKeywords)(e.target.value)} /></Field>
      </div>

      <div className="card">
        <h2>Video</h2>
        {uploadsEnabled ? (
          <>
            <Field label="Upload a video file" hint={`MP4 works best. Up to ${MAX_VIDEO_MB} MB on the free plan. Keep this page open until it finishes.`}>
              <input type="file" accept="video/*" onChange={(e) => void pickVideo(e.target.files?.[0])} disabled={videoPct !== null} />
            </Field>
            {videoPct !== null ? <div className="bar" aria-label="Video upload progress"><i style={{ width: `${videoPct}%` }} /></div> : null}
          </>
        ) : null}
        <Field label={uploadsEnabled ? '…or paste a video link' : 'Video link *'} hint="An MP4 link or an HLS (.m3u8) stream from your video host."><input type="url" placeholder="https://" value={videoUrl} onChange={(e) => mark(setVideoUrl)(e.target.value)} /></Field>
        {videoUrl && !hls ? <video className="preview" src={videoUrl} controls preload="metadata" /> : null}
        {hls ? <Message kind="ok">HLS stream detected. Viewers can watch it, but it can’t be downloaded for offline use.</Message> : null}
        <div className="two" style={{ marginTop: 12 }}>
          <Field label="Duration" hint="Filled in automatically when you upload. Format 12:40."><input type="text" value={durationText} onChange={(e) => mark(setDurationText)(e.target.value)} placeholder="12:40" /></Field>
        </div>
      </div>

      <div className="card">
        <h2>Thumbnail</h2>
        {uploadsEnabled ? (
          <>
            <Field label="Upload an image"><input type="file" accept="image/*" onChange={(e) => void pickThumb(e.target.files?.[0])} disabled={thumbPct !== null} /></Field>
            {thumbPct !== null ? <div className="bar"><i style={{ width: `${thumbPct}%` }} /></div> : null}
          </>
        ) : null}
        <Field label={uploadsEnabled ? '…or paste an image link' : 'Image link'}><input type="url" placeholder="https://" value={thumbnail} onChange={(e) => mark(setThumbnail)(e.target.value)} /></Field>
        {thumbnail ? <img src={thumbnail} alt="Thumbnail preview" style={{ maxWidth: 280, borderRadius: 12 }} /> : null}
      </div>

      <div className="card">
        <h2>Visibility</h2>
        <Check checked={isPublished} onChange={mark(setPublished)} label="Published" hint="Visible in the app and the website feed. Uncheck to keep as a draft or to remove it from the app." />
        <Check checked={notifyOnPublish} onChange={mark(setNotify)} label="Send a push notification when published" hint="Only sent the first time it is published." />
        <Check checked={isFeatured} onChange={mark(setFeatured)} label="Featured on the app’s Home screen" />
        <Check checked={isDownloadable && !hls} disabled={hls} onChange={mark(setDownloadable)} label="Allow users to download for offline viewing" hint={hls ? 'Not available for HLS streams.' : undefined} />
      </div>

      <div className="row">
        <button className="btn" onClick={() => void save()} disabled={busy}>{saving ? 'Saving…' : busy ? 'Uploading…' : isNew ? 'SAVE TESTIMONY' : 'SAVE CHANGES'}</button>
        <button className="btn ghost" onClick={back} disabled={saving}>Cancel</button>
      </div>
    </>
  );
}
