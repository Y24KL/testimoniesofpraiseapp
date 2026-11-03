import { useEffect, useState } from 'react';
import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { uploadToCloudinary, uploadVideo, uploadsEnabled } from '../uploads';
import { fmtDuration, isHls, isHttpUrl, parseDuration } from '../lib';
import { Field, Message } from '../components/Field';

type Status = 'draft' | 'published' | 'unpublished';

/** A lyrical analysis record (Firestore: lyricalAnalyses). Kept apart from ordinary testimony records. */
interface Analysis {
  id: string;
  title: string;
  songTitle: string;
  artistName?: string;
  description: string;
  videoUrl: string;
  thumbnailUrl?: string;
  duration?: number;
  publicationDate?: Timestamp | null;
  status: Status;
  displayOrder: number;
  createdBy?: string;
}

const STATUS_LABEL: Record<Status, string> = { draft: 'Draft (hidden)', published: 'Published', unpublished: 'Unpublished (hidden)' };
const dateInput = (ts?: Timestamp | null) => (ts ? ts.toDate().toISOString().slice(0, 10) : '');
const today = () => new Date().toISOString().slice(0, 10);

/**
 * Lyrical Analysis manager: upload or link a video, preview it, save as draft, publish, unpublish,
 * edit, replace the video, delete and reorder. Only published items reach the app and the web.
 */
