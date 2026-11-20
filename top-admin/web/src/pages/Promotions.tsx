import { useEffect, useRef, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { uploadToCloudinary, uploadsEnabled } from '../uploads';
import { isHttpUrl } from '../lib';
import { pushEnabled, sendPush } from '../push';
import type { Promotion } from '../types';
import { Check, Field, Message } from '../components/Field';
import { Icon } from '../components/Icon';
import { useConfirm } from '../components/feedback';
import { EmptyState, GlassCard, LoadingList, PageHeader, SearchInput, SectionHeader, StatusBadge, UploadProgress } from '../components/ui';

export function Promotions() {
  const [promotions, setPromotions] = useState<Promotion[] | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [category, setCategory] = useState('');
  const [destinationUrl, setDestinationUrl] = useState('');
  const [target, setTarget] = useState<'internal' | 'external'>('external');
  const [order, setOrder] = useState(0);
  const [isPublished, setIsPublished] = useState(true);
  const [sendPushOn, setSendPushOn] = useState(true);

  // Upload & UI state
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [search, setSearch] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const confirm = useConfirm();

  useEffect(() => {
    const q = query(collection(db, 'promotions'), orderBy('order', 'asc'));
    return onSnapshot(
      q,
      (snap) => {
        setPromotions(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Promotion, 'id'>) })));
      },
      (e) => setErr(e.message)
    );
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setDescription('');
    setImageUrl('');
    setCategory('');
    setDestinationUrl('');
    setTarget('external');
    setOrder(promotions ? promotions.length : 0);
    setIsPublished(true);
    setErr('');
    setOk('');
  };

  const startEdit = (p: Promotion) => {
    setEditingId(p.id);
    setTitle(p.title);
    setDescription(p.description || '');
    setImageUrl(p.imageUrl);
    setCategory(p.category || '');
    setDestinationUrl(p.destinationUrl);
    setTarget(p.target || 'external');
    setOrder(p.order ?? 0);
    setIsPublished(p.isPublished !== false);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadPct(0);
    setErr('');
    try {
      const url = await uploadToCloudinary(file, 'image', setUploadPct);
      setImageUrl(url);
    } catch (ex) {
      setErr((ex as Error).message || 'Image upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setOk('');

    if (!title.trim()) return setErr('Please enter a promotion title.');
    if (!imageUrl.trim() || !isHttpUrl(imageUrl)) return setErr('Please provide a valid image URL (or upload a banner).');
    if (!destinationUrl.trim()) return setErr('Please enter a destination URL.');

    setBusy(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        imageUrl: imageUrl.trim(),
        category: category.trim(),
        destinationUrl: destinationUrl.trim(),
        target,
        order: Number(order) || 0,
        isPublished,
        updatedAt: serverTimestamp(),
      };

      const willPush = !editingId && isPublished && sendPushOn && pushEnabled;
      if (willPush && !(await confirm({ title: 'Publish and send a push notification?', message: 'App users who chose Promotions are notified straight away.', confirmLabel: 'Publish and notify' }))) return;

      if (editingId) {
        await updateDoc(doc(db, 'promotions', editingId), payload);
        setOk('Promotion updated successfully.');
      } else {
        const created = await addDoc(collection(db, 'promotions'), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        setOk('Promotion published successfully.');
        if (willPush) {
          const r = await sendPush({ pref: 'promotions', title: title.trim(), body: (description.trim() || title.trim()).slice(0, 300), data: { type: 'promotion', contentId: created.id } });
          setOk(r.ok ? `Promotion published. Push sent to ${r.sent} device${r.sent === 1 ? '' : 's'}.` : `Promotion published, but the push failed: ${r.error}`);
        }
      }
      resetForm();
    } catch (ex) {
      setErr((ex as Error).message || 'Failed to save promotion.');
    } finally {
      setBusy(false);
    }
  };

  const togglePublish = async (p: Promotion) => {
    try {
      await updateDoc(doc(db, 'promotions', p.id), {
        isPublished: !p.isPublished,
        updatedAt: serverTimestamp(),
      });
    } catch (ex) {
      setErr((ex as Error).message);
    }
  };

  const remove = async (p: Promotion) => {
    if (!(await confirm({ title: `Delete “${p.title}”?`, message: 'It disappears from the app straight away. This can’t be undone.', confirmLabel: 'Delete permanently', danger: true }))) return;
    try {
      await deleteDoc(doc(db, 'promotions', p.id));
      setOk('Promotion deleted.');
      if (editingId === p.id) resetForm();
    } catch (ex) {
      setErr((ex as Error).message);
    }
  };

  const needle = search.trim().toLowerCase();
  const shown = (promotions ?? []).filter((p) => !needle || [p.title, p.description ?? '', p.category ?? '', p.destinationUrl].some((v) => v.toLowerCase().includes(needle)));

  return (
    <>
      <PageHeader
        eyebrow="Content Studio"
        title="Promotions"
        sub="Featured campaigns, media announcements and partner links shown in the app and on the website."
        actions={editingId ? <button type="button" className="btn ghost" onClick={resetForm}><Icon name="plus" size={16} />New promotion</button> : undefined}
      />

      {err ? <Message kind="err">{err}</Message> : null}
      {ok ? <Message kind="ok">{ok}</Message> : null}

      <form ref={formRef} onSubmit={save} className={`card ${editingId ? 'editing-ring' : ''}`}>
        <SectionHeader icon={editingId ? 'edit' : 'plus'} title={editingId ? 'Edit promotion' : 'Create a promotion'} hint={editingId ? `Editing “${title}”` : 'Published promotions appear in the app’s promotions carousel, in display order.'} />
        <div className="compose">
          <div>
            <Field label="Title *">
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Special Easter Live Concert" required />
            </Field>
            <Field label="Description">
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short copy shown on the card" rows={2} />
            </Field>
            <Field label="Banner image *" hint={uploadsEnabled ? 'Paste a link or upload an image.' : undefined}>
              <div className="input-row">
                <input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://… image link" required />
                {uploadsEnabled ? (
                  <label className="btn ghost small file-btn">
                    <Icon name="upload" size={14} />{uploading ? `${uploadPct}%` : 'Upload'}
                    <input type="file" accept="image/*" onChange={handleFileUpload} disabled={uploading} />
                  </label>
                ) : null}
              </div>
            </Field>
            {uploading ? <UploadProgress label="Uploading banner" pct={uploadPct} /> : null}
            <div className="form-grid">
              <Field label="Destination link *" style={{ gridColumn: 'span 2' }}>
                <input type="text" value={destinationUrl} onChange={(e) => setDestinationUrl(e.target.value)} placeholder="https://example.com or an in-app route" required />
              </Field>
              <Field label="Opens">
                <select value={target} onChange={(e) => setTarget(e.target.value as 'internal' | 'external')}>
                  <option value="external">In the browser</option>
                  <option value="internal">Inside the app</option>
                </select>
              </Field>
              <Field label="Category">
                <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Events" />
              </Field>
              <Field label="Display order">
                <input type="number" value={order} onChange={(e) => setOrder(Number(e.target.value))} />
              </Field>
            </div>
          </div>
          <div>
            <div className="small muted" style={{ marginBottom: 8 }}>Card preview</div>
            <div className="card media-card" style={{ margin: 0 }}>
              <div className="cover">
                {imageUrl && isHttpUrl(imageUrl) ? <img src={imageUrl} alt="Banner preview" /> : <span className="none"><Icon name="image" size={28} /></span>}
              </div>
              <div className="body">
                {category ? <span className="small gold">{category}</span> : null}
                <span className="t">{title || 'Promotion title'}</span>
                <span className="d">{description || 'Short description'}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="form-actions">
          <div className="checks">
            <Check label="Published" checked={isPublished} onChange={setIsPublished} />
            {!editingId ? <Check label="Send a push notification" checked={sendPushOn} onChange={setSendPushOn} disabled={!pushEnabled || !isPublished} hint={!pushEnabled ? 'Push isn’t configured.' : undefined} /> : null}
          </div>
          <div className="row">
            {editingId ? <button type="button" className="btn ghost" onClick={resetForm}>Cancel</button> : null}
            <button type="submit" className="btn primary" disabled={busy || uploading}>
              {busy ? <span className="spin sm" aria-hidden="true" /> : <Icon name={editingId ? 'check' : 'send'} size={16} />}
              {busy ? 'Saving…' : editingId ? 'Update promotion' : isPublished ? 'Publish promotion' : 'Save draft'}
            </button>
          </div>
        </div>
      </form>

      <SectionHeader icon="megaphone" title="All promotions" hint={promotions ? `${promotions.length} total · ${promotions.filter((p) => p.isPublished).length} published` : undefined} actions={<SearchInput value={search} onChange={setSearch} placeholder="Search promotions…" label="Search promotions" />} />
      {promotions === null ? (
        <GlassCard><LoadingList rows={3} /></GlassCard>
      ) : shown.length === 0 ? (
        <GlassCard><EmptyState icon="megaphone" title={promotions.length === 0 ? 'No promotions yet' : 'No promotions match'}>{promotions.length === 0 ? 'Create one with the form above.' : 'Try another search.'}</EmptyState></GlassCard>
      ) : (
        <div className="media-grid">
          {shown.map((p) => (
            <article key={p.id} className={`card media-card ${p.isPublished ? '' : 'dim'}`}>
              <div className="cover">
                {p.imageUrl ? <img src={p.imageUrl} alt="" loading="lazy" /> : <span className="none"><Icon name="image" size={28} /></span>}
                <div className="badges"><StatusBadge kind={p.isPublished ? 'ok' : 'draft'}>{p.isPublished ? 'Published' : 'Draft'}</StatusBadge></div>
                <span className="order" title="Display order">#{p.order ?? 0}</span>
              </div>
              <div className="body">
                {p.category ? <span className="small gold">{p.category}</span> : null}
                <span className="t">{p.title}</span>
                {p.description ? <span className="d clamp-3">{p.description}</span> : null}
                <a className="link-out" href={p.destinationUrl} target="_blank" rel="noreferrer"><Icon name="link" size={12} /> {p.destinationUrl}</a>
              </div>
              <div className="actions">
                <button type="button" className="btn small ghost" onClick={() => startEdit(p)}><Icon name="edit" size={14} />Edit</button>
                <button type="button" className={`btn small ${p.isPublished ? 'ghost' : 'success'}`} onClick={() => void togglePublish(p)}>{p.isPublished ? 'Unpublish' : 'Publish'}</button>
                <button type="button" className="btn small danger" aria-label={`Delete ${p.title}`} onClick={() => void remove(p)}><Icon name="trash" size={14} /></button>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
