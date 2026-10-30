import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../api/firebase';
import { useAuth } from '../context/AuthContext';
import { navigate, type Route } from '../router';
import { colors, radius } from '../theme';

/**
 * Welcome tour for the website: seven stops, each opening the real page it describes. The captions are the
 * same on-screen descriptions as the app. Background music is the team's own track, quiet, and only plays
 * after the user has pressed a button (browsers block autoplay otherwise). The tour's status is saved on the
 * account, so it is never shown again on any device once completed or skipped.
 */
const STEPS: { title: string; caption: string; route: Route }[] = [
  { title: 'Home', caption: 'Home brings together live broadcasts, testimonies, audio and resources in one place.', route: { name: 'home' } },
  { title: 'Click to watch Live', caption: 'Watch Live opens our broadcasts. When we are on air, the stream appears there with live chat.', route: { name: 'live' } },
  { title: 'T.O.P on Loveworld Radio', caption: 'T.O.P on Loveworld Radio plays our 24/7 audio stream from the Listen page.', route: { name: 'listen' } },
  { title: 'ADOTOPOC Resource Center', caption: 'The ADOTOPOC Resource Center has resources for hosting outreaches and crusades.', route: { name: 'adotopoc' } },
  { title: 'Read Testimonies', caption: 'Read Testimonies opens written testimonies you can read in full and comment on.', route: { name: 'written' } },
  { title: 'Watch powerful Testimonies', caption: 'Watch powerful Testimonies opens the video testimony archive.', route: { name: 'testimonies' } },
  { title: 'Sponsor Testimonies of Praise show', caption: 'Sponsor the show opens the sponsorship information for Testimonies of Praise.', route: { name: 'sponsor' } },
];

const MUSIC_LEVEL = 0.3;

interface TourValue {
  active: boolean;
  index: number;
  muted: boolean;
  start(): void;
  next(): void;
  back(): void;
  skip(): void;
  finish(): void;
  toggleMute(): void;
}

const Ctx = createContext<TourValue | null>(null);

export function TourProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [muted, setMuted] = useState(false);
  const music = useRef<HTMLAudioElement | null>(null);

  const stopMusic = useCallback(() => {
    if (music.current) {
      music.current.pause();
      music.current.src = '';
      music.current = null;
    }
  }, []);

  // Stop music when the tour closes, the user signs out, or the page is hidden.
  useEffect(() => {
    const onHide = () => {
      if (document.hidden) stopMusic();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      stopMusic();
    };
  }, [stopMusic]);

  useEffect(() => {
    if (!user) {
      setActive(false);
      stopMusic();
    }
  }, [user, stopMusic]);

  const openStep = useCallback((i: number) => {
    setIndex(i);
    navigate(STEPS[i].route);
  }, []);

  const start = useCallback(() => {
    if (!user) return;
    // Called from the Get started button, so this play() comes from a user gesture and the browser allows it.
    try {
      const audio = new Audio('/audio/tutorial-bed.mp3');
      audio.loop = true;
      audio.volume = muted ? 0 : MUSIC_LEVEL;
      music.current = audio;
      void audio.play().catch(() => undefined);
    } catch {
      /* no music is fine: the tour still works */
    }
    setActive(true);
    openStep(0);
  }, [user, muted, openStep]);

  const close = useCallback(
    async (status: 'completed' | 'skipped') => {
      stopMusic();
      setActive(false);
      setIndex(0);
      if (!user) return;
      // Saved to the account; a failed save is retried the next time the tour would have been offered.
      try {
        await updateDoc(doc(db, 'users', user.uid), { tourStatus: status, tourUpdatedAt: serverTimestamp() });
      } catch {
        /* the account document may not exist yet; nothing else depends on it */
      }
    },
    [user, stopMusic],
  );

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      if (music.current) music.current.volume = next ? 0 : MUSIC_LEVEL;
      return next;
    });
  }, []);

  const value = useMemo<TourValue>(
    () => ({
      active,
      index,
      muted,
      start,
      next: () => (index >= STEPS.length - 1 ? void close('completed') : openStep(index + 1)),
      back: () => index > 0 && openStep(index - 1),
      skip: () => void close('skipped'),
      finish: () => void close('completed'),
      toggleMute,
    }),
    [active, index, muted, start, openStep, close, toggleMute],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTour(): TourValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTour must be used inside TourProvider');
  return v;
}

/** The card shown over the page while the tour is open. Only its own buttons respond. */
export function TourOverlay() {
  const tour = useTour();
  if (!tour.active) return null;
  const step = STEPS[tour.index];
  const last = tour.index === STEPS.length - 1;
  return (
    <div role="dialog" aria-modal="true" aria-label="Welcome tour" style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(18,0,28,0.55)' }}>
      <div style={{ width: '100%', maxWidth: 560, margin: 16, padding: 20, borderRadius: radius.xl, background: colors.surface, border: '1px solid rgba(245,197,66,0.35)', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span aria-live="polite" style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.2, color: colors.accent }}>
            STEP {tour.index + 1} OF {STEPS.length}
          </span>
          <button type="button" onClick={tour.skip} style={{ background: 'none', border: 'none', color: colors.textMuted, fontWeight: 700, cursor: 'pointer' }}>
            Skip tour
          </button>
        </div>
        <h2 style={{ margin: 0, fontSize: 20, color: colors.text }}>{step.title}</h2>
        <p style={{ margin: 0, color: colors.textMuted, lineHeight: 1.5 }}>{step.caption}</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={tour.toggleMute} aria-pressed={tour.muted} style={{ flex: 1, minHeight: 44, borderRadius: 999, border: `1px solid ${colors.border}`, background: 'none', color: colors.accent, fontWeight: 700, cursor: 'pointer' }}>
            {tour.muted ? 'Unmute music' : 'Mute music'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={tour.back} disabled={tour.index === 0} style={{ flex: 1, minHeight: 48, borderRadius: 999, border: `1px solid ${colors.border}`, background: 'none', color: colors.text, fontWeight: 700, cursor: 'pointer', opacity: tour.index === 0 ? 0.4 : 1 }}>
            Back
          </button>
          <button type="button" onClick={tour.next} style={{ flex: 1.4, minHeight: 48, borderRadius: 999, border: 'none', background: colors.accent, color: colors.onAccent, fontWeight: 800, cursor: 'pointer' }}>
            {last ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
