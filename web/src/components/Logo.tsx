import React from 'react';

const ASPECT = 600 / 431;

/** Official badge. `size` is the height; width follows the badge's aspect ratio. WebP (~90 KB) with PNG fallback. */
export function Logo({ size = 40, className = '' }: { size?: number; className?: string }) {
  const width = Math.round(size * ASPECT);
  return (
    <picture className={className} style={{ display: 'inline-flex', flexShrink: 0 }}>
      <source srcSet="/logo.webp" type="image/webp" />
      <img
        src="/logo.png"
        alt="Testimonies of Praise"
        width={width}
        height={size}
        decoding="async"
        style={{ objectFit: 'contain', width: `${width}px`, height: `${size}px`, display: 'block' }}
      />
    </picture>
  );
}
