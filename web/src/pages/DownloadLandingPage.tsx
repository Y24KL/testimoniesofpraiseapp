import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Download, Volume2, VolumeX } from 'lucide-react';
import './download-landing.css';

const VIDEO_URL = 'https://topappstorage.b-cdn.net/video/TESTIMONIES%20OF%20PRAISE%20FINAL%20OPENING%20MONTAGE.mp4';
const STORE_URL = 'https://web.lwappstore.com/share/lW-APP-Y26-PJ8225';
const WEB_URL = 'https://testimoniesofpraiseapp.com';

const NOTES = ['♪', '♫', '♪', '♬'];

/**
 * Public download landing page at /#/download. Shown before sign-in, never waits for the app's start-up.
 * The background is the TOP opening montage, streamed from the CDN: muted, looping and inline. It is not
 * downloaded when the visitor prefers reduced motion or when the video fails, and a gradient is shown instead.
 */
export function DownloadLandingPage() {
  const reducedMotion = useMemo(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false, []);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const [muted, setMuted] = useState(true);
  const showVideo = !reducedMotion && !failed;

  useEffect(() => {
    // Autoplay can be refused by the browser; the gradient fallback still looks finished, so ignore the refusal.
    videoRef.current?.play().catch(() => undefined);
  }, [showVideo]);

  const toggleSound = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  };

  return (
    <div className="dl-page">
      <div className={`dl-bg${showVideo ? '' : ' dl-bg--fallback'}`} aria-hidden="true">
        {showVideo ? (
          <video
            ref={videoRef}
            className="dl-video"
            src={VIDEO_URL}
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            onError={() => setFailed(true)}
          />
        ) : null}
        <div className="dl-overlay" />
      </div>

      <div className="dl-decor" aria-hidden="true">
        {NOTES.map((note, i) => (
          <span key={i} className="dl-note" style={{ left: `${20 + i * 18}%`, animationDelay: `${i * 1.6}s` }}>{note}</span>
        ))}
      </div>

      {showVideo ? (
        <button type="button" className="dl-sound" onClick={toggleSound} aria-label={muted ? 'Turn sound on' : 'Turn sound off'}>
          {muted ? <VolumeX size={20} aria-hidden="true" /> : <Volume2 size={20} aria-hidden="true" />}
        </button>
      ) : null}

      <main className="dl-main">
        <section className="dl-brand">
          <img className="dl-logo" src="/logo.png" alt="Testimonies of Praise" />
          <p className="dl-brand-name">TESTIMONIES OF PRAISE</p>
          <p className="dl-brand-line">No one ever praised God and went away empty, he always blesses you for praising him.</p>
        </section>

        <section className="dl-promo">
          <p className="dl-new">New update!</p>
          <h1 className="dl-title">THE TESTIMONIES OF PRAISE APP IS HERE!</h1>
          <p className="dl-copy">Download the app for free and be inspired by powerful testimonies from the songs by the Loveworld Singers!</p>
          <div className="dl-ctas">
            <a className="dl-btn dl-btn--primary" href={STORE_URL} target="_blank" rel="noopener noreferrer">
              <Download size={20} aria-hidden="true" />
              <span>DOWNLOAD FROM LOVEWORLD APP STORE</span>
            </a>
            <a className="dl-btn dl-btn--secondary" href={WEB_URL}>
              <span>CONTINUE TO WEB</span>
              <ArrowRight size={18} aria-hidden="true" />
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
