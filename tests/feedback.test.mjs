// Unit tests for "Feedback & Suggestions" validation and the saved payload.
// Run: node --experimental-strip-types tests/feedback.test.mjs   (npm run test:feedback)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const { validateFeedback, buildFeedbackPayload, withTimeout, FeedbackTimeoutError, FEEDBACK_LIMITS, FEEDBACK_TYPES, FEEDBACK_TYPE_LABELS, EMPTY_FEEDBACK } =
  await import('../src/utils/feedback.ts');

let n = 0;
const good = { feedbackType: 'suggestion', subject: '  Dark mode  ', message: '  Please add offline radio.  ', rating: 4 };
const ctx = { userId: 'alice', platform: 'android', appVersion: '1.0.9' };

// A complete form has no errors; subject and rating are optional.
assert.deepEqual(validateFeedback(good), {});
assert.deepEqual(validateFeedback({ ...good, subject: '', rating: null }), {});
n++;

// The message is required: empty and whitespace-only are rejected. The empty starting form cannot be sent.
assert.equal(validateFeedback({ ...good, message: '' }).message, 'Please write your message before sending.');
assert.equal(validateFeedback({ ...good, message: '   \n  ' }).message, 'Please write your message before sending.');
assert.equal(Object.keys(validateFeedback(EMPTY_FEEDBACK)).join(), 'message');
n++;

// Length limits (measured after trimming).
assert.equal(validateFeedback({ ...good, message: 'x'.repeat(FEEDBACK_LIMITS.message) }).message, undefined);
assert.equal(validateFeedback({ ...good, message: 'x'.repeat(FEEDBACK_LIMITS.message + 1) }).message, 'This message is too long.');
assert.equal(validateFeedback({ ...good, subject: 'x'.repeat(FEEDBACK_LIMITS.subject + 1) }).subject, 'This subject is too long.');
n++;

// Only the five known categories and whole-number ratings 1-5.
assert.equal(validateFeedback({ ...good, feedbackType: 'spam' }).feedbackType, 'Choose a feedback type.');
for (const rating of [0, 6, 2.5, -1]) assert.equal(validateFeedback({ ...good, rating }).rating, 'Choose a rating from 1 to 5.', String(rating));
for (const rating of [1, 2, 3, 4, 5]) assert.equal(validateFeedback({ ...good, rating }).rating, undefined);
assert.deepEqual(
  FEEDBACK_TYPES.map((t) => FEEDBACK_TYPE_LABELS[t]),
  ['General Feedback', 'Suggestion / Feature Request', 'Report a Problem', 'User Experience', 'Other'],
);
n++;

// The payload is trimmed, always 'new', and carries nothing beyond the agreed fields.
assert.deepEqual(buildFeedbackPayload(good, ctx), {
  userId: 'alice',
  feedbackType: 'suggestion',
  subject: 'Dark mode',
  message: 'Please add offline radio.',
  rating: 4,
  platform: 'android',
  appVersion: '1.0.9',
  status: 'new',
});
// An empty subject and a missing rating are left out entirely.
assert.deepEqual(Object.keys(buildFeedbackPayload({ ...good, subject: '  ', rating: null }, ctx)).sort(), ['appVersion', 'feedbackType', 'message', 'platform', 'status', 'userId']);
n++;

// withTimeout: passes results and errors through, and gives up when the save never confirms.
assert.equal(await withTimeout(Promise.resolve('ok'), 50), 'ok');
await assert.rejects(withTimeout(Promise.reject(new Error('boom')), 50), /boom/);
await assert.rejects(withTimeout(new Promise(() => {}), 20), FeedbackTimeoutError);
n++;

// The web copy must stay identical to the mobile one (apart from the header comment).
const strip = (s) => s.replace(/\r\n/g, '\n').replace(/^\/\*\*[\s\S]*?\*\/\n/, '');
assert.equal(
  strip(readFileSync(new URL('../web/src/utils/feedback.ts', import.meta.url), 'utf8')),
  strip(readFileSync(new URL('../src/utils/feedback.ts', import.meta.url), 'utf8')),
);
n++;

console.log(`feedback tests passed (${n} groups)`);
