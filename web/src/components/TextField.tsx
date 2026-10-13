import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { colors, radius } from '../theme';

interface Props {
  label: string;
  value: string;
  onChange: (val: string) => void;
  type?: string;
  secure?: boolean;
  error?: string;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  autoFocus?: boolean;
  maxLength?: number;
  autoComplete?: string;
  style?: React.CSSProperties;
}

export function TextField({
  label,
  value,
  onChange,
  type = 'text',
  secure = false,
  error,
  multiline = false,
  rows = 4,
  placeholder,
  autoFocus,
  maxLength,
  autoComplete,
  style,
}: Props) {
  const [hidden, setHidden] = useState(secure);
  const [focused, setFocused] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', boxSizing: 'border-box' }}>
      <label
        style={{
          fontSize: '13px',
          fontWeight: '700',
          color: colors.textMuted,
        }}
      >
        {label}
      </label>
      <div
        style={{
          display: 'flex',
          alignItems: multiline ? 'flex-start' : 'center',
          backgroundColor: colors.surface,
          border: `1.5px solid ${error ? colors.danger : focused ? colors.primaryLight : colors.border}`,
          borderRadius: radius.md,
          padding: '0 14px',
          minHeight: multiline ? 'auto' : '52px',
          boxSizing: 'border-box',
          transition: 'border-color 0.2s ease',
        }}
      >
        {multiline ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={rows}
            placeholder={placeholder}
            autoFocus={autoFocus}
            maxLength={maxLength}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={{
              width: '100%',
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              color: colors.text,
              fontSize: '16px',
              padding: '12px 0',
              resize: 'vertical',
              boxSizing: 'border-box',
              lineHeight: '1.4',
              ...style,
            }}
          />
        ) : (
          <input
            type={secure ? (hidden ? 'password' : 'text') : type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            autoFocus={autoFocus}
            maxLength={maxLength}
            autoComplete={autoComplete}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={{
              flex: 1,
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              color: colors.text,
              fontSize: '16px',
              padding: '12px 0',
              boxSizing: 'border-box',
              ...style,
            }}
          />
        )}
        {secure && (
          <button
            type="button"
            onClick={() => setHidden(!hidden)}
            aria-label={hidden ? 'Show password' : 'Hide password'}
            style={{
              background: 'none',
              border: 'none',
              color: colors.textMuted,
              cursor: 'pointer',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {hidden ? <Eye size={18} /> : <EyeOff size={18} />}
          </button>
        )}
      </div>
      {error && (
        <span style={{ fontSize: '12px', color: colors.danger, marginTop: '2px' }}>
          {error}
        </span>
      )}
    </div>
  );
}
