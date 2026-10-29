import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEvent, useEventListener } from 'expo';
import { useVideoPlayer, type VideoSource } from 'expo-video';
import { useAuth } from '@/auth/AuthContext';
import { useAudioPlayer } from '@/audio/AudioPlayerContext';
import { VOICEOVERS, type VoiceoverId } from './manifest';
import { captionFor, decidePlay } from './logic';
import { TUTORIAL_STEPS } from './tutorial';

const ENABLED_KEY = 'top:voiceover-enabled';
const tutorialDoneKey = (uid: string) => `top:tutorial-finished:${uid}`;

export interface VoiceoverNotice {
  id: VoiceoverId;
  /** Text to show when no audio is available for this narration (never blocks the screen). */
  text: string | null;
}

interface TutorialState {
  active: boolean;
  index: number;
}

interface VoiceoverValue {
  /** Voice guidance on/off (the "mute" setting). Persisted on this device. */
  enabled: boolean;
  setEnabled(on: boolean): void;
  /** The narration playing right now, if any. */
  playing: VoiceoverId | null;
  /** Shown when an intentional narration had no approved audio, so the text still reaches the user. */
  notice: VoiceoverNotice | null;
  /** Starts a narration for an intentional action. Safe to call from effects: duplicates are ignored. */
  play(id: VoiceoverId): void;
  stop(): void;
  replay(): void;
  tutorial: TutorialState;
  startTutorial(): void;
  nextStep(): void;
  previousStep(): void;
  skipTutorial(): void;
  finishTutorial(): void;
}

const Ctx = createContext<VoiceoverValue | null>(null);

/**
 * Voice guidance for the whole app. It uses its own audio player, so narration never shares a player
 * with TOP Radio or testimony audio, and it only starts while that audio is idle (see decidePlay).
 * Narration stops on sign-out, when the app leaves the foreground, and when the tutorial ends.
 */
export function VoiceoverProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const main = useAudioPlayer();
  const player = useVideoPlayer(null as unknown as VideoSource, (p) => {
    p.audioMixingMode = 'duckOthers';
    p.staysActiveInBackground = false;
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });

  const [enabled, setEnabledState] = useState(true);
  const [playing, setPlaying] = useState<VoiceoverId | null>(null);
  const [notice, setNotice] = useState<VoiceoverNotice | null>(null);
  const [tutorial, setTutorial] = useState<TutorialState>({ active: false, index: 0 });

  // Refs let the playback code read the latest values without re-creating callbacks on every render.
  const enabledRef = useRef(enabled);
  const playingRef = useRef<VoiceoverId | null>(null);
  const tutorialRef = useRef(tutorial);
  const mainBusyRef = useRef(false);
  enabledRef.current = enabled;
  tutorialRef.current = tutorial;
  mainBusyRef.current = main.status === 'playing' || main.status === 'loading' || main.status === 'reconnecting';

  useEffect(() => {
    AsyncStorage.getItem(ENABLED_KEY)
      .then((v) => {
        if (v === 'false') setEnabledState(false);
      })
      .catch(() => undefined);
  }, []);

  const stopNow = useCallback(() => {
    try {
      player.pause();
    } catch {
      /* the player may already be released; nothing left to stop */
    }
    playingRef.current = null;
    setPlaying(null);
  }, [player]);

  const setEnabled = useCallback(
    (on: boolean) => {
      setEnabledState(on);
      enabledRef.current = on;
      AsyncStorage.setItem(ENABLED_KEY, on ? 'true' : 'false').catch(() => undefined);
      if (!on) stopNow();
    },
    [stopNow],
  );

  const play = useCallback(
    (id: VoiceoverId) => {
      const entry = VOICEOVERS[id];
      const decision = decidePlay(entry, {
        enabled: enabledRef.current,
        currentlyPlaying: playingRef.current,
        tutorialActive: tutorialRef.current.active,
        mainAudioBusy: mainBusyRef.current,
      });
      if (decision.action === 'skip') {
        if (decision.reason === 'no-audio') setNotice({ id, text: captionFor(entry) });
        return;
      }
      setNotice(null);
      try {
        player.replace(decision.url);
        player.play();
        playingRef.current = id;
        setPlaying(id);
      } catch {
        // Playback problems must never block the screen: the notice keeps the text available.
        setNotice({ id, text: captionFor(entry) });
      }
    },
    [player],
  );

  const stop = useCallback(() => stopNow(), [stopNow]);

  const replay = useCallback(() => {
    if (playingRef.current) return;
    const id = notice?.id ?? playingRef.current;
    if (id) play(id);
  }, [notice, play]);

  // Playback finished on its own.
  useEventListener(player, 'playToEnd', () => {
    playingRef.current = null;
    setPlaying(null);
  });
  // A failed file must not leave the UI thinking it's playing.
  useEffect(() => {
    if (status === 'error' && playingRef.current) {
      const id = playingRef.current;
      stopNow();
      setNotice({ id, text: captionFor(VOICEOVERS[id]) });
    }
  }, [status, stopNow]);

  // Sign-out or a different account: nothing from the previous session keeps talking.
  const uid = user?.uid ?? null;
  useEffect(() => {
    stopNow();
    setTutorial({ active: false, index: 0 });
  }, [uid, stopNow]);

  // Leaving the foreground stops narration (TOP Radio and testimony audio keep their own rules).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') stopNow();
    });
    return () => sub.remove();
  }, [stopNow]);

  // Tutorial controls. Each step's narration starts only from a deliberate Next/Back/Start action.
  const playStep = useCallback(
    (index: number) => {
      const step = TUTORIAL_STEPS[index];
      if (step) play(step.voice);
    },
    [play],
  );

  const startTutorial = useCallback(() => {
    if (!uid) return;
    // A finished tour is not restarted automatically; only the explicit replay or a new account starts it.
    setTutorial({ active: true, index: 0 });
    tutorialRef.current = { active: true, index: 0 };
    playStep(0);
  }, [uid, playStep]);

  const goTo = useCallback(
    (index: number) => {
      const next = Math.max(0, Math.min(TUTORIAL_STEPS.length - 1, index));
      setTutorial({ active: true, index: next });
      tutorialRef.current = { active: true, index: next };
      stopNow();
      playStep(next);
    },
    [playStep, stopNow],
  );

  const endTutorial = useCallback(
    (persist: boolean) => {
      stopNow();
      setTutorial({ active: false, index: 0 });
      tutorialRef.current = { active: false, index: 0 };
      if (persist && uid) AsyncStorage.setItem(tutorialDoneKey(uid), 'true').catch(() => undefined);
    },
    [stopNow, uid],
  );

  const value = useMemo<VoiceoverValue>(
    () => ({
      enabled,
      setEnabled,
      playing,
      notice,
      play,
      stop,
      replay,
      tutorial,
      startTutorial,
      nextStep: () => goTo(tutorialRef.current.index + 1),
      previousStep: () => goTo(tutorialRef.current.index - 1),
      skipTutorial: () => endTutorial(true),
      finishTutorial: () => endTutorial(true),
    }),
    [enabled, setEnabled, playing, notice, play, stop, replay, tutorial, startTutorial, goTo, endTutorial],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useVoiceover(): VoiceoverValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useVoiceover must be used inside VoiceoverProvider');
  return v;
}
