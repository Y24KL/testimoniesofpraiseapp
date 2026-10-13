import React, { useState } from 'react';
import { Copy, Check, Upload, CheckCircle } from 'lucide-react';
import { colors, radius } from '../theme';
import { TopBar } from '../components/TopBar';
import { TextField } from '../components/TextField';
import { PrimaryButton } from '../components/PrimaryButton';
import { uploadReceipt } from '../api/cloudinary';
import { repo } from '../api/repository';
import { useAuth } from '../context/AuthContext';

interface Props {
  onBack: () => void;
}

const env = import.meta.env;

const BANK_INFO = {
  bankName: env.VITE_BANK_NAME || 'Parallex Bank',
  accountName: env.VITE_BANK_ACCOUNT_NAME || 'Testimonies of Praise',
  accountNumber: env.VITE_BANK_ACCOUNT_NUMBER || '1000316330',
};

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 14px',
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        border: `1px solid ${colors.border}`,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <span style={{ fontSize: '12px', color: colors.textMuted }}>{label}</span>
        <span style={{ fontSize: '15px', fontWeight: '700', color: colors.text }}>{value}</span>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        style={{
          background: 'none',
          border: 'none',
          color: copied ? colors.success : colors.accent,
          fontSize: '13px',
          fontWeight: '700',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '6px',
        }}
      >
        {copied ? (
          <>
            <Check size={16} /> Copied
          </>
        ) : (
          <>
            <Copy size={16} /> Copy
          </>
        )}
      </button>
    </div>
  );
}

export function SponsorPage({ onBack }: Props) {
  const { user } = useAuth();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setFile(f);
      setPreview(URL.createObjectURL(f));
    }
  };

  const submit = async () => {
    if (!file) {
      return setError('Please attach a photo or screenshot of your transfer receipt.');
    }
    setBusy(true);
    setError(null);
    try {
      const receiptUrl = await uploadReceipt(file, `receipt-${Date.now()}-${file.name}`);
      await repo.submitSponsorship({
        uid: user?.uid,
        userEmail: user?.email,
        amount,
        note,
        receiptUrl,
      });
      setDone(true);
    } catch (err: any) {
      console.error('Sponsor error:', err);
      setError('Could not submit your receipt. Please check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', backgroundColor: colors.bg }}>
      <TopBar title="Sponsor Testimonies of Praise" onBack={onBack} />
      <div
        style={{
          flex: 1,
          padding: '20px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          maxWidth: '480px',
          margin: '0 auto',
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
              Thank you for your seed!
            </h2>
            <p style={{ fontSize: '15px', color: colors.textMuted, margin: 0, lineHeight: '1.4' }}>
              We've received your receipt and will confirm it shortly. May God bless your partnership.
            </p>
            <div style={{ width: '100%', marginTop: '16px' }}>
              <PrimaryButton title="DONE" onClick={onBack} />
            </div>
          </div>
        ) : (
          <>
            <p style={{ fontSize: '14px', color: colors.textMuted, margin: 0, lineHeight: '1.4' }}>
              Every seed helps testimonies reach someone who needs to hear them. Thank you for sowing into the ministry.
            </p>

            {/* Bank details card */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                padding: '16px',
                borderRadius: radius.lg,
                backgroundColor: colors.card,
                border: `1px solid ${colors.border}`,
              }}
            >
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: '800',
                  letterSpacing: '1px',
                  color: colors.accent,
                  textTransform: 'uppercase',
                }}
              >
                BANK TRANSFER DETAILS
              </span>
              <CopyRow label="Bank Name" value={BANK_INFO.bankName} />
              <CopyRow label="Account Name" value={BANK_INFO.accountName} />
              <CopyRow label="Account Number" value={BANK_INFO.accountNumber} />
            </div>

            {/* Form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <TextField
                label="Amount (Optional)"
                value={amount}
                onChange={setAmount}
                placeholder="e.g. 5,000"
              />
              <TextField
                label="Note or Prayer Request (Optional)"
                value={note}
                onChange={setNote}
                placeholder="Share a word or request..."
              />

              {/* Receipt File Picker */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: '700', color: colors.textMuted }}>
                  Attach Transfer Receipt
                </span>
                <label
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    padding: '24px 16px',
                    borderRadius: radius.md,
                    backgroundColor: colors.surface,
                    border: `1.5px dashed ${colors.border}`,
                    cursor: 'pointer',
                    textAlign: 'center',
                  }}
                >
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                  {preview ? (
                    <img
                      src={preview}
                      alt="Receipt preview"
                      style={{ maxHeight: '160px', maxWidth: '100%', borderRadius: radius.sm, objectFit: 'contain' }}
                    />
                  ) : (
                    <>
                      <Upload size={28} color={colors.accent} />
                      <span style={{ fontSize: '14px', color: colors.text }}>
                        Tap to choose receipt photo
                      </span>
                      <span style={{ fontSize: '12px', color: colors.textMuted }}>
                        JPG, PNG, WebP supported
                      </span>
                    </>
                  )}
                </label>
              </div>

              {error && (
                <span style={{ fontSize: '13px', color: colors.danger, textAlign: 'center' }}>
                  {error}
                </span>
              )}

              <div style={{ marginTop: '8px' }}>
                <PrimaryButton
                  title="SUBMIT RECEIPT"
                  onClick={submit}
                  loading={busy}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
