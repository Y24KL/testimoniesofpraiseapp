import { useEffect, useRef, useState } from 'react';
import { collection, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import {
  MAX_VIDEO_MB,
  uploadToCloudinary,
  uploadsEnabled,
  uploadVideo,
  identifyProvider,
  getProviderDisplayName,
} from '../uploads';
import { describe, notifyTestimonyPublished } from '../notify';
import { CATEGORIES, fmtDuration, isHls, isHttpUrl, parseDuration, readVideoDuration, testimonyFromDoc } from '../lib';
import type { Route, Testimony } from '../types';
import { Check, Field, Message } from '../components/Field';
import { Icon } from '../components/Icon';
import { StreamPreview } from '../components/StreamPreview';
import { useConfirm } from '../components/feedback';
import { GlassCard, LoadingList, PageHeader, SectionHeader, UploadProgress } from '../components/ui';
import { indexTestimony } from '../aiSearchIndex';

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
  const confirm = useConfirm();

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
    if (!file.type.startsWith('video/') && !file.type.startsWith('audio/')) return setErr('Please choose a video file (MP4 works best).');
    try {
      setVideoPct(0);
      const secs = await readVideoDuration(file);
      if (secs && !durationText) setDurationText(fmtDuration(secs));
      const res = await uploadVideo(file, setVideoPct);
      mark(setVideoUrl)(res.url);
      setOk(`Media uploaded to ${getProviderDisplayName(res.provider)}!`);
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
    if (newlyPublished && notifyOnPublish && !(await confirm({ title: 'Publish and notify app users?', message: 'Publishing sends a push notification to everyone with testimony alerts on.', confirmLabel: 'Publish and notify' }))) return;

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
      if (isPublished) {
        try {
          await indexTestimony({
            id: docId, title: title.trim(), description: description.trim(), authorName: authorName.trim(),
            category: category.trim(), keywords: keywords.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean),
          });
        } catch (indexError) {
          console.warn('[AI search] testimony saved but embedding could not be refreshed; use Rebuild AI search index.', indexError);
        }
      }
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

  const back = async () => {
    if (!dirty.current || (await confirm({ title: 'Discard your unsaved changes?', message: 'Anything you changed on this page will be lost.', confirmLabel: 'Discard changes', cancelLabel: 'Keep editing', danger: true }))) go({ name: 'testimonies' });
  };
  if (loading) {
    return (
      <>
        <PageHeader eyebrow="Video Testimonies" title="Edit testimony" />
        <GlassCard><LoadingList rows={4} /></GlassCard>
      </>
    );
  }
  const busy = saving || thumbPct !== null || videoPct !== null;
  const saveLabel = saving ? 'Saving…' : busy ? 'Uploading…' : isNew ? 'Save testimony' : 'Save changes';

  return (
    <>
      <PageHeader
        eyebrow="Video Testimonies"
        title={isNew ? 'New testimony' : 'Edit testimony'}
        sub={isNew ? 'Add the details, a video and a thumbnail. Save as a draft or publish straight away.' : existing?.title}
        actions={
          <>
            <button type="button" className="btn ghost" onClick={() => void back()}><Icon name="arrowLeft" size={16} />Back</button>
            <button type="button" className="btn primary" onClick={() => void save()} disabled={busy}>
              {saving ? <span className="spin sm" aria-hidden="true" /> : <Icon name="check" size={16} />}{saveLabel}
            </button>
          </>
        }
      />
      {err ? <Message kind="err">{err}</Message> : null}
      {ok ? <Message kind="ok">{ok}</Message> : null}

      <div className="editor-layout">
        <div className="stack">
          <GlassCard>
            <SectionHeader icon="fileText" title="Details" />
            <Field label="Title *"><input type="text" value={title} onChange={(e) => mark(setTitle)(e.target.value)} maxLength={160} placeholder="e.g. Healed of a lifelong condition" /></Field>
            <div className="two">
              <Field label="Testifier name"><input type="text" value={authorName} onChange={(e) => mark(setAuthorName)(e.target.value)} /></Field>
              <Field label="Category">
                <input type="text" list="cats" value={category} onChange={(e) => mark(setCategory)(e.target.value)} />
                <datalist id="cats">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
              </Field>
            </div>
            <Field label="Description"><textarea value={description} onChange={(e) => mark(setDescription)(e.target.value)} style={{ minHeight: 120 }} /></Field>
            <Field label="Search keywords" hint="Comma-separated. Helps people find it in the app’s search."><input type="text" value={keywords} onChange={(e) => mark(setKeywords)(e.target.value)} placeholder="healing, faith, family" /></Field>
          </GlassCard>

          <GlassCard>
            <SectionHeader icon="film" title="Video" />
            {uploadsEnabled ? (
              <>
                <div className="upload-zone">
                  <div className="row">
                    <div>
                      <b>Upload a video file</b>
                      <div className="small muted">MP4 works best. Up to {MAX_VIDEO_MB} MB on the free plan. Keep this page open until it finishes.</div>
                    </div>
                    <label className={`btn small file-btn ${videoPct !== null ? 'disabled' : ''}`}>
                      <Icon name="upload" size={14} />Choose video
                      <input type="file" accept="video/*" onChange={(e) => void pickVideo(e.target.files?.[0])} disabled={videoPct !== null} />
                    </label>
                  </div>
                  {videoPct !== null ? <UploadProgress label="Uploading video" pct={videoPct} /> : null}
                </div>
                <div className="or-sep">or paste a link</div>
              </>
            ) : null}
            <Field label={uploadsEnabled ? 'Video link' : 'Video link *'} hint="An MP4 link or an HLS (.m3u8) stream from your video host."><input type="url" placeholder="https://" value={videoUrl} onChange={(e) => mark(setVideoUrl)(e.target.value)} /></Field>
            {videoUrl ? <div className="provider-note"><Icon name="cloud" size={14} />Storage provider: <b>{getProviderDisplayName(identifyProvider(videoUrl))}</b></div> : null}
            {videoUrl && !hls ? <video className="preview" src={videoUrl} controls preload="metadata" /> : null}
            {hls && isHttpUrl(videoUrl) ? <StreamPreview url={videoUrl} /> : null}
            {hls ? <Message kind="warn">HLS stream detected. Viewers can watch it, but it can’t be downloaded for offline use.</Message> : null}
            <div className="two" style={{ marginTop: 12 }}>
              <Field label="Duration" hint="Filled in automatically when you upload. Format 12:40."><input type="text" value={durationText} onChange={(e) => mark(setDurationText)(e.target.value)} placeholder="12:40" /></Field>
            </div>
          </GlassCard>
        </div>

        <aside className="editor-side">
          <GlassCard>
            <SectionHeader icon="eye" title="Visibility" as="h3" />
            <Check checked={isPublished} onChange={mark(setPublished)} label="Published" hint="Visible in the app and the website feed. Untick to keep it as a draft or remove it from the app." />
            <Check checked={notifyOnPublish} onChange={mark(setNotify)} label="Push notification on publish" hint="Only sent the first time it’s published." />
            <Check checked={isFeatured} onChange={mark(setFeatured)} label="Featured on the Home screen" />
            <Check checked={isDownloadable && !hls} disabled={hls} onChange={mark(setDownloadable)} label="Allow offline downloads" hint={hls ? 'Not available for HLS streams.' : undefined} />
            <div className="sticky-actions">
              <button type="button" className="btn ghost" onClick={() => void back()} disabled={saving}>Cancel</button>
              <button type="button" className="btn primary" onClick={() => void save()} disabled={busy}>{saveLabel}</button>
            </div>
          </GlassCard>

          <GlassCard>
            <SectionHeader icon="image" title="Thumbnail" as="h3" />
            {thumbnail ? <img className="cover-preview" src={thumbnail} alt="Thumbnail preview" /> : <div className="cover-empty">No thumbnail yet</div>}
            {thumbPct !== null ? <UploadProgress label="Uploading thumbnail" pct={thumbPct} /> : null}
            <div className="stack-sm" style={{ marginTop: 12 }}>
              <input type="url" placeholder="https://… image link" aria-label="Thumbnail link" value={thumbnail} onChange={(e) => mark(setThumbnail)(e.target.value)} />
              {thumbnail ? <div className="provider-note" style={{ margin: 0 }}><Icon name="cloud" size={14} />Storage provider: <b>{getProviderDisplayName(identifyProvider(thumbnail))}</b></div> : null}
              {uploadsEnabled ? (
                <label className="btn ghost small file-btn" style={{ justifySelf: 'start' }}>
                  <Icon name="upload" size={14} />Upload image
                  <input type="file" accept="image/*" onChange={(e) => void pickThumb(e.target.files?.[0])} disabled={thumbPct !== null} />
                </label>
              ) : null}
            </div>
          </GlassCard>
        </aside>
      </div>
    </>
  );
}
