import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { VoiceoverId } from './manifest';
import { useVoiceover } from './VoiceoverProvider';

/**
 * Plays a feature's narration each time the user deliberately opens that screen.
 * useFocusEffect runs when the screen gains focus (a tap or navigation), not on every re-render,
 * so the same visit never plays twice and an auth callback or state restore doesn't replay it.
 */
export function useFeatureVoiceover(id: VoiceoverId) {
  const { play } = useVoiceover();
  useFocusEffect(
    useCallback(() => {
      play(id);
    }, [id, play]),
  );
}
