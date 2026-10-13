import React, { useState } from 'react';
import { colors } from '../theme';
import { TopBar } from '../components/TopBar';
import { TextField } from '../components/TextField';
import { PrimaryButton } from '../components/PrimaryButton';
import { useAuth } from '../context/AuthContext';

interface Props {
  onBack: () => void;
}

export function ForgotPasswordPage({ onBack }: Props) {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const emailTrim = email.trim();
    if (!emailTrim || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailTrim)) {
      return setError('Please enter a valid email address.');
    }
    setBusy(true);
    setError(null);
    try {
      await resetPassword(emailTrim);
    } catch {
      // Deliberately ignored to prevent revealing whether the account exists
    } finally {
      setBusy(false);
      setSent(true);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', backgroundColor: colors.bg }}>
      <TopBar title="Reset password" onBack={onBack} />
      <div
        style={{
          flex: 1,
          padding: '24px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          maxWidth: '480px',
          margin: '0 auto',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {sent ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'center', marginTop: '20px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: '700', color: colors.text, margin: 0 }}>
              Check your email
            </h2>
            <p style={{ fontSize: '15px', color: colors.textMuted, margin: 0, lineHeight: '1.4' }}>
              If an account exists for {email.trim()}, we’ve sent a link to reset your password.
            </p>
            <div style={{ marginTop: '16px' }}>
              <PrimaryButton title="BACK TO SIGN IN" onClick={onBack} />
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ fontSize: '15px', color: colors.textMuted, margin: 0, lineHeight: '1.4' }}>
              Enter the email you used to sign up and we’ll send you a link to reset your password.
            </p>
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="your@email.com"
            />
            {error && (
              <span style={{ fontSize: '13px', color: colors.danger, textAlign: 'center' }}>
                {error}
              </span>
            )}
            <div style={{ marginTop: '8px' }}>
              <PrimaryButton title="SEND RESET LINK" onClick={submit} loading={busy} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
