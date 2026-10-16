import React, { useEffect, useState, useRef } from 'react';
import { repo } from '../api/repository';
import type { AdotopocConfig } from '../types';

const DEFAULT_VIDEO_URL =
  'https://res.cloudinary.com/duw6xrnpn/video/upload/v1792135475/ADOTOP_LOGO_OUTRO_m1awjk.mp4';
const DEFAULT_PAGE_URL = 'https://testimoniesofpraiseweb.onrender.com/adotopoc';
const LOGO_URL = 'https://res.cloudinary.com/duw6xrnpn/image/upload/v1789425387/LOG_xcvt3v.png';

interface Props {
  onBack: () => void;
}

export function AdotopocPage({ onBack }: Props) {
  const [config, setConfig] = useState<AdotopocConfig>({
    resourcePageUrl: DEFAULT_PAGE_URL,
    introVideoUrl: DEFAULT_VIDEO_URL,
    introEnabled: true,
  });
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    repo.getAdotopocConfig()
      .then((cfg) => setConfig(cfg))
      .catch(() => undefined);
  }, []);

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleGoToResources = () => {
    const targetUrl = config.resourcePageUrl || DEFAULT_PAGE_URL;
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100dvh',
      backgroundColor: '#000000',
      overflow: 'hidden',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* Background Full-Screen Video */}
      <video
        ref={videoRef}
        src={config.introVideoUrl || DEFAULT_VIDEO_URL}
        autoPlay
        loop
        playsInline
        muted={isMuted}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: 1,
        }}
      />

      {/* Top Bar Controls */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 20px',
        zIndex: 10,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 100%)',
      }}>
        {/* Sound Toggle (Matching the screenshot icon style) */}
        <button
          onClick={toggleMute}
          style={{
            background: 'rgba(0, 0, 0, 0.4)',
            border: 'none',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            fontSize: '18px',
            cursor: 'pointer',
            backdropFilter: 'blur(8px)',
          }}
          aria-label={isMuted ? 'Unmute video' : 'Mute video'}
        >
          {isMuted ? '🔇' : '🔊'}
        </button>

        {/* Back Button / Brand Badge */}
        <button
          onClick={onBack}
          style={{
            background: 'rgba(0, 0, 0, 0.4)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '20px',
            padding: '6px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: '#FFFFFF',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            backdropFilter: 'blur(8px)',
          }}
        >
          <img src={LOGO_URL} alt="Logo" style={{ width: '18px', height: '18px', objectFit: 'contain' }} />
          <span>Close</span>
        </button>
      </div>

      {/* Bottom Gradient & Text/CTA Container */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        padding: '40px 24px 36px 24px',
        background: 'linear-gradient(to top, rgba(0, 0, 0, 0.95) 0%, rgba(0, 0, 0, 0.6) 60%, transparent 100%)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}>
        {/* Requested Text Overlay */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <h2 style={{
            color: '#FFFFFF',
            fontSize: '22px',
            fontWeight: 800,
            margin: 0,
            lineHeight: 1.3,
            textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)',
          }}>
            Want to host a day of Testimonies of Praise outreaches and crusade?
          </h2>
          <p style={{
            color: 'rgba(255, 255, 255, 0.85)',
            fontSize: '14px',
            fontWeight: 500,
            margin: 0,
            lineHeight: 1.4,
          }}>
            Click below to go to our resource center.
          </p>
        </div>

        {/* Full-Width Golden/Amber Action Button (Styled after screenshot) */}
        <button
          onClick={handleGoToResources}
          style={{
            width: '100%',
            padding: '16px 20px',
            backgroundColor: '#DDA853',
            color: '#1A1001',
            border: 'none',
            borderRadius: '12px',
            fontSize: '16px',
            fontWeight: 800,
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.4)',
            transition: 'transform 0.15s ease, background-color 0.15s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
          onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
          onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <span>Go to Our Resource Center</span>
          <span style={{ fontSize: '18px' }}>➔</span>
        </button>
      </div>
    </div>
  );
}
