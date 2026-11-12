import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Bug, CheckCircle2, Lightbulb, MessageSquare, MoreHorizontal, Send, Smartphone, Sparkles, Star } from 'lucide-react';
import { repo } from '../api/repository';
import { PrimaryButton } from '../components/PrimaryButton';
import { TextField } from '../components/TextField';
import { TopBar } from '../components/TopBar';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme';
import {
  EMPTY_FEEDBACK,
  FEEDBACK_LIMITS,
  FEEDBACK_SEND_TIMEOUT_MS,
  FEEDBACK_TYPES,
  FEEDBACK_TYPE_LABELS,
  FeedbackTimeoutError,
  validateFeedback,
  withTimeout,
  type FeedbackErrors,
  type FeedbackInput,
  type FeedbackType,
} from '../utils/feedback';
import './feedback.css';

const TYPE_ICONS: Record<FeedbackType, React.ComponentType<{ size?: number }>> = {
  general: MessageSquare,
  suggestion: Lightbulb,
  problem: Bug,
  experience: Smartphone,
  other: MoreHorizontal,
};

const NOT_SENT_OFFLINE = 'Your feedback was not sent. Check your internet connection and try again. What you typed is still here.';
const NOT_SENT_WAIT = 'Your feedback was not sent. Please wait a moment and try again. What you typed is still here.';
const NOT_SENT = 'Your feedback was not sent. Please try again. What you typed is still here.';

const shell: React.CSSProperties = { display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: colors.bg };
const column: React.CSSProperties = { display: 'flex', flexDirection: 'column', maxWidth: '640px', width: '100%', margin: '0 auto', boxSizing: 'border-box' };
const label: React.CSSProperties = { fontSize: '13px', fontWeight: 700, color: colors.textMuted };

/**
 * "Feedback & Suggestions": the form, and (only after Firestore confirms the save) the thank-you state.
 * Both live on one page, so the browser's Back button can never return to a filled-in form and send it twice.
 */
