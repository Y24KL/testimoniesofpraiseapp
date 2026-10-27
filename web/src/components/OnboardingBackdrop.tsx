import React, { useEffect, useRef, useState } from 'react';
import { Play, Volume2, VolumeX } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../api/firebase';
import { isHls } from '../api/repository';
import { ONBOARDING_MEDIA, resolveOnboardingMedia, type OnboardingMedia } from '../config/onboarding';

// v2: older caches could hold "none" (no media) and would hide the default montage.
const CACHE_KEY = 'top:onboarding-media:v2';

function readCache(): OnboardingMedia | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const m = raw ? (JSON.parse(raw) as OnboardingMedia) : null;
    return m && m.type !== 'none' ? m : null;
  } catch {
    return null;
  }
}

/** Media to show now: cached remote value > build-time env; refreshes the cache in the background. */
export function useOnboardingMedia(): OnboardingMedia {
  const [media, setMedia] = useState<OnboardingMedia>(() => readCache() ?? ONBOARDING_MEDIA);
  useEffect(() => {
    let alive = true;
    getDoc(doc(db, 'settings/onboarding'))
      .then((snap) => {
        if (!snap.exists()) return;
        const d = snap.data();
        const remote = resolveOnboardingMedia({ type: d.mediaType, url: d.mediaUrl, posterUrl: d.posterUrl, overlayOpacity: d.overlayOpacity });
        if (remote.type === 'none') return; // an empty admin setting keeps the default montage
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(remote));
        } catch {
          /* storage may be unavailable (private mode) */
        }
        // An admin-chosen background replaces the default straight away; after that it never
        // changes mid-view (later changes show on the next visit, from the cache).
        if (alive) setMedia((cur) => (cur.url === ONBOARDING_MEDIA.url ? remote : cur));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return media;
}

const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const saveData = () => {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return Boolean(c?.saveData || (c?.effectiveType && /(^|-)2g$/.test(c.effectiveType)));
};

function Video({ media, onFail }: { media: OnboardingMedia; onFail: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [ready, setReady] = useState(false);

  // Don't play (and download) the intro while the tab is in the background.
  useEffect(() => {
    const onVis = () => {
      const v = ref.current;
      if (!v) return;
      if (document.hidden) v.pause();
      else void v.play().catch(() => undefined);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    let hls: { destroy(): void } | null = null;
    let cancelled = false;
    const start = () => v.play().catch(() => undefined); // muted autoplay; if refused the poster stays
    if (isHls(media.url) && !v.canPlayType('application/vnd.apple.mpegurl')) {
      import('hls.js')
        .then(({ default: Hls }) => {
          if (cancelled) return;
          if (!Hls.isSupported()) return onFail();
          const h = new Hls({ capLevelToPlayerSize: true });
          hls = h;
          h.on(Hls.Events.ERROR, (_e, d) => d.fatal && onFail());
          h.loadSource(media.url);
          h.attachMedia(v);
          start();
        })
        .catch(onFail);
    } else {
      v.src = media.url;
      start();
    }
    return () => {
      cancelled = true;
      hls?.destroy();
    };
  }, [media.url, onFail]);

  return (
    <>
      <video
        ref={ref}
        muted={muted}
        loop
        playsInline
        autoPlay
        preload="metadata"
        poster={media.posterUrl}
        aria-hidden="true"
        onPlaying={() => setReady(true)}
        onError={onFail}
        className={`onb-video${ready ? ' is-ready' : ''}`}
        style={media.posterUrl ? { opacity: 1 } : undefined}
      />
      <button
        type="button"
        onClick={() => setMuted((m) => !m)}
        aria-label={muted ? 'Unmute intro video' : 'Mute intro video'}
        className="icon-btn onb-sound"
      >
        {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>
    </>
  );
}

/** Full-bleed image/video with scrim; failures fall back to the poster, then the branded background. */
export function OnboardingBackdrop({ media }: { media: OnboardingMedia }) {
  const [failed, setFailed] = useState(false);
  const [optIn, setOptIn] = useState(false);
  useEffect(() => setFailed(false), [media.url]);

  // Data saver / slow connection / reduced motion: don't auto-download the video, offer a Play button.
  const hold = media.type === 'video' && !optIn && (prefersReducedMotion() || saveData());
  const onFail = React.useCallback(() => setFailed(true), []);

  let content: React.ReactNode = null;
  if (media.type === 'image' && !failed) content = <img src={media.url} alt="" decoding="async" fetchPriority="high" onError={onFail} />;
  else if (media.type === 'video' && (failed || hold) && media.posterUrl) content = <img src={media.posterUrl} alt="" decoding="async" />;
  else if (media.type === 'video' && !failed) content = <Video media={media} onFail={onFail} />;

  return (
    <div className="onb-media" aria-hidden={!hold}>
      <div className="onb-brand" />
      {content}
      {content ? <div className="onb-scrim" style={{ opacity: 0.45 + media.overlayOpacity * 0.55 }} /> : null}
      {content ? <div className="onb-vignette" /> : null}
      {hold ? (
        <button
          type="button"
          onClick={() => setOptIn(true)}
          aria-label="Play intro video"
          className="icon-btn onb-sound"
        >
          <Play size={18} />
        </button>
      ) : null}
    </div>
  );
}
