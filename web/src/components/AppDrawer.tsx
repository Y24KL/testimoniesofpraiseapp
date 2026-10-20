import React, { useEffect } from 'react';
import {
  X,
  User,
  Radio,
  Library,
  BookOpen,
  Tag,
  Video,
  PlayCircle,
  FileText,
  Heart,
  Download,
  Bell,
  Settings,
  LogOut,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Logo } from './Logo';
import { colors, radius } from '../theme';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onProfile: () => void;
  onGoToRadio: () => void;
  onGoToAdotopoc: () => void;
  onGoToArticles: () => void;
  onGoToPromotions: () => void;
  onGoToLive: () => void;
  onGoToTestimonies: () => void;
  onShareTestimony: () => void;
  onSponsor: () => void;
  onGoToDownloads: () => void;
  onNotifications: () => void;
  onNotificationSettings: () => void;
}

export function AppDrawer({
  isOpen,
  onClose,
  onProfile,
  onGoToRadio,
  onGoToAdotopoc,
  onGoToArticles,
  onGoToPromotions,
  onGoToLive,
  onGoToTestimonies,
  onShareTestimony,
  onSponsor,
  onGoToDownloads,
  onNotifications,
  onNotificationSettings,
}: Props) {
  const { user, signOut } = useAuth();

  // Prevent background scrolling while open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const navigateAndClose = (action: () => void) => {
    onClose();
    action();
  };

  const menuItems = [
    {
      id: 'radio',
      title: 'TOP Radio',
      subtitle: '24/7 Live Audio Stream',
      icon: <Radio size={18} color={colors.accent} />,
      iconBg: 'rgba(245, 197, 66, 0.15)',
      badge: 'LIVE 24/7',
      badgeBg: 'rgba(255, 59, 78, 0.2)',
      badgeColor: colors.live,
      action: onGoToRadio,
    },
    {
      id: 'adotopoc',
      title: 'ADOTOPOC',
      subtitle: 'Resource Center & Media',
      icon: (
        <img
          src="/LOG_xcvt3v.png"
          alt="ADOTOPOC"
          style={{ width: '36px', height: '36px', objectFit: 'cover', borderRadius: '50%' }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src =
              'https://res.cloudinary.com/duw6xrnpn/image/upload/v1789425387/LOG_xcvt3v.png';
          }}
        />
      ),
      iconBg: 'transparent',
      action: onGoToAdotopoc,
    },
    {
      id: 'articles',
      title: 'Articles & Insights',
      subtitle: 'Publications & Study',
      icon: <BookOpen size={18} color={colors.primaryLight} />,
      iconBg: 'rgba(186, 104, 200, 0.2)',
      action: onGoToArticles,
    },
    {
      id: 'promotions',
      title: 'Promotions',
      subtitle: 'Featured Events & Campaigns',
      icon: <Tag size={18} color={colors.accent} />,
      iconBg: 'rgba(245, 197, 66, 0.15)',
      action: onGoToPromotions,
    },
    {
      id: 'live',
      title: 'Watch Live',
      subtitle: 'Livestream & Live Chat',
      icon: <Video size={18} color={colors.live} />,
      iconBg: 'rgba(255, 59, 78, 0.15)',
      action: onGoToLive,
    },
    {
      id: 'testimonies',
      title: 'Testimonies',
      subtitle: 'Video Praise Archive',
      icon: <PlayCircle size={18} color={colors.accent} />,
      iconBg: 'rgba(245, 197, 66, 0.15)',
      action: onGoToTestimonies,
    },
    {
      id: 'share',
      title: 'Share Testimony',
      subtitle: 'Submit your praise report',
      icon: <FileText size={18} color={colors.primaryLight} />,
      iconBg: 'rgba(186, 104, 200, 0.2)',
      action: onShareTestimony,
    },
    {
      id: 'sponsor',
      title: 'Sponsor TOP',
      subtitle: 'Partner & support the ministry',
      icon: <Heart size={18} color={colors.live} />,
      iconBg: 'rgba(255, 59, 78, 0.15)',
      action: onSponsor,
    },
    {
      id: 'downloads',
      title: 'Downloads',
      subtitle: 'Saved Offline Media',
      icon: <Download size={18} color={colors.accent} />,
      iconBg: 'rgba(245, 197, 66, 0.15)',
      action: onGoToDownloads,
    },
    {
      id: 'notifications',
      title: 'Notifications',
      subtitle: 'Announcements & Alerts',
      icon: <Bell size={18} color={colors.textMuted} />,
      iconBg: 'rgba(255, 255, 255, 0.08)',
      action: onNotifications,
    },
    {
      id: 'settings',
      title: 'Preferences',
      subtitle: 'Notification & App Settings',
      icon: <Settings size={18} color={colors.textMuted} />,
      iconBg: 'rgba(255, 255, 255, 0.08)',
      action: onNotificationSettings,
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Navigation Menu"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(18, 0, 28, 0.75)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
      />

      {/* Drawer Container */}
      <div
        style={{
          position: 'relative',
          width: 'min(86vw, 360px)',
          height: '100dvh',
          backgroundColor: colors.surface,
          borderLeft: `1px solid ${colors.border}`,
          boxShadow: '-8px 0 28px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1001,
          animation: 'slideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <style>{`
          @keyframes slideIn {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
          }
        `}</style>

        {/* Top Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: `1px solid ${colors.border}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Logo size={28} />
            <span style={{ fontSize: '18px', fontWeight: 800, color: colors.text }}>Menu</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              color: colors.text,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Profile Card Section (Profile inside the Hamburger Menu) */}
        <button
          type="button"
          onClick={() => navigateAndClose(onProfile)}
          style={{
            margin: '14px 16px 6px',
            padding: '12px 14px',
            borderRadius: radius.md,
            backgroundColor: colors.card,
            border: `1px solid ${colors.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            cursor: 'pointer',
            textAlign: 'left',
            color: 'inherit',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              border: `1.5px solid ${colors.accent}`,
              overflow: 'hidden',
              backgroundColor: colors.surfaceLight,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt="Profile photo"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <User size={22} color={colors.accent} />
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: '14px',
                fontWeight: 700,
                color: colors.text,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {user?.displayName || 'My Profile'}
            </div>
            <div
              style={{
                fontSize: '12px',
                color: colors.textMuted,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {user?.email || 'Tap to view account details'}
            </div>
          </div>

          <ChevronRight size={18} color={colors.accent} />
        </button>

        {/* Feature List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px 14px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <div
            style={{
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '1px',
              color: colors.textMuted,
              padding: '8px 8px 4px',
              textTransform: 'uppercase',
            }}
          >
            All Features
          </div>

          {menuItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => navigateAndClose(item.action)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 12px',
                borderRadius: radius.md,
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
                color: 'inherit',
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: item.iconBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {item.icon}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: colors.text }}>
                    {item.title}
                  </span>
                  {item.badge && (
                    <span
                      style={{
                        fontSize: '9px',
                        fontWeight: 800,
                        backgroundColor: item.badgeBg,
                        color: item.badgeColor,
                        padding: '2px 6px',
                        borderRadius: radius.pill,
                        letterSpacing: '0.5px',
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    color: colors.textMuted,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {item.subtitle}
                </div>
              </div>

              <ChevronRight size={16} color={colors.border} />
            </button>
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            borderTop: `1px solid ${colors.border}`,
            padding: '14px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            alignItems: 'center',
          }}
        >
          {user && (
            <button
              type="button"
              onClick={() => {
                onClose();
                void signOut();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                width: '100%',
                padding: '8px 16px',
                borderRadius: radius.pill,
                backgroundColor: 'rgba(255, 107, 127, 0.1)',
                border: 'none',
                color: colors.danger,
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <LogOut size={16} color={colors.danger} />
              <span>Sign Out</span>
            </button>
          )}

          <div style={{ fontSize: '11px', color: colors.textMuted }}>
            Testimonies of Praise • Web PWA
          </div>
        </div>
      </div>
    </div>
  );
}
