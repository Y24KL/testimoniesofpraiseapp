import React from 'react';
import { Sparkles } from 'lucide-react';
import { colors } from '../theme';

interface Props {
  icon?: React.ReactNode;
  title: string;
  message?: string;
  children?: React.ReactNode;
}

export function EmptyState({
  icon = <Sparkles size={40} color={colors.primaryLight} />,
  title,
  message,
  children,
}: Props) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '36px 20px',
        gap: '12px',
        textAlign: 'center',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </div>
      <h3 style={{ fontSize: '17px', fontWeight: '700', color: colors.text, margin: 0 }}>
        {title}
      </h3>
      {message && (
        <p style={{ fontSize: '14px', color: colors.textMuted, margin: 0, maxWidth: '320px', lineHeight: '1.4' }}>
          {message}
        </p>
      )}
      {children}
    </div>
  );
}
