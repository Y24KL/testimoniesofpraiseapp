import { useEffect, useState } from 'react';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { uploadToCloudinary, uploadsEnabled } from '../uploads';
import { describe, notifyArticlePublished } from '../notify';
import { isHttpUrl } from '../lib';
import type { Article, Route } from '../types';
import { Check, Field, Message } from '../components/Field';

interface Props {
  id?: string;
  go: (r: Route) => void;
}

export function ArticleEditor({ id, go }: Props) {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [category, setCategory] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [body, setBody] = useState('');
  const [isPublished, setIsPublished] = useState(true);
  const [notifyOnPublish, setNotifyOnPublish] = useState(true);

  const [preview, setPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(Boolean(id));
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getDoc(doc(db, 'articles', id))
      .then((snap) => {
        if (!snap.exists()) {
          setErr('Article not found.');
          return;
        }
        const data = snap.data() as Article;
        setTitle(data.title || '');
        setAuthor(data.author || '');
        setCategory(data.category || '');
        setCoverImageUrl(data.coverImageUrl || '');
        setBody(data.body || '');
        setIsPublished(data.isPublished !== false);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadPct(0);
    setErr('');
    try {
      const url = await uploadToCloudinary(file, 'image', setUploadPct);
      setCoverImageUrl(url);
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

    if (!title.trim()) return setErr('Please enter an article title.');
    if (!body.trim()) return setErr('Please write the article content.');
    if (coverImageUrl && !isHttpUrl(coverImageUrl)) return setErr('The cover image link must start with https://');

    setBusy(true);
    try {
      const payload = {
        title: title.trim(),
        author: author.trim() || 'TOP Editorial',
        category: category.trim() || 'General',
        coverImageUrl: coverImageUrl.trim(),
        body: body.trim(),
        isPublished,
        updatedAt: serverTimestamp(),
      };

      let targetId = id;
      let isNew = !id;

      if (id) {
        await updateDoc(doc(db, 'articles', id), {
          ...payload,
          ...(isPublished ? { publishedAt: serverTimestamp() } : {}),
        });
      } else {
        const ref = await addDoc(collection(db, 'articles'), {
          ...payload,
          createdAt: serverTimestamp(),
          publishedAt: isPublished ? serverTimestamp() : null,
        });
        targetId = ref.id;
      }

      let noteMsg = 'Article saved.';
      if (isPublished && notifyOnPublish && targetId) {
        const nr = await notifyArticlePublished(targetId, title.trim());
        noteMsg += ` ${describe(nr)}`;
      }

      setOk(noteMsg);
      setTimeout(() => go({ name: 'articles' }), 1200);
    } catch (ex: any) {
      setErr(ex.message || 'Failed to save article.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="muted">Loading article…</p>;

  return (
    <>
      <div className="row between">
        <div>
          <h1>{id ? 'Edit Article' : 'Write New Article'}</h1>
          <p className="muted">Craft an inspiring update, written testimony, devotional, or announcement.</p>
        </div>
        <button className="btn ghost" onClick={() => go({ name: 'articles' })}>
          ← Back to Articles
        </button>
      </div>

      {err ? <Message kind="err">{err}</Message> : null}
      {ok ? <Message kind="ok">{ok}</Message> : null}

      <form onSubmit={save} className="card" style={{ marginTop: 16 }}>
        <div className="row between" style={{ marginBottom: 16 }}>
          <div className="row gap">
            <button
              type="button"
              className={`btn small ${!preview ? 'primary' : 'ghost'}`}
              onClick={() => setPreview(false)}
            >
              Editor
            </button>
            <button
              type="button"
              className={`btn small ${preview ? 'primary' : 'ghost'}`}
              onClick={() => setPreview(true)}
            >
              Live Preview
            </button>
          </div>
        </div>

        {!preview ? (
          <>
            <Field label="Article Title *">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Unwavering Faith: How God Healed Against All Odds"
                required
              />
            </Field>

            <div className="row gap" style={{ display: 'flex', gap: 12 }}>
              <Field label="Author / Byline" style={{ flex: 1 }}>
                <input
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="e.g. Pastor Karen or TOP Editorial"
                />
              </Field>
              <Field label="Category" style={{ flex: 1 }}>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g. Devotional, Announcement, Praise Report"
                />
              </Field>
            </div>

            <Field label="Cover Image (Optional)">
              <div className="row gap" style={{ alignItems: 'center' }}>
                <input
                  type="url"
                  value={coverImageUrl}
                  onChange={(e) => setCoverImageUrl(e.target.value)}
                  placeholder="https://... (image URL)"
                  style={{ flex: 1 }}
                />
                {uploadsEnabled ? (
                  <label className="btn ghost" style={{ cursor: 'pointer', margin: 0 }}>
                    {uploading ? `Uploading ${uploadPct}%` : 'Upload Cover'}
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
              {coverImageUrl ? (
                <div style={{ marginTop: 8 }}>
                  <img
                    src={coverImageUrl}
                    alt="Cover preview"
                    style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }}
                  />
                </div>
              ) : null}
            </Field>

            <Field label="Article Body * (Supports multi-line paragraphs, bullet points with '-', and headings with '#')">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={14}
                placeholder="Write the full content of the article here..."
                required
                style={{ fontFamily: 'inherit', lineHeight: '1.6', fontSize: 14 }}
              />
            </Field>
          </>
        ) : (
          /* Live Reading Preview */
          <div
            style={{
              padding: 24,
              backgroundColor: 'var(--surface, #1E0A2B)',
              borderRadius: 8,
              border: '1px solid var(--border)',
              marginBottom: 16,
            }}
          >
            {coverImageUrl ? (
              <img
                src={coverImageUrl}
                alt=""
                style={{ width: '100%', maxHeight: 260, objectFit: 'cover', borderRadius: 8, marginBottom: 16 }}
              />
            ) : null}
            {category ? <span className="pill" style={{ marginBottom: 8, display: 'inline-block' }}>{category}</span> : null}
            <h1 style={{ fontSize: 26, margin: '8px 0', color: '#fff' }}>{title || 'Untitled Article'}</h1>
            <p className="small muted" style={{ marginBottom: 20 }}>
              By {author || 'TOP Editorial'} • Preview Mode
            </p>
            <div style={{ lineHeight: '1.7', fontSize: 15, color: '#f3e8ff', whiteSpace: 'pre-wrap' }}>
              {body || 'No content written yet.'}
            </div>
          </div>
        )}

        <div className="row between" style={{ marginTop: 16, alignItems: 'center' }}>
          <div className="row gap" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
            <Check
              label="Publish immediately (visible to all users)"
              checked={isPublished}
              onChange={setIsPublished}
            />
            {isPublished ? (
              <Check
                label="Send push notification to users on publish"
                checked={notifyOnPublish}
                onChange={setNotifyOnPublish}
              />
            ) : null}
          </div>

          <div className="row gap">
            <button type="button" className="btn ghost" onClick={() => go({ name: 'articles' })}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={busy || uploading}>
              {busy ? 'Saving…' : isPublished ? (id ? 'Update & Publish' : 'Publish Article') : 'Save as Draft'}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}
