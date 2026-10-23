import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Logo } from '../components/Logo';
import { OnboardingBackdrop, useOnboardingMedia } from '../components/OnboardingBackdrop';
import { GoogleIcon } from '../components/GoogleIcon';
import { useAuth } from '../context/AuthContext';
import { googleErrorMessage } from '../utils/authErrors';

interface Props {
  onGetStarted: () => void;
  onSignIn: () => void;
}

const FEATURES = ['Live broadcasts', 'Video testimonies', 'TOP Radio', 'Offline downloads'];

export function WelcomePage({ onGetStarted, onSignIn }: Props) {
  const { signInWithGoogle } = useAuth();
  const media = useOnboardingMedia();
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogle = async () => {
    setError(null);
    setGoogleBusy(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      const msg = googleErrorMessage(e);
      if (msg) setError(msg);
    } finally {
      setGoogleBusy(false);
    }
  };

  return (
    <div className="onb">
      <OnboardingBackdrop media={media} />
      <div className="onb-content">
        <div className="onb-top">
          <Logo size={media.type === 'none' ? 96 : 56} />
        </div>

        <div className="onb-copy">
          <span className="onb-eyebrow">WELCOME TO</span>
          <h1 className="onb-title">
            Testimonies
            <br />
            of Praise
          </h1>
          <p className="onb-quote">“No one ever praises God and goes away empty, He always blesses you for praising Him.”</p>
          <span className="onb-attr">Rev. Chris Oyakhilome DSc. DSc. DD</span>
          <div className="chips">
            {FEATURES.map((f) => (
              <span key={f} className="chip">
                {f}
              </span>
            ))}
          </div>
        </div>

        <div className="onb-actions">
          <button type="button" className="btn btn-gold btn-block" onClick={onGetStarted}>
            Get started <ArrowRight size={18} />
          </button>
          <button type="button" className="btn btn-white btn-block" onClick={handleGoogle} disabled={googleBusy} aria-busy={googleBusy}>
            {googleBusy ? <span className="spinner light" /> : <GoogleIcon />}
            Continue with Google
          </button>
          <button type="button" className="onb-signin" onClick={onSignIn}>
            Already have an account? <b>Sign in</b>
          </button>
          {error ? (
            <div className="err-box" role="alert">
              {error}
            </div>
          ) : null}
          <p className="onb-legal">By continuing you agree to the Terms of Service and Privacy Policy.</p>
        </div>
      </div>
    </div>
  );
}
