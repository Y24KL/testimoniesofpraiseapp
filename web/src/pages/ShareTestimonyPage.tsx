import React, { useState } from 'react';
import { CheckCircle, Send } from 'lucide-react';
import { colors, radius } from '../theme';
import { TopBar } from '../components/TopBar';
import { TextField } from '../components/TextField';
import { PrimaryButton } from '../components/PrimaryButton';
import { repo } from '../api/repository';
import { useAuth } from '../context/AuthContext';

interface Props {
  onBack: () => void;
}

const MIN_LENGTH = 20;

export function ShareTestimonyPage({ onBack }: Props) {
  const { user } = useAuth();
  const [fullName, setFullName] = useState(user?.displayName ?? '');
  const [churchZone, setChurchZone] = useState('');
  const [testimony, setTestimony] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const errors = {
    fullName: fullName.trim() ? '' : 'Please enter your full name.',
    churchZone: churchZone.trim() ? '' : 'Please enter your church zone.',
    testimony:
      testimony.trim().length >= MIN_LENGTH
        ? ''
        : `Please share a little more (at least ${MIN_LENGTH} characters).`,
  };

  const isValid = !errors.fullName && !errors.churchZone && !errors.testimony;

  const submit = async () => {
    setTouched(true);
    if (!isValid) return;

    setBusy(true);
    setError(null);
    try {
      await repo.submitTestimony({
        fullName: fullName.trim(),
        churchZone: churchZone.trim(),
        testimony: testimony.trim(),
        userId: user?.uid,
        userEmail: user?.email,
      });
      setDone(true);
    } catch (err: any) {
      console.error('Submit testimony error:', err);
      setError('Unable to send your testimony. Please check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const resetForm = () => {
    setTestimony('');
    setDone(false);
    setTouched(false);
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
      <TopBar title="Share your testimony" onBack={onBack} />
      <div
        style={{
          flex: 1,
          padding: '20px 16px',
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {done ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '16px',
              textAlign: 'center',
              padding: '32px 16px',
            }}
          >
            <CheckCircle size={64} color={colors.success} />
            <h2 style={{ fontSize: '22px', fontWeight: '700', color: colors.text, margin: 0 }}>
              Praise the Lord!
            </h2>
            <p style={{ fontSize: '15px', color: colors.textMuted, margin: 0, lineHeight: '1.4' }}>
              Your testimony has been received and will be reviewed shortly.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', marginTop: '16px' }}>
              <PrimaryButton title="SUBMIT ANOTHER" onClick={resetForm} />
              <PrimaryButton title="DONE" variant="outline" onClick={onBack} />
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <TextField
              label="Full Name"
              value={fullName}
              onChange={setFullName}
              error={touched ? errors.fullName : undefined}
            />
            <TextField
              label="Church Zone"
              value={churchZone}
              onChange={setChurchZone}
              placeholder="e.g. CE Lagos Zone 1"
              error={touched ? errors.churchZone : undefined}
            />
            <TextField
              label="Your Testimony"
              multiline
              rows={6}
              value={testimony}
              onChange={setTestimony}
              placeholder="Tell what the Lord has done for you..."
              maxLength={5000}
              error={touched ? errors.testimony : undefined}
            />

            {error && (
              <span style={{ fontSize: '13px', color: colors.danger, textAlign: 'center' }}>
                {error}
              </span>
            )}

            <div style={{ marginTop: '8px' }}>
              <PrimaryButton
                title="SUBMIT TESTIMONY"
                icon={<Send size={18} />}
                onClick={submit}
                loading={busy}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
