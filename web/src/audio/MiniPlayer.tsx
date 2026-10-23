import React from 'react';
import { Music2, Pause, Play, Radio, X } from 'lucide-react';
import { useAudioPlayer } from './AudioPlayerContext';

const STATUS_TEXT: Record<string, string> = {
  loading: 'Connecting…',
  paused: 'Paused',
  reconnecting: 'Reconnecting…',
  error: 'Playback failed. Press play to retry',
};

/** Floating "now playing" bar, shown on every page while audio is loaded. */
export function MiniPlayer({ withNav, onOpen }: { withNav: boolean; onOpen: () => void }) {
  const { track, status, toggle, stop } = useAudioPlayer();
  if (!track) return null;
  const playing = status === 'playing';
  const busy = status === 'loading' || status === 'reconnecting';
  const sub = STATUS_TEXT[status] ?? (track.live ? 'Live on TOP Radio' : track.artist ?? 'Audio testimony');

  return (
    <div className={`mini-player${withNav ? '' : ' no-nav'}`} role="region" aria-label="Audio player">
      <button type="button" className="mini-info" onClick={onOpen} aria-label={`Now playing: ${track.title}. Open Listen`}>
        <span className="mini-art">{track.live ? <Radio size={18} /> : <Music2 size={18} />}</span>
        <div>
          <div className="mini-title">{track.title}</div>
          <div className="mini-sub" style={status === 'error' ? { color: 'var(--danger)' } : undefined}>
            {track.live && playing ? <span className="live-dot pulse" /> : null}
            {sub}
          </div>
        </div>
      </button>
      <button type="button" className="round-btn" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'} aria-busy={busy}>
        {busy ? <span className="spinner" /> : playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" style={{ marginLeft: 2 }} />}
      </button>
      <button type="button" className="round-btn ghost" onClick={stop} aria-label="Stop and close player">
        <X size={18} />
      </button>
    </div>
  );
}
