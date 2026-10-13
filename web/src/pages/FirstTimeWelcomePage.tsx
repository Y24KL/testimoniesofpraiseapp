import React from 'react';
import { PlayCircle, Radio, Heart } from 'lucide-react';
import { colors, gradients } from '../theme';
import { Logo } from '../components/Logo';
import { PrimaryButton } from '../components/PrimaryButton';
import { useAuth } from '../context/AuthContext';

interface Props {
  onDone: () => void;
}

export function FirstTimeWelcomePage({ onDone }: Props) {
  const { user, clearNewAccount } = useAuth();

  const handleDone = () => {
    clearNewAccount();
    onDone();
  };

  const displayName = user?.displayName ? user.displayName.split(' ')[0] : '';

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
          gap: '16px',
          textAlign: 'center',
        }}
      >
        <Logo size={110} />
        <h1
          style={{
            fontSize: '26px',
            fontWeight: '800',
            color: colors.accent,
            margin: '10px 0 0 0',
          }}
        >
          Welcome{displayName ? `, ${displayName}` : ''}!
        </h1>
        <p
          style={{
            fontSize: '15px',
            color: colors.textMuted,
            margin: '0 0 12px 0',
            maxWidth: '340px',
            lineHeight: '1.4',
          }}
        >
          We're glad you're here. Every testimony has a story, and we can't wait to hear yours.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '340px', textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <PlayCircle size={22} color={colors.accent} />
            <span style={{ fontSize: '15px', color: colors.text }}>
              Watch and be encouraged by others' testimonies
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Radio size={22} color={colors.accent} />
            <span style={{ fontSize: '15px', color: colors.text }}>
              Join live services as they happen
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Heart size={22} color={colors.accent} />
            <span style={{ fontSize: '15px', color: colors.text }}>
              Share what God has done for you
            </span>
          </div>
        </div>
      </div>

      <div style={{ width: '100%', maxWidth: '400px', margin: '0 auto' }}>
        <PrimaryButton title="GET STARTED" onClick={handleDone} />
      </div>
    </div>
  );
}
