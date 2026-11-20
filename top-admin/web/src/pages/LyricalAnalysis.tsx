import { useEffect, useRef, useState, type CSSProperties } from 'react';
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
import { Icon } from '../components/Icon';
import { StreamPreview } from '../components/StreamPreview';
import { useConfirm } from '../components/feedback';
import { EmptyState, FilterTabs, GlassCard, LoadingList, PageHeader, SearchInput, SectionHeader, StatusBadge, UploadProgress } from '../components/ui';

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

const STATUS_LABEL: Record<Status, string> = { draft: 'Draft', published: 'Published', unpublished: 'Unpublished' };
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
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Status>('all');
  const formRef = useRef<HTMLDivElement>(null);
  const confirm = useConfirm();

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
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    if (!(await confirm({ title: `Delete “${a.title}”?`, message: 'The app and website stop showing it. This can’t be undone.', confirmLabel: 'Delete permanently', danger: true }))) return;
    setErr('');
    try {
      await deleteDoc(doc(db, 'lyricalAnalyses', a.id));
      if (editingId === a.id) resetForm();
      setOk('Deleted.');
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const previewable = isHttpUrl(videoUrl);
  const badge = (st: Status) => (st === 'published' ? 'ok' : st === 'unpublished' ? 'warn' : 'draft');
  const needle = search.trim().toLowerCase();
  const filtering = needle.length > 0 || statusFilter !== 'all';
  const listed = (items ?? []).map((a, i) => ({ a, i })).filter(({ a }) => (statusFilter === 'all' || a.status === statusFilter) && (!needle || [a.title, a.songTitle ?? '', a.artistName ?? ''].some((x) => x.toLowerCase().includes(needle))));

  return (
    <>
      <PageHeader
        eyebrow="Content Studio"
        title="Lyrical Analysis"
        sub="Analysis videos of LoveWorld songs. Only published items appear in the app and on the web."
        actions={editingId ? <button type="button" className="btn ghost" onClick={resetForm}><Icon name="plus" size={16} />New analysis</button> : undefined}
      />

      <div ref={formRef} className={`card ${editingId ? 'editing-ring' : ''}`}>
        <SectionHeader
          icon={editingId ? 'edit' : 'plus'}
          title={editingId ? 'Edit analysis' : 'New analysis'}
          hint={editingId ? <>Currently <StatusBadge kind={badge(editingStatus)}>{STATUS_LABEL[editingStatus]}</StatusBadge></> : 'Save as a draft to keep working on it, or publish straight away.'}
        />
        <div className="compose" style={{ '--side': '360px' } as CSSProperties}>
          <div>
            <Field label="Analysis title *"><input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
            <div className="two">
              <Field label="Original song title *"><input value={songTitle} onChange={(e) => setSongTitle(e.target.value)} /></Field>
              <Field label="Artist / minister"><input value={artistName} onChange={(e) => setArtistName(e.target.value)} placeholder="LoveWorld Singers member or minister" /></Field>
            </div>
            <Field label="Description"><textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
            <Field label="Video link" hint={editingId ? 'To replace the video, upload a new file or paste a new link. The previous file stays in storage.' : 'Upload a video or paste a link.'}>
              <div className="input-row">
                <input type="url" placeholder="https://" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} />
                {uploadsEnabled ? (
                  <label className={`btn ghost small file-btn ${uploadPct !== null ? 'disabled' : ''}`}>
                    <Icon name="upload" size={14} />{editingId ? 'Replace' : 'Upload'}
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
              <Field label="Duration" hint="m:ss or h:mm:ss"><input value={durationText} onChange={(e) => setDurationText(e.target.value)} placeholder="12:40" /></Field>
              <Field label="Publication date"><input type="date" value={publicationDate} onChange={(e) => setPublicationDate(e.target.value)} /></Field>
            </div>
          </div>
          <div className="stack-sm">
            <span className="small muted">Preview, as viewers will see it</span>
            {videoUrl && previewable ? (
              isHls(videoUrl) ? <StreamPreview key={videoUrl} url={videoUrl} /> : <video key={videoUrl} className="preview" src={videoUrl} poster={thumbnailUrl && isHttpUrl(thumbnailUrl) ? thumbnailUrl : undefined} controls preload="metadata" />
            ) : thumbnailUrl && isHttpUrl(thumbnailUrl) ? (
              <img className="cover-preview" src={thumbnailUrl} alt="Thumbnail preview" />
            ) : (
              <div className="cover-empty">Add a video to preview it here.</div>
            )}
          </div>
        </div>
        <div className="form-actions">
          <span className="small muted">{editingId ? 'Saving keeps your changes and sets the status you choose.' : 'New analyses go to the end of the list.'}</span>
          <div className="row">
            {editingId ? <button type="button" className="btn ghost" onClick={resetForm}>Cancel edit</button> : null}
            <button type="button" className="btn ghost" onClick={() => void save('draft')} disabled={busy || uploadPct !== null || thumbPct !== null}>Save as draft</button>
            <button type="button" className="btn primary" onClick={() => void save('published')} disabled={busy || uploadPct !== null || thumbPct !== null}>
              {busy ? <span className="spin sm" aria-hidden="true" /> : <Icon name="send" size={16} />}{busy ? 'Saving…' : 'Publish'}
            </button>
          </div>
        </div>
        {err ? <Message kind="err">{err}</Message> : null}
        {ok ? <Message kind="ok">{ok}</Message> : null}
      </div>

      <GlassCard>
        <SectionHeader icon="layers" title="All analyses" hint="The order here is the order shown in the app." actions={<SearchInput value={search} onChange={setSearch} placeholder="Search analyses…" label="Search analyses" />} />
        <div className="toolbar">
          <FilterTabs
            label="Filter by status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={(['all', 'published', 'draft', 'unpublished'] as ('all' | Status)[]).map((f) => ({ id: f, label: f === 'all' ? 'All' : f === 'draft' ? 'Drafts' : f.charAt(0).toUpperCase() + f.slice(1), count: items ? items.filter((a) => f === 'all' || a.status === f).length : undefined }))}
          />
        </div>
        {filtering ? <p className="result-count">Reordering is off while a search or filter is applied.</p> : null}
        {!items ? <LoadingList rows={3} /> : null}
        {items && listed.length === 0 ? <EmptyState icon="music" title={items.length === 0 ? 'No analyses yet' : 'No analyses match'}>{items.length === 0 ? 'Add the first one with the form above.' : 'Try another search or filter.'}</EmptyState> : null}
        <div className="order-list">
          {listed.map(({ a, i }) => (
            <div key={a.id} className="order-row">
              <div className="moves">
                <button type="button" className="icon-btn xs" onClick={() => void move(i, -1)} disabled={filtering || i === 0} aria-label={`Move ${a.title} up`}><Icon name="arrowUp" size={14} /></button>
                <button type="button" className="icon-btn xs" onClick={() => void move(i, 1)} disabled={filtering || !items || i === items.length - 1} aria-label={`Move ${a.title} down`}><Icon name="arrowDown" size={14} /></button>
              </div>
              {a.thumbnailUrl ? <img className="thumb" src={a.thumbnailUrl} alt="" loading="lazy" /> : <div className="thumb center-icon"><Icon name="music" size={18} /></div>}
              <div className="info">
                <div className="t" title={a.title}>{a.title}</div>
                <div className="tags">
                  <StatusBadge kind={badge(a.status)}>{STATUS_LABEL[a.status] ?? a.status}</StatusBadge>
                  {a.songTitle ? <span className="tag"><Icon name="music" size={11} />{a.songTitle}</span> : null}
                  {a.artistName ? <span className="tag"><Icon name="user" size={11} />{a.artistName}</span> : null}
                  {a.duration ? <span className="tag"><Icon name="clock" size={11} />{fmtDuration(a.duration)}</span> : null}
                </div>
              </div>
              <div className="row-actions">
                <button type="button" className="btn small ghost" onClick={() => edit(a)}><Icon name="edit" size={14} />Edit</button>
                {a.status === 'published' ? (
                  <button type="button" className="btn small ghost" onClick={() => void setStatus(a, 'unpublished')}>Unpublish</button>
                ) : (
                  <button type="button" className="btn small success" onClick={() => void setStatus(a, 'published')}>Publish</button>
                )}
                <button type="button" className="btn small danger" aria-label={`Delete ${a.title}`} onClick={() => void remove(a)}><Icon name="trash" size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    </>
  );
}
