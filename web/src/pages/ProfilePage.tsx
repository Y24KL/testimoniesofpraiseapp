import React, { useRef, useState } from 'react';
import {
  Camera,
  Bell,
  Download,
  Heart,
  Gift,
  ChevronRight,
  LogOut,
  Trash2,
} from 'lucide-react';
import { colors, radius } from '../theme';
import { TopBar } from '../components/TopBar';
import { PrimaryButton } from '../components/PrimaryButton';
import { uploadAvatar } from '../api/cloudinary';
import { useAuth } from '../context/AuthContext';

interface Props {
  onBack: () => void;
  onGoToNotifications: () => void;
  onGoToDownloads: () => void;
  onGoToShare: () => void;
  onGoToSponsor: () => void;
}

function getInitials(name?: string | null): string {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export function ProfilePage({
  onBack,
  onGoToNotifications,
  onGoToDownloads,
  onGoToShare,
  onGoToSponsor,
}: Props) {
  const { user, signOut, deleteAccount, updatePhoto } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhotoError(null);
    if (!e.target.files || !e.target.files[0]) return;
    const f = e.target.files[0];
    setPhotoBusy(true);
    try {
      const url = await uploadAvatar(f, `avatar-${Date.now()}-${f.name}`);
      await updatePhoto(url);
    } catch (err: any) {
      console.error('Avatar upload error:', err);
      setPhotoError('Could not update your photo. Please try again.');
    } finally {
      setPhotoBusy(false);
    }
  };

  const handleLogout = async () => {
    setBusy(true);
    try {
      await signOut();
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteAccount = async () => {
    setBusy(true);
    try {
      await deleteAccount();
    } catch (err: any) {
      alert('Unable to delete account. You may need to sign out and sign back in before deleting.');
    } finally {
      setBusy(false);
      setShowDeleteConfirm(false);
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
      <TopBar title="Profile" onBack={onBack} />
      <div
        style={{
          flex: 1,
          padding: '20px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {/* User Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '8px 0' }}>
          <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => fileInputRef.current?.click()}>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt="Profile avatar"
                style={{
                  width: '96px',
                  height: '96px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: `2px solid ${colors.accent}`,
                  backgroundColor: colors.card,
                }}
              />
            ) : (
              <div
                style={{
                  width: '96px',
                  height: '96px',
                  borderRadius: '50%',
                  backgroundColor: colors.primary,
                  border: `2px solid ${colors.accent}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: colors.accent,
                  fontSize: '32px',
                  fontWeight: '800',
                }}
              >
                {getInitials(user?.displayName ?? user?.email)}
              </div>
            )}
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                backgroundColor: colors.accent,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: `2px solid ${colors.bg}`,
              }}
            >
              <Camera size={16} color={colors.bg} />
            </div>
          </div>

          {photoBusy && <span style={{ fontSize: '12px', color: colors.accent }}>Uploading photo…</span>}
          {photoError && <span style={{ fontSize: '12px', color: colors.danger }}>{photoError}</span>}

          <h2 style={{ fontSize: '20px', fontWeight: '700', color: colors.text, margin: 0 }}>
            {user?.displayName ?? 'Friend'}
          </h2>
          <span style={{ fontSize: '14px', color: colors.textMuted }}>
            {user?.email}
          </span>
        </div>

        {/* Links Rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            type="button"
            onClick={onGoToNotifications}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              minHeight: '54px',
              padding: '0 16px',
              borderRadius: radius.md,
              backgroundColor: colors.surface,
              border: `1px solid ${colors.border}`,
              color: colors.text,
              cursor: 'pointer',
              fontSize: '15px',
              fontWeight: '600',
              textAlign: 'left',
            }}
          >
            <Bell size={20} color={colors.accent} />
            <span style={{ flex: 1 }}>Notification preferences</span>
            <ChevronRight size={18} color={colors.textMuted} />
          </button>

          <button
            type="button"
            onClick={onGoToDownloads}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              minHeight: '54px',
              padding: '0 16px',
              borderRadius: radius.md,
              backgroundColor: colors.surface,
              border: `1px solid ${colors.border}`,
              color: colors.text,
              cursor: 'pointer',
              fontSize: '15px',
              fontWeight: '600',
              textAlign: 'left',
            }}
          >
            <Download size={20} color={colors.accent} />
            <span style={{ flex: 1 }}>Downloads</span>
            <ChevronRight size={18} color={colors.textMuted} />
          </button>

          <button
            type="button"
            onClick={onGoToShare}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              minHeight: '54px',
              padding: '0 16px',
              borderRadius: radius.md,
              backgroundColor: colors.surface,
              border: `1px solid ${colors.border}`,
              color: colors.text,
              cursor: 'pointer',
              fontSize: '15px',
              fontWeight: '600',
              textAlign: 'left',
            }}
          >
            <Heart size={20} color={colors.accent} />
            <span style={{ flex: 1 }}>Share your testimony</span>
            <ChevronRight size={18} color={colors.textMuted} />
          </button>

          <button
            type="button"
            onClick={onGoToSponsor}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              minHeight: '54px',
              padding: '0 16px',
              borderRadius: radius.md,
              backgroundColor: colors.surface,
              border: `1px solid ${colors.border}`,
              color: colors.text,
              cursor: 'pointer',
              fontSize: '15px',
              fontWeight: '600',
              textAlign: 'left',
            }}
          >
            <Gift size={20} color={colors.accent} />
            <span style={{ flex: 1 }}>Sponsor Testimonies of Praise</span>
            <ChevronRight size={18} color={colors.textMuted} />
          </button>
        </div>

        {/* Account actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
          <PrimaryButton
            title="LOG OUT"
            variant="outline"
            icon={<LogOut size={18} />}
            onClick={handleLogout}
            loading={busy}
          />
          <PrimaryButton
            title="DELETE ACCOUNT"
            variant="danger"
            icon={<Trash2 size={18} />}
            onClick={() => setShowDeleteConfirm(true)}
          />
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.8)',
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
        >
          <div
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.lg,
              border: `1px solid ${colors.border}`,
              padding: '24px',
              maxWidth: '360px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              textAlign: 'center',
            }}
          >
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: colors.text, margin: 0 }}>
              Delete account?
            </h3>
            <p style={{ fontSize: '14px', color: colors.textMuted, margin: 0, lineHeight: '1.4' }}>
              This will permanently delete your account and profile data. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: radius.pill,
                  backgroundColor: colors.card,
                  border: `1px solid ${colors.border}`,
                  color: colors.text,
                  fontWeight: '700',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: radius.pill,
                  backgroundColor: colors.danger,
                  border: 'none',
                  color: '#fff',
                  fontWeight: '700',
                  cursor: 'pointer',
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
