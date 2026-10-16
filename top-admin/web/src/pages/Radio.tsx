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

const STALE_MS = 60_000; // Missed heartbeats (>60s) treated as left

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
    } catch (ex: any) {
      setErr(ex.message || 'Failed to update radio stream.');
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
    window.scrollTo({ top: 300, behavior: 'smooth' });
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
    } catch (ex: any) {
      setErr(ex.message || 'Audio upload failed.');
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
    } catch (ex: any) {
      setErr(ex.message || 'Thumbnail upload failed.');
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
    } catch (ex: any) {
      setErr(ex.message || 'Failed to save audio testimony.');
    } finally {
      setRadioBusy(false);
    }
  };

  const removeAudio = async (id: string) => {
    if (!confirm('Are you sure you want to delete this audio testimony?')) return;
    try {
      await deleteDoc(doc(db, 'audioTestimonies', id));
      setOk('Audio testimony deleted.');
    } catch (ex: any) {
      setErr(ex.message);
    }
  };

  return (
    <>
      <div className="row between">
        <div>
          <h1>TOP Radio & Audio</h1>
          <p className="muted">
            Configure live audio radio broadcasts, monitor live listeners, and manage recorded audio testimonies.
          </p>
        </div>
      </div>

      {err ? <Message kind="err">{err}</Message> : null}
      {ok ? <Message kind="ok">{ok}</Message> : null}

      {/* Tabs */}
      <div className="row gap" style={{ marginBottom: 20 }}>
        <button
          className={`btn ${tab === 'stream' ? 'primary' : 'ghost'}`}
          onClick={() => setTab('stream')}
        >
          📻 Live Radio Stream
        </button>
        <button
          className={`btn ${tab === 'library' ? 'primary' : 'ghost'}`}
          onClick={() => setTab('library')}
        >
          🎧 Audio Testimonies Library ({audioItems?.length ?? 0})
        </button>
      </div>

      {tab === 'stream' ? (
        /* LIVE RADIO STREAM CONTROLS */
        <div className="card">
          <div className="row between" style={{ alignItems: 'center', marginBottom: 16 }}>
            <div className="row gap" style={{ alignItems: 'center' }}>
              <span className={`dot ${isLive ? 'on' : ''}`} />
              <b>{isLive ? 'RADIO IS LIVE' : 'Radio is Offline'}</b>
              {isLive && activeListeners !== null ? (
                <span className="pill ok">🎧 {activeListeners} listening now</span>
              ) : null}
            </div>
            {isLive ? (
              <button
                className="btn danger"
                disabled={radioBusy}
                onClick={() => saveRadio(false, 'TOP Radio is now marked offline.')}
              >
                End Live Broadcast
              </button>
            ) : (
              <button
                className="btn primary"
                disabled={radioBusy}
                onClick={() => saveRadio(true, 'TOP Radio is now broadcasting LIVE!')}
              >
                Go Live on Radio
              </button>
            )}
          </div>

          <Field label="Live Audio Stream URL * (Icecast / Shoutcast MP3/AAC or HLS .m3u8 audio)">
            <div className="row gap">
              <input
                type="text"
                value={streamUrl}
                onChange={(e) => setStreamUrl(e.target.value)}
                placeholder="https://radio.example.com/stream.mp3 or .m3u8"
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="btn ghost"
                onClick={toggleTestStream}
                disabled={!streamUrl.trim()}
              >
                {isPlayingPreview ? '⏹ Stop Test' : '▶ Test Stream'}
              </button>
            </div>
          </Field>
          <audio ref={audioPreviewRef} onEnded={() => setIsPlayingPreview(false)} style={{ display: 'none' }} />

          <Field label="Current Programme Title">
            <input
              type="text"
              value={programme}
              onChange={(e) => setProgramme(e.target.value)}
              placeholder="e.g. Testimonies of Praise Live Radio Session"
            />
          </Field>

          <Field label="Programme Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What listeners are currently hearing..."
              rows={2}
            />
          </Field>

          <div className="row between" style={{ marginTop: 16 }}>
            <span className="small muted">
              Session ID: <code>{sessionId || 'None (Offline)'}</code>
            </span>
            <button
              className="btn ghost"
              disabled={radioBusy}
              onClick={() => saveRadio(isLive, 'Radio settings updated.')}
            >
              Save Stream Settings
            </button>
          </div>
        </div>
      ) : (
        /* AUDIO TESTIMONIES LIBRARY */
        <>
          <form onSubmit={saveAudioTestimony} className="card" style={{ marginBottom: 24 }}>
            <h3>{editingAudioId ? 'Edit Audio Testimony' : 'Add Audio Testimony to Library'}</h3>

            <Field label="Title *">
              <input
                type="text"
                value={audioTitle}
                onChange={(e) => setAudioTitle(e.target.value)}
                placeholder="e.g. Miraculous Healing from Heart Disease"
                required
              />
            </Field>

            <Field label="Audio Recording URL / Upload *">
              <div className="row gap" style={{ alignItems: 'center' }}>
                <input
                  type="url"
                  value={audioUrl}
                  onChange={(e) => setAudioUrl(e.target.value)}
                  placeholder="https://... (mp3, aac, m4a)"
                  style={{ flex: 1 }}
                  required
                />
                {uploadsEnabled ? (
                  <label className="btn ghost" style={{ cursor: 'pointer', margin: 0 }}>
                    {uploadingAudio ? `Uploading ${audioUploadPct}%` : 'Upload Audio File'}
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={handleAudioUpload}
                      style={{ display: 'none' }}
                      disabled={uploadingAudio}
                    />
                  </label>
                ) : null}
              </div>
              {audioUrl ? (
                <div style={{ marginTop: 6, fontSize: 12, color: '#aaa' }}>
                  Storage Provider: <span style={{ color: '#F5C542', fontWeight: 600 }}>{getProviderDisplayName(identifyProvider(audioUrl))}</span>
                </div>
              ) : null}
            </Field>

            <div className="row gap" style={{ display: 'flex', gap: 12 }}>
              <Field label="Speaker / Testifier" style={{ flex: 1 }}>
                <input
                  type="text"
                  value={speaker}
                  onChange={(e) => setSpeaker(e.target.value)}
                  placeholder="e.g. Brother Emmanuel"
                />
              </Field>
              <Field label="Category" style={{ flex: 1 }}>
                <input
                  type="text"
                  value={audioCategory}
                  onChange={(e) => setAudioCategory(e.target.value)}
                  placeholder="e.g. Healing, Financial, Family"
                />
              </Field>
            </div>

            <Field label="Cover Thumbnail (Optional)">
              <div className="row gap" style={{ alignItems: 'center' }}>
                <input
                  type="url"
                  value={audioThumb}
                  onChange={(e) => setAudioThumb(e.target.value)}
                  placeholder="https://... (thumbnail image URL)"
                  style={{ flex: 1 }}
                />
                {uploadsEnabled ? (
                  <label className="btn ghost" style={{ cursor: 'pointer', margin: 0 }}>
                    {uploadingThumb ? `Uploading ${thumbUploadPct}%` : 'Upload Image'}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleThumbUpload}
                      style={{ display: 'none' }}
                      disabled={uploadingThumb}
                    />
                  </label>
                ) : null}
              </div>
            </Field>

            <Field label="Short Description">
              <textarea
                value={audioDesc}
                onChange={(e) => setAudioDesc(e.target.value)}
                placeholder="Brief summary of the testimony..."
                rows={2}
              />
            </Field>

            <div className="row between" style={{ marginTop: 12, alignItems: 'center' }}>
              <Check
                label="Published (Visible in TOP Radio library)"
                checked={audioPublished}
                onChange={setAudioPublished}
              />
              <div className="row gap">
                {editingAudioId ? (
                  <button type="button" className="btn ghost" onClick={resetAudioForm}>
                    Cancel
                  </button>
                ) : null}
                <button type="submit" className="btn primary" disabled={radioBusy || uploadingAudio}>
                  {radioBusy ? 'Saving…' : editingAudioId ? 'Update Audio' : 'Add to Library'}
                </button>
              </div>
            </div>
          </form>

          {/* Table of audio testimonies */}
          <h3>Audio Testimonies Library</h3>
          {audioItems === null ? (
            <p className="muted">Loading audio library…</p>
          ) : audioItems.length === 0 ? (
            <p className="muted">No audio testimonies added yet.</p>
          ) : (
            <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                    <th style={{ padding: '12px 16px' }}>Title & Speaker</th>
                    <th style={{ padding: '12px 16px' }}>Category</th>
                    <th style={{ padding: '12px 16px' }}>Audio Source</th>
                    <th style={{ padding: '12px 16px' }}>Status</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {audioItems.map((item) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 16px' }}>
                        <b>{item.title}</b>
                        <div className="small muted">{item.speaker || 'Anonymous'}</div>
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <span className="pill">{item.category || 'General'}</span>
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <audio controls src={item.audioUrl} style={{ height: 32, maxWidth: 220 }} />
                        <div style={{ fontSize: 11, color: '#888', marginTop: 3 }}>
                          {getProviderDisplayName(identifyProvider(item.audioUrl))}
                        </div>
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <span className={`pill ${item.isPublished ? 'ok' : 'ghost'}`}>
                          {item.isPublished ? 'Live' : 'Draft'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button className="btn small ghost" onClick={() => startEditAudio(item)}>
                          Edit
                        </button>
                        <button
                          className="btn small danger"
                          style={{ marginLeft: 6 }}
                          onClick={() => removeAudio(item.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
