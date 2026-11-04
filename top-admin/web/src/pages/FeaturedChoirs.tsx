import { useEffect, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { notifyChoirFeatured } from '../notify';
import { pushEnabled } from '../push';
import { uploadToCloudinary, uploadVideo, uploadsEnabled } from '../uploads';
import { fmtDuration, isHls, isHttpUrl, parseDuration } from '../lib';
import { Check, Field, Message } from '../components/Field';

/** One entry in the "Featured choirs" showcase (Firestore: featuredChoirs). */
interface FeaturedEntry {
  id: string;
  groupName: string;
  songTitle: string;
  videoUrl: string;
  thumbnailUrl: string;
  duration?: number;
  isPublished: boolean;
  order: number;
}

/** Admin editor for the "Feature your choir/group" showcase. Entries are added here, never in code. */
export function FeaturedChoirs() {
  const [entries, setEntries] = useState<FeaturedEntry[] | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState('');
  const [songTitle, setSongTitle] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [durationText, setDurationText] = useState('');
  const [isPublished, setIsPublished] = useState(true);
  const [sendPushOn, setSendPushOn] = useState(true);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [thumbPct, setThumbPct] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'featuredChoirs'), orderBy('order', 'asc'));
    return onSnapshot(
      q,
      (snap) => setEntries(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FeaturedEntry, 'id'>) }))),
      (e) => setErr(e.message),
    );
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setGroupName('');
    setSongTitle('');
    setVideoUrl('');
    setThumbnailUrl('');
    setDurationText('');
    setIsPublished(true);
  };

  const edit = (c: FeaturedEntry) => {
    setEditingId(c.id);
    setGroupName(c.groupName);
    setSongTitle(c.songTitle);
    setVideoUrl(c.videoUrl);
    setThumbnailUrl(c.thumbnailUrl ?? '');
    setDurationText(fmtDuration(c.duration ?? 0));
    setIsPublished(c.isPublished);
    setErr('');
    setOk('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const pickVideo = async (file?: File) => {
    if (!file) return;
    setErr('');
    try {
      setUploadPct(0);
      setVideoUrl((await uploadVideo(file, setUploadPct)).url);
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
    if (!groupName.trim()) return setErr('Enter the group name.');
    if (!songTitle.trim()) return setErr('Enter the song title.');
    if (!isHttpUrl(videoUrl)) return setErr('Upload a video or paste a link that starts with https://');
    if (thumbnailUrl && !isHttpUrl(thumbnailUrl)) return setErr('The thumbnail link must start with https://');
    if (isHls(videoUrl)) return setErr('Live (.m3u8) streams can’t be shown in the showcase. Use a video file or a video page link.');

    setBusy(true);
    try {
      const data = {
        groupName: groupName.trim(),
        songTitle: songTitle.trim(),
        videoUrl: videoUrl.trim(),
        thumbnailUrl: thumbnailUrl.trim(),
        duration: parseDuration(durationText),
        isPublished,
        updatedAt: serverTimestamp(),
      };
      if (editingId) {
        await updateDoc(doc(db, 'featuredChoirs', editingId), data);
        setOk('Saved.');
      } else {
        const nextOrder = entries && entries.length ? Math.max(...entries.map((c) => c.order)) + 1 : 0;
        const created = await addDoc(collection(db, 'featuredChoirs'), { ...data, order: nextOrder, createdAt: serverTimestamp() });
        setOk('Added to the showcase.');
        if (isPublished && sendPushOn && pushEnabled) {
          if (!confirm('This sends a push notification to app users who chose Featured Choirs. Continue?')) return;
          const r = await notifyChoirFeatured(created.id, groupName.trim());
          setOk(r.status === 'failed' ? `Added to the showcase, but the push failed: ${r.message}` : 'Added to the showcase and notification sent.');
        }
      }
      resetForm();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    if (!entries) return;
    const other = entries[index + dir];
    if (!other) return;
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'featuredChoirs', entries[index].id), { order: other.order });
      batch.update(doc(db, 'featuredChoirs', other.id), { order: entries[index].order });
      await batch.commit();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const remove = async (c: FeaturedEntry) => {
    if (!confirm(`Remove “${c.groupName}” from the showcase?`)) return;
    try {
      await deleteDoc(doc(db, 'featuredChoirs', c.id));
      if (editingId === c.id) resetForm();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <div>
      <h1>Featured choirs</h1>
      <p className="muted">Groups shown in the “Featured choirs” showcase on the app and web. Requests from groups are reviewed under “Choir requests”.</p>

      <div className="card">
        <h2>{editingId ? 'Edit entry' : 'New entry'}</h2>
        <Field label="Group name"><input value={groupName} onChange={(e) => setGroupName(e.target.value)} /></Field>
        <Field label="Song title"><input value={songTitle} onChange={(e) => setSongTitle(e.target.value)} /></Field>
        <Field label="Video link"><input type="url" placeholder="https://" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} /></Field>
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
        <Field label="Duration (m:ss or h:mm:ss)"><input value={durationText} onChange={(e) => setDurationText(e.target.value)} placeholder="6:10" /></Field>
        <Check checked={isPublished} onChange={setIsPublished} label="Published (visible in the showcase)" />
        {!editingId ? <Check checked={sendPushOn} onChange={setSendPushOn} label="Send a push notification now" /> : null}
        {err ? <Message kind="err">{err}</Message> : null}
        {ok ? <Message kind="ok">{ok}</Message> : null}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button className="btn" onClick={() => void save()} disabled={busy}>{busy ? 'Saving…' : editingId ? 'Save changes' : 'Add to showcase'}</button>
          {editingId ? <button className="btn ghost" onClick={resetForm}>Cancel edit</button> : null}
        </div>
      </div>

      <div className="card">
        <h2>Showcase order</h2>
        {!entries ? <div className="muted">Loading…</div> : null}
        {entries && entries.length === 0 ? <div className="muted">No entries yet.</div> : null}
        {entries?.map((c, i) => (
          <div key={c.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 0', borderTop: '1px solid #3A2253', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <b>{c.groupName}</b>
              <div className="small muted">{c.songTitle} {c.isPublished ? '' : '• Hidden'}</div>
            </div>
            <button className="btn ghost" onClick={() => void move(i, -1)} disabled={i === 0} aria-label={`Move ${c.groupName} up`}>↑</button>
            <button className="btn ghost" onClick={() => void move(i, 1)} disabled={i === entries.length - 1} aria-label={`Move ${c.groupName} down`}>↓</button>
            <button className="btn ghost" onClick={() => void updateDoc(doc(db, 'featuredChoirs', c.id), { isPublished: !c.isPublished, updatedAt: serverTimestamp() })}>
              {c.isPublished ? 'Hide' : 'Show'}
            </button>
            <button className="btn ghost" onClick={() => edit(c)}>Edit</button>
            <button className="btn ghost" onClick={() => void remove(c)}>Remove</button>
          </div>
        ))}
      </div>
    </div>
  );
}
