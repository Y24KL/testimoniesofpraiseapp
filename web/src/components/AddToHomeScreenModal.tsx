import React, { useEffect, useState } from 'react';
import { Share, PlusSquare, X } from 'lucide-react';
import { colors, radius } from '../theme';
import { Logo } from './Logo';

export function AddToHomeScreenModal() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Check if on iOS
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    // Check if running in standalone PWA mode
    const isStandalone = (window.navigator as any).standalone === true || window.matchMedia('(display-mode: standalone)').matches;
    const dismissed = localStorage.getItem('top:a2hs-dismissed') === 'true';

    if (isIos && !isStandalone && !dismissed) {
      // Delay prompt slightly so user gets initial context first
      const timer = setTimeout(() => setShow(true), 3500);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismiss = (forever = false) => {
    if (forever) {
      localStorage.setItem('top:a2hs-dismissed', 'true');
    }
    setShow(false);
  };

  if (!show) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 'calc(var(--sab, 0px) + 70px)',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'calc(100% - 32px)',
        maxWidth: '440px',
        backgroundColor: colors.surface,
        border: `1.5px solid ${colors.accent}`,
        borderRadius: radius.lg,
        padding: '16px',
        zIndex: 50,
        boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        animation: 'slideUp 0.3s ease-out',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Logo size={28} />
          <span style={{ fontSize: '15px', fontWeight: '700', color: colors.text }}>
            Install on your iPhone
          </span>
        </div>
        <button
          type="button"
          onClick={() => dismiss(false)}
          aria-label="Close"
          style={{ background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer', padding: '4px' }}
        >
          <X size={18} />
        </button>
      </div>

      <p style={{ fontSize: '13px', color: colors.textMuted, margin: 0, lineHeight: '1.4' }}>
        Get the full-screen app experience, offline testimonies, and instant launch from your Home Screen:
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: colors.card, padding: '10px 12px', borderRadius: radius.md }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: colors.text }}>
          <Share size={18} color={colors.accent} />
          <span>1. Tap the <strong>Share</strong> button in Safari's bottom toolbar</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: colors.text }}>
          <PlusSquare size={18} color={colors.accent} />
          <span>2. Scroll down and tap <strong>Add to Home Screen</strong></span>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '2px' }}>
        <button
          type="button"
          onClick={() => dismiss(true)}
          style={{
            background: 'none',
            border: 'none',
            color: colors.textMuted,
            fontSize: '12px',
            cursor: 'pointer',
            padding: '6px 8px',
          }}
        >
          Don't show again
        </button>
        <button
          type="button"
          onClick={() => dismiss(false)}
          style={{
            backgroundColor: colors.accent,
            color: colors.bg,
            border: 'none',
            borderRadius: radius.pill,
            padding: '6px 14px',
            fontSize: '12px',
            fontWeight: '700',
            cursor: 'pointer',
          }}
        >
          Got it
        </button>
      </div>
    </div>
  );
}
