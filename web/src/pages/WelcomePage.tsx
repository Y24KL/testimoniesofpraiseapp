import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Logo } from '../components/Logo';
import { OnboardingBackdrop, useOnboardingMedia } from '../components/OnboardingBackdrop';
import { KingsChatSignInError, startKingsChatLogin } from '../api/kingschatAuth';

interface Props {
  onGetStarted: () => void;
  onSignIn: () => void;
}

const FEATURES = ['Live broadcasts', 'Video testimonies', 'TOP Radio', 'Offline downloads'];

export function WelcomePage({ onGetStarted, onSignIn }: Props) {
  const media = useOnboardingMedia();
  const [kingsChatBusy, setKingsChatBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Leaves the site for KingsChat's login page; the page stays busy until the browser navigates away.
  const handleKingsChat = async () => {
    setError(null);
    setKingsChatBusy(true);
    try {
      await startKingsChatLogin();
    } catch (e) {
      setError(e instanceof KingsChatSignInError ? e.message : 'KingsChat sign-in didn’t finish. Try again.');
      setKingsChatBusy(false);
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
          <p className="onb-quote">“Nobody ever praised God and went away empty, He always blesses you for praising Him.”</p>
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
          <button type="button" className="btn btn-white btn-block" onClick={handleKingsChat} disabled={kingsChatBusy} aria-busy={kingsChatBusy}>
            {kingsChatBusy ? <span className="spinner light" /> : null}
            Continue with KingsChat
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