export function LyricalAnalysis() {
  const [items, setItems] = useState<Analysis[] | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingStatus, setEditingStatus] = useState<Status>('draft');
  const [title, setTitle] = useState('');
  const [songTitle, setSongTitle] = useState('');
  const [artistName, setArtistName] = useState('');
  const [description, setDescription] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [durationText, setDurationText] = useState('');
  const [publicationDate, setPublicationDate] = useState(today());
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [thumbPct, setThumbPct] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'lyricalAnalyses'), orderBy('displayOrder', 'asc'));
    return onSnapshot(
      q,
      (snap) => setItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Analysis, 'id'>) }))),
      (e) => setErr(e.message),
    );
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setEditingStatus('draft');
    setTitle('');
    setSongTitle('');
    setArtistName('');
    setDescription('');
    setVideoUrl('');
    setThumbnailUrl('');
    setDurationText('');
    setPublicationDate(today());
  };

  const edit = (a: Analysis) => {
    setEditingId(a.id);
    setEditingStatus(a.status);
    setTitle(a.title);
    setSongTitle(a.songTitle ?? '');
    setArtistName(a.artistName ?? '');
    setDescription(a.description ?? '');
    setVideoUrl(a.videoUrl);
    setThumbnailUrl(a.thumbnailUrl ?? '');
    setDurationText(fmtDuration(a.duration ?? 0));
    setPublicationDate(dateInput(a.publicationDate) || today());
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
      // Uses the same upload manager as the testimonies (Bunny Storage, Cloudinary fallback).
      setVideoUrl((await uploadVideo(file, setUploadPct)).url);
      setOk('Video uploaded. Check the preview, then save.');
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

  /** Saves the form as the given status. Publishing needs a playable video link. */
  const save = async (status: Status) => {
    setErr('');
    setOk('');
    if (!title.trim()) return setErr('Enter the analysis title.');
    if (!songTitle.trim()) return setErr('Enter the original song title.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(publicationDate)) return setErr('Choose a publication date.');
    if (videoUrl && !isHttpUrl(videoUrl)) return setErr('The video link must start with https://');
    if (thumbnailUrl && !isHttpUrl(thumbnailUrl)) return setErr('The thumbnail link must start with https://');
    if (status === 'published' && !videoUrl) return setErr('Upload or paste a video before publishing (or save as a draft).');

    setBusy(true);
    try {
      const data = {
        title: title.trim(),
        songTitle: songTitle.trim(),
        artistName: artistName.trim(),
        description: description.trim(),
        videoUrl: videoUrl.trim(),
        thumbnailUrl: thumbnailUrl.trim(),
        duration: parseDuration(durationText),
        publicationDate: Timestamp.fromDate(new Date(`${publicationDate}T00:00:00`)),
        status,
        updatedAt: serverTimestamp(),
      };
      if (editingId) {
        await updateDoc(doc(db, 'lyricalAnalyses', editingId), data);
        setOk(status === 'published' ? 'Saved and published.' : 'Saved.');
      } else {
        const nextOrder = items && items.length ? Math.max(...items.map((a) => a.displayOrder)) + 1 : 0;
        await addDoc(collection(db, 'lyricalAnalyses'), { ...data, displayOrder: nextOrder, createdAt: serverTimestamp(), createdBy: auth.currentUser?.uid ?? null });
        setOk(status === 'published' ? 'Published. It is now visible in the app and on the web.' : 'Saved as a draft. It stays hidden until you publish it.');
      }
      resetForm();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (a: Analysis, status: Status) => {
    setErr('');
    if (status === 'published' && !a.videoUrl) return setErr('This analysis has no video yet. Edit it and add one first.');
    try {
      await updateDoc(doc(db, 'lyricalAnalyses', a.id), { status, updatedAt: serverTimestamp() });
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  /** Swaps this item's display order with its neighbour above or below. */
  const move = async (index: number, dir: -1 | 1) => {
    if (!items) return;
    const other = items[index + dir];
    if (!other) return;
    setErr('');
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'lyricalAnalyses', items[index].id), { displayOrder: other.displayOrder });
      batch.update(doc(db, 'lyricalAnalyses', other.id), { displayOrder: items[index].displayOrder });
      await batch.commit();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const remove = async (a: Analysis) => {
    if (!confirm(`Delete “${a.title}”? This cannot be undone. The app and web will no longer show it.`)) return;
    setErr('');
    try {
      await deleteDoc(doc(db, 'lyricalAnalyses', a.id));
      if (editingId === a.id) resetForm();
      setOk('Deleted.');
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const previewable = isHttpUrl(videoUrl) && !isHls(videoUrl);

  return (
    <div>
      <h1>Lyrical Analysis</h1>
      <p className="muted">Analysis videos of LoveWorld songs. Only published items appear in the app and on the web.</p>

      <div className="card">
        <h2>{editingId ? `Edit analysis (${STATUS_LABEL[editingStatus]})` : 'New analysis'}</h2>
        <Field label="Analysis title"><input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="Original song title"><input value={songTitle} onChange={(e) => setSongTitle(e.target.value)} /></Field>
        <Field label="Artist / minister"><input value={artistName} onChange={(e) => setArtistName(e.target.value)} placeholder="LoveWorld Singers member or minister" /></Field>
        <Field label="Description"><textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        <Field label="Video link" hint={editingId ? 'Replacing the video: upload a new file or paste a new link. The previous file is not deleted from storage.' : 'Upload a video or paste a link.'}>
          <input type="url" placeholder="https://" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} />
        </Field>
        {uploadsEnabled ? (
          <Field label={editingId ? '…or replace with an uploaded video' : '…or upload a video'}>
            <input type="file" accept="video/*" disabled={uploadPct !== null} onChange={(e) => void pickVideo(e.target.files?.[0])} />
          </Field>
        ) : null}
        {uploadPct !== null ? <div className="small muted">Uploading video… {uploadPct}%</div> : null}
        {videoUrl ? (
          previewable ? (
            <div>
              <div className="small muted" style={{ marginBottom: 6 }}>Preview (as it will appear to the viewer)</div>
              <video key={videoUrl} src={videoUrl} controls preload="metadata" style={{ width: '100%', maxWidth: 560, borderRadius: 10, background: '#000' }} />
            </div>
          ) : (
            <div className="small muted">Preview isn’t available for this link. Live (.m3u8) streams can’t be previewed here.</div>
          )
        ) : null}
        <Field label="Thumbnail link"><input type="url" placeholder="https://" value={thumbnailUrl} onChange={(e) => setThumbnailUrl(e.target.value)} /></Field>
        {uploadsEnabled ? (
          <Field label="…or upload a thumbnail image">
            <input type="file" accept="image/*" disabled={thumbPct !== null} onChange={(e) => void pickThumb(e.target.files?.[0])} />
          </Field>
        ) : null}
        {thumbPct !== null ? <div className="small muted">Uploading image… {thumbPct}%</div> : null}
        {thumbnailUrl && isHttpUrl(thumbnailUrl) ? <img src={thumbnailUrl} alt="Thumbnail preview" style={{ maxWidth: 260, borderRadius: 10 }} /> : null}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Field label="Duration (m:ss or h:mm:ss)" style={{ flex: 1, minWidth: 160 }}><input value={durationText} onChange={(e) => setDurationText(e.target.value)} placeholder="12:40" /></Field>
          <Field label="Publication date" style={{ flex: 1, minWidth: 160 }}><input type="date" value={publicationDate} onChange={(e) => setPublicationDate(e.target.value)} /></Field>
        </div>
        {err ? <Message kind="err">{err}</Message> : null}
        {ok ? <Message kind="ok">{ok}</Message> : null}
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => void save('published')} disabled={busy}>{busy ? 'Saving…' : 'Publish'}</button>
          <button className="btn ghost" onClick={() => void save('draft')} disabled={busy}>Save as draft</button>
          {editingId ? <button className="btn ghost" onClick={resetForm}>Cancel edit</button> : null}
        </div>
      </div>

      <div className="card">
        <h2>All analyses</h2>
        <div className="small muted" style={{ marginBottom: 8 }}>Order here is the order shown in the app.</div>
        {!items ? <div className="muted">Loading…</div> : null}
        {items && items.length === 0 ? <div className="muted">No analyses yet.</div> : null}
        {items?.map((a, i) => (
          <div key={a.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 0', borderTop: '1px solid #3A2253', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <b>{a.title}</b>
              <div className="small muted">
                {a.songTitle} {a.artistName ? `• ${a.artistName}` : ''} • {STATUS_LABEL[a.status] ?? a.status}
              </div>
            </div>
            <button className="btn ghost" onClick={() => void move(i, -1)} disabled={i === 0} aria-label={`Move ${a.title} up`}>↑</button>
            <button className="btn ghost" onClick={() => void move(i, 1)} disabled={i === items.length - 1} aria-label={`Move ${a.title} down`}>↓</button>
            {a.status === 'published' ? (
              <button className="btn ghost" onClick={() => void setStatus(a, 'unpublished')}>Unpublish</button>
            ) : (
              <button className="btn ghost" onClick={() => void setStatus(a, 'published')}>Publish</button>
            )}
            <button className="btn ghost" onClick={() => edit(a)}>Edit</button>
            <button className="btn ghost" onClick={() => void remove(a)}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}