export function FeedbackPage({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const [values, setValues] = useState<FeedbackInput>(EMPTY_FEEDBACK);
  const [errors, setErrors] = useState<FeedbackErrors>({});
  const [sending, setSending] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const inFlight = useRef(false); // blocks a second click before React re-renders
  // A save that timed out may still be queued by Firestore. Retrying the same text waits on that same
  // save instead of starting another, so one feedback is never stored twice.
  const pending = useRef<{ key: string; work: Promise<void> } | null>(null);

  const set = <K extends keyof FeedbackInput>(key: K, value: FeedbackInput[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const sendAnother = () => {
    pending.current = null;
    setValues(EMPTY_FEEDBACK);
    setErrors({});
    setServerError(null);
    setSent(false);
    window.scrollTo({ top: 0 });
  };

  const submit = async () => {
    if (inFlight.current) return;
    const found = validateFeedback(values);
    setErrors(found);
    setServerError(null);
    if (Object.keys(found).length > 0) return;
    if (!user?.uid) {
      setServerError('Please sign in again to send your feedback.');
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setServerError(NOT_SENT_OFFLINE);
      return;
    }

    inFlight.current = true;
    setSending(true);
    try {
      const key = JSON.stringify(values);
      if (!pending.current || pending.current.key !== key) {
        const work = repo.submitFeedback(values, user.uid);
        work.catch(() => undefined); // handled below; avoids an unhandled rejection after a timeout
        pending.current = { key, work };
      }
      await withTimeout(pending.current.work, FEEDBACK_SEND_TIMEOUT_MS);
      pending.current = null;
      setSent(true); // only reached once the server has confirmed the write
      window.scrollTo({ top: 0 });
    } catch (e) {
      if (e instanceof FeedbackTimeoutError) {
        setServerError(NOT_SENT_OFFLINE); // keep `pending`: the save may still go through
      } else {
        pending.current = null;
        const code = (e as { code?: string })?.code ?? '';
        setServerError(code === 'unavailable' || code === 'deadline-exceeded' ? NOT_SENT_OFFLINE : code === 'permission-denied' ? NOT_SENT_WAIT : NOT_SENT);
      }
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div style={shell}>
        <TopBar title="Feedback & Suggestions" onBack={onBack} />
        <FeedbackSuccess onBack={onBack} onSendAnother={sendAnother} />
      </div>
    );
  }

  return (
    <div style={shell}>
      <TopBar title="Feedback & Suggestions" onBack={onBack} />
      <div style={{ ...column, padding: '16px 16px 48px', gap: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: colors.text }}>We'd love to hear from you!</h2>
          <p style={{ margin: 0, fontSize: '15px', color: colors.textMuted, lineHeight: 1.5 }}>
            Your thoughts, ideas and suggestions help us make Testimonies of Praise better. Share your experience with us and let us know how we can improve.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span id="fb-type-label" style={label}>
            Feedback type
          </span>
          <div className="fb-types" role="radiogroup" aria-labelledby="fb-type-label">
            {FEEDBACK_TYPES.map((type) => {
              const Icon = TYPE_ICONS[type];
              const on = values.feedbackType === type;
              return (
                <button key={type} type="button" role="radio" aria-checked={on} disabled={sending} className="fb-type" onClick={() => set('feedbackType', type)}>
                  <span className="fb-type-icon" aria-hidden="true">
                    <Icon size={20} />
                  </span>
                  <span className="fb-type-label">{FEEDBACK_TYPE_LABELS[type]}</span>
                  {on ? <CheckCircle2 size={18} color={colors.accent} aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
          {errors.feedbackType ? <span style={{ fontSize: '12px', color: colors.danger }}>{errors.feedbackType}</span> : null}
        </div>

        <TextField
          label="Subject (optional)"
          value={values.subject}
          onChange={(v) => set('subject', v)}
          error={errors.subject}
          maxLength={FEEDBACK_LIMITS.subject}
          placeholder="What's your feedback about?"
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <TextField
            label="Message"
            value={values.message}
            onChange={(v) => set('message', v)}
            error={errors.message}
            maxLength={FEEDBACK_LIMITS.message}
            multiline
            rows={6}
            placeholder="Tell us what you think. Share your experience, suggestions or any issues you've encountered..."
          />
          <span style={{ fontSize: '12px', color: colors.textSubtle, textAlign: 'right' }}>
            {values.message.length}/{FEEDBACK_LIMITS.message}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <span id="fb-rating-label" style={label}>
            How would you rate your experience with T.O.P?
          </span>
          <div className="fb-stars" role="group" aria-labelledby="fb-rating-label">
            {[1, 2, 3, 4, 5].map((n) => {
              const filled = values.rating !== null && n <= values.rating;
              return (
                <button
                  key={n}
                  type="button"
                  className={`fb-star${filled ? ' on' : ''}`}
                  disabled={sending}
                  aria-label={`${n} ${n === 1 ? 'star' : 'stars'}`}
                  aria-pressed={values.rating === n}
                  // Clicking the current rating again clears it: the rating is optional.
                  onClick={() => set('rating', values.rating === n ? null : n)}
                >
                  <Star size={34} fill={filled ? 'currentColor' : 'none'} />
                </button>
              );
            })}
          </div>
          <span style={{ fontSize: '12px', color: colors.textSubtle, textAlign: 'center' }}>Optional</span>
        </div>

        {serverError && (
          <p role="alert" style={{ margin: 0, color: colors.danger, fontSize: '14px', textAlign: 'center' }}>
            {serverError}
          </p>
        )}

        <PrimaryButton title="SEND FEEDBACK" icon={<Send size={18} />} loading={sending} disabled={sending} onClick={() => void submit()} />
      </div>
    </div>
  );
}

// Position inside the 200 x 200 stage, size, colour, drift and start delay of each sparkle.
const SPARKLES = [
  { x: 22, y: 44, size: 16, color: colors.accent, dx: -8, dy: -6 },
  { x: 164, y: 30, size: 13, color: '#FFFFFF', dx: 7, dy: -8 },
  { x: 176, y: 104, size: 15, color: colors.accent, dx: 9, dy: 0 },
  { x: 150, y: 166, size: 12, color: '#FFFFFF', dx: 6, dy: 8 },
  { x: 34, y: 158, size: 14, color: colors.accent, dx: -7, dy: 8 },
  { x: 8, y: 100, size: 11, color: '#FFFFFF', dx: -9, dy: 0 },
];

/**
 * The "Thank You!" state: the green circle springs in, a ripple expands, the tick draws itself, a few
 * sparkles twinkle, then the text slides up (CSS in feedback.css; all skipped under reduced motion).
 */
function FeedbackSuccess({ onBack, onSendAnother }: { onBack: () => void; onSendAnother: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true }); // screen readers announce the result
  }, []);

  return (
    <div style={{ ...column, padding: '32px 24px 48px', alignItems: 'center', flex: 1, justifyContent: 'center' }}>
      <div className="fb-stage" role="img" aria-label="Feedback sent">
        <span className="fb-ripple" />
        {SPARKLES.map((s, i) => (
          <span
            key={i}
            className="fb-sparkle"
            style={{ left: s.x, top: s.y, color: s.color, animationDelay: `${0.62 + i * 0.09}s`, ['--dx' as string]: `${s.dx}px`, ['--dy' as string]: `${s.dy}px` }}
          >
            <Sparkles size={s.size} />
          </span>
        ))}
        <span className="fb-circle" />
        <svg className="fb-check" viewBox="0 0 120 120" aria-hidden="true">
          <path d="M35 62 L52 79 L87 44" pathLength={100} />
        </svg>
      </div>

      <div className="fb-text" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', marginTop: '8px', width: '100%' }}>
        <h2 ref={heading} tabIndex={-1} style={{ margin: 0, fontSize: '30px', fontWeight: 800, color: colors.text, textAlign: 'center', outline: 'none' }}>
          Thank You!
        </h2>
        <p style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: colors.accent, textAlign: 'center' }}>Thank you for sharing your feedback!</p>
        <p style={{ margin: 0, fontSize: '15px', lineHeight: 1.5, color: colors.textMuted, textAlign: 'center' }}>
          Your feedback has been successfully received. We appreciate you taking the time to help us make Testimonies of Praise even better.
        </p>
        <p style={{ margin: '4px 0 0', fontSize: '16px', fontWeight: 700, color: colors.text, textAlign: 'center' }}>Your voice matters to us. ❤️</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', marginTop: '18px' }}>
          <PrimaryButton title="BACK TO T.O.P" icon={<ArrowLeft size={18} />} onClick={onBack} />
          <PrimaryButton title="SEND ANOTHER FEEDBACK" icon={<MessageSquare size={18} />} variant="outline" onClick={onSendAnother} />
        </div>
      </div>
    </div>
  );
}
