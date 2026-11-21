import { useEffect, useRef, useState } from 'react';
import { addDoc, collection, doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { isHttpUrl } from '../lib';
import { describe, notifyWrittenPublished } from '../notify';
import { uploadToCloudinary, uploadsEnabled } from '../uploads';
import type { Route } from '../types';
import { Check, Field, Message } from '../components/Field';
import { Icon } from '../components/Icon';
import { useConfirm } from '../components/feedback';
import { TagPicker } from '../components/TagPicker';
import { sanitizeTags, type ContentTag } from '../tags';
import { GlassCard, LoadingList, PageHeader, SectionHeader, UploadProgress } from '../components/ui';

// Same limits as the Firestore rules (validWrittenTestimony).
const MAX_TITLE = 200;
const MAX_BODY = 20000;
const CATEGORIES = ['Healing', 'Finance', 'Career', 'Family', 'Salvation', 'Deliverance', 'Academics', 'Protection', 'Other'];

export interface WrittenPrefill {
  title?: string;
  body?: string;
  authorName?: string;
  churchZone?: string;
  sourceSubmissionId?: string;
}

export function WrittenTestimonyEditor({ id, prefill, go }: { id?: string; prefill?: WrittenPrefill; go: (r: Route) => void }) {
  // The document id once saved, so a second Save updates instead of creating a copy.
  const [docId, setDocId] = useState(id);
  const isNew = !docId;
  const [title, setTitle] = useState(prefill?.title ?? '');
  const [body, setBody] = useState(prefill?.body ?? '');
  const [authorName, setAuthorName] = useState(prefill?.authorName ?? '');
  const [churchZone, setChurchZone] = useState(prefill?.churchZone ?? '');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState<ContentTag[]>([]);
  const [photo, setPhoto] = useState('');
  const [isPublished, setPublished] = useState(false);
  const [notify, setNotify] = useState(true);
  const [wasPublished, setWasPublished] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [photoPct, setPhotoPct] = useState<number | null>(null);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const dirty = useRef(false);
  const confirm = useConfirm();
  const mark = <T,>(set: (v: T) => void) => (v: T) => { dirty.current = true; set(v); };

  useEffect(() => {
    if (!id) return;
    getDoc(doc(db, 'writtenTestimonies', id))
      .then((s) => {
        if (!s.exists()) return setErr('This written testimony no longer exists.');
        const x = s.data();
        setTitle(x.title ?? ''); setBody(x.body ?? ''); setAuthorName(x.authorName ?? ''); setChurchZone(x.churchZone ?? '');
        setCategory(x.category ?? ''); setTags(sanitizeTags(x.tags)); setPhoto(x.authorPhotoUrl ?? ''); setPublished(x.isPublished === true); setWasPublished(x.isPublished === true);
      })
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const pickPhoto = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return setErr('Choose an image file for the photo.');
    setErr(''); setPhotoPct(0);
    try {
      setPhoto(await uploadToCloudinary(file, 'image', setPhotoPct));
      dirty.current = true;
    } catch (e) {
      setErr(`Photo upload failed: ${(e as Error).message}`);
    }
    setPhotoPct(null);
  };

  const save = async () => {
    setErr(''); setOk('');
    const t = title.trim();
    const b = body.replace(/\r\n/g, '\n').trim();
    if (!t) return setErr('Add a title.');
    if (t.length > MAX_TITLE) return setErr(`The title can be up to ${MAX_TITLE} characters.`);
    if (!b) return setErr('Add the testimony text.');
    if (b.length > MAX_BODY) return setErr(`The testimony can be up to ${MAX_BODY.toLocaleString()} characters (${b.length.toLocaleString()} now).`);
    if (photo && !isHttpUrl(photo)) return setErr('The photo link must start with https://');
    setSaving(true);
    try {
      const data = {
        title: t,
        body: b,
        authorName: authorName.trim().slice(0, 120),
        churchZone: churchZone.trim().slice(0, 160),
        category: category.trim().slice(0, 60),
        tags,
        authorPhotoUrl: photo.trim(),
        isPublished,
        updatedAt: serverTimestamp(),
      };
      let targetId = docId;
      if (docId) {
        await updateDoc(doc(db, 'writtenTestimonies', docId), { ...data, ...(isPublished && !wasPublished ? { publishedAt: serverTimestamp() } : {}) });
      } else {
        const ref = await addDoc(collection(db, 'writtenTestimonies'), {
          ...data,
          createdAt: serverTimestamp(),
          publishedAt: isPublished ? serverTimestamp() : null,
          ...(prefill?.sourceSubmissionId ? { sourceSubmissionId: prefill.sourceSubmissionId } : {}),
        });
        targetId = ref.id;
        setDocId(ref.id);
        if (prefill?.sourceSubmissionId) {
          await updateDoc(doc(db, 'testimonySubmissions', prefill.sourceSubmissionId), { status: 'approved', linkedWrittenId: ref.id }).catch(() => undefined);
        }
      }
      dirty.current = false;
      let msg = isPublished ? 'Saved and published. It now shows in the app and on the website.' : 'Saved as a draft (not visible to users).';
      if (isPublished && notify && targetId) msg += ` ${describe(await notifyWrittenPublished(targetId, t))}`;
      setWasPublished(isPublished);
      setOk(msg);
    } catch (e) {
      setErr((e as Error).message);
    }
    setSaving(false);
  };

  const back = async () => {
    if (!dirty.current || (await confirm({ title: 'Discard your unsaved changes?', message: 'Anything you changed on this page will be lost.', confirmLabel: 'Discard changes', cancelLabel: 'Keep editing', danger: true }))) go({ name: 'written' });
  };
  if (loading) {
    return (
      <>
        <PageHeader eyebrow="Written Testimonies" title="Edit written testimony" />
        <GlassCard><LoadingList rows={4} /></GlassCard>
      </>
    );
  }
  const paragraphs = body.split(/\n\s*\n|\n/).map((p) => p.trim()).filter(Boolean);
  const len = body.trim().length;

  return (
    <>
      <PageHeader
        eyebrow="Written Testimonies"
        title={isNew ? 'New written testimony' : 'Edit written testimony'}
        sub="Readers see it exactly as the preview shows."
        actions={
          <>
            <button type="button" className="btn ghost" onClick={() => void back()}><Icon name="arrowLeft" size={16} />Back</button>
            <button type="button" className="btn primary" disabled={saving || photoPct !== null} onClick={() => void save()}>
              {saving ? <span className="spin sm" aria-hidden="true" /> : <Icon name="check" size={16} />}{saving ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      />
      {prefill?.sourceSubmissionId ? <Message kind="warn">Prefilled from a submission. Check the name and church/zone can be shown publicly before publishing.</Message> : null}
      {err ? <Message kind="err">{err}</Message> : null}
      {ok ? <Message kind="ok">{ok}</Message> : null}

      <div className="editor-layout">
        <GlassCard>
          <SectionHeader icon="fileText" title="Testimony" />
          <Field label="Title *"><input type="text" value={title} maxLength={MAX_TITLE} onChange={(e) => mark(setTitle)(e.target.value)} placeholder="Business breakthrough after leaving my job" /></Field>
          <label className="f">
            <span>Testimony text * <span className={`char-count ${len > MAX_BODY * 0.9 ? 'near' : ''}`}>{len.toLocaleString()} / {MAX_BODY.toLocaleString()}</span></span>
            <textarea className="body-input" value={body} onChange={(e) => mark(setBody)(e.target.value)} />
            <span className="f-hint">Leave a blank line between paragraphs.</span>
          </label>
          <div className="two">
            <Field label="Testifier name (shown publicly)"><input type="text" value={authorName} maxLength={120} onChange={(e) => mark(setAuthorName)(e.target.value)} placeholder="Brother Ajiboye Oluwaseun Henry" /></Field>
            <Field label="Church / zone (shown publicly)"><input type="text" value={churchZone} maxLength={160} onChange={(e) => mark(setChurchZone)(e.target.value)} placeholder="Christ Embassy Lagos Zone 1" /></Field>
          </div>
          <Field label="Category">
            <input type="text" list="written-cats" value={category} maxLength={60} onChange={(e) => mark(setCategory)(e.target.value)} />
            <datalist id="written-cats">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
          </Field>
          <TagPicker
            value={tags}
            onChange={mark(setTags)}
            disabled={saving}
            source={() => ({ contentType: 'written', title, category, excerpt: body.slice(0, 2500) })}
          />
        </GlassCard>

        <aside className="editor-side">
          <GlassCard>
            <SectionHeader icon="send" title="Publishing" as="h3" />
            <Check checked={isPublished} onChange={mark(setPublished)} label="Published" hint="Visible in the app and on the website. Leave off to keep it as a draft." />
            {isPublished && !wasPublished ? <Check checked={notify} onChange={setNotify} label="Notify app users when published" /> : null}
            <div className="sticky-actions">
              <button type="button" className="btn ghost" onClick={() => void back()} disabled={saving}>Cancel</button>
              <button type="button" className="btn primary" disabled={saving || photoPct !== null} onClick={() => void save()}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </GlassCard>

          <GlassCard>
            <SectionHeader icon="user" title="Testifier photo" as="h3" hint="Optional" />
            <div className="stack-sm">
              <input type="url" value={photo} onChange={(e) => mark(setPhoto)(e.target.value)} placeholder="https://… photo link" aria-label="Photo link" />
              {uploadsEnabled ? (
                <label className="btn ghost small file-btn" style={{ justifySelf: 'start' }}>
                  <Icon name="upload" size={14} />Upload photo
                  <input type="file" accept="image/*" disabled={photoPct !== null} onChange={(e) => void pickPhoto(e.target.files?.[0])} />
                </label>
              ) : null}
              {photoPct !== null ? <UploadProgress label="Uploading photo" pct={photoPct} /> : null}
            </div>
          </GlassCard>

          <GlassCard>
            <SectionHeader icon="smartphone" title="Preview" as="h3" />
            <div className="wt-preview">
              <div className="paper">
                <div className="who">
                  <span className="ring">{photo && isHttpUrl(photo) ? <img src={photo} alt="" /> : <span />}</span>
                  <div>
                    <div className="name">{authorName || 'Testifier name'}</div>
                    <div className="zone">{churchZone || 'Church / zone'}</div>
                  </div>
                </div>
                <div className="title">{title || 'Title'}</div>
                {paragraphs.length ? paragraphs.map((p, i) => <p key={i}>{p}</p>) : <p className="placeholder">The testimony text appears here.</p>}
              </div>
            </div>
          </GlassCard>
        </aside>
      </div>
    </>
  );
}
