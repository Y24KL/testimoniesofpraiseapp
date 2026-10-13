import React from 'react';
import { AlertCircle } from 'lucide-react';
import { colors } from '../theme';
import { PrimaryButton } from './PrimaryButton';

interface Props {
  message?: string;
  onRetry?: () => void;
  compact?: boolean;
}

export function ErrorState({
  message = 'Something went wrong. Please check your connection and try again.',
  onRetry,
  compact = false,
}: Props) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: compact ? '20px 16px' : '36px 20px',
        gap: '14px',
        textAlign: 'center',
      }}
      role="alert"
    >
      <AlertCircle size={compact ? 32 : 46} color={colors.danger} />
      <p style={{ fontSize: '14px', color: colors.textMuted, margin: 0, lineHeight: '1.4' }}>
        {message}
      </p>
      {onRetry && (
        <div style={{ marginTop: '4px', width: '100%', maxWidth: '240px' }}>
          <PrimaryButton title="TRY AGAIN" variant="outline" onClick={onRetry} />
        </div>
      )}
    </div>
  );
}
