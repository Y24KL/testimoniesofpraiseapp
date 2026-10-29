import React from 'react';
import { colors, radius } from '../theme';
import { PROFILE_TITLES, type ProfileTitle } from '../profile/validation';

interface Props {
  value: string;
  onChange: (title: ProfileTitle) => void;
  error?: string;
  disabled?: boolean;
}

/** Single-choice title list (Mr, Mrs, … Evangelist) with radio semantics for keyboard and screen readers. */
export function TitlePicker({ value, onChange, error, disabled }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <span id="title-picker-label" style={{ fontSize: '13px', fontWeight: 700, color: colors.textMuted }}>
        Title *
      </span>
      <div role="radiogroup" aria-labelledby="title-picker-label" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {PROFILE_TITLES.map((option) => {
          const on = value === option;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={disabled}
              onClick={() => onChange(option)}
              onKeyDown={(e) => {
                // Arrow keys move the selection, as in a native radio group.
                if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) return;
                e.preventDefault();
                const i = PROFILE_TITLES.indexOf(option);
                const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
                onChange(PROFILE_TITLES[(i + dir + PROFILE_TITLES.length) % PROFILE_TITLES.length]);
                (e.currentTarget.parentElement?.children[(i + dir + PROFILE_TITLES.length) % PROFILE_TITLES.length] as HTMLElement | undefined)?.focus();
              }}
              style={{
                minHeight: '40px',
                padding: '0 14px',
                borderRadius: radius.pill,
                cursor: disabled ? 'default' : 'pointer',
                fontWeight: 700,
                fontSize: '14px',
                border: `1px solid ${on ? colors.accent : colors.border}`,
                background: on ? colors.accent : colors.surface,
                color: on ? colors.onAccent : colors.text,
                transition: 'background 0.2s ease, transform 0.15s ease',
              }}
            >
              {option}
            </button>
          );
        })}
      </div>
      {error ? <span style={{ fontSize: '12px', color: colors.danger }}>{error}</span> : null}
    </div>
  );
}
