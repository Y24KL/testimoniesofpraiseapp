import React, { useEffect, useRef, useState } from 'react';
import { Plus, Users, Play, ArrowLeft } from 'lucide-react';
import { repo } from '../api/repository';
import { TopBar } from '../components/TopBar';
import { VideoPlayer } from '../components/VideoPlayer';
import { PrimaryButton } from '../components/PrimaryButton';
import { ErrorState } from '../components/ErrorState';
import { EmptyState } from '../components/EmptyState';
import { TextField } from '../components/TextField';
import { useAuth } from '../context/AuthContext';
import { CHOIR_CONFIRMATION_TEXT, CHOIR_FEATURE_INTRO, CHOIR_FEATURE_TITLE, CHOIR_FORM_INTRO, CHOIR_FORM_TITLE } from '../constants/choirFeature';
import { colors, gradients, radius } from '../theme';
import type { FeaturedChoir } from '../types';
import { formatDuration } from '../utils/format';
import { CHOIR_LIMITS, validateChoirRequest, type ChoirRequestInput } from '../utils/choirRequest';

interface PageProps {
  onBack: () => void;
  onNavigate: (route: 'choirShowcase' | 'choirRequest' | 'choirRequestSent') => void;
  onSelectChoir?: (id: string) => void;
}

/** Landing page: intro text, then the showcase of featured groups. */
export function ChoirFeaturePage({ onBack, onNavigate }: PageProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: colors.bg }}>
      <TopBar title="Feature your choir" onBack={onBack} />
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '900px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        <div style={{ background: gradients.hero, borderRadius: radius.lg, padding: '22px', minHeight: '140px', display: 'flex', alignItems: 'flex-end' }}>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: colors.text, lineHeight: 1.25 }}>{CHOIR_FEATURE_TITLE}</h1>
        </div>
        {CHOIR_FEATURE_INTRO.map((p) => (
          <p key={p} style={{ margin: 0, fontSize: '16px', color: colors.text, lineHeight: 1.5 }}>
            {p}
          </p>
        ))}
        <PrimaryButton title="EXPLORE FEATURED CHOIRS" icon={<Play size={18} />} onClick={() => onNavigate('choirShowcase')} />
      </div>
    </div>
  );
}

/** Showcase of featured choir/group videos, with a floating "+" that opens the submission form. */
export function FeaturedChoirsPage({ onBack, onNavigate, onSelectChoir }: PageProps) {
  const [items, setItems] = useState<FeaturedChoir[] | null>(null);
  const [error, setError] = useState(false);

  const load = () => {
    setError(false);
    repo
      .getFeaturedChoirs()
      .then(setItems)
      .catch(() => setError(true));
  };
  useEffect(load, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: colors.bg }}>
      <TopBar title="Featured choirs" onBack={onBack} />
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '900px', width: '100%', margin: '0 auto', boxSizing: 'border-box', paddingBottom: '110px' }}>
        {error && !items ? (
          <ErrorState message="Unable to load featured choirs. Please check your internet connection." onRetry={load} />
        ) : !items ? (
          <div style={{ color: colors.textMuted, textAlign: 'center', padding: '40px 0' }}>Loading praise…</div>
        ) : items.length === 0 ? (
          <EmptyState icon={<Users size={44} color={colors.primaryLight} />} title="No featured choirs yet" message="Featured choirs and groups will appear here." />
        ) : (
          items.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelectChoir?.(c.id)}
              aria-label={`${c.groupName}, ${c.songTitle}`}
              style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '10px', borderRadius: radius.md, background: colors.surface, border: `1px solid ${colors.border}`, textAlign: 'left', color: colors.text, cursor: 'pointer', width: '100%' }}
            >
              <div style={{ width: '96px', height: '64px', flexShrink: 0, borderRadius: radius.sm, overflow: 'hidden', background: colors.card, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {c.thumbnail ? <img src={c.thumbnail} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Users size={28} color={colors.primaryLight} />}
              </div>
              <span style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '15px', fontWeight: 700 }}>{c.groupName}</span>
                <span style={{ fontSize: '13px', color: colors.textMuted }}>{c.songTitle}</span>
                {c.duration ? <span style={{ fontSize: '12px', color: colors.textSubtle }}>{formatDuration(c.duration)}</span> : null}
              </span>
              <Play size={26} color={colors.accent} aria-hidden="true" />
            </button>
          ))
        )}
      </div>
      <button
        type="button"
        onClick={() => onNavigate('choirRequest')}
        aria-label="Submit your choir or group"
        style={{ position: 'fixed', right: '20px', bottom: '24px', width: '58px', height: '58px', borderRadius: '50%', border: 'none', background: colors.accent, color: colors.onAccent, boxShadow: '0 6px 18px rgba(0,0,0,0.35)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <Plus size={30} />
      </button>
    </div>
  );
}

