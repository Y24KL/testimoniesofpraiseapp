/**
 * "Feedback & Suggestions": the categories, limits and validation shared by the form. The mobile app keeps
 * an identical copy (src/utils/feedback.ts); the Firestore rules (top-admin/firestore.rules,
 * appFeedback) enforce the same values and limits on the server.
 */

export const FEEDBACK_TYPES = ['general', 'suggestion', 'problem', 'experience', 'other'] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

export const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  general: 'General Feedback',
  suggestion: 'Suggestion / Feature Request',
  problem: 'Report a Problem',
  experience: 'User Experience',
  other: 'Other',
};

export const FEEDBACK_LIMITS = { subject: 120, message: 2000 } as const;

export type FeedbackPlatform = 'android' | 'ios' | 'web';

export interface FeedbackInput {
  feedbackType: FeedbackType;
  subject: string;
  message: string;
  /** 1-5, or null when the person did not rate. */
  rating: number | null;
}

export type FeedbackErrors = Partial<Record<'feedbackType' | 'subject' | 'message' | 'rating', string>>;

export const EMPTY_FEEDBACK: FeedbackInput = { feedbackType: 'general', subject: '', message: '', rating: null };

/** Returns one message per invalid field; an empty object means the form can be sent. */
export function validateFeedback(input: FeedbackInput): FeedbackErrors {
  const errors: FeedbackErrors = {};
  if (!FEEDBACK_TYPES.includes(input.feedbackType)) errors.feedbackType = 'Choose a feedback type.';
  if (input.subject.trim().length > FEEDBACK_LIMITS.subject) errors.subject = 'This subject is too long.';
  if (!input.message.trim()) errors.message = 'Please write your message before sending.';
  else if (input.message.trim().length > FEEDBACK_LIMITS.message) errors.message = 'This message is too long.';
  if (input.rating !== null && !(Number.isInteger(input.rating) && input.rating >= 1 && input.rating <= 5))
    errors.rating = 'Choose a rating from 1 to 5.';
  return errors;
}

export interface FeedbackContext {
  userId: string;
  platform: FeedbackPlatform;
  appVersion: string;
}

/**
 * The fields saved to Firestore (the repository adds createdAt: serverTimestamp()). Text is trimmed;
 * an empty subject and a missing rating are left out, which is what the security rules expect.
 */
export function buildFeedbackPayload(input: FeedbackInput, ctx: FeedbackContext) {
  const subject = input.subject.trim();
  return {
    userId: ctx.userId,
    feedbackType: input.feedbackType,
    ...(subject ? { subject } : {}),
    message: input.message.trim(),
    ...(input.rating !== null ? { rating: input.rating } : {}),
    platform: ctx.platform,
    appVersion: ctx.appVersion,
    status: 'new' as const,
  };
}

/** Thrown by withTimeout when the save has not been confirmed in time (usually a lost connection). */
export class FeedbackTimeoutError extends Error {
  constructor() {
    super('feedback-timeout');
  }
}

/**
 * Waits for `work`, but gives up after `ms`. Firestore queues writes while offline instead of failing,
 * so without this the form would show "sending" forever. The original promise keeps running: the
 * screen keeps it and waits on the same one when the person retries, so a retry never sends twice.
 */
export function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new FeedbackTimeoutError()), ms);
    work.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/** How long the form waits for Firestore to confirm before offering a retry. */
export const FEEDBACK_SEND_TIMEOUT_MS = 20000;
