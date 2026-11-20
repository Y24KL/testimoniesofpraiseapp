import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  uploadAudio,
  uploadImageToCloudinary,
  uploadsEnabled,
  identifyProvider,
  getProviderDisplayName,
} from '../uploads';
import { isHttpUrl } from '../lib';
import type { AudioTestimony, RadioSettings } from '../types';
import { Check, Field, Message } from '../components/Field';
import { Icon } from '../components/Icon';
import { useConfirm } from '../components/feedback';
import { EmptyState, FilterTabs, GlassCard, LoadingList, PageHeader, SearchInput, SectionHeader, StatusBadge, UploadProgress } from '../components/ui';

const STALE_MS = 60_000; // Missed heartbeats (>60s) treated as left

type StreamCheck = { state: 'idle' | 'checking' | 'up' | 'down'; detail?: string };

/**
 * Reads the stream URL from the browser to tell the admin whether it is broadcasting right now.
 * HLS: the playlist (and its first variant) must list media segments. Other URLs: any 2xx answer.
 */
async function checkStream(url: string): Promise<StreamCheck> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return { state: 'down', detail: `The stream answered HTTP ${res.status}.` };
    if (!/\.m3u8(\?|$)/i.test(url)) return { state: 'up', detail: 'The stream URL is reachable.' };
    let text = await res.text();
    const variant = text.split(/\r?\n/).find((l) => l.trim() && !l.startsWith('#'));
    if (!/#EXTINF/.test(text) && variant) {
      const res2 = await fetch(new URL(variant.trim(), url).toString(), { cache: 'no-store' });
      text = res2.ok ? await res2.text() : '';
    }
    const segments = (text.match(/#EXTINF/g) || []).length;
    return segments > 0
      ? { state: 'up', detail: `Broadcasting now (${segments} live segments). Listeners can play it while the radio is ON AIR.` }
      : { state: 'down', detail: 'The playlist has no live segments: nothing is being broadcast on this URL right now.' };
  } catch {
    return { state: 'down', detail: 'Could not reach the stream URL from this browser (offline, blocked, or not a public stream).' };
  }
}

