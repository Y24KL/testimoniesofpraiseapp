import React, { useEffect, useState } from 'react';
import { repo } from '../api/repository';
import { TopBar } from '../components/TopBar';
import { colors } from '../theme';
import type { AdotopocConfig } from '../types';

const DEFAULT_VIDEO_URL =
  'https://res.cloudinary.com/duw6xrnpn/video/upload/v1792135475/ADOTOP_LOGO_OUTRO_m1awjk.mp4';
const DEFAULT_PAGE_URL = 'https://testimoniesofpraiseweb.onrender.com/adotopoc';
const LOGO_URL = 'https://res.cloudinary.com/duw6xrnpn/image/upload/v1789425387/LOG_xcvt3v.png';

// Scoped ADOTOPOC Palette
const A = {
  bg: '#11070B',
  surface: '#220912',
  border: '#3D1020',
  crimson: '#7F0404',
  crimsonLight: '#A80505',
  cream: '#FBFAF5',
  creamMuted: 'rgba(251,250,245,0.7)',
};

interface Props {
  onBack: () => void;
}

export function AdotopocPage({ onBack }: Props) {
  const [config, setConfig] = useState<AdotopocConfig>({
    resourcePageUrl: DEFAULT_PAGE_URL,
    introVideoUrl: DEFAULT_VIDEO_URL,
    introEnabled: true,
  });
  const [showVideo, setShowVideo] = useState(true);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    repo.getAdotopocConfig().then((cfg) => {
      setConfig(cfg);
      if (!cfg.introEnabled) setShowVideo(false);
    }).catch(() => undefined);
  }, []);

  const handleVideoEnd = () => {
    setShowVideo(false);
  };

  const handleSkip = () => {
    if (videoRef.current) videoRef.current.pause();
    setShowVideo(false);
  };

  const handleReplay = () => {
    setShowVideo(true);
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play();
      }
    }, 50);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100dvh', // 100dvh prevents mobile browser navigation bars from hiding content
      backgroundColor: A.bg,
      boxSizing: 'border-box',
    }}>
      {/* ADOTOPOC Header */}
      <div style={{
        minHeight: '64px', // Increased height for better mobile touch area
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px',
        borderBottom: `1px solid ${A.border}`,
        backgroundColor: A.bg,
        flexShrink: 0,
      }}>
        <button
          onClick={onBack}
          style={{
            width: '48px', // Expanded minimum touch target to 48px
            height: '48px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: A.cream,
            fontSize: '24px', // Scaled up for visibility
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: '-8px', 
          }}
          aria-label="Back"
        >
          ←
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, paddingLeft: '4px' }}>
          <img src={LOGO_URL} alt="ADOTOPOC Logo" style={{ width: '36px', height: '36px', objectFit: 'contain' }} />
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: '16px', fontWeight: 800, color: A.cream, lineHeight: '1.2' }}>ADOTOPOC</div>
            <div style={{ fontSize: '10px', fontWeight: 600, color: A.creamMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Resource Center
            </div>
          </div>
        </div>

        {!showVideo && (
          <button
            onClick={handleReplay}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 14px', // Increased padding for mobile tapping
              borderRadius: '20px',
              backgroundColor: A.crimson,
              border: `1px solid ${A.crimsonLight}`,
              color: A.cream,
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            🎬 Intro
          </button>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, position: 'relative', backgroundColor: A.bg, display: 'flex', flexDirection: 'column' }}>
        {showVideo ? (
          <div style={{ flex: 1, width: '100%', position: 'relative', backgroundColor: '#000' }}>
            <video
              ref={videoRef}
              src={config.introVideoUrl || DEFAULT_VIDEO_URL}
              autoPlay
              playsInline
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              onEnded={handleVideoEnd}
            />

            <button
              onClick={handleSkip}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '12px 18px', // Scaled for mobile
                borderRadius: '24px',
                backgroundColor: 'rgba(17,7,11,0.85)',
                border: `1px solid ${A.crimsonLight}`,
                color: A.cream,
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                zIndex: 10,
              }}
            >
              Skip Intro ⏭
            </button>

            <div style={{
              position: 'absolute',
              bottom: '32px',
              left: '16px',
              right: '16px',
              padding: '16px',
              borderRadius: '16px',
              backgroundColor: 'rgba(17,7,11,0.9)',
              border: `1px solid ${A.border}`,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '18px', fontWeight: 800, color: A.cream }}>Welcome to ADOTOPOC</div>
              <div style={{ fontSize: '13px', color: A.creamMuted, marginTop: '6px', lineHeight: '1.4' }}>
                Apostolic Deliverance Outreach & Testimonies of Praise Online Community
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%' }}>
            {/* The Iframe Container */}
            <div style={{ flex: 1, WebkitOverflowScrolling: 'touch' }}>
              <iframe
                src={config.resourcePageUrl || DEFAULT_PAGE_URL}
                title="ADOTOPOC Resource Center"
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  backgroundColor: A.bg,
                  display: 'block'
                }}
                allow="fullscreen"
              />
            </div>
            
            {/* Mobile-Optimized Action Bar */}
            <div style={{
              padding: '16px',
              backgroundColor: A.surface,
              borderTop: `1px solid ${A.border}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              alignItems: 'center',
              flexShrink: 0
            }}>
              <span style={{ fontSize: '13px', color: A.creamMuted, textAlign: 'center' }}>
                Need to download files or want a better view?
              </span>
              <a
                href={config.resourcePageUrl || DEFAULT_PAGE_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  padding: '16px', // Massive touch target area
                  backgroundColor: A.crimson,
                  color: A.cream,
                  textDecoration: 'none',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: 700,
                  boxSizing: 'border-box',
                  border: `1px solid ${A.crimsonLight}`,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                }}
              >
                Open Resources in New Tab ↗
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
