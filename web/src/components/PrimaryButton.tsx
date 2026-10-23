import React from 'react';
import { colors, gradients, radius } from '../theme';

interface Props {
  title: string;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'outline' | 'ghost' | 'danger';
  icon?: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

export function PrimaryButton({
  title,
  onClick,
  loading,
  disabled,
  variant = 'primary',
  icon,
  style,
  className = '',
}: Props) {
  const inactive = disabled || loading;

  const baseStyle: React.CSSProperties = {
    minHeight: '50px',
    borderRadius: radius.pill,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '0 20px',
    fontSize: '15px',
    fontWeight: '700',
    letterSpacing: '0.2px',
    cursor: inactive ? 'not-allowed' : 'pointer',
    opacity: inactive ? 0.6 : 1,
    transition: 'transform 0.15s ease, opacity 0.15s ease',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    ...style,
  };

  let variantStyle: React.CSSProperties = {};

  if (variant === 'primary') {
    variantStyle = {
      background: gradients.gold,
      color: colors.onAccent,
      border: 'none',
      boxShadow: '0 6px 18px rgba(245, 197, 66, 0.22)',
    };
  } else if (variant === 'outline') {
    variantStyle = {
      background: 'rgba(28,8,41,0.6)',
      color: colors.text,
      border: '1.5px solid rgba(245,197,66,0.45)',
    };
  } else if (variant === 'ghost') {
    variantStyle = {
      background: 'transparent',
      color: colors.accent,
      border: 'none',
    };
  } else if (variant === 'danger') {
    variantStyle = {
      background: 'transparent',
      color: colors.danger,
      border: `1.5px solid ${colors.danger}`,
    };
  }

  return (
    <button
      type="button"
      disabled={inactive}
      onClick={onClick}
      className={`touch-btn ${className}`}
      style={{ ...baseStyle, ...variantStyle }}
    >
      {loading ? (
        <span
          style={{
            width: '18px',
            height: '18px',
            border: '2px solid rgba(255,255,255,0.3)',
            borderTopColor: '#fff',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            display: 'inline-block',
          }}
        />
      ) : (
        icon
      )}
      <span>{title}</span>
    </button>
  );
}
