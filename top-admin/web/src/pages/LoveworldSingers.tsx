import { useEffect, useState } from 'react';
import {
  Timestamp,
  deleteDoc,
  doc,
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import { uploadToCloudinary, uploadVideo, uploadsEnabled } from '../uploads';
import { fmtDuration, isHls, isHttpUrl, parseDuration } from '../lib';
import { Check, Field, Message } from '../components/Field';

/** "Worship with your LoveWorld Singers" library (Firestore: loveworldSingersVideos). */
interface SingersVideo {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string;
  duration?: number;
  publishedAt?: Timestamp | null;
  isFeatured: boolean;
  isDownloadable: boolean;
  isPublished: boolean;
  order: number;
}

const dateInput = (ts?: Timestamp | null) => (ts ? ts.toDate().toISOString().slice(0, 10) : '');

/** Admin editor and list for the LoveWorld Singers library. Unpublished videos stay hidden from the app. */
/** Default background video; the app and website use it until an admin saves another link. */
const DEFAULT_HERO_VIDEO = 'https://topappstorage.b-cdn.net/LWS%20playout/ELI-J%2029.mp4';

export function LoveworldSingers() {
  const heroRef = doc(db, 'settings', 'loveworldSingers');
  const [heroVideoUrl, setHeroVideoUrl] = useState(DEFAULT_HERO_VIDEO);
  const [heroBusy, setHeroBusy] = useState(false);
  const [heroErr, setHeroErr] = useState('');
  const [heroOk, setHeroOk] = useState('');
  const [videos, setVideos] = useState<SingersVideo[] | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [durationText, setDurationText] = useState('');
  const [publishDate, setPublishDate] = useState(new Date().toISOString().slice(0, 10));
  const [isFeatured, setIsFeatured] = useState(false);
  const [isDownloadable, setIsDownloadable] = useState(true);
  const [isPublished, setIsPublished] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [thumbPct, setThumbPct] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'loveworldSingersVideos'), orderBy('order', 'asc'));
    return onSnapshot(
      q,
      (snap) => setVideos(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SingersVideo, 'id'>) }))),
      (e) => setErr(e.message),
    );
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setDescription('');
    setVideoUrl('');
    setThumbnailUrl('');
    setDurationText('');
    setPublishDate(new Date().toISOString().slice(0, 10));
    setIsFeatured(false);
    setIsDownloadable(true);
    setIsPublished(false);
  };

  const edit = (v: SingersVideo) => {
    setEditingId(v.id);
    setTitle(v.title);
    setDescription(v.description ?? '');
    setVideoUrl(v.videoUrl);
    setThumbnailUrl(v.thumbnailUrl ?? '');
    setDurationText(fmtDuration(v.duration ?? 0));
    setPublishDate(dateInput(v.publishedAt) || new Date().toISOString().slice(0, 10));
    setIsFeatured(v.isFeatured);
    setIsDownloadable(v.isDownloadable);
    setIsPublished(v.isPublished);
    setErr('');
    setOk('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const pickVideo = async (file?: File) => {
    if (!file) return;
    setErr('');
    if (!file.type.startsWith('video/')) return setErr('Please choose a video file (MP4 works best).');
    try {
      setUploadPct(0);
      const res = await uploadVideo(file, setUploadPct);
      setVideoUrl(res.url);
      setOk('Video uploaded. Save to keep it.');
    } catch (e) {
      setErr(`Video upload failed. ${(e as Error).message}`);
    }
    setUploadPct(null);
  };

  const pickThumb = async (file?: File) => {
    if (!file) return;
    setErr('');
    try {
      setThumbPct(0);
      setThumbnailUrl(await uploadToCloudinary(file, 'image', setThumbPct));
    } catch (e) {
      setErr((e as Error).message || 'Image upload failed.');
    }
    setThumbPct(null);
  };

  const save = async () => {
    setErr('');
    setOk('');
    if (!title.trim()) return setErr('Please enter a title.');
    if (!isHttpUrl(videoUrl)) return setErr('Upload a video or paste a link that starts with https://');
    if (thumbnailUrl && !isHttpUrl(thumbnailUrl)) return setErr('The thumbnail link must start with https://');
    if (isPublished && !videoUrl) return setErr('Add a video before publishing (or save as a draft).');
    if (isDownloadable && isHls(videoUrl))
      return setErr('Downloads need an MP4 file. Live (.m3u8) streams can’t be saved. Turn off “Allow downloads” or upload an MP4.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(publishDate)) return setErr('Choose a publish date.');

    setBusy(true);
    try {
      const data = {
        title: title.trim(),
        description: description.trim(),
        videoUrl: videoUrl.trim(),
        thumbnailUrl: thumbnailUrl.trim(),
        duration: parseDuration(durationText),
        publishedAt: Timestamp.fromDate(new Date(`${publishDate}T00:00:00`)),
        isFeatured,
        isDownloadable,
        isPublished,
        updatedAt: serverTimestamp(),
      };
      if (editingId) {
        await updateDoc(doc(db, 'loveworldSingersVideos', editingId), data);
        setOk('Saved.');
      } else {
        // New videos go to the end of the library.
        const nextOrder = videos && videos.length ? Math.max(...videos.map((v) => v.order)) + 1 : 0;
        await addDoc(collection(db, 'loveworldSingersVideos'), { ...data, order: nextOrder, createdAt: serverTimestamp() });
        setOk(isPublished ? 'Published. It is now visible in the app and on the web.' : 'Saved as a draft. It is hidden from users until you publish it.');
      }
      resetForm();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const setField = async (v: SingersVideo, changes: Partial<Pick<SingersVideo, 'isPublished' | 'isDownloadable' | 'isFeatured'>>) => {
    setErr('');
    if (changes.isDownloadable && isHls(v.videoUrl)) return setErr('This video is a live (.m3u8) stream and can’t be downloaded.');
    try {
      await updateDoc(doc(db, 'loveworldSingersVideos', v.id), { ...changes, updatedAt: serverTimestamp() });
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  /** Swaps this video's order with its neighbour above or below. */
  const move = async (index: number, dir: -1 | 1) => {
    if (!videos) return;
    const other = videos[index + dir];
    if (!other) return;
    setErr('');
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'loveworldSingersVideos', videos[index].id), { order: other.order });
      batch.update(doc(db, 'loveworldSingersVideos', other.id), { order: videos[index].order });
      await batch.commit();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const remove = async (v: SingersVideo) => {
    if (!confirm(`Delete “${v.title}”? The app and web will no longer show it.`)) return;
    setErr('');
    try {
      await deleteDoc(doc(db, 'loveworldSingersVideos', v.id));
      if (editingId === v.id) resetForm();
      setOk('Deleted.');
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  useEffect(() => {
    return onSnapshot(heroRef, (snap) => {
      const url = snap.exists() ? (snap.data() as { heroVideoUrl?: string }).heroVideoUrl : undefined;
      if (url) setHeroVideoUrl(url);
    }, (e) => setHeroErr(e.message));
  }, []);

  const saveHeroVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    setHeroErr('');
    setHeroOk('');
    if (!isHttpUrl(heroVideoUrl)) return setHeroErr('Please provide a valid https:// video link.');
    setHeroBusy(true);
    try {
      await setDoc(heroRef, { heroVideoUrl: heroVideoUrl.trim(), updatedAt: serverTimestamp() }, { merge: true });
      setHeroOk('Saved. The page uses this video from now on.');
    } catch (err) {
      setHeroErr((err as Error).message);
    } finally {
      setHeroBusy(false);
    }
  };

  return (
    <div>
      <h1>LoveWorld Singers</h1>
      <p className="muted">The “Worship with your LoveWorld Singers” library. Published videos appear in the app and on the web straight away.</p>

      <form className="card" onSubmit={saveHeroVideo}>
        <h2>Page video</h2>
        <p className="small muted">The background video at the top of the LoveWorld Singers page in the app and on the web.</p>
        <Field label="Video link (https://, MP4)">
          <input type="url" value={heroVideoUrl} onChange={(e) => setHeroVideoUrl(e.target.value)} placeholder="https://..." />
        </Field>
        {heroVideoUrl ? (
          <video src={heroVideoUrl} controls muted style={{ width: '100%', maxHeight: 200, borderRadius: 6, backgroundColor: '#000', marginTop: 10 }} />
        ) : null}
        {heroErr ? <Message kind="err">{heroErr}</Message> : null}
        {heroOk ? <Message kind="ok">{heroOk}</Message> : null}
        <div className="row between" style={{ marginTop: 12 }}>
          <button type="button" className="btn ghost" onClick={() => setHeroVideoUrl(DEFAULT_HERO_VIDEO)}>Reset to default</button>
          <button type="submit" className="btn primary" disabled={heroBusy}>{heroBusy ? 'Saving…' : 'Save page video'}</button>
        </div>
      </form>

      <div className="card">
        <h2>{editingId ? 'Edit video' : 'New video'}</h2>
        <Field label="Title"><input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="Description"><textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        <Field label="Video link (MP4 is needed for downloads)" hint="Paste a link or upload a file below.">
          <input type="url" placeholder="https://" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} />
        </Field>
        {uploadsEnabled ? (
          <Field label="…or upload a video">
            <input type="file" accept="video/*" disabled={uploadPct !== null} onChange={(e) => void pickVideo(e.target.files?.[0])} />
          </Field>
        ) : null}
        {uploadPct !== null ? <div className="small muted">Uploading video… {uploadPct}%</div> : null}
        <Field label="Thumbnail link"><input type="url" placeholder="https://" value={thumbnailUrl} onChange={(e) => setThumbnailUrl(e.target.value)} /></Field>
        {uploadsEnabled ? (
          <Field label="…or upload a thumbnail image">
            <input type="file" accept="image/*" disabled={thumbPct !== null} onChange={(e) => void pickThumb(e.target.files?.[0])} />
          </Field>
        ) : null}
        {thumbPct !== null ? <div className="small muted">Uploading image… {thumbPct}%</div> : null}
        {thumbnailUrl && isHttpUrl(thumbnailUrl) ? <img src={thumbnailUrl} alt="Thumbnail preview" style={{ maxWidth: 260, borderRadius: 10 }} /> : null}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Field label="Duration (m:ss or h:mm:ss)" style={{ flex: 1, minWidth: 160 }}><input value={durationText} onChange={(e) => setDurationText(e.target.value)} placeholder="4:32" /></Field>
          <Field label="Publish date" style={{ flex: 1, minWidth: 160 }}><input type="date" value={publishDate} onChange={(e) => setPublishDate(e.target.value)} /></Field>
        </div>
        <Check checked={isPublished} onChange={setIsPublished} label="Published (visible to app users)" hint="Unpublished videos are hidden from users." />
        <Check checked={isFeatured} onChange={setIsFeatured} label="Featured (shown first in the library)" />
        <Check checked={isDownloadable} onChange={setIsDownloadable} label="Allow downloads in the Downloads section" hint="Needs an MP4 link." />
        {err ? <Message kind="err">{err}</Message> : null}
        {ok ? <Message kind="ok">{ok}</Message> : null}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button className="btn" onClick={() => void save()} disabled={busy}>{busy ? 'Saving…' : editingId ? 'Save changes' : 'Save video'}</button>
          {editingId ? <button className="btn ghost" onClick={resetForm}>Cancel edit</button> : null}
        </div>
      </div>

      <div className="card">
        <h2>Library order</h2>
        {!videos ? <div className="muted">Loading…</div> : null}
        {videos && videos.length === 0 ? <div className="muted">No videos yet.</div> : null}
        {videos?.map((v, i) => (
          <div key={v.id} className="row" style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 0', borderTop: '1px solid #3A2253', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <b>{v.title}</b>
              <div className="small muted">
                {v.isPublished ? 'Published' : 'Draft (hidden)'}
                {v.isFeatured ? ' • Featured' : ''}
                {v.isDownloadable ? ' • Downloads on' : ' • Downloads off'}
              </div>
            </div>
            <button className="btn ghost" onClick={() => void move(i, -1)} disabled={i === 0} aria-label={`Move ${v.title} up`}>↑</button>
            <button className="btn ghost" onClick={() => void move(i, 1)} disabled={!videos || i === videos.length - 1} aria-label={`Move ${v.title} down`}>↓</button>
            <button className="btn ghost" onClick={() => void setField(v, { isPublished: !v.isPublished })}>{v.isPublished ? 'Unpublish' : 'Publish'}</button>
            <button className="btn ghost" onClick={() => void setField(v, { isFeatured: !v.isFeatured })}>{v.isFeatured ? 'Unfeature' : 'Feature'}</button>
            <button className="btn ghost" onClick={() => void setField(v, { isDownloadable: !v.isDownloadable })}>{v.isDownloadable ? 'Disable download' : 'Enable download'}</button>
            <button className="btn ghost" onClick={() => edit(v)}>Edit</button>
            <button className="btn ghost" onClick={() => void remove(v)}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}
