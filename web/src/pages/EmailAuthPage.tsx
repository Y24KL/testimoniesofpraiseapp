import React, { useEffect, useState } from 'react';
import { AlertCircle, ChevronLeft, CheckCircle, Circle, XCircle } from 'lucide-react';
import { colors, radius } from '../theme';
import { Logo } from '../components/Logo';
import { TextField } from '../components/TextField';
import { GoogleIcon } from '../components/GoogleIcon';
import { TitlePicker } from '../components/TitlePicker';
import { validateProfile, type ProfileTitle, type ValidProfile } from '../profile/validation';
import { useAuth } from '../context/AuthContext';
import { emailAuthMessage, googleErrorMessage } from '../utils/authErrors';

interface Props {
  mode: 'signin' | 'signup';
  onModeChange: (mode: 'signin' | 'signup') => void;
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

export function EmailAuthPage({ mode, onModeChange, onBack, onForgotPassword }: Props) {
  const { signInWithEmail, register, signInWithGoogle } = useAuth();
  const [fullName, setFullName] = useState('');
  const [title, setTitle] = useState('');
  const [zone, setZone] = useState('');
  const [church, setChurch] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const signup = mode === 'signup';
  const mismatch = signup && confirm.length > 0 && password !== confirm;
  // Inline profile errors appear after the first submit attempt.
  const signupCheck = signup && submitted ? validateProfile({ title, fullName, zone, church }) : null;
  const signupErrors = signupCheck && !signupCheck.ok ? signupCheck.errors : {};

  useEffect(() => {
    setError(null);
    setSubmitted(false);
  }, [mode]);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    setSubmitted(true);
    setError(null);

    const emailTrim = email.trim();
    let profile: ValidProfile | undefined;
    if (!emailTrim || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailTrim)) return setError('Please enter a valid email address.');
    if (signup) {
      // Checked before the account exists, so nothing incomplete is created.
      const checked = validateProfile({ title, fullName, zone, church });
      if (!checked.ok) return setError(Object.values(checked.errors)[0] ?? 'Check your details.');
      profile = checked.value;
      if (!PASSWORD_RULES.every((r) => r.test(password))) return setError('Your password does not meet the requirements below.');
      if (password !== confirm) return setError('Passwords do not match.');
    } else if (!password) {
      return setError('Please enter your password.');
    }

    setBusy(true);
    try {
      if (signup) await register(fullName, emailTrim, password, profile);
      else await signInWithEmail(emailTrim, password);
    } catch (err) {
      if (import.meta.env.DEV) console.error('Auth error:', err);
      setError(emailAuthMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setError(null);
    setGoogleBusy(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      const msg = googleErrorMessage(err);
      if (msg) setError(msg);
    } finally {
      setGoogleBusy(false);
    }
  };

  return (
    <div className="auth">
      <div className="auth-card">
        <div>
          <button type="button" className="icon-btn" onClick={onBack} aria-label="Go back">
            <ChevronLeft size={22} />
          </button>
        </div>
        <div className="auth-head">
          <Logo size={56} />
          <h1>{signup ? 'Create your account' : 'Welcome back'}</h1>
          <p>{signup ? 'Join the family and never miss a testimony.' : 'Sign in to continue to Testimonies of Praise.'}</p>
        </div>

        <div className="segment" role="tablist" aria-label="Sign in or create account">
          <button type="button" role="tab" aria-selected={!signup} onClick={() => onModeChange('signin')}>
            Sign in
          </button>
          <button type="button" role="tab" aria-selected={signup} onClick={() => onModeChange('signup')}>
            Create account
          </button>
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} noValidate>
          {signup && <TextField label="Full name" value={fullName} onChange={setFullName} autoComplete="name" error={signupErrors.fullName} />}
          {signup && <TitlePicker value={title} onChange={(t: ProfileTitle) => setTitle(t)} error={signupErrors.title} />}
          {signup && <TextField label="Zone" value={zone} onChange={setZone} placeholder="e.g. Lagos Zone 1" error={signupErrors.zone} />}
          {signup && <TextField label="Church" value={church} onChange={setChurch} placeholder="e.g. Christ Embassy Lagos" error={signupErrors.church} />}
          <TextField label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
          <TextField label="Password" secure value={password} onChange={setPassword} autoComplete={signup ? 'new-password' : 'current-password'} />

          {signup ? (
            <>
              <TextField
                label="Confirm password"
                secure
                value={confirm}
                onChange={setConfirm}
                error={mismatch ? 'Passwords do not match.' : undefined}
                autoComplete="new-password"
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '14px', borderRadius: radius.md, backgroundColor: colors.surface, border: `1px solid ${colors.borderSoft}` }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: colors.accent, marginBottom: '4px' }}>Password requirements</span>
                {PASSWORD_RULES.map((r) => {
                  const ok = r.test(password);
                  return (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                      {ok ? <CheckCircle size={16} color={colors.success} /> : submitted ? <XCircle size={16} color={colors.danger} /> : <Circle size={16} color={colors.textSubtle} />}
                      <span style={{ color: ok ? colors.text : colors.textMuted }}>{r.label}</span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-6px' }}>
              <button type="button" className="link-btn" onClick={onForgotPassword}>
                Forgot password?
              </button>
            </div>
          )}

          {error && (
            <div className="err-box" role="alert">
              <AlertCircle size={18} color={colors.danger} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" className="btn btn-gold btn-block" disabled={busy} aria-busy={busy}>
            {busy ? <span className="spinner" /> : null}
            {signup ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <div className="divider">or</div>
        <button type="button" className="btn btn-white btn-block" onClick={google} disabled={googleBusy} aria-busy={googleBusy}>
          {googleBusy ? <span className="spinner light" /> : <GoogleIcon />}
          Continue with Google
        </button>
      </div>
    </div>
  );
}
