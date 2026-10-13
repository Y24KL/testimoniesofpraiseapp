import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnline } from '../hooks/useOnline';
import { colors } from '../theme';

export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;

  return (
    <div
      style={{
        backgroundColor: colors.danger,
        color: '#FFFFFF',
        padding: '6px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        fontSize: '11px',
        fontWeight: '800',
        letterSpacing: '0.8px',
        textTransform: 'uppercase',
        zIndex: 40,
        position: 'sticky',
        top: 0,
      }}
      role="status"
    >
      <WifiOff size={14} />
      <span>YOU'RE OFFLINE — SAVED DOWNLOADS ARE STILL PLAYABLE</span>
    </div>
  );
}
