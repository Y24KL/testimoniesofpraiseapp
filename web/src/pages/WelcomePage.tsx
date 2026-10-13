import React, { useState } from 'react';
import { Mail } from 'lucide-react';
import { colors, gradients } from '../theme';
import { Logo } from '../components/Logo';
import { PrimaryButton } from '../components/PrimaryButton';
import { useAuth } from '../context/AuthContext';

interface Props {
  onGoToEmail: () => void;
}

export function WelcomePage({ onGoToEmail }: Props) {
  const { signInWithGoogle } = useAuth();
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogle = async () => {
    setError(null);
    setGoogleBusy(true);
    try {
      await signInWithGoogle();
    } catch (e: any) {
      console.error('Google sign in error:', e);
      if (e?.code !== 'auth/popup-closed-by-user') {
        setError('Could not sign in with Google. Please try again or use email.');
      }
    } finally {
      setGoogleBusy(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100dvh',
        background: gradients.hero,
        padding: '24px',
        paddingTop: 'calc(var(--sat, 0px) + 24px)',
        paddingBottom: 'calc(var(--sab, 0px) + 24px)',
        justifyContent: 'space-between',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          textAlign: 'center',
        }}
      >
        <Logo size={110} />
        <span
          style={{
            fontSize: '12px',
            fontWeight: '800',
            letterSpacing: '4px',
            color: colors.textMuted,
            marginTop: '18px',
            textTransform: 'uppercase',
          }}
        >
          WELCOME TO
        </span>
        <h1
          style={{
            fontSize: '26px',
            fontWeight: '800',
            letterSpacing: '1.5px',
            color: colors.accent,
            margin: 0,
            textTransform: 'uppercase',
          }}
        >
          TESTIMONIES OF PRAISE
        </h1>
        <p
          style={{
            fontSize: '15px',
            color: colors.textMuted,
            margin: '6px 0 0 0',
          }}
        >
         Nobody praises God and goes away empty, he always blesses you for praising him.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
        {/* Google Sign In Button */}
        <button
          type="button"
          onClick={handleGoogle}
          disabled={googleBusy}
          className="touch-btn"
          style={{
            minHeight: '50px',
            borderRadius: '999px',
            backgroundColor: '#FFFFFF',
            border: 'none',
            color: '#1F1F1F',
            fontSize: '14px',
            fontWeight: '700',
            letterSpacing: '0.6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            cursor: googleBusy ? 'default' : 'pointer',
            opacity: googleBusy ? 0.7 : 1,
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.15z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.15C3.26 21.36 7.33 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.24C.45 8.15 0 9.92 0 12s.45 3.85 1.24 5.42l4.04-3.15z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.24 6.58l4.04 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
            />
          </svg>
          <span>CONTINUE WITH GOOGLE</span>
        </button>

        <PrimaryButton
          title="CONTINUE WITH EMAIL"
          variant="outline"
          icon={<Mail size={18} />}
          onClick={onGoToEmail}
        />

        {error && (
          <span style={{ fontSize: '13px', color: colors.danger, textAlign: 'center' }}>
            {error}
          </span>
        )}

        <p
          style={{
            fontSize: '11px',
            color: colors.textMuted,
            textAlign: 'center',
            margin: '4px 0 0 0',
            lineHeight: '1.4',
          }}
        >
          By continuing you agree to the Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