export function Radio() {
  const [tab, setTab] = useState<'stream' | 'library'>('stream');

  // --- Live Radio State ---
  const radioRef = doc(db, 'settings', 'radio');
  const [isLive, setIsLive] = useState(false);
  const [streamUrl, setStreamUrl] = useState('');
  const [programme, setProgramme] = useState('');
  const [description, setDescription] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [radioLoaded, setRadioLoaded] = useState(false);
  const [radioBusy, setRadioBusy] = useState(false);
  const [streamCheck, setStreamCheck] = useState<StreamCheck>({ state: 'idle' });
  const [activeListeners, setActiveListeners] = useState<number | null>(null);

  // Audio Preview in Admin
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  // --- Audio Library State ---
  const [audioItems, setAudioItems] = useState<AudioTestimony[] | null>(null);
  const [editingAudioId, setEditingAudioId] = useState<string | null>(null);
  const [audioTitle, setAudioTitle] = useState('');
  const [audioDesc, setAudioDesc] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [speaker, setSpeaker] = useState('');
  const [audioCategory, setAudioCategory] = useState('');
  const [audioThumb, setAudioThumb] = useState('');
  const [audioPublished, setAudioPublished] = useState(true);

  // Uploading state
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [audioUploadPct, setAudioUploadPct] = useState(0);
  const [uploadingThumb, setUploadingThumb] = useState(false);
  const [thumbUploadPct, setThumbUploadPct] = useState(0);

  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [search, setSearch] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const confirm = useConfirm();

  // 1. Listen to Live Radio Settings
  useEffect(() => {
    return onSnapshot(
      radioRef,
      (snap) => {
        const d = (snap.data() as RadioSettings) || {};
        setIsLive(d.isLive === true);
        setSessionId(d.sessionId || '');
        if (!radioLoaded) {
          setStreamUrl(d.streamUrl || '');
          setProgramme(d.currentProgramme || '');
          setDescription(d.description || '');
          setRadioLoaded(true);
        }
      },
      (e) => setErr(e.message)
    );
  }, [radioLoaded]);

  // 2. Count Active Live Listeners
  useEffect(() => {
    if (!sessionId || !isLive) {
      setActiveListeners(null);
      return;
    }
    const col = collection(db, 'radioListeners', sessionId, 'listeners');
    return onSnapshot(col, (snap) => {
      const now = Date.now();
      const alive = snap.docs.filter((d) => {
        const ts = d.data().lastSeen as Timestamp | undefined;
        return ts && now - ts.toMillis() < STALE_MS;
      });
      setActiveListeners(alive.length);
    });
  }, [sessionId, isLive]);

  // 3. Listen to Audio Testimonies collection
  useEffect(() => {
    const q = query(collection(db, 'audioTestimonies'), orderBy('createdAt', 'desc'));
    return onSnapshot(
      q,
      (snap) => {
        setAudioItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AudioTestimony, 'id'>) })));
      },
      (e) => setErr(e.message)
    );
  }, []);

  // Save Live Radio Settings
  const saveRadio = async (turnLive: boolean, note: string) => {
    setErr('');
    setOk('');

    if (streamUrl && !isHttpUrl(streamUrl)) {
      return setErr('The audio stream link must start with https:// (or http:// for local streams).');
    }
    if (turnLive && !streamUrl.trim()) {
      return setErr('Please specify a playable stream URL before switching live.');
    }

    setRadioBusy(true);
    try {
      const goingLive = turnLive && !isLive;
      const newSessionId = goingLive
        ? `radio-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
        : sessionId;

      await setDoc(
        radioRef,
        {
          isLive: turnLive,
          streamUrl: streamUrl.trim(),
          currentProgramme: programme.trim(),
          description: description.trim(),
          sessionId: newSessionId,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      if (goingLive) {
        setSessionId(newSessionId);
      }
      setOk(note);
    } catch (ex) {
      setErr((ex as Error).message || 'Failed to update radio stream.');
    } finally {
      setRadioBusy(false);
    }
  };

  const toggleTestStream = () => {
    if (!audioPreviewRef.current) return;
    if (isPlayingPreview) {
      audioPreviewRef.current.pause();
      setIsPlayingPreview(false);
    } else {
      audioPreviewRef.current.src = streamUrl;
      audioPreviewRef.current
        .play()
        .then(() => setIsPlayingPreview(true))
        .catch((e) => setErr(`Could not preview stream: ${e.message}`));
    }
  };

  // Audio Library form handlers
  const resetAudioForm = () => {
    setEditingAudioId(null);
    setAudioTitle('');
    setAudioDesc('');
    setAudioUrl('');
    setSpeaker('');
    setAudioCategory('');
    setAudioThumb('');
    setAudioPublished(true);
  };

  const startEditAudio = (item: AudioTestimony) => {
    setEditingAudioId(item.id);
    setAudioTitle(item.title);
    setAudioDesc(item.description || '');
    setAudioUrl(item.audioUrl);
    setSpeaker(item.speaker || '');
    setAudioCategory(item.category || '');
    setAudioThumb(item.thumbnailUrl || '');
    setAudioPublished(item.isPublished !== false);
    setTab('library');
    window.setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAudio(true);
    setAudioUploadPct(0);
    setErr('');
    try {
      const res = await uploadAudio(file, setAudioUploadPct);
      setAudioUrl(res.url);
      setOk(`Audio successfully uploaded to ${getProviderDisplayName(res.provider)}!`);
    } catch (ex) {
      setErr((ex as Error).message || 'Audio upload failed.');
    } finally {
      setUploadingAudio(false);
    }
  };

  const handleThumbUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingThumb(true);
    setThumbUploadPct(0);
    setErr('');
    try {
      const res = await uploadImageToCloudinary(file, setThumbUploadPct);
      setAudioThumb(res.url);
      setOk('Thumbnail image uploaded to Cloudinary!');
    } catch (ex) {
      setErr((ex as Error).message || 'Thumbnail upload failed.');
    } finally {
      setUploadingThumb(false);
    }
  };

  const saveAudioTestimony = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setOk('');

    if (!audioTitle.trim()) return setErr('Please enter an audio testimony title.');
    if (!audioUrl.trim()) return setErr('Please upload or provide an audio URL.');

    setRadioBusy(true);
    try {
      const payload = {
        title: audioTitle.trim(),
        description: audioDesc.trim(),
        audioUrl: audioUrl.trim(),
        speaker: speaker.trim(),
        category: audioCategory.trim(),
        thumbnailUrl: audioThumb.trim(),
        isPublished: audioPublished,
        updatedAt: serverTimestamp(),
      };

      if (editingAudioId) {
        await updateDoc(doc(db, 'audioTestimonies', editingAudioId), payload);
        setOk('Audio testimony updated.');
      } else {
        await addDoc(collection(db, 'audioTestimonies'), {
          ...payload,
          createdAt: serverTimestamp(),
          publishedAt: audioPublished ? serverTimestamp() : null,
        });
        setOk('Audio testimony added to library.');
      }
      resetAudioForm();
    } catch (ex) {
      setErr((ex as Error).message || 'Failed to save audio testimony.');
    } finally {
      setRadioBusy(false);
    }
  };

  const removeAudio = async (item: AudioTestimony) => {
    if (!(await confirm({ title: `Delete “${item.title}”?`, message: 'It disappears from the TOP Radio library. The audio file stays in storage.', confirmLabel: 'Delete permanently', danger: true }))) return;
    try {
      await deleteDoc(doc(db, 'audioTestimonies', item.id));
      setOk('Audio testimony deleted.');
      if (editingAudioId === item.id) resetAudioForm();
    } catch (ex) {
      setErr((ex as Error).message);
    }
  };

  const endRadio = async () => {
    if (!(await confirm({ title: 'Take TOP Radio off air?', message: 'Listeners are stopped and TOP Radio is greyed out in the app and on the website.', confirmLabel: 'Go off air', danger: true }))) return;
    void saveRadio(false, 'TOP Radio is now off air.');
  };

  const needle = search.trim().toLowerCase();
  const shownAudio = (audioItems ?? []).filter((i) => !needle || [i.title, i.speaker ?? '', i.category ?? ''].some((v) => v.toLowerCase().includes(needle)));

  if (!radioLoaded && !err) {
    return (
      <>
        <PageHeader eyebrow="Broadcast & Media" title="TOP Radio" />
        <GlassCard><LoadingList rows={3} /></GlassCard>
      </>
    );
  }

  return (
    <>
      <PageHeader eyebrow="Broadcast & Media" title="TOP Radio" sub="Run the live audio stream, watch listener numbers, and manage the recorded audio testimonies library." />

      {err ? <Message kind="err">{err}</Message> : null}
      {ok ? <Message kind="ok">{ok}</Message> : null}

      <div className="toolbar">
        <FilterTabs
          label="Radio sections"
          value={tab}
          onChange={setTab}
          options={[
            { id: 'stream', label: 'Live radio stream' },
            { id: 'library', label: 'Audio testimonies', count: audioItems?.length },
          ]}
        />
      </div>

      {tab === 'stream' ? (
        <>
          <GlassCard className={`broadcast-hero ${isLive ? 'on' : ''}`} aria-label="Radio status">
            <div className="state">
              <div className="row gap">
                <span className={`on-air ${isLive ? 'live' : 'off'}`}><span className="pulse" />{isLive ? 'ON AIR' : 'OFF AIR'}</span>
                {isLive && activeListeners !== null ? <span className="viewer-count"><Icon name="radio" size={14} />{activeListeners.toLocaleString()} listening now</span> : null}
              </div>
              <h2>{programme.trim() || 'TOP Radio'}</h2>
              <span className="small muted" style={{ maxWidth: 620 }}>
                {isLive
                  ? 'App and website users can press Play on TOP Radio, even while the main video broadcast is offline.'
                  : 'TOP Radio is greyed out in the app and on the website. This is separate from the main Live broadcast. For a 24/7 stream, leave the radio on air.'}
              </span>
            </div>
            {isLive ? (
              <button type="button" className="btn danger xl" disabled={radioBusy} onClick={() => void endRadio()}><Icon name="x" size={18} />GO OFF AIR</button>
            ) : (
              <button type="button" className="btn live xl" disabled={radioBusy} onClick={() => void saveRadio(true, 'TOP Radio is now on air.')}><Icon name="radio" size={18} />GO ON AIR</button>
            )}
          </GlassCard>

          <GlassCard>
            <SectionHeader icon="radio" title="Stream settings" />
            <div className="audio-test">
              <button
                type="button"
                className="btn ghost small"
                disabled={!streamUrl.trim() || streamCheck.state === 'checking'}
                onClick={async () => {
                  setStreamCheck({ state: 'checking' });
                  setStreamCheck(await checkStream(streamUrl.trim()));
                }}
              >
                <Icon name="activity" size={14} className={streamCheck.state === 'checking' ? 'spinning' : undefined} />{streamCheck.state === 'checking' ? 'Checking…' : 'Check stream now'}
              </button>
              <button type="button" className="btn ghost small" onClick={toggleTestStream} disabled={!streamUrl.trim()}>
                <Icon name={isPlayingPreview ? 'x' : 'play'} size={14} />{isPlayingPreview ? 'Stop listening' : 'Listen here'}
              </button>
              {streamCheck.state === 'up' || streamCheck.state === 'down' ? <StatusBadge kind={streamCheck.state === 'up' ? 'ok' : 'bad'}>{streamCheck.state === 'up' ? 'Stream is up' : 'Stream is down'}</StatusBadge> : null}
              {streamCheck.detail ? <span className="small muted">{streamCheck.detail}</span> : null}
            </div>
            <audio ref={audioPreviewRef} onEnded={() => setIsPlayingPreview(false)} style={{ display: 'none' }} />

            <Field label="Live audio stream link *" hint="Icecast / Shoutcast MP3 or AAC, or an HLS (.m3u8) audio stream.">
              <input type="text" value={streamUrl} onChange={(e) => setStreamUrl(e.target.value)} placeholder="https://radio.example.com/stream.mp3 or .m3u8" />
            </Field>
            <div className="two">
              <Field label="Current programme title">
                <input type="text" value={programme} onChange={(e) => setProgramme(e.target.value)} placeholder="e.g. Testimonies of Praise Live Radio Session" />
              </Field>
              <Field label="Programme description">
                <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What listeners are hearing now" />
              </Field>
            </div>
            <div className="form-actions">
              <span className="small muted">Session ID: <code>{sessionId || 'none (off air)'}</code></span>
              <button type="button" className="btn primary" disabled={radioBusy} onClick={() => void saveRadio(isLive, 'Radio settings saved.')}><Icon name="check" size={16} />Save stream settings</button>
            </div>
          </GlassCard>
        </>
      ) : (
        <>
          <form ref={formRef} onSubmit={saveAudioTestimony} className={`card ${editingAudioId ? 'editing-ring' : ''}`}>
            <SectionHeader icon={editingAudioId ? 'edit' : 'plus'} title={editingAudioId ? 'Edit audio testimony' : 'Add an audio testimony'} hint={editingAudioId ? `Editing “${audioTitle}”` : 'Published recordings appear in the TOP Radio library in the app.'} />
            <div className="compose" style={{ '--side': '300px' } as CSSProperties}>
              <div>
                <Field label="Title *">
                  <input type="text" value={audioTitle} onChange={(e) => setAudioTitle(e.target.value)} placeholder="e.g. Miraculous healing from heart disease" required />
                </Field>
                <Field label="Audio recording *" hint="MP3, AAC or M4A. Large files go to Bunny Storage through the Worker.">
                  <div className="input-row">
                    <input type="url" value={audioUrl} onChange={(e) => setAudioUrl(e.target.value)} placeholder="https://… (mp3, aac, m4a)" required />
                    {uploadsEnabled ? (
                      <label className={`btn ghost small file-btn ${uploadingAudio ? 'disabled' : ''}`}>
                        <Icon name="upload" size={14} />Upload
                        <input type="file" accept="audio/*" onChange={handleAudioUpload} disabled={uploadingAudio} />
                      </label>
                    ) : null}
                  </div>
                </Field>
                {uploadingAudio ? <UploadProgress label="Uploading audio" pct={audioUploadPct} /> : null}
                {audioUrl ? <div className="provider-note"><Icon name="cloud" size={14} />Storage provider: <b>{getProviderDisplayName(identifyProvider(audioUrl))}</b></div> : null}
                <div className="two">
                  <Field label="Speaker / testifier"><input type="text" value={speaker} onChange={(e) => setSpeaker(e.target.value)} placeholder="e.g. Brother Emmanuel" /></Field>
                  <Field label="Category"><input type="text" value={audioCategory} onChange={(e) => setAudioCategory(e.target.value)} placeholder="e.g. Healing, Family" /></Field>
                </div>
                <Field label="Cover image (optional)">
                  <div className="input-row">
                    <input type="url" value={audioThumb} onChange={(e) => setAudioThumb(e.target.value)} placeholder="https://… image link" />
                    {uploadsEnabled ? (
                      <label className={`btn ghost small file-btn ${uploadingThumb ? 'disabled' : ''}`}>
                        <Icon name="upload" size={14} />Upload
                        <input type="file" accept="image/*" onChange={handleThumbUpload} disabled={uploadingThumb} />
                      </label>
                    ) : null}
                  </div>
                </Field>
                {uploadingThumb ? <UploadProgress label="Uploading cover" pct={thumbUploadPct} /> : null}
                <Field label="Short description">
                  <textarea value={audioDesc} onChange={(e) => setAudioDesc(e.target.value)} placeholder="A brief summary of the testimony" rows={2} />
                </Field>
              </div>
              <div className="stack-sm">
                <span className="small muted">Preview</span>
                {audioThumb && isHttpUrl(audioThumb) ? <img className="cover-preview" src={audioThumb} alt="Cover preview" style={{ aspectRatio: '1 / 1' }} /> : <div className="cover-empty" style={{ aspectRatio: '1 / 1' }}><Icon name="mic" size={28} /></div>}
                {audioUrl && isHttpUrl(audioUrl) ? <audio controls src={audioUrl} style={{ width: '100%' }} preload="none" /> : null}
              </div>
            </div>
            <div className="form-actions">
              <Check label="Published" hint="Visible in the TOP Radio library." checked={audioPublished} onChange={setAudioPublished} />
              <div className="row">
                {editingAudioId ? <button type="button" className="btn ghost" onClick={resetAudioForm}>Cancel</button> : null}
                <button type="submit" className="btn primary" disabled={radioBusy || uploadingAudio || uploadingThumb}>
                  {radioBusy ? <span className="spin sm" aria-hidden="true" /> : <Icon name="check" size={16} />}{radioBusy ? 'Saving…' : editingAudioId ? 'Update audio' : 'Add to library'}
                </button>
              </div>
            </div>
          </form>

          <GlassCard className="table-card">
            <div style={{ padding: '20px 24px 0' }}>
              <SectionHeader icon="mic" title="Audio testimonies library" hint={audioItems ? `${audioItems.length} recordings · ${audioItems.filter((i) => i.isPublished).length} published` : undefined} actions={<SearchInput value={search} onChange={setSearch} placeholder="Search recordings…" label="Search recordings" />} />
            </div>
            {audioItems === null ? (
              <div style={{ padding: 20 }}><LoadingList rows={3} /></div>
            ) : shownAudio.length === 0 ? (
              <EmptyState icon="mic" title={audioItems.length === 0 ? 'No audio testimonies yet' : 'No recordings match'}>{audioItems.length === 0 ? 'Add one with the form above.' : 'Try another search.'}</EmptyState>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Title</th><th>Category</th><th>Listen</th><th>Status</th><th aria-label="Actions"></th></tr></thead>
                  <tbody>
                    {shownAudio.map((item) => (
                      <tr key={item.id}>
                        <td className="title-cell"><b>{item.title}</b><div className="small muted">{item.speaker || 'Anonymous'}</div></td>
                        <td><span className="tag">{item.category || 'General'}</span></td>
                        <td>
                          <audio className="audio-inline" controls preload="none" src={item.audioUrl} />
                          <div className="tiny muted">{getProviderDisplayName(identifyProvider(item.audioUrl))}</div>
                        </td>
                        <td><StatusBadge kind={item.isPublished ? 'ok' : 'draft'}>{item.isPublished ? 'Published' : 'Draft'}</StatusBadge></td>
                        <td>
                          <div className="row-actions">
                            <button type="button" className="btn small ghost" onClick={() => startEditAudio(item)}><Icon name="edit" size={14} />Edit</button>
                            <button type="button" className="btn small danger" aria-label={`Delete ${item.title}`} onClick={() => void removeAudio(item)}><Icon name="trash" size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        </>
      )}
    </>
  );
}
