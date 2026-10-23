import React, { useState } from 'react';
import { Bell } from 'lucide-react';
import { colors, gradients } from '../theme';
import { PrimaryButton } from '../components/PrimaryButton';

interface Props {
  onDone: () => void;
}

export function NotificationPrimerPage({ onDone }: Props) {
  const [busy, setBusy] = useState(false);

  const enable = async () => {
    setBusy(true);
    try {
      if ('Notification' in window) {
        await Notification.requestPermission();
      }
    } finally {
      localStorage.setItem('top:notification-primer-seen:v1', 'true');
      setBusy(false);
      onDone();
    }
  };

  const skip = () => {
    localStorage.setItem('top:notification-primer-seen:v1', 'true');
    onDone();
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
          gap: '16px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '96px',
            height: '96px',
            borderRadius: '48px',
            backgroundColor: colors.primary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `1.5px solid ${colors.accent}`,
          }}
        >
          <Bell size={46} color={colors.accent} />
        </div>
        <h1
          style={{
            fontSize: '24px',
            fontWeight: '700',
            color: colors.text,
            margin: '8px 0 0 0',
          }}
        >
          Stay connected with Testimonies of Praise.
        </h1>
        <p
          style={{
            fontSize: '15px',
            color: colors.textMuted,
            margin: 0,
            maxWidth: '320px',
            lineHeight: '1.4',
          }}
        >
          Receive alerts when new testimonies, videos, live broadcasts, and special announcements are published.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '400px', margin: '0 auto' }}>
        <PrimaryButton
          title="Turn on notifications"
          icon={<Bell size={18} />}
          onClick={enable}
          loading={busy}
        />
        <PrimaryButton
          title="Not now"
          variant="ghost"
          onClick={skip}
          disabled={busy}
        />
      </div>
    </div>
  );
}
