import { useEffect, useState } from 'react';
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
import type { Promotion } from '../types';
import { Check, Field, Message } from '../components/Field';

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

  // Upload & UI state
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

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
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    } catch (ex: any) {
      setErr(ex.message || 'Image upload failed.');
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

      if (editingId) {
        await updateDoc(doc(db, 'promotions', editingId), payload);
        setOk('Promotion updated successfully.');
      } else {
        await addDoc(collection(db, 'promotions'), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        setOk('Promotion published successfully.');
      }
      resetForm();
    } catch (ex: any) {
      setErr(ex.message || 'Failed to save promotion.');
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
    } catch (ex: any) {
      setErr(ex.message);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Are you sure you want to delete this promotion?')) return;
    try {
      await deleteDoc(doc(db, 'promotions', id));
      setOk('Promotion deleted.');
    } catch (ex: any) {
      setErr(ex.message);
    }
  };

  return (
    <>
      <div className="row between">
        <h1>Promotions Management</h1>
        {editingId ? (
          <button className="btn ghost" onClick={resetForm}>+ New Promotion</button>
        ) : null}
      </div>
      <p className="muted">
        Manage featured campaigns, media announcements, and partner links displayed in the mobile & web app.
      </p>

      {err ? <Message kind="err">{err}</Message> : null}
      {ok ? <Message kind="ok">{ok}</Message> : null}

      {/* Editor Card */}
      <form onSubmit={save} className="card" style={{ marginBottom: 24 }}>
        <h3>{editingId ? 'Edit Promotion' : 'Create New Promotion'}</h3>

        <Field label="Title *">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Special Easter Live Concert"
            required
          />
        </Field>

        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short promotional copy to display on the card"
            rows={2}
          />
        </Field>

        <Field label="Banner / Thumbnail Image *">
          <div className="row gap" style={{ alignItems: 'center' }}>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://... (image URL)"
              style={{ flex: 1 }}
              required
            />
            {uploadsEnabled ? (
              <label className="btn ghost" style={{ cursor: 'pointer', margin: 0 }}>
                {uploading ? `Uploading ${uploadPct}%` : 'Upload Image'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                  disabled={uploading}
                />
              </label>
            ) : null}
          </div>
          {imageUrl ? (
            <div style={{ marginTop: 8 }}>
              <img
                src={imageUrl}
                alt="Banner preview"
                style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }}
              />
            </div>
          ) : null}
        </Field>

        <div className="row gap" style={{ display: 'flex', gap: 12 }}>
          <Field label="Destination URL *" style={{ flex: 2 }}>
            <input
              type="text"
              value={destinationUrl}
              onChange={(e) => setDestinationUrl(e.target.value)}
              placeholder="https://example.com or internal route"
              required
            />
          </Field>
          <Field label="Category" style={{ flex: 1 }}>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Events, Partnership"
            />
          </Field>
          <Field label="Display Order" style={{ width: 100 }}>
            <input
              type="number"
              value={order}
              onChange={(e) => setOrder(Number(e.target.value))}
            />
          </Field>
        </div>

        <div className="row between" style={{ marginTop: 12, alignItems: 'center' }}>
          <Check
            label="Published (Visible to all users)"
            checked={isPublished}
            onChange={setIsPublished}
          />

          <div className="row gap">
            {editingId ? (
              <button type="button" className="btn ghost" onClick={resetForm}>Cancel</button>
            ) : null}
            <button type="submit" className="btn primary" disabled={busy || uploading}>
              {busy ? 'Saving…' : editingId ? 'Update Promotion' : 'Publish Promotion'}
            </button>
          </div>
        </div>
      </form>

      {/* List Table */}
      <h3>Published & Draft Promotions</h3>
      {promotions === null ? (
        <p className="muted">Loading promotions…</p>
      ) : promotions.length === 0 ? (
        <p className="muted">No promotions created yet.</p>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                <th style={{ padding: '12px 16px' }}>Banner</th>
                <th style={{ padding: '12px 16px' }}>Title & Description</th>
                <th style={{ padding: '12px 16px' }}>Destination</th>
                <th style={{ padding: '12px 16px' }}>Order</th>
                <th style={{ padding: '12px 16px' }}>Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {promotions.map((p) => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 16px', width: 90 }}>
                    {p.imageUrl ? (
                      <img
                        src={p.imageUrl}
                        alt=""
                        style={{ width: 80, height: 48, objectFit: 'cover', borderRadius: 4 }}
                      />
                    ) : (
                      <span className="muted">No img</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <b>{p.title}</b>
                    {p.category ? <span className="pill" style={{ marginLeft: 8, fontSize: 11 }}>{p.category}</span> : null}
                    <div className="small muted" style={{ maxWidth: 300, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.description}
                    </div>
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: 13, maxWidth: 200, wordBreak: 'break-all' }}>
                    <a href={p.destinationUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
                      {p.destinationUrl}
                    </a>
                  </td>
                  <td style={{ padding: '10px 16px', fontWeight: 'bold' }}>{p.order ?? 0}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <button
                      className={`pill ${p.isPublished ? 'ok' : 'ghost'}`}
                      style={{ cursor: 'pointer', border: 'none' }}
                      onClick={() => togglePublish(p)}
                    >
                      {p.isPublished ? 'Live' : 'Draft'}
                    </button>
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="btn small ghost" onClick={() => startEdit(p)}>Edit</button>
                    <button className="btn small danger" style={{ marginLeft: 6 }} onClick={() => remove(p.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
