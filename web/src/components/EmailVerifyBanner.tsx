import React, { useState } from 'react';
import { Mail } from 'lucide-react';
import { colors, radius } from '../theme';
import { useAuth } from '../context/AuthContext';

export function EmailVerifyBanner() {
  const { user, needsEmailVerification, refreshEmailVerified, resendVerificationEmail } = useAuth();
  const [busy, setBusy] = useState<'resend' | 'refresh' | null>(null);
  const [msg, setMsg] = useState('');

  if (!needsEmailVerification || !user) return null;

  const resend = async () => {
    setBusy('resend');
    setMsg('');
    try {
      await resendVerificationEmail();
      setMsg(`Verification email sent to ${user.email}.`);
    } catch {
      setMsg('Could not send the email. Try again shortly.');
    }
    setBusy(null);
  };

  const refresh = async () => {
    setBusy('refresh');
    setMsg('');
    await refreshEmailVerified();
    setBusy(null);
  };

  return (
    <div
      style={{
        margin: '16px 16px 0 16px',
        padding: '14px',
        borderRadius: radius.md,
        backgroundColor: colors.surface,
        border: `1px solid ${colors.accent}`,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        boxSizing: 'border-box',
      }}
      role="alert"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Mail size={18} color={colors.accent} />
        <span style={{ fontSize: '14px', fontWeight: '700', color: colors.text }}>
          Please verify your email
        </span>
      </div>
      <p style={{ fontSize: '13px', color: colors.textMuted, margin: 0, lineHeight: '1.4' }}>
        We sent a verification link to {user.email}. Tap it, then come back and click "I've verified".
      </p>
      {msg && <p style={{ fontSize: '13px', color: colors.accent, margin: 0 }}>{msg}</p>}
      <div style={{ display: 'flex', gap: '20px', marginTop: '2px' }}>
        <button
          type="button"
          onClick={busy ? undefined : refresh}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '13px',
            fontWeight: '700',
            color: colors.accent,
            cursor: 'pointer',
            padding: 0,
          }}
        >
          {busy === 'refresh' ? 'Checking…' : "I've verified"}
        </button>
        <button
          type="button"
          onClick={busy ? undefined : resend}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '13px',
            fontWeight: '700',
            color: colors.textMuted,
            cursor: 'pointer',
            padding: 0,
          }}
        >
          {busy === 'resend' ? 'Sending…' : 'Resend email'}
        </button>
      </div>
    </div>
  );
}
