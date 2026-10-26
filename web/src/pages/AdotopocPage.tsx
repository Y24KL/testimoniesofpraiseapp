import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, Globe, Volume2, VolumeX, X } from 'lucide-react';
import { repo } from '../api/repository';
import type { AdotopocConfig } from '../types';

const DEFAULT_VIDEO_URL = 'https://res.cloudinary.com/duw6xrnpn/video/upload/v1792135475/ADOTOP_LOGO_OUTRO_m1awjk.mp4';
const DEFAULT_PAGE_URL = 'https://testimoniesofpraiseweb.onrender.com/adotopoc';
const LOGO_URL = 'https://res.cloudinary.com/duw6xrnpn/image/upload/v1789425387/LOG_xcvt3v.png';

interface Props {
  onBack: () => void;
}

const isWebUrl = (u: string) => {
  try {
    const x = new URL(u);
    return (x.protocol === 'https:' || x.protocol === 'http:') && !!x.hostname;
  } catch {
    return false;
  }
};

const glass: React.CSSProperties = {
  background: 'rgba(18,0,28,0.45)',
  border: '1px solid rgba(255,255,255,0.18)',
  color: '#fff',
  width: 44,
  height: 44,
  borderRadius: 22,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  backdropFilter: 'blur(6px)',
};

/**
 * ADOTOPOC: full-bleed intro video with the call to action on top (same layout as the mobile app).
 * The Resource Center is a normal link that opens in a new browser tab.
 */
export function AdotopocPage({ onBack }: Props) {
  const [config, setConfig] = useState<AdotopocConfig>({ resourcePageUrl: DEFAULT_PAGE_URL, introVideoUrl: DEFAULT_VIDEO_URL, introEnabled: true });
  const [muted, setMuted] = useState(true);
  const [videoState, setVideoState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    repo
      .getAdotopocConfig()
      .then(setConfig)
      .catch(() => undefined);
  }, []);

  const videoUrl = config.introEnabled ? config.introVideoUrl || DEFAULT_VIDEO_URL : '';
  const pageUrl = (config.resourcePageUrl || DEFAULT_PAGE_URL).trim();
  const linkOk = isWebUrl(pageUrl);

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !muted;
    setMuted(!muted);
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100dvh', overflow: 'hidden', background: 'linear-gradient(180deg, #4B006E 0%, #2E0044 50%, #12001C 100%)' }}>
      {videoState !== 'ready' ? (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingBottom: 160 }}>
          <img src={LOGO_URL} alt="" style={{ width: 150, height: 150, objectFit: 'contain', opacity: 0.9 }} />
          {videoUrl && videoState === 'loading' ? <span className="spinner light" style={{ marginTop: 18 }} /> : null}
        </div>
      ) : null}
      {videoUrl && videoState !== 'failed' ? (
        <video
          ref={videoRef}
          src={videoUrl}
          autoPlay
          loop
          playsInline
          muted={muted}
          onCanPlay={() => setVideoState('ready')}
          onError={() => setVideoState('failed')}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: videoState === 'ready' ? 1 : 0, transition: 'opacity .4s' }}
        />
      ) : null}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(18,0,28,0.55) 0%, rgba(18,0,28,0.08) 20%, rgba(18,0,28,0.15) 45%, rgba(18,0,28,0.82) 72%, rgba(18,0,28,0.98) 100%)',
        }}
      />

      <div style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 14px)', left: 16, right: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" style={glass} onClick={onBack} aria-label="Close">
            <X size={22} />
          </button>
          {videoState === 'ready' ? (
            <button type="button" style={glass} onClick={toggleMute} aria-label={muted ? 'Turn sound on' : 'Turn sound off'}>
              {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
          ) : null}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px 6px 6px', borderRadius: 8, background: '#4B006E', border: '1px solid rgba(245,197,66,0.55)', boxShadow: '0 8px 20px rgba(0,0,0,0.35)' }}>
          <img src={LOGO_URL} alt="" style={{ width: 30, height: 30, objectFit: 'contain' }} />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.4, color: '#F5C542' }}>ADOTOPOC</span>
        </div>
      </div>

      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '0 24px calc(env(safe-area-inset-bottom, 0px) + 32px)', display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 640 }}>
        <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.2, color: '#F5C542' }}>OUTREACHES &amp; CRUSADES</span>
        <h1 style={{ margin: 0, fontSize: 'clamp(30px, 6vw, 40px)', lineHeight: 1.18, fontWeight: 800, color: '#fff', textShadow: '0 2px 6px rgba(0,0,0,0.45)' }}>
          Want to host A Day of Testimonies of Praise?
        </h1>
        <p style={{ margin: 0, fontSize: 17, lineHeight: 1.45, color: 'rgba(255,255,255,0.88)', maxWidth: 480 }}>
          Everything you need to plan your outreach or crusade is in our Resource Center.
        </p>
        {linkOk ? (
          <a
            href={pageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-gold"
            style={{ marginTop: 10, alignSelf: 'flex-start', minWidth: 240, height: 56, borderRadius: 12, fontSize: 17, fontWeight: 800, gap: 10, textDecoration: 'none' }}
          >
            Go to Resource Center <ExternalLink size={18} />
          </a>
        ) : (
          <p role="alert" style={{ margin: 0, color: 'var(--danger)', fontSize: 14 }}>
            The Resource Center link isn’t set up correctly. Please try again later.
          </p>
        )}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#9C86B3' }}>
          <Globe size={13} /> Opens in a new tab
        </span>
        {videoState === 'failed' ? <span style={{ fontSize: 12, color: '#9C86B3' }}>The intro video couldn’t load. You can still open the Resource Center.</span> : null}
      </div>
    </div>
  );
}
