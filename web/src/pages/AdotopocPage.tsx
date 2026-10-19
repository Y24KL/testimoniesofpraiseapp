import React, { useEffect, useState } from 'react';
import { repo } from '../api/repository';
import type { AdotopocConfig } from '../types';

const DEFAULT_PAGE_URL = 'https://testimoniesofpraiseweb.onrender.com/adotopoc';
const LOGO_URL = 'https://res.cloudinary.com/duw6xrnpn/image/upload/v1789425387/LOG_xcvt3v.png';

// Event poster image — the main "A Day of Testimonies of Praise" graphic
const POSTER_URL =
  'https://res.cloudinary.com/duw6xrnpn/image/upload/v1789425387/adotopoc_poster_xcvt3v.png';

interface Props {
  onBack: () => void;
}

export function AdotopocPage({ onBack }: Props) {
  const [config, setConfig] = useState<AdotopocConfig>({
    resourcePageUrl: DEFAULT_PAGE_URL,
    introVideoUrl: '',
    introEnabled: false,
  });

  useEffect(() => {
    repo
      .getAdotopocConfig()
      .then((cfg) => setConfig(cfg))
      .catch(() => undefined);
  }, []);

  const handleGoToResources = () => {
    const targetUrl = config.resourcePageUrl || DEFAULT_PAGE_URL;
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100dvh',
        backgroundColor: '#ffffff',
        overflow: 'hidden',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ── Top Navigation Bar ── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 16px',
          backgroundColor: '#ffffff',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          zIndex: 20,
        }}
      >
        {/* Home icon */}
        <button
          onClick={onBack}
          aria-label="Go back home"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Simple house SVG */}
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#222" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
            <polyline points="9 21 9 12 15 12 15 21" />
          </svg>
        </button>

        {/* URL / title badge */}
        <div
          style={{
            flex: 1,
            margin: '0 10px',
            background: '#f0f0f0',
            borderRadius: '20px',
            padding: '6px 14px',
            fontSize: '12px',
            color: '#555',
            textAlign: 'center',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          sofpraiseapp.onrender.com
        </div>

        {/* Close button */}
        <button
          onClick={onBack}
          style={{
            background: 'rgba(0,0,0,0.08)',
            border: 'none',
            borderRadius: '20px',
            padding: '6px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: '#222',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <img
            src={LOGO_URL}
            alt="LMM Logo"
            style={{ width: '18px', height: '18px', objectFit: 'contain', borderRadius: '50%' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <span>Close</span>
        </button>
      </div>

      {/* ── Main Hero / Poster Section ── */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          flex: 1,
          minHeight: 0,
          background: 'linear-gradient(180deg, #ffffff 0%, #f5f5f5 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          overflow: 'hidden',
        }}
      >
        {/* LMM Logo at the top inside a gold/blue ring */}
        <div
          style={{
            marginTop: '18px',
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            border: '4px solid #003DA5',
            outline: '4px solid #FFD700',
            outlineOffset: '2px',
            boxShadow: '0 0 0 2px #003DA5',
            overflow: 'hidden',
            flexShrink: 0,
            backgroundColor: '#003DA5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <img
            src={LOGO_URL}
            alt="LMM Ministry Logo"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>

        {/* Poster Graphic with all the text / flags / design */}
        <div
          style={{
            width: '100%',
            position: 'relative',
            background: 'linear-gradient(160deg, #b20000 0%, #8b0000 30%, #003DA5 60%, #1a1a6e 100%)',
            padding: '0 0 10px 0',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          {/* Decorative gold arc / halo at the top */}
          <div
            style={{
              position: 'absolute',
              top: '-60px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '320px',
              height: '260px',
              borderRadius: '50%',
              border: '18px solid #FFD700',
              opacity: 0.35,
              pointerEvents: 'none',
            }}
          />
          {/* Inner blue arc */}
          <div
            style={{
              position: 'absolute',
              top: '-44px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '280px',
              height: '230px',
              borderRadius: '50%',
              border: '10px solid #003DA5',
              opacity: 0.5,
              pointerEvents: 'none',
            }}
          />

          {/* Flags row placeholder — replaced with a colored strip */}
          <div
            style={{
              width: '100%',
              height: '40px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              marginTop: '10px',
              gap: '4px',
            }}
          >
            {['🇰🇪', '🇳🇬', '🇺🇸', '🇬🇧', '🇮🇳', '🇧🇷', '🇨🇳', '🇩🇪', '🇿🇦', '🇫🇷', '🇵🇭', '🇨🇦'].map(
              (flag, i) => (
                <span key={i} style={{ fontSize: '20px', lineHeight: 1 }}>
                  {flag}
                </span>
              )
            )}
          </div>

          {/* "A DAY OF" text */}
          <div
            style={{
              marginTop: '6px',
              fontSize: '28px',
              fontWeight: 900,
              color: '#FFFFFF',
              letterSpacing: '4px',
              textShadow: '0 2px 8px rgba(0,0,0,0.6)',
              textTransform: 'uppercase',
            }}
          >
            A DAY OF
          </div>

          {/* "TESTIMONIES" big gold text */}
          <div
            style={{
              fontSize: 'clamp(36px, 10vw, 64px)',
              fontWeight: 900,
              color: '#FFD700',
              letterSpacing: '2px',
              textShadow:
                '0 0 20px rgba(255,215,0,0.6), 2px 4px 0 #8b6800, 0 2px 8px rgba(0,0,0,0.8)',
              lineHeight: 1,
              textTransform: 'uppercase',
              textAlign: 'center',
              padding: '0 8px',
            }}
          >
            TESTIMONIES
          </div>

          {/* "OF" text */}
          <div
            style={{
              fontSize: '22px',
              fontWeight: 900,
              color: '#FFFFFF',
              letterSpacing: '3px',
              textShadow: '0 2px 6px rgba(0,0,0,0.5)',
              margin: '2px 0',
            }}
          >
            OF
          </div>

          {/* "PRAISE" big gold text */}
          <div
            style={{
              fontSize: 'clamp(40px, 12vw, 72px)',
              fontWeight: 900,
              color: '#FFD700',
              letterSpacing: '2px',
              textShadow:
                '0 0 20px rgba(255,215,0,0.6), 2px 4px 0 #8b6800, 0 2px 8px rgba(0,0,0,0.8)',
              lineHeight: 1,
              textTransform: 'uppercase',
            }}
          >
            PRAISE
          </div>

          {/* Blue ribbon banner — "OUTREACHES & CRUSADES" */}
          <div
            style={{
              width: '100%',
              marginTop: '10px',
              background: 'linear-gradient(90deg, #001f87, #003DA5, #001f87)',
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              borderTop: '3px solid #FFD700',
              borderBottom: '3px solid #FFD700',
            }}
          >
            <span
              style={{
                fontSize: '18px',
                fontWeight: 900,
                color: '#FFFFFF',
                letterSpacing: '3px',
                textTransform: 'uppercase',
                textShadow: '0 1px 4px rgba(0,0,0,0.5)',
              }}
            >
              OUTREACHES &amp; CRUSADES
            </span>
          </div>
        </div>

        {/* ── CTA Card ── */}
        <div
          style={{
            width: '100%',
            backgroundColor: '#ffffff',
            padding: '24px 20px 32px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: '18px',
              fontWeight: 800,
              color: '#111111',
              lineHeight: 1.35,
            }}
          >
            Want to host a day of Testimonies of Praise outreaches and crusade?
          </p>
          <p
            style={{
              margin: 0,
              fontSize: '13px',
              fontWeight: 400,
              color: '#555555',
              lineHeight: 1.4,
            }}
          >
            Click below to go to our resource center.
          </p>

          {/* Gold "Go to Our Resource Center" button */}
          <button
            onClick={handleGoToResources}
            style={{
              marginTop: '12px',
              width: '100%',
              padding: '16px 20px',
              backgroundColor: '#DDA853',
              color: '#1A1001',
              border: 'none',
              borderRadius: '10px',
              fontSize: '16px',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'transform 0.15s ease, background-color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#c8963e';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#DDA853';
            }}
            onMouseDown={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.98)';
            }}
            onMouseUp={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
            }}
          >
            <span>Go to Our Resource Center</span>
            <span style={{ fontSize: '18px' }}>→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