/** Playback of one featured choir/group video, with a way back to the showcase. */
export function FeaturedChoirPage({ id, onBack }: { id: string; onBack: () => void }) {
  const [item, setItem] = useState<FeaturedChoir | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setError(false);
    repo
      .getFeaturedChoir(id)
      .then((c) => {
        if (cancelled) return;
        if (!c) setNotFound(true);
        else setItem(c);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: colors.bg }}>
      <TopBar title="Featured choirs" onBack={onBack} />
      {notFound && !item ? (
        <ErrorState message="This video is no longer available." onRetry={onBack} />
      ) : error && !item ? (
        <ErrorState message="Unable to load this video. Please check your internet connection." onRetry={() => window.location.reload()} />
      ) : !item ? (
        <div style={{ color: colors.textMuted, textAlign: 'center', padding: '40px 0' }}>Loading praise…</div>
      ) : (
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '900px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
          {item.videoUrl ? (
            <VideoPlayer uri={item.videoUrl} label={`${item.groupName}: ${item.songTitle}`} autoPlay />
          ) : (
            <div style={{ padding: '24px', background: colors.card, textAlign: 'center', color: colors.textMuted }}>Video is not available.</div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: colors.text }}>{item.groupName}</h1>
            <span style={{ fontSize: '15px', color: colors.text }}>{item.songTitle}</span>
            {item.duration ? <span style={{ fontSize: '13px', color: colors.textMuted }}>{formatDuration(item.duration)}</span> : null}
          </div>
          <PrimaryButton title="Back to featured choirs" variant="outline" icon={<ArrowLeft size={18} />} onClick={onBack} />
        </div>
      )}
    </div>
  );
}

const EMPTY: ChoirRequestInput = { groupName: '', churchZone: '', ministrationUrl: '', songTitle: '' };

/**
 * Submission form. Saved as pending for review; nothing is published from here. Typed values stay
 * on screen after a network error, and a second click while sending is ignored.
 */
export function ChoirRequestPage({ onBack, onSent }: { onBack: () => void; onSent: () => void }) {
  const { user } = useAuth();
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof ChoirRequestInput, string>>>({});
  const [sending, setSending] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const set = (key: keyof ChoirRequestInput) => (value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const submit = async () => {
    if (inFlight.current) return;
    const found = validateChoirRequest(values);
    setErrors(found);
    setServerError(null);
    if (Object.keys(found).length > 0) return;
    if (!user?.uid) {
      setServerError('Please sign in again to send your request.');
      return;
    }
    inFlight.current = true;
    setSending(true);
    try {
      await repo.submitChoirFeatureRequest(values, user.uid);
      onSent();
    } catch {
      setServerError('Your request was not sent. Check your internet connection and try again. What you typed is still here.');
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: colors.bg }}>
      <TopBar title={CHOIR_FEATURE_TITLE} onBack={onBack} />
      <div
        style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '640px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}
      >
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: colors.text }}>{CHOIR_FORM_TITLE}</h2>
        <p style={{ margin: 0, fontSize: '15px', color: colors.textMuted, lineHeight: 1.5 }}>{CHOIR_FORM_INTRO}</p>
        <TextField label="Group name" value={values.groupName} onChange={set('groupName')} error={errors.groupName} maxLength={CHOIR_LIMITS.groupName} />
        <TextField label="Church zone" value={values.churchZone} onChange={set('churchZone')} error={errors.churchZone} maxLength={CHOIR_LIMITS.churchZone} />
        <TextField
          label="Ministration URL"
          value={values.ministrationUrl}
          onChange={set('ministrationUrl')}
          error={errors.ministrationUrl}
          maxLength={CHOIR_LIMITS.ministrationUrl}
          placeholder="https://www.youtube.com/watch?v=..."
        />
        <TextField label="Song title" value={values.songTitle} onChange={set('songTitle')} error={errors.songTitle} maxLength={CHOIR_LIMITS.songTitle} />
        {serverError && (
          <p role="alert" style={{ margin: 0, color: colors.danger, fontSize: '14px', textAlign: 'center' }}>
            {serverError}
          </p>
        )}
        <PrimaryButton title="SUBMIT REQUEST" loading={sending} disabled={sending} onClick={() => void submit()} />
        <p style={{ margin: 0, color: colors.textSubtle, fontSize: '12px', textAlign: 'center' }}>Your request is reviewed before anything is published.</p>
      </div>
    </div>
  );
}

const KINGSCHAT_BLUE = '#1D6FE0';

/** Confirmation after a request is saved. Reached with a replace, so Back cannot resubmit the form. */
export function ChoirRequestSentPage({ onHome }: { onHome: () => void }) {
  const [linkError, setLinkError] = useState(false);
  const handle = '@testimonies.lmm';
  const KINGSCHAT_URL = 'https://kingschat.online/user/testimonies.lmm';

  const contact = () => {
    setLinkError(false);
    // Opens outside the site; noopener keeps this page from being reachable from the new tab.
    const win = window.open(KINGSCHAT_URL, '_blank', 'noopener,noreferrer');
    if (!win) setLinkError(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: colors.bg }}>
      <TopBar title="Request sent" />
      <div style={{ padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'stretch', maxWidth: '640px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        <p style={{ margin: 0, fontSize: '16px', lineHeight: 1.5, color: colors.text, textAlign: 'center' }}>
          {CHOIR_CONFIRMATION_TEXT}
        </p>
        <p style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: colors.accent, textAlign: 'center' }}>{handle}</p>
        {linkError && (
          <p role="alert" style={{ margin: 0, color: colors.danger, textAlign: 'center', fontSize: '14px' }}>
            We couldn’t open KingsChat. Search for {handle} in the KingsChat app.
          </p>
        )}
        <button
          type="button"
          onClick={contact}
          style={{ minHeight: '52px', borderRadius: radius.pill, border: 'none', background: KINGSCHAT_BLUE, color: '#FFFFFF', fontWeight: 800, fontSize: '16px', letterSpacing: '0.3px', cursor: 'pointer' }}
        >
          CONTACT US ON KINGCHAT
        </button>
        <PrimaryButton title="RETURN TO HOME" variant="outline" onClick={onHome} />
      </div>
    </div>
  );
}
