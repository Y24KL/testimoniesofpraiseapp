import React, { useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { TextField } from '../components/TextField';
import { TitlePicker } from '../components/TitlePicker';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors } from '../theme';
import { PROFILE_LIMITS, validateProfile, type ProfileErrors, type ProfileInput } from '../profile/validation';

const EMPTY: ProfileInput = { title: '', fullName: '', zone: '', church: '' };

/**
 * Shown once after a new account is created (email or Google), before the rest of the site opens.
 * Saved against the signed-in UID; never shown again once saved.
 */
export function ProfileCompletionPage() {
  const { completeProfile, signOut, user } = useAuth();
  const [form, setForm] = useState<ProfileInput>(EMPTY);
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const submitting = useRef(false);

  const set = (key: keyof ProfileInput) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (touched) setErrors((e) => ({ ...e, [key]: undefined }));
    setFormError(null);
  };

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (submitting.current) return; // a second click while saving does nothing
    setTouched(true);
    setFormError(null);
    const checked = validateProfile(form);
    if (!checked.ok) {
      setErrors(checked.errors);
      return;
    }
    setErrors({});
    submitting.current = true;
    setBusy(true);
    try {
      await completeProfile(form);
      // On success the app moves on by itself: the profile is no longer pending.
    } catch (err) {
      setFormError((err as Error).message || 'We couldn’t save your profile. Please try again.');
      setBusy(false);
      submitting.current = false;
    }
  };

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="auth-head">
          <h1>Complete your profile</h1>
          <p>Tell us a little about you before you start. It takes less than a minute.</p>
          {user?.email ? <p style={{ color: colors.accent, fontSize: '13px' }}>{user.email}</p> : null}
        </div>

        <form onSubmit={submit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <TitlePicker value={form.title} onChange={set('title')} error={errors.title} disabled={busy} />
          <TextField label="Full name *" value={form.fullName} onChange={set('fullName')} autoComplete="name" maxLength={PROFILE_LIMITS.fullName} error={errors.fullName} />
          <TextField label="Zone *" value={form.zone} onChange={set('zone')} placeholder="e.g. Lagos Zone 1" maxLength={PROFILE_LIMITS.zone} error={errors.zone} />
          <TextField label="Church *" value={form.church} onChange={set('church')} placeholder="e.g. Christ Embassy Lagos" maxLength={PROFILE_LIMITS.church} error={errors.church} />

          {formError ? (
            <div className="err-box" role="alert">
              <span>{formError}</span>
            </div>
          ) : null}

          <PrimaryButton title="Continue" onClick={() => void submit()} loading={busy} disabled={busy} />
        </form>

        <button type="button" className="onb-signin" onClick={() => void signOut()} disabled={busy} style={{ alignSelf: 'center' }}>
          Not you? <b>Sign out</b>
        </button>
      </div>
    </div>
  );
}
