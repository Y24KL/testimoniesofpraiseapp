import React, { useEffect, useState } from 'react';
import { colors, radius } from '../theme';
import { TopBar } from '../components/TopBar';
import { PrimaryButton } from '../components/PrimaryButton';
import type { NotificationPrefs } from '../types';

interface Props {
  onBack: () => void;
}

const DEFAULT_PREFS: NotificationPrefs = {
  testimonies: true,
  live: true,
  announcements: true,
};

const ROWS: { key: keyof NotificationPrefs; label: string; hint: string }[] = [
  { key: 'testimonies', label: 'New Testimonies', hint: 'When a new testimony is published' },
  { key: 'live', label: 'Live Notifications', hint: 'When a live stream is starting' },
  { key: 'announcements', label: 'Important Announcements', hint: 'Featured content and church updates' },
];

export function NotificationSettingsPage({ onBack }: Props) {
  const [prefs, setPrefs] = useState<NotificationPrefs>(() => {
    try {
      const stored = localStorage.getItem('top:notification-prefs:v1');
      return stored ? JSON.parse(stored) : DEFAULT_PREFS;
    } catch {
      return DEFAULT_PREFS;
    }
  });

  const [perm, setPerm] = useState<NotificationPermission>('default');

  useEffect(() => {
    if ('Notification' in window) {
      setPerm(Notification.permission);
    }
  }, []);

  const toggle = (key: keyof NotificationPrefs) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    localStorage.setItem('top:notification-prefs:v1', JSON.stringify(next));
  };

  const requestPerm = async () => {
    if ('Notification' in window) {
      const p = await Notification.requestPermission();
      setPerm(p);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100dvh',
        backgroundColor: colors.bg,
        paddingBottom: 'calc(var(--sab, 0px) + 36px)',
        boxSizing: 'border-box',
      }}
    >
      <TopBar title="Notification preferences" onBack={onBack} />
      <div
        style={{
          flex: 1,
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {perm !== 'granted' && (
          <div
            style={{
              padding: '16px',
              borderRadius: radius.md,
              backgroundColor: colors.surface,
              border: `1px solid ${colors.danger}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <span style={{ fontSize: '14px', color: colors.text }}>
              Browser notifications are not yet enabled for this device.
            </span>
            <PrimaryButton title="ENABLE BROWSER NOTIFICATIONS" onClick={requestPerm} />
          </div>
        )}

        {ROWS.map((r) => (
          <div
            key={r.key}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px',
              borderRadius: radius.md,
              backgroundColor: colors.surface,
              border: `1px solid ${colors.border}`,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '15px', fontWeight: '700', color: colors.text }}>
                {r.label}
              </span>
              <span style={{ fontSize: '12px', color: colors.textMuted }}>
                {r.hint}
              </span>
            </div>
            <label
              style={{
                position: 'relative',
                display: 'inline-block',
                width: '46px',
                height: '26px',
                flexShrink: 0,
              }}
            >
              <input
                type="checkbox"
                checked={prefs[r.key]}
                onChange={() => toggle(r.key)}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span
                style={{
                  position: 'absolute',
                  cursor: 'pointer',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: prefs[r.key] ? colors.primaryLight : colors.border,
                  borderRadius: '13px',
                  transition: 'background-color 0.2s',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    content: '""',
                    height: '20px',
                    width: '20px',
                    left: prefs[r.key] ? '23px' : '3px',
                    bottom: '3px',
                    backgroundColor: prefs[r.key] ? colors.accent : colors.textMuted,
                    borderRadius: '50%',
                    transition: 'left 0.2s',
                  }}
                />
              </span>
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}
