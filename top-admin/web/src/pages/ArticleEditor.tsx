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
import { Icon } from '../components/Icon';
import { FilterTabs, GlassCard, LoadingList, PageHeader, SectionHeader, StatusBadge, UploadProgress } from '../components/ui';

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
    } catch (ex) {
      setErr((ex as Error).message || 'Failed to save article.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <>
        <PageHeader eyebrow="Articles & Updates" title="Edit article" />
        <GlassCard><LoadingList rows={4} /></GlassCard>
      </>
    );
  }

  const submitLabel = busy ? 'Saving…' : isPublished ? (id ? 'Update and publish' : 'Publish article') : 'Save as draft';

  return (
    <form onSubmit={save}>
      <PageHeader
        eyebrow="Articles & Updates"
        title={id ? 'Edit article' : 'Write new article'}
        sub="An update, devotional or announcement for app and website readers."
        actions={
          <>
            <button type="button" className="btn ghost" onClick={() => go({ name: 'articles' })}><Icon name="arrowLeft" size={16} />Back to articles</button>
            <button type="submit" className="btn primary" disabled={busy || uploading}>
              {busy ? <span className="spin sm" aria-hidden="true" /> : <Icon name={isPublished ? 'send' : 'check'} size={16} />}
              {submitLabel}
            </button>
          </>
        }
      />

      {err ? <Message kind="err">{err}</Message> : null}
      {ok ? <Message kind="ok">{ok}</Message> : null}

      <div className="toolbar">
        <FilterTabs
          label="Editor mode"
          value={preview ? 'preview' : 'edit'}
          onChange={(v) => setPreview(v === 'preview')}
          options={[{ id: 'edit', label: 'Write' }, { id: 'preview', label: 'Reading preview' }]}
        />
      </div>

      <div className="editor-layout">
        <GlassCard>
          {!preview ? (
            <>
              <Field label="Title *">
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Unwavering Faith: How God Healed Against All Odds" required />
              </Field>
              <Field label="Article body *" hint="Separate paragraphs with a blank line. Start a line with “-” for a bullet or “#” for a heading.">
                <textarea className="body-input" value={body} onChange={(e) => setBody(e.target.value)} rows={16} placeholder="Write the full article here…" required />
              </Field>
              <div className="small muted">{body.trim() ? `${body.trim().split(/\s+/).length.toLocaleString()} words · about ${Math.max(1, Math.round(body.trim().split(/\s+/).length / 200))} min read` : 'No words yet'}</div>
            </>
          ) : (
            <article className="reading">
              {coverImageUrl ? <img className="cover-preview" src={coverImageUrl} alt="" /> : null}
              {category ? <StatusBadge kind="info" plain>{category}</StatusBadge> : null}
              <h1>{title || 'Untitled article'}</h1>
              <p className="small muted">By {author || 'TOP Editorial'} · Preview</p>
              <div className="body">{body || 'No content written yet.'}</div>
            </article>
          )}
        </GlassCard>

        <aside className="editor-side">
          <GlassCard>
            <SectionHeader icon="send" title="Publishing" as="h3" />
            <Check label="Publish now" hint="Visible to everyone in the app and on the website." checked={isPublished} onChange={setIsPublished} />
            {isPublished ? <Check label="Notify app users" hint="Sends a push notification when it publishes." checked={notifyOnPublish} onChange={setNotifyOnPublish} /> : null}
            <div className="sticky-actions">
              <button type="button" className="btn ghost" onClick={() => go({ name: 'articles' })}>Cancel</button>
              <button type="submit" className="btn primary" disabled={busy || uploading}>{submitLabel}</button>
            </div>
          </GlassCard>

          <GlassCard>
            <SectionHeader icon="image" title="Cover image" as="h3" />
            {coverImageUrl ? <img className="cover-preview" src={coverImageUrl} alt="Cover preview" /> : <div className="cover-empty">No cover image. Articles without one show as text cards.</div>}
            {uploading ? <UploadProgress label="Uploading cover" pct={uploadPct} /> : null}
            <div className="stack-sm" style={{ marginTop: 12 }}>
              <input type="url" value={coverImageUrl} onChange={(e) => setCoverImageUrl(e.target.value)} placeholder="https://… image link" aria-label="Cover image link" />
              <div className="row">
                {uploadsEnabled ? (
                  <label className="btn ghost small file-btn">
                    <Icon name="upload" size={14} />{uploading ? `Uploading ${uploadPct}%` : 'Upload image'}
                    <input type="file" accept="image/*" onChange={handleFileUpload} disabled={uploading} />
                  </label>
                ) : <span className="small muted">Uploads aren’t configured; paste a link instead.</span>}
                {coverImageUrl ? <button type="button" className="btn ghost small" onClick={() => setCoverImageUrl('')}><Icon name="x" size={14} />Remove</button> : null}
              </div>
            </div>
          </GlassCard>

          <GlassCard>
            <SectionHeader icon="info" title="Details" as="h3" />
            <Field label="Author / byline">
              <input type="text" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="TOP Editorial" />
            </Field>
            <Field label="Category">
              <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Devotional, Announcement" />
            </Field>
          </GlassCard>
        </aside>
      </div>
    </form>
  );
}
