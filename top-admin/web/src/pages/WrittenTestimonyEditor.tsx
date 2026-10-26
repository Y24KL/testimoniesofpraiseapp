import { useEffect, useRef, useState } from 'react';
import { addDoc, collection, doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { isHttpUrl } from '../lib';
import { describe, notifyWrittenPublished } from '../notify';
import { uploadToCloudinary, uploadsEnabled } from '../uploads';
import type { Route } from '../types';
import { Check, Field, Message } from '../components/Field';

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
  const mark = <T,>(set: (v: T) => void) => (v: T) => { dirty.current = true; set(v); };

  useEffect(() => {
    if (!id) return;
    getDoc(doc(db, 'writtenTestimonies', id))
      .then((s) => {
        if (!s.exists()) return setErr('This written testimony no longer exists.');
        const x = s.data();
        setTitle(x.title ?? ''); setBody(x.body ?? ''); setAuthorName(x.authorName ?? ''); setChurchZone(x.churchZone ?? '');
        setCategory(x.category ?? ''); setPhoto(x.authorPhotoUrl ?? ''); setPublished(x.isPublished === true); setWasPublished(x.isPublished === true);
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

  const back = () => { if (!dirty.current || confirm('Discard your unsaved changes?')) go({ name: 'written' }); };
  if (loading) return <p className="muted">Loading…</p>;
  const paragraphs = body.split(/\n\s*\n|\n/).map((p) => p.trim()).filter(Boolean);

  return (
    <>
      <div className="row between"><h1>{isNew ? 'New written testimony' : 'Edit written testimony'}</h1><button className="btn ghost" onClick={back}>← Back</button></div>
      {prefill?.sourceSubmissionId ? <Message kind="warn">Prefilled from a submission. Check the name and church/zone may be shown publicly before publishing.</Message> : null}
      {err ? <Message kind="err">{err}</Message> : null}
      {ok ? <Message kind="ok">{ok}</Message> : null}

      <div className="card">
        <h2>Testimony</h2>
        <Field label="Title *"><input type="text" value={title} maxLength={MAX_TITLE} onChange={(e) => mark(setTitle)(e.target.value)} placeholder="Business breakthrough after leaving my job" /></Field>
        <Field label="Testimony text *" hint={`${body.trim().length.toLocaleString()} / ${MAX_BODY.toLocaleString()} characters. Leave a blank line between paragraphs.`}>
          <textarea value={body} onChange={(e) => mark(setBody)(e.target.value)} style={{ minHeight: 260 }} />
        </Field>
        <div className="two">
          <Field label="Testifier name (shown publicly)"><input type="text" value={authorName} maxLength={120} onChange={(e) => mark(setAuthorName)(e.target.value)} placeholder="Brother Ajiboye Oluwaseun Henry" /></Field>
          <Field label="Church / zone (shown publicly)"><input type="text" value={churchZone} maxLength={160} onChange={(e) => mark(setChurchZone)(e.target.value)} placeholder="Christ Embassy Lagos Zone 1" /></Field>
        </div>
        <div className="two">
          <Field label="Category">
            <input type="text" list="written-cats" value={category} maxLength={60} onChange={(e) => mark(setCategory)(e.target.value)} />
            <datalist id="written-cats">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
          </Field>
          <Field label="Photo link (optional)" hint={uploadsEnabled ? 'Or upload a photo below.' : undefined}><input type="url" value={photo} onChange={(e) => mark(setPhoto)(e.target.value)} placeholder="https://" /></Field>
        </div>
        {uploadsEnabled ? (
          <Field label="Upload photo">
            <input type="file" accept="image/*" disabled={photoPct !== null} onChange={(e) => void pickPhoto(e.target.files?.[0])} />
          </Field>
        ) : null}
        {photoPct !== null ? <div className="bar" aria-label="Photo upload progress"><i style={{ width: `${photoPct}%` }} /></div> : null}
      </div>

      <div className="card">
        <h2>Publishing</h2>
        <Check checked={isPublished} onChange={mark(setPublished)} label="Published (visible in the app and on the website)" hint="Leave off to keep it as a draft." />
        {isPublished && !wasPublished ? <Check checked={notify} onChange={setNotify} label="Send a notification when published" /> : null}
        <button className="btn" disabled={saving || photoPct !== null} onClick={() => void save()}>{saving ? 'Saving…' : 'SAVE'}</button>
      </div>

      <div className="card">
        <h2>Preview</h2>
        <div style={{ background: 'linear-gradient(135deg,#7A1FA2,#4B006E)', borderRadius: 22, padding: 12 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 18, color: '#14063A' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <span style={{ width: 60, height: 60, borderRadius: '50%', background: '#F5C542', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                {photo && isHttpUrl(photo) ? <img src={photo} alt="" style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover' }} /> : <span style={{ width: 52, height: 52, borderRadius: '50%', background: '#4B006E' }} />}
              </span>
              <div>
                <div style={{ fontWeight: 900, color: '#4B006E' }}>{authorName || 'Testifier name'}</div>
                <div style={{ fontWeight: 700, color: '#2B1B9A', fontSize: 13 }}>{churchZone || 'Church / zone'}</div>
              </div>
            </div>
            <div style={{ fontWeight: 800, color: '#4B006E', fontSize: 18, marginBottom: 8 }}>{title || 'Title'}</div>
            {paragraphs.length ? paragraphs.map((p, i) => <p key={i} style={{ margin: '0 0 10px', fontWeight: 600, lineHeight: 1.55 }}>{p}</p>) : <p className="muted">The testimony text appears here.</p>}
          </div>
        </div>
      </div>
    </>
  );
}
