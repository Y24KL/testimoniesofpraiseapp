import React from 'react';
import { Home, PlayCircle, Radio, Download } from 'lucide-react';
import { colors } from '../theme';

export type TabName = 'home' | 'testimonies' | 'live' | 'downloads';

interface Props {
  currentTab: TabName;
  onTabChange: (tab: TabName) => void;
}

const TABS: { id: TabName; label: string; icon: React.FC<{ size?: number; color?: string }> }[] = [
  { id: 'home', label: 'HOME', icon: Home },
  { id: 'testimonies', label: 'TESTIMONIES', icon: PlayCircle },
  { id: 'live', label: 'LIVE', icon: Radio },
  { id: 'downloads', label: 'DOWNLOADS', icon: Download },
];

export function BottomNavigation({ currentTab, onTabChange }: Props) {
  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        width: '100%',
        backgroundColor: colors.surface,
        borderTop: `1px solid ${colors.border}`,
        display: 'flex',
        alignItems: 'center',
        paddingTop: '8px',
        paddingBottom: 'calc(var(--sab, 0px) + 8px)',
        paddingLeft: 'max(8px, var(--sal, 0px))',
        paddingRight: 'max(8px, var(--sar, 0px))',
        zIndex: 30,
        boxSizing: 'border-box',
      }}
      role="tablist"
      aria-label="App Navigation"
    >
      {TABS.map((tab) => {
        const active = currentTab === tab.id;
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onTabChange(tab.id)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '2px',
              minHeight: '48px',
              background: 'none',
              border: 'none',
              color: active ? colors.accent : colors.textMuted,
              cursor: 'pointer',
              padding: 0,
              transition: 'transform 0.15s ease',
            }}
          >
            <div
              style={{
                transform: active ? 'scale(1.1)' : 'scale(1)',
                transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon size={22} color={active ? colors.accent : colors.textMuted} />
            </div>
            <span
              style={{
                fontSize: '10px',
                fontWeight: '800',
                letterSpacing: '0.6px',
                color: active ? colors.accent : colors.textMuted,
              }}
            >
              {tab.label}
            </span>
            <div
              style={{
                width: '4px',
                height: '4px',
                borderRadius: '50%',
                backgroundColor: active ? colors.accent : 'transparent',
                marginTop: '1px',
              }}
            />
          </button>
        );
      })}
    </nav>
  );
}
