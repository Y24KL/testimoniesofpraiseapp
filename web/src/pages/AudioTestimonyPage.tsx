import React, { useEffect, useState } from 'react';
import { Music2, Pause, Play, Share2 } from 'lucide-react';
import { repo } from '../api/repository';
import { useAudioPlayer } from '../audio/AudioPlayerContext';
import { audioTrack } from '../audio/tracks';
import { CommentsSection } from '../components/CommentsSection';
import { ErrorState } from '../components/ErrorState';
import { PrimaryButton } from '../components/PrimaryButton';
import { TopBar } from '../components/TopBar';
import type { AudioTestimony } from '../types';
import { formatDate, formatDuration } from '../utils/format';

interface Props {
  id: string;
  onBack: () => void;
}

/** One audio testimony: play/pause through the site-wide player, details and comments. */
export function AudioTestimonyPage({ id, onBack }: Props) {
  const player = useAudioPlayer();
  const [item, setItem] = useState<AudioTestimony | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    repo
      .getAudioTestimony(id)
      .then((a) => {
        if (cancelled) return;
        if (a) setItem(a);
        else setError('This audio testimony is no longer available.');
      })
      .catch(() => !cancelled && setError('Unable to load this audio testimony. Please check your internet connection.'));
    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  const share = async () => {
    if (!item) return;
    // Share the audio file itself: the public URL saved when it was uploaded.
    const url = (item.audioUrl ?? '').trim();
    if (!/^https?:\/\/\S+$/i.test(url)) {
      window.alert('This audio doesn’t have a shareable link yet. Please try again later.');
      return;
    }
    if (navigator.share) {
      try {
        await navigator.share({ title: item.title, text: `Listen to "${item.title}" on Testimonies of Praise`, url });
        return;
      } catch {
        /* cancelled: fall back to copying */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  };

  const track = item ? audioTrack(item) : null;
  const current = !!track && player.track?.id === track.id;
  const playing = current && player.status === 'playing';
  const busy = current && (player.status === 'loading' || player.status === 'reconnecting');

  return (
    <div data-page style={{ minHeight: '100dvh', paddingBottom: 'calc(var(--nav-h) + env(safe-area-inset-bottom) + 24px)' }}>
      <TopBar title="Audio testimony" onBack={onBack} />
      {error && !item ? (
        <ErrorState message={error} onRetry={() => setAttempt((a) => a + 1)} />
      ) : !item || !track ? (
        <div className="skeleton" style={{ height: 260, margin: 16 }} aria-hidden="true" />
      ) : (
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 760, width: '100%', margin: '0 auto' }}>
          <div className="audio-row active" style={{ flexDirection: 'column', gap: 14, padding: 20, cursor: 'default' }}>
            <div style={{ width: 140, height: 140, borderRadius: 18, overflow: 'hidden', background: 'var(--gold-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gold)' }}>
              {item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Music2 size={42} />}
            </div>
            <button
              type="button"
              className="round-btn"
              style={{ width: 64, height: 64, border: 'none', cursor: 'pointer' }}
              onClick={() => (playing ? player.pause() : player.play(track))}
              aria-label={`${playing ? 'Pause' : 'Play'} ${item.title}`}
              aria-busy={busy}
            >
              {busy ? <span className="spinner" /> : playing ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" style={{ marginLeft: 3 }} />}
            </button>
            <span className="comments-muted" style={{ textAlign: 'center' }}>
              {current && player.status === 'error' ? 'Playback failed. Tap play to retry.' : playing ? 'Playing: keeps going while you browse the site' : current ? 'Paused' : 'Tap play to listen'}
            </span>
          </div>
          <div>
            {item.category ? <div style={{ color: 'var(--gold)', fontSize: 12, fontWeight: 800, letterSpacing: 1.2 }}>{item.category.toUpperCase()}</div> : null}
            <h1 style={{ margin: '6px 0', fontSize: 24, color: 'var(--text)' }}>{item.title}</h1>
            <div className="media-meta">{[item.speaker, formatDate(item.publishedAt ?? item.createdAt), formatDuration(item.duration)].filter(Boolean).join('  ·  ')}</div>
          </div>
          {item.description ? <p style={{ margin: 0, color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{item.description}</p> : null}
          <PrimaryButton title={copied ? 'LINK COPIED!' : 'SHARE'} variant="outline" icon={<Share2 size={18} />} onClick={share} />
          <CommentsSection type="audio" mediaId={item.id} mediaTitle={item.title} />
        </div>
      )}
    </div>
  );
}
