import { useEffect, useRef, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { notifyChoirFeatured } from '../notify';
import { pushEnabled } from '../push';
import { uploadToCloudinary, uploadVideo, uploadsEnabled } from '../uploads';
import { fmtDuration, isHls, isHttpUrl, parseDuration } from '../lib';
import { Check, Field, Message } from '../components/Field';
import { Icon } from '../components/Icon';
import { useConfirm, useToast } from '../components/feedback';
import { EmptyState, GlassCard, LoadingList, PageHeader, SectionHeader, StatusBadge, UploadProgress } from '../components/ui';

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
  const formRef = useRef<HTMLDivElement>(null);
  const confirm = useConfirm();
  const toast = useToast();

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
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
      const willPush = !editingId && isPublished && sendPushOn && pushEnabled;
      if (willPush && !(await confirm({ title: 'Add and send a push notification?', message: 'App users who chose Featured Choirs are notified straight away.', confirmLabel: 'Add and notify' }))) return;
      if (editingId) {
        await updateDoc(doc(db, 'featuredChoirs', editingId), data);
        setOk('Saved.');
      } else {
        const nextOrder = entries && entries.length ? Math.max(...entries.map((c) => c.order)) + 1 : 0;
        const created = await addDoc(collection(db, 'featuredChoirs'), { ...data, order: nextOrder, createdAt: serverTimestamp() });
        setOk('Added to the showcase.');
        if (willPush) {
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
    if (!(await confirm({ title: `Remove “${c.groupName}” from the showcase?`, message: 'It disappears from the app and website straight away.', confirmLabel: 'Remove', danger: true }))) return;
    try {
      await deleteDoc(doc(db, 'featuredChoirs', c.id));
      if (editingId === c.id) resetForm();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const toggle = async (c: FeaturedEntry) => {
    try {
      await updateDoc(doc(db, 'featuredChoirs', c.id), { isPublished: !c.isPublished, updatedAt: serverTimestamp() });
      toast.ok(c.isPublished ? `${c.groupName} is hidden from the showcase.` : `${c.groupName} is shown in the showcase.`);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Content Studio"
        title="Featured Choirs"
        sub="Groups shown in the “Featured choirs” showcase in the app and on the web. Requests from groups are reviewed under Choir Requests."
        actions={editingId ? <button type="button" className="btn ghost" onClick={resetForm}><Icon name="plus" size={16} />New entry</button> : undefined}
      />

      <div ref={formRef} className={`card ${editingId ? 'editing-ring' : ''}`}>
        <SectionHeader icon={editingId ? 'edit' : 'plus'} title={editingId ? 'Edit entry' : 'Add to the showcase'} hint={editingId ? `Editing “${groupName}”` : 'New entries go to the end of the showcase.'} />
        <div className="compose" style={{ gridTemplateColumns: 'minmax(0, 1fr) 320px' }}>
          <div>
            <div className="two">
              <Field label="Group name *"><input value={groupName} onChange={(e) => setGroupName(e.target.value)} /></Field>
              <Field label="Song title *"><input value={songTitle} onChange={(e) => setSongTitle(e.target.value)} /></Field>
            </div>
            <Field label="Video link *" hint="A video file or a video page link. Live (.m3u8) streams can’t be used here.">
              <div className="input-row">
                <input type="url" placeholder="https://" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} />
                {uploadsEnabled ? (
                  <label className={`btn ghost small file-btn ${uploadPct !== null ? 'disabled' : ''}`}>
                    <Icon name="upload" size={14} />Upload
                    <input type="file" accept="video/*" disabled={uploadPct !== null} onChange={(e) => void pickVideo(e.target.files?.[0])} />
                  </label>
                ) : null}
              </div>
            </Field>
            {uploadPct !== null ? <UploadProgress label="Uploading video" pct={uploadPct} /> : null}
            <Field label="Thumbnail link">
              <div className="input-row">
                <input type="url" placeholder="https://" value={thumbnailUrl} onChange={(e) => setThumbnailUrl(e.target.value)} />
                {uploadsEnabled ? (
                  <label className={`btn ghost small file-btn ${thumbPct !== null ? 'disabled' : ''}`}>
                    <Icon name="upload" size={14} />Upload
                    <input type="file" accept="image/*" disabled={thumbPct !== null} onChange={(e) => void pickThumb(e.target.files?.[0])} />
                  </label>
                ) : null}
              </div>
            </Field>
            {thumbPct !== null ? <UploadProgress label="Uploading thumbnail" pct={thumbPct} /> : null}
            <div className="form-grid">
              <Field label="Duration" hint="m:ss or h:mm:ss"><input value={durationText} onChange={(e) => setDurationText(e.target.value)} placeholder="6:10" /></Field>
            </div>
          </div>
          <div className="stack-sm">
            <span className="small muted">Preview</span>
            {videoUrl && isHttpUrl(videoUrl) && !isHls(videoUrl) && /\.(mp4|m4v|mov|webm)(\?|$)/i.test(videoUrl) ? (
              <video className="preview" src={videoUrl} poster={thumbnailUrl && isHttpUrl(thumbnailUrl) ? thumbnailUrl : undefined} controls preload="metadata" />
            ) : thumbnailUrl && isHttpUrl(thumbnailUrl) ? (
              <img className="cover-preview" src={thumbnailUrl} alt="Thumbnail preview" />
            ) : (
              <div className="cover-empty">Add a thumbnail or a video file to preview it here.</div>
            )}
          </div>
        </div>
        <div className="form-actions">
          <div className="checks">
            <Check checked={isPublished} onChange={setIsPublished} label="Published" hint="Visible in the showcase." />
            {!editingId ? <Check checked={sendPushOn} onChange={setSendPushOn} label="Send a push notification" disabled={!pushEnabled || !isPublished} hint={!pushEnabled ? 'Push isn’t configured.' : undefined} /> : null}
          </div>
          <div className="row">
            {editingId ? <button type="button" className="btn ghost" onClick={resetForm}>Cancel edit</button> : null}
            <button type="button" className="btn primary" onClick={() => void save()} disabled={busy || uploadPct !== null || thumbPct !== null}>
              {busy ? <span className="spin sm" aria-hidden="true" /> : <Icon name="check" size={16} />}{busy ? 'Saving…' : editingId ? 'Save changes' : 'Add to showcase'}
            </button>
          </div>
        </div>
        {err ? <Message kind="err">{err}</Message> : null}
        {ok ? <Message kind="ok">{ok}</Message> : null}
      </div>

      <GlassCard>
        <SectionHeader icon="layers" title="Showcase order" hint={entries ? `${entries.length} entries · ${entries.filter((c) => c.isPublished).length} shown. The app shows them in this order.` : undefined} />
        {!entries ? <LoadingList rows={3} /> : null}
        {entries && entries.length === 0 ? <EmptyState icon="users" title="No entries yet">Add the first group with the form above.</EmptyState> : null}
        <div className="order-list">
          {entries?.map((c, i) => (
            <div key={c.id} className="order-row">
              <div className="moves">
                <button type="button" className="icon-btn xs" onClick={() => void move(i, -1)} disabled={i === 0} aria-label={`Move ${c.groupName} up`}><Icon name="arrowUp" size={14} /></button>
                <button type="button" className="icon-btn xs" onClick={() => void move(i, 1)} disabled={i === entries.length - 1} aria-label={`Move ${c.groupName} down`}><Icon name="arrowDown" size={14} /></button>
              </div>
              {c.thumbnailUrl ? <img className="thumb" src={c.thumbnailUrl} alt="" loading="lazy" /> : <div className="thumb center-icon"><Icon name="users" size={18} /></div>}
              <div className="info">
                <div className="t" title={c.groupName}>{c.groupName}</div>
                <div className="tags">
                  <StatusBadge kind={c.isPublished ? 'ok' : 'draft'}>{c.isPublished ? 'Shown' : 'Hidden'}</StatusBadge>
                  {c.songTitle ? <span className="tag"><Icon name="music" size={11} />{c.songTitle}</span> : null}
                  {c.duration ? <span className="tag"><Icon name="clock" size={11} />{fmtDuration(c.duration)}</span> : null}
                </div>
              </div>
              <div className="row-actions">
                <button type="button" className="btn small ghost" onClick={() => edit(c)}><Icon name="edit" size={14} />Edit</button>
                <button type="button" className={`btn small ${c.isPublished ? 'ghost' : 'success'}`} onClick={() => void toggle(c)}>{c.isPublished ? 'Hide' : 'Show'}</button>
                <a className="btn small ghost" href={c.videoUrl} target="_blank" rel="noreferrer" aria-label={`Open ${c.groupName}'s video`}><Icon name="external" size={14} /></a>
                <button type="button" className="btn small danger" aria-label={`Remove ${c.groupName}`} onClick={() => void remove(c)}><Icon name="trash" size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    </>
  );
}
