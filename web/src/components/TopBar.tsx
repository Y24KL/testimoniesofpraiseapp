import React from 'react';
import { ChevronLeft, Search, Bell, User as UserIcon } from 'lucide-react';
import { colors } from '../theme';
import { useAuth } from '../context/AuthContext';
import { Logo } from './Logo';

interface Props {
  title?: string;
  brand?: boolean;
  onBack?: () => void;
  onSearch?: () => void;
  onNotifications?: () => void;
  onProfile?: () => void;
  actions?: Array<{ icon: React.ComponentType<{ size?: number; color?: string }>; label: string; onClick: () => void }>;
}

export function TopBar({
  title,
  brand = false,
  onBack,
  onSearch,
  onNotifications,
  onProfile,
  actions,
}: Props) {
  const { user } = useAuth();

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
            fontSize: '17px',
            fontWeight: '700',
            color: colors.text,
            margin: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title ?? 'Testimonies of Praise'}
        </h1>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
        {actions?.map((action, idx) => (
          <button
            key={idx}
            type="button"
            onClick={action.onClick}
            aria-label={action.label}
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
            <action.icon size={22} color={colors.text} />
          </button>
        ))}
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
        {onProfile && (
          <button
            type="button"
            onClick={onProfile}
            aria-label="Profile"
            style={{
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt="Profile"
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  border: `1.5px solid ${colors.accent}`,
                  objectFit: 'cover',
                }}
              />
            ) : (
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  border: `1.5px solid ${colors.accent}`,
                  backgroundColor: colors.card,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: colors.accent,
                  fontSize: '13px',
                  fontWeight: '700',
                }}
              >
                {user?.displayName ? user.displayName[0].toUpperCase() : <UserIcon size={18} />}
              </div>
            )}
          </button>
        )}
      </div>
    </header>
  );
}
