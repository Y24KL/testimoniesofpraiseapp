import React from 'react';
import { ChevronLeft, Search, Bell, Menu } from 'lucide-react';
import { colors } from '../theme';
import { Logo } from './Logo';

interface Props {
  title?: string;
  brand?: boolean;
  onBack?: () => void;
  onSearch?: () => void;
  onNotifications?: () => void;
  onProfile?: () => void;
  onMenu?: () => void;
  actions?: Array<{ icon: React.ComponentType<{ size?: number; color?: string }>; label: string; onClick: () => void }>;
}

export function TopBar({
  title,
  brand = false,
  onBack,
  onSearch,
  onNotifications,
  onProfile,
  onMenu,
  actions,
}: Props) {
  const handleMenuClick = onMenu || onProfile;

  return (
    <header
      style={{
        height: '56px',
        paddingTop: 'var(--sat)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: '12px',
        paddingRight: '12px',
        backgroundColor: colors.bg,
        borderBottom: `1px solid ${colors.border}`,
        position: 'sticky',
        top: 0,
        zIndex: 20,
        boxSizing: 'content-box',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Go back"
            style={{
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'none',
              border: 'none',
              color: colors.text,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <ChevronLeft size={24} />
          </button>
        )}
        {brand && <Logo size={34} />}
        <h1
          style={{
            margin: 0,
            fontSize: '17px',
            fontWeight: 700,
            color: colors.text,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title || 'Testimonies of Praise'}
        </h1>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {actions &&
          actions.map((act, i) => {
            const Icon = act.icon;
            return (
              <button
                key={i}
                type="button"
                onClick={act.onClick}
                aria-label={act.label}
                style={{
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'none',
                  border: 'none',
                  color: colors.text,
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <Icon size={22} color={colors.text} />
              </button>
            );
          })}
        {onSearch && (
          <button
            type="button"
            onClick={onSearch}
            aria-label="Search"
            style={{
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'none',
              border: 'none',
              color: colors.text,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <Search size={22} />
          </button>
        )}
        {onNotifications && (
          <button
            type="button"
            onClick={onNotifications}
            aria-label="Notifications"
            style={{
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'none',
              border: 'none',
              color: colors.text,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <Bell size={22} />
          </button>
        )}
        {handleMenuClick && (
          <button
            type="button"
            onClick={handleMenuClick}
            aria-label="Navigation Menu"
            style={{
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'none',
              border: 'none',
              color: colors.text,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <Menu size={24} />
          </button>
        )}
      </div>
    </header>
  );
}
