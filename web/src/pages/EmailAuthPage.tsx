import React, { useState } from 'react';
import { CheckCircle, XCircle, Circle } from 'lucide-react';
import { colors, radius } from '../theme';
import { TopBar } from '../components/TopBar';
import { TextField } from '../components/TextField';
import { PrimaryButton } from '../components/PrimaryButton';
import { useAuth } from '../context/AuthContext';

interface Props {
  onBack: () => void;
  onForgotPassword: () => void;
}

const PASSWORD_RULES = [
  { id: 'len', label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { id: 'upper', label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { id: 'lower', label: 'One lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { id: 'num', label: 'One number', test: (p: string) => /\d/.test(p) },
  { id: 'special', label: 'One special character', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

export function EmailAuthPage({ onBack, onForgotPassword }: Props) {
  const { signInWithEmail, register } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const signup = mode === 'signup';
  const mismatch = signup && confirm.length > 0 && password !== confirm;

  const submit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSubmitted(true);
    setError(null);

    const emailTrim = email.trim();
    if (!emailTrim || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailTrim)) {
      return setError('Please enter a valid email address.');
    }

    if (signup) {
      if (!fullName.trim()) return setError('Please enter your full name.');
      const strong = PASSWORD_RULES.every((r) => r.test(password));
      if (!strong) return setError('Your password does not meet the requirements below.');
      if (password !== confirm) return setError('Passwords do not match.');
    } else if (!password) {
      return setError('Please enter your password.');
    }

    setBusy(true);
    try {
      if (signup) {
        await register(fullName, emailTrim, password);
      } else {
        await signInWithEmail(emailTrim, password);
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      const code = err?.code ?? '';
      if (code === 'auth/email-already-in-use') {
        setError('An account with this email already exists. Try signing in instead.');
      } else if (code === 'auth/wrong-password' || code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
        setError('Invalid email or password.');
      } else if (code === 'auth/too-many-requests') {
        setError('Too many attempts. Please wait a moment and try again.');
      } else {
        setError(err?.message ?? 'Unable to sign in. Please check your details.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', backgroundColor: colors.bg }}>
      <TopBar title={signup ? 'Create account' : 'Sign in'} onBack={onBack} />
      <div
        style={{
          flex: 1,
          padding: '20px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          maxWidth: '480px',
          margin: '0 auto',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {signup && (
            <TextField
              label="Full Name"
              value={fullName}
              onChange={setFullName}
              autoComplete="name"
            />
          )}

          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
          />

          <TextField
            label="Password"
            secure
            value={password}
            onChange={setPassword}
            autoComplete={signup ? 'new-password' : 'current-password'}
          />

          {signup ? (
            <>
              <TextField
                label="Confirm Password"
                secure
                value={confirm}
                onChange={setConfirm}
                error={mismatch ? 'Passwords do not match.' : undefined}
                autoComplete="new-password"
              />

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  padding: '14px',
                  borderRadius: radius.md,
                  backgroundColor: colors.surface,
                  border: `1px solid ${colors.border}`,
                }}
              >
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: '800',
                    letterSpacing: '1px',
                    color: colors.accent,
                    marginBottom: '4px',
                    textTransform: 'uppercase',
                  }}
                >
                  Password Requirements
                </span>
                {PASSWORD_RULES.map((r) => {
                  const ok = r.test(password);
                  return (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                      {ok ? (
                        <CheckCircle size={16} color={colors.success} />
                      ) : submitted ? (
                        <XCircle size={16} color={colors.danger} />
                      ) : (
                        <Circle size={16} color={colors.textMuted} />
                      )}
                      <span style={{ color: ok ? colors.text : colors.textMuted }}>{r.label}</span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={onForgotPassword}
                style={{
                  background: 'none',
                  border: 'none',
                  color: colors.accent,
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Forgot Password?
              </button>
            </div>
          )}

          {error && (
            <div style={{ fontSize: '13px', color: colors.danger, textAlign: 'center' }}>
              {error}
            </div>
          )}

          <div style={{ marginTop: '8px' }}>
            <PrimaryButton
              title={signup ? 'CREATE ACCOUNT' : 'SIGN IN'}
              onClick={() => submit()}
              loading={busy}
            />
          </div>
        </form>

        <div style={{ textAlign: 'center', marginTop: '12px' }}>
          <button
            type="button"
            onClick={() => {
              setMode(signup ? 'signin' : 'signup');
              setError(null);
              setSubmitted(false);
            }}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '14px',
              color: colors.textMuted,
              cursor: 'pointer',
              padding: '8px',
            }}
          >
            {signup ? 'Already have an account? ' : 'New here? '}
            <span style={{ color: colors.accent, fontWeight: '700' }}>
              {signup ? 'Sign in' : 'Create account'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
