import { useEffect, useRef, useState } from 'react';
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
import { notifyLoveworldPublished } from '../notify';
import { pushEnabled } from '../push';
import { uploadToCloudinary, uploadVideo, uploadsEnabled } from '../uploads';
import { fmtDuration, isHls, isHttpUrl, parseDuration } from '../lib';
import { Check, Field, Message } from '../components/Field';
import { Icon } from '../components/Icon';
import { StreamPreview } from '../components/StreamPreview';
import { useConfirm } from '../components/feedback';
import { EmptyState, GlassCard, LoadingList, PageHeader, SearchInput, SectionHeader, StatusBadge, UploadProgress } from '../components/ui';

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
  const [sendPushOn, setSendPushOn] = useState(true);
  const [isPublished, setIsPublished] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [thumbPct, setThumbPct] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [search, setSearch] = useState('');
  const formRef = useRef<HTMLDivElement>(null);
  const confirm = useConfirm();

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
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
      const willPush = !editingId && isPublished && sendPushOn && pushEnabled;
      if (willPush && !(await confirm({ title: 'Publish and send a push notification?', message: 'App users who chose LoveWorld Singers are notified straight away.', confirmLabel: 'Publish and notify' }))) return;
      if (editingId) {
        await updateDoc(doc(db, 'loveworldSingersVideos', editingId), data);
        setOk('Saved.');
      } else {
        // New videos go to the end of the library.
        const nextOrder = videos && videos.length ? Math.max(...videos.map((v) => v.order)) + 1 : 0;
        const created = await addDoc(collection(db, 'loveworldSingersVideos'), { ...data, order: nextOrder, createdAt: serverTimestamp() });
        setOk(isPublished ? 'Published. It is now visible in the app and on the web.' : 'Saved as a draft. It is hidden from users until you publish it.');
        if (willPush) {
          const r = await notifyLoveworldPublished(created.id, title.trim());
          setOk(r.status === 'failed' ? `Published, but the push failed: ${r.message}` : 'Published and notification sent.');
        }
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
    if (!(await confirm({ title: `Delete “${v.title}”?`, message: 'The app and website stop showing it straight away. This can’t be undone.', confirmLabel: 'Delete permanently', danger: true }))) return;
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

  const needle = search.trim().toLowerCase();
  const filtering = needle.length > 0;
  const listed = (videos ?? []).map((v, i) => ({ v, i })).filter(({ v }) => !filtering || [v.title, v.description ?? ''].some((x) => x.toLowerCase().includes(needle)));

  return (
    <>
      <PageHeader
        eyebrow="Content Studio"
        title="LoveWorld Singers"
        sub="The “Worship with your LoveWorld Singers” library. Published videos appear in the app and on the web straight away."
        actions={editingId ? <button type="button" className="btn ghost" onClick={resetForm}><Icon name="plus" size={16} />New video</button> : undefined}
      />

      <div ref={formRef} className={`card ${editingId ? 'editing-ring' : ''}`}>
        <SectionHeader icon={editingId ? 'edit' : 'plus'} title={editingId ? 'Edit video' : 'Add a video'} hint={editingId ? `Editing “${title}”` : 'New videos go to the end of the library.'} />
        <div className="compose" style={{ gridTemplateColumns: 'minmax(0, 1fr) 320px' }}>
          <div>
            <Field label="Title *"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Song title" /></Field>
            <Field label="Description"><textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
            <Field label="Video link *" hint="MP4 is needed for downloads. Paste a link or upload a file.">
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
              <Field label="Duration" hint="m:ss or h:mm:ss"><input value={durationText} onChange={(e) => setDurationText(e.target.value)} placeholder="4:32" /></Field>
              <Field label="Publish date"><input type="date" value={publishDate} onChange={(e) => setPublishDate(e.target.value)} /></Field>
            </div>
          </div>
          <div className="stack-sm">
            <span className="small muted">Preview</span>
            {videoUrl && isHttpUrl(videoUrl) ? (
              isHls(videoUrl) ? <StreamPreview url={videoUrl} /> : <video className="preview" src={videoUrl} poster={thumbnailUrl && isHttpUrl(thumbnailUrl) ? thumbnailUrl : undefined} controls preload="metadata" />
            ) : thumbnailUrl && isHttpUrl(thumbnailUrl) ? (
              <img className="cover-preview" src={thumbnailUrl} alt="Thumbnail preview" />
            ) : (
              <div className="cover-empty">Add a video link or upload a file to preview it here.</div>
            )}
          </div>
        </div>
        <div className="form-actions">
          <div className="checks">
            <Check checked={isPublished} onChange={setIsPublished} label="Published" hint="Hidden from users until published." />
            {!editingId ? <Check checked={sendPushOn} onChange={setSendPushOn} label="Send a push notification" disabled={!pushEnabled || !isPublished} hint={!pushEnabled ? 'Push isn’t configured.' : undefined} /> : null}
            <Check checked={isFeatured} onChange={setIsFeatured} label="Featured" hint="Shown first in the library." />
            <Check checked={isDownloadable} onChange={setIsDownloadable} label="Allow downloads" hint="Needs an MP4 link." />
          </div>
          <div className="row">
            {editingId ? <button type="button" className="btn ghost" onClick={resetForm}>Cancel edit</button> : null}
            <button type="button" className="btn primary" onClick={() => void save()} disabled={busy || uploadPct !== null || thumbPct !== null}>
              {busy ? <span className="spin sm" aria-hidden="true" /> : <Icon name="check" size={16} />}{busy ? 'Saving…' : editingId ? 'Save changes' : 'Save video'}
            </button>
          </div>
        </div>
        {err ? <Message kind="err">{err}</Message> : null}
        {ok ? <Message kind="ok">{ok}</Message> : null}
      </div>

      <GlassCard>
        <SectionHeader
          icon="layers"
          title="Library order"
          hint={videos ? `${videos.length} videos · ${videos.filter((v) => v.isPublished).length} published. The app shows them in this order.` : undefined}
          actions={<SearchInput value={search} onChange={setSearch} placeholder="Search the library…" label="Search the library" />}
        />
        {filtering ? <p className="result-count">Reordering is off while searching.</p> : null}
        {!videos ? <LoadingList rows={4} /> : null}
        {videos && listed.length === 0 ? <EmptyState icon="mic" title={videos.length === 0 ? 'No videos yet' : 'No videos match'}>{videos.length === 0 ? 'Add the first video with the form above.' : 'Try another search.'}</EmptyState> : null}
        <div className="order-list">
          {listed.map(({ v, i }) => (
            <div key={v.id} className="order-row">
              <div className="moves">
                <button type="button" className="icon-btn xs" onClick={() => void move(i, -1)} disabled={filtering || i === 0} aria-label={`Move ${v.title} up`}><Icon name="arrowUp" size={14} /></button>
                <button type="button" className="icon-btn xs" onClick={() => void move(i, 1)} disabled={filtering || !videos || i === videos.length - 1} aria-label={`Move ${v.title} down`}><Icon name="arrowDown" size={14} /></button>
              </div>
              {v.thumbnailUrl ? <img className="thumb" src={v.thumbnailUrl} alt="" loading="lazy" /> : <div className="thumb center-icon"><Icon name="mic" size={18} /></div>}
              <div className="info">
                <div className="t" title={v.title}>{v.title}</div>
                <div className="tags">
                  <StatusBadge kind={v.isPublished ? 'ok' : 'draft'}>{v.isPublished ? 'Published' : 'Draft'}</StatusBadge>
                  {v.isFeatured ? <span className="tag gold"><Icon name="star" size={11} />Featured</span> : null}
                  <span className="tag"><Icon name="download" size={11} />{v.isDownloadable ? 'Downloads on' : 'Downloads off'}</span>
                  {v.duration ? <span className="tag"><Icon name="clock" size={11} />{fmtDuration(v.duration)}</span> : null}
                </div>
              </div>
              <div className="row-actions">
                <button type="button" className="btn small ghost" onClick={() => edit(v)}><Icon name="edit" size={14} />Edit</button>
                <button type="button" className={`btn small ${v.isPublished ? 'ghost' : 'success'}`} onClick={() => void setField(v, { isPublished: !v.isPublished })}>{v.isPublished ? 'Unpublish' : 'Publish'}</button>
                <button type="button" className="btn small ghost" onClick={() => void setField(v, { isFeatured: !v.isFeatured })}>{v.isFeatured ? 'Unfeature' : 'Feature'}</button>
                <button type="button" className="btn small ghost" onClick={() => void setField(v, { isDownloadable: !v.isDownloadable })}>{v.isDownloadable ? 'Disable download' : 'Enable download'}</button>
                <button type="button" className="btn small danger" aria-label={`Delete ${v.title}`} onClick={() => void remove(v)}><Icon name="trash" size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      <form className="card" onSubmit={saveHeroVideo}>
        <SectionHeader icon="film" title="Page background video" hint="Plays at the top of the LoveWorld Singers page in the app and on the web." />
        <div className="compose" style={{ gridTemplateColumns: 'minmax(0, 1fr) 320px' }}>
          <div>
            <Field label="Video link (https://, MP4)">
              <input type="url" value={heroVideoUrl} onChange={(e) => setHeroVideoUrl(e.target.value)} placeholder="https://..." />
            </Field>
            {heroErr ? <Message kind="err">{heroErr}</Message> : null}
            {heroOk ? <Message kind="ok">{heroOk}</Message> : null}
            <div className="row">
              <button type="submit" className="btn primary" disabled={heroBusy}>{heroBusy ? 'Saving…' : 'Save page video'}</button>
              <button type="button" className="btn ghost" onClick={() => setHeroVideoUrl(DEFAULT_HERO_VIDEO)}><Icon name="undo" size={14} />Reset to default</button>
            </div>
          </div>
          {heroVideoUrl ? <video className="preview" src={heroVideoUrl} controls muted preload="metadata" /> : <div className="cover-empty">No video</div>}
        </div>
      </form>
    </>
  );
}
