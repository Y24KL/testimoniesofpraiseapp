import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors } from '../theme';

const RESEND_SECONDS = 45;

/**
 * Shown after sign-up or sign-in until this browser enters the 6-digit code emailed to the account.
 * The same check as the app: once verified, this browser is trusted and the code is not asked again.
 */
export function VerifyCodePage() {
  const { verificationEmail, codeError, verifyCode, resendCode, signOut } = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);
  const submitting = useRef(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (submitting.current) return;
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      await verifyCode(code);
      // On success the app moves on by itself: this screen is no longer shown.
    } catch (err) {
      setError((err as Error).message || 'That code did not work. Try again.');
      setBusy(false);
      submitting.current = false;
    }
  };

  const resend = async () => {
    if (cooldown > 0 || busy) return;
    setError(null);
    setCode('');
    await resendCode();
    setCooldown(RESEND_SECONDS);
  };

  const shown = error ?? codeError;

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="auth-head">
          <h1>Check your email</h1>
          <p>Enter the 6-digit code we sent to {verificationEmail ?? 'your email'}.</p>
        </div>

        <form onSubmit={submit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            disabled={busy}
            aria-label="6-digit code"
            placeholder="000000"
            style={{
              textAlign: 'center',
              fontSize: '28px',
              fontWeight: 700,
              letterSpacing: '10px',
              padding: '14px',
              borderRadius: '14px',
              border: `1px solid ${colors.border}`,
              background: colors.surface,
              color: colors.text,
              fontFamily: 'inherit',
            }}
          />

          {shown ? (
            <div className="err-box" role="alert">
              <span>{shown}</span>
            </div>
          ) : null}

          <PrimaryButton title="Verify" onClick={() => void submit()} loading={busy} disabled={busy || code.length !== 6} />
        </form>

        <button
          type="button"
          onClick={() => void resend()}
          disabled={cooldown > 0 || busy}
          style={{ alignSelf: 'center', background: 'none', border: 'none', color: colors.accent, fontWeight: 700, cursor: cooldown > 0 ? 'default' : 'pointer', opacity: cooldown > 0 ? 0.6 : 1 }}
        >
          {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
        </button>

        <button type="button" className="onb-signin" onClick={() => void signOut()} disabled={busy} style={{ alignSelf: 'center' }}>
          Not you? <b>Sign out</b>
        </button>
      </div>
    </div>
  );
}
