import React from 'react';
import { radius } from '../theme';

interface Props {
  videoId: string;
  label?: string;
}

export function YouTubePlayer({ videoId, label = 'YouTube Video' }: Props) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '16 / 9',
        backgroundColor: '#000',
        borderRadius: radius.md,
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      <iframe
        src={`https://www.youtube.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1`}
        title={label}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          border: 'none',
        }}
      />
    </div>
  );
}
