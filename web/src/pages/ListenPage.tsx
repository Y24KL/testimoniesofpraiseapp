import React, { useCallback, useEffect, useState } from 'react';
import { Music2, Pause, Play, Radio, RefreshCw, VideoOff } from 'lucide-react';
import { repo } from '../api/repository';
import { useAudioPlayer } from '../audio/AudioPlayerContext';
import { audioTrack, radioTrack } from '../audio/tracks';
import { TopBar } from '../components/TopBar';
import { useLive } from '../hooks/useContent';
import { navigate } from '../router';
import type { AudioTestimony, RadioConfig } from '../types';
import { formatDuration } from '../utils/format';

interface Props {
  onMenu: () => void;
}

/** TOP Radio + audio testimonies, played through the site-wide audio player (keeps playing across pages). */
export function ListenPage({ onMenu }: Props) {
  const { live } = useLive();
  const player = useAudioPlayer();
  const [radio, setRadio] = useState<RadioConfig | null>(null);
  const [radioError, setRadioError] = useState(false);
  const [library, setLibrary] = useState<AudioTestimony[] | null>(null);
  const [libraryError, setLibraryError] = useState(false);

  useEffect(
    () =>
      repo.subscribeRadio(
        (cfg) => {
          setRadio(cfg);
          setRadioError(false);
        },
        () => setRadioError(true),
      ),
    [],
  );

  const loadLibrary = useCallback(async () => {
    try {
      setLibrary(await repo.getAudioTestimonies(50));
      setLibraryError(false);
    } catch {
      setLibraryError(true);
      setLibrary((cur) => cur ?? []);
    }
  }, []);

  useEffect(() => {
    void loadLibrary();
  }, [loadLibrary]);

  const radioAvailable = Boolean(radio?.isLive && radio.streamUrl);
  const radioCurrent = radioAvailable && !!radio && player.track?.id === radioTrack(radio).id;
  const radioPlaying = radioCurrent && player.status === 'playing';
  const radioBusy = radioCurrent && (player.status === 'loading' || player.status === 'reconnecting');
  const radioStatus = !radioAvailable
    ? 'Not broadcasting right now'
    : radioCurrent && player.status === 'reconnecting'
      ? 'Reconnecting…'
      : radioCurrent && player.status === 'error'
        ? 'Couldn’t connect. Press play to retry.'
        : radioPlaying
          ? 'Playing live'
          : 'Press play to listen live';

  return (
    <div data-page style={{ minHeight: '100dvh', paddingBottom: 'calc(var(--nav-h) + env(safe-area-inset-bottom) + 24px)' }}>
      <TopBar title="Listen" onNotifications={() => navigate({ name: 'notifications' })} onMenu={onMenu} />
      <div className="page-pad page-width" style={{ paddingTop: 12 }}>
        {live?.isLive ? (
          <button type="button" className="notice live" onClick={() => navigate({ name: 'live' })}>
            <span className="live-dot pulse" />
            <span style={{ flex: 1 }}>The live broadcast is on now</span>
            <span style={{ color: 'var(--gold)' }}>Watch</span>
          </button>
        ) : live ? (
          <div className="notice off">
            <VideoOff size={16} />
            The live broadcast is offline. Keep listening below.
          </div>
        ) : null}

        <section className="radio-card" aria-labelledby="radio-title">
          <div className="radio-top">
            <span className="radio-icon">
              <Radio size={26} />
            </span>
            {radioAvailable ? (
              <span className="on-air">
                <span className="live-dot pulse" /> ON AIR
              </span>
            ) : (
              <span className="off-air">{radio === null && !radioError ? 'CHECKING…' : 'OFF AIR'}</span>
            )}
          </div>
          <span className="onb-eyebrow" style={{ fontSize: 11, letterSpacing: 1.4 }}>
            TOP RADIO
          </span>
          <h2 id="radio-title" style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>
            {radioAvailable ? radio?.currentProgramme || 'Live now' : 'TOP Radio is off air'}
          </h2>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.5 }}>
            {radioAvailable
              ? radio?.description || 'Gospel music, prayers and testimonies, streaming live.'
              : radioError
                ? 'We couldn’t check the radio status right now.'
                : 'When the radio is on air you can listen here and keep browsing. Audio testimonies are always available below.'}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14 }}>
            <button
              type="button"
              className="round-btn big-play"
              disabled={!radioAvailable}
              onClick={() => (radioPlaying ? player.pause() : radio && player.play(radioTrack(radio)))}
              aria-label={radioPlaying ? 'Pause TOP Radio' : 'Play TOP Radio'}
              aria-busy={radioBusy}
            >
              {radioBusy ? <span className="spinner" /> : radioPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" style={{ marginLeft: 3 }} />}
            </button>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{radioStatus}</div>
              <div style={{ fontSize: 12, color: 'var(--text-subtle)', marginTop: 2 }}>Keeps playing while you browse the site</div>
            </div>
            <span className={`eq${radioPlaying ? '' : ' paused'}`} aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          </div>
        </section>

        <div className="section-head">
          <div>
            <h2>Audio testimonies</h2>
            <p>Listen any time, on demand.</p>
          </div>
          <button type="button" className="link-btn" onClick={() => void loadLibrary()} aria-label="Refresh audio list">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {library === null ? (
          <div aria-hidden="true" style={{ display: 'grid', gap: 10 }}>
            <div className="skeleton" style={{ height: 66 }} />
            <div className="skeleton" style={{ height: 66 }} />
          </div>
        ) : library.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
            <Music2 size={40} color="var(--purple-light)" />
            <h3 style={{ color: 'var(--text)', margin: '10px 0 4px', fontSize: 16 }}>{libraryError ? 'Couldn’t load audio' : 'No audio testimonies yet'}</h3>
            <p style={{ margin: 0, fontSize: 14 }}>{libraryError ? 'Check your connection and try again.' : 'Audio testimonies will appear here as soon as they’re published.'}</p>
          </div>
        ) : (
          library.map((item) => {
            const tr = audioTrack(item);
            const current = player.track?.id === tr.id;
            const playing = current && player.status === 'playing';
            const busy = current && player.status === 'loading';
            return (
              <button key={item.id} type="button" className={`audio-row ${current ? 'active' : 'idle'}`} onClick={() => (playing ? player.pause() : player.play(tr))} aria-label={`${playing ? 'Pause' : 'Play'} ${item.title}`}>
                <span className="round-btn">{busy ? <span className="spinner" /> : playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" style={{ marginLeft: 2 }} />}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="media-title" style={{ fontSize: 15 }}>
                    {item.title}
                  </span>
                  <span className="media-meta" style={{ display: 'block' }}>
                    {[item.speaker, formatDuration(item.duration), item.category].filter(Boolean).join('  ·  ')}
                  </span>
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
