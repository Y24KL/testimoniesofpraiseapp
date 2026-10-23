import type { AudioTestimony, RadioConfig } from '../types';
import type { AudioTrack } from './AudioPlayerContext';

export const radioTrack = (cfg: RadioConfig): AudioTrack => ({
  id: `radio:${cfg.sessionId ?? 'stream'}`,
  url: cfg.streamUrl,
  title: cfg.currentProgramme || 'TOP Radio',
  artist: 'TOP Radio · Live',
  live: true,
  sessionId: cfg.sessionId,
});

export const audioTrack = (a: AudioTestimony): AudioTrack => ({
  id: `audio:${a.id}`,
  url: a.audioUrl,
  title: a.title,
  artist: a.speaker || 'Audio testimony',
  artwork: a.thumbnailUrl,
});
