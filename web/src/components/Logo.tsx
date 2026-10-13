import React from 'react';

export function Logo({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <img
      src="/logo.png"
      alt="Testimonies of Praise logo"
      width={size}
      height={size}
      className={className}
      style={{ objectFit: 'contain', width: `${size}px`, height: `${size}px`, display: 'inline-block' }}
    />
  );
}
