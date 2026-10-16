import React, { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { repo } from '../api/repository';
import { TopBar } from '../components/TopBar';
import { colors } from '../theme';
import type { AdotopocConfig } from '../types';

const DEFAULT_VIDEO_URL =
  'https://res.cloudinary.com/duw6xrnpn/video/upload/v1792135475/ADOTOP_LOGO_OUTRO_m1awjk.mp4';
const DEFAULT_PAGE_URL = 'https://testimoniesofpraiseweb.onrender.com/adotopoc';
const LOGO_URL = 'https://res.cloudinary.com/duw6xrnpn/image/upload/v1789425387/LOG_xcvt3v.png';

// Scoped ADOTOPOC Palette — never bleeds outside this component
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
      minHeight: '100dvh',
      backgroundColor: A.bg,
      boxSizing: 'border-box',
    }}>
      {/* ADOTOPOC Header — scoped crimson/cream palette */}
      <div style={{
        height: '56px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        borderBottom: `1px solid ${A.border}`,
        backgroundColor: A.bg,
        flexShrink: 0,
      }}>
        <button
          onClick={onBack}
          style={{
            width: '40px',
            height: '40px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: A.cream,
            fontSize: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-label="Back"
        >
          ←
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src={LOGO_URL} alt="ADOTOPOC Logo" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
          <div>
            <div style={{ fontSize: '15px', fontWeight: 800, color: A.cream }}>ADOTOPOC</div>
            <div style={{ fontSize: '9px', fontWeight: 600, color: A.creamMuted, textTransform: 'uppercase', letterSpacing: '1px' }}>
              Resource Center
            </div>
          </div>
        </div>

        {!showVideo ? (
          <button
            onClick={handleReplay}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '5px 10px',
              borderRadius: '16px',
              backgroundColor: A.crimson,
              border: `1px solid ${A.crimsonLight}`,
              color: A.cream,
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            🎬 Intro
          </button>
        ) : (
          <div style={{ width: '40px' }} />
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, position: 'relative', backgroundColor: A.bg, overflow: 'hidden' }}>
        {showVideo ? (
          <div style={{ width: '100%', height: '100%', position: 'relative', backgroundColor: '#000' }}>
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
                padding: '8px 14px',
                borderRadius: '20px',
                backgroundColor: 'rgba(17,7,11,0.85)',
                border: `1px solid ${A.crimsonLight}`,
                color: A.cream,
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                zIndex: 10,
              }}
            >
              Skip Intro ⏭
            </button>

            <div style={{
              position: 'absolute',
              bottom: '24px',
              left: '16px',
              right: '16px',
              padding: '14px',
              borderRadius: '12px',
              backgroundColor: 'rgba(17,7,11,0.9)',
              border: `1px solid ${A.border}`,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '17px', fontWeight: 800, color: A.cream }}>Welcome to ADOTOPOC</div>
              <div style={{ fontSize: '12px', color: A.creamMuted, marginTop: '4px' }}>
                Apostolic Deliverance Outreach & Testimonies of Praise Online Community
              </div>
            </div>
          </div>
        ) : (
          <iframe
            src={config.resourcePageUrl || DEFAULT_PAGE_URL}
            title="ADOTOPOC Resource Center"
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              backgroundColor: A.bg,
            }}
            allow="fullscreen"
          />
        )}
      </div>
    </div>
  );
}
