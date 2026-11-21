/**
 * User Communication & Support (docs/USER_MESSAGING_PLAN.md). Admin messages are created here, by the
 * Worker with the service account, after the caller has been verified as an admin. Users reply from the
 * app directly under strict Firestore rules; corrections (M2) also come through the Worker.
 *
 * supportThreads/{threadId}            uid, subject, category, related, status, counters, last message
 * supportThreads/{threadId}/messages/{messageId}
 *
 * The message id is the admin client's idempotency key: a retried send finds the existing message and
 * creates nothing. The push goes through the notification engine as a "messages" campaign addressed to
 * the one person, with lock-screen text that never includes the message itself.
 */
import { getGoogleAccessToken } from './googleAuth.js';

export const CATEGORIES = ['choir_request', 'sponsorship', 'testimony', 'written_testimony', 'feedback', 'report', 'comment', 'account', 'general'];
export const RELATED_TYPES = ['choir_request', 'sponsorship', 'testimony_submission', 'written_testimony', 'feedback', 'report', 'comment'];
/** First path segment of in-app destinations an action button may open (see the app's linking config). */
export const ACTION_ROUTES = ['messages', 'choir', 'sponsor', 'share', 'profile', 'feedback', 'notifications', 'testimony', 'written', 'article', 'lyrical', 'singers', 'live', 'radio', 'correction'];
export const LIMITS = { subject: 120, body: 4000, preview: 140, actionLabel: 40, url: 500, relatedLabel: 150 };
const ID = /^[A-Za-z0-9_-]{1,128}$/;
const KEY = /^[A-Za-z0-9_-]{8,64}$/;
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const PUSH_ABOUT = { choir_request: ' about your choir request', sponsorship: ' about your sponsorship', testimony: ' about your testimony', written_testimony: ' about your testimony', feedback: ' about your feedback', report: ' about your report', account: ' about your account' };

export class SupportInputError extends Error {}

const text = (v, max, name, { required = true } = {}) => {
  if (v === undefined || v === null || v === '') {
    if (required) throw new SupportInputError(`${name} is required.`);
    return '';
  }
  if (typeof v !== 'string') throw new SupportInputError(`${name} must be text.`);
  const s = v.replace(/\r\n/g, '\n').trim();
  if (required && !s) throw new SupportInputError(`${name} is required.`);
  if (s.length > max) throw new SupportInputError(`${name} is too long (max ${max} characters).`);
  if (CONTROL.test(s)) throw new SupportInputError(`${name} contains invalid characters.`);
  return s;
};

/** An action button: an in-app route ("choir", "messages/abc") or an https URL without credentials. */
export function parseAction(raw) {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) throw new SupportInputError('Invalid action button.');
  const label = text(raw.label, LIMITS.actionLabel, 'Button label');
  if (typeof raw.route === 'string' && raw.route) {
    const route = raw.route.trim().replace(/^\/+/, '');
    const m = route.match(/^([a-z]+)((?:\/[A-Za-z0-9_-]{1,100}){0,2})$/);
    if (!m || !ACTION_ROUTES.includes(m[1])) throw new SupportInputError('That button destination is not a screen in the app.');
    return { label, route };
  }
  if (typeof raw.url === 'string' && raw.url) {
    let u;
    try {
      u = new URL(raw.url.trim());
    } catch {
      throw new SupportInputError('The button link is not a valid web address.');
    }
    if (u.protocol !== 'https:' || u.username || u.password || u.href.length > LIMITS.url) throw new SupportInputError('Button links must be secure https:// addresses.');
    return { label, url: u.href };
  }
  throw new SupportInputError('Choose where the button goes.');
}

/** Validates an admin send request. Either threadId (reply) or subject + category (new conversation). */
export function parseSendRequest(raw) {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  if (typeof r.uid !== 'string' || !ID.test(r.uid)) throw new SupportInputError('A valid recipient is required.');
  if (typeof r.clientMessageId !== 'string' || !KEY.test(r.clientMessageId)) throw new SupportInputError('Missing message key.');
  const body = text(r.body, LIMITS.body, 'Message');
  const action = parseAction(r.action);
  if (r.threadId !== undefined && r.threadId !== null) {
    if (typeof r.threadId !== 'string' || !ID.test(r.threadId)) throw new SupportInputError('Invalid conversation.');
    return { uid: r.uid, clientMessageId: r.clientMessageId, threadId: r.threadId, body, action };
  }
  const subject = text(r.subject, LIMITS.subject, 'Subject');
  if (!CATEGORIES.includes(r.category)) throw new SupportInputError('Choose a message category.');
  let related = null;
  if (r.related !== undefined && r.related !== null) {
    const rel = r.related;
    if (typeof rel !== 'object' || !RELATED_TYPES.includes(rel.type) || typeof rel.id !== 'string' || !ID.test(rel.id)) throw new SupportInputError('Invalid related record.');
    related = { type: rel.type, id: rel.id, label: text(rel.label, LIMITS.relatedLabel, 'Related record', { required: false }) };
  }
  return { uid: r.uid, clientMessageId: r.clientMessageId, threadId: null, subject, category: r.category, related, body, action };
}

const preview = (s) => (s.length > LIMITS.preview ? `${s.slice(0, LIMITS.preview - 1)}…` : s).replace(/\s+/g, ' ');

/**
 * Creates the message (and the conversation, for a new one) plus its push campaign, in one atomic commit.
 * Returns { threadId, messageId, created, duplicate }. Throws SupportInputError for a bad recipient/thread.
 */
export async function sendSupportMessage(store, input, { adminUid, now = Date.now() }) {
  const users = await store.get('users', [input.uid]);
  if (!users.get(input.uid)) throw new SupportInputError('That user was not found.');

  const threadId = input.threadId ?? `th_${input.clientMessageId}`;
  const messageId = input.clientMessageId;
  const msgCol = `supportThreads/${threadId}/messages`;
  const existing = (await store.get(msgCol, [messageId])).get(messageId);
  if (existing) return { threadId, messageId, created: false, duplicate: true };

  const thread = (await store.get('supportThreads', [threadId])).get(threadId);
  if (input.threadId) {
    if (!thread) throw new SupportInputError('That conversation no longer exists.');
    if (thread.data.uid !== input.uid) throw new SupportInputError('That conversation belongs to someone else.');
  }
  const category = thread?.data.category ?? input.category;
  const campaignId = `msg_${messageId}`;
  const message = {
    senderType: 'admin',
    senderUid: adminUid,
    body: input.body,
    ...(input.action ? { action: input.action } : {}),
    createdAt: new Date(now),
    readAt: null,
    delivery: { status: 'queued', campaignId },
  };
  const last = { lastMessageAt: new Date(now), lastMessagePreview: preview(input.body), lastSender: 'admin', updatedAt: new Date(now), status: 'awaiting_user', unreadForAdmin: 0 };
  const writes = [{ col: msgCol, id: messageId, kind: 'create', data: message }];
  if (thread) {
    writes.push({ col: 'supportThreads', id: threadId, kind: 'update', ifVersion: thread.version, data: last, inc: { unreadForUser: 1, messageCount: 1 } });
  } else {
    writes.push({
      col: 'supportThreads',
      id: threadId,
      kind: 'create',
      data: { uid: input.uid, subject: input.subject, category, related: input.related, createdBy: adminUid, createdAt: new Date(now), unreadForUser: 1, messageCount: 1, ...last },
    });
  }
  writes.push({
    col: 'notificationCampaigns',
    id: campaignId,
    kind: 'create',
    data: {
      title: 'Message from Testimonies of Praise',
      body: `Our team has sent you a message${PUSH_ABOUT[category] ?? ''}. Open the app to read it.`,
      type: 'message',
      category: 'messages',
      contentId: threadId,
      audienceUids: [input.uid],
      publishAt: now,
      expiresAt: now + 7 * 24 * 3600 * 1000,
      priority: 92,
      dedupeKey: `message:${messageId}`,
      delivery: 'immediate',
      status: 'scheduled',
      dueAt: now,
      source: 'support',
      createdAt: now,
      copySource: 'template',
      counts: { queued: 0, sent: 0, skipped: 0, failed: 0, expired: 0 },
    },
  });
  const results = await store.commit(writes, true);
  if (!results.every((x) => x.ok)) {
    // Someone else wrote first (a retry or a reply at the same moment): report it as a duplicate if ours exists.
    const again = (await store.get(msgCol, [messageId])).get(messageId);
    if (again) return { threadId, messageId, created: false, duplicate: true };
    throw new Error('The conversation changed while sending. Please try again.');
  }
  return { threadId, messageId, created: true, duplicate: false, campaignId };
}

/**
 * Firebase Auth details for admins (email is not stored in Firestore). By uid list or by one email.
 * Returns [{ uid, email, emailVerified, createdAt, lastSignInAt, disabled }].
 */
export async function lookupAuthUsers(env, { uids, email }, { fetchFn = fetch } = {}) {
  const body = {};
  if (Array.isArray(uids) && uids.length) {
    const list = uids.filter((u) => typeof u === 'string' && ID.test(u)).slice(0, 50);
    if (!list.length) return [];
    body.localId = list;
  } else if (typeof email === 'string' && /^[^\s@]{1,64}@[^\s@]{1,190}$/.test(email.trim())) {
    body.email = [email.trim().toLowerCase()];
  } else {
    throw new SupportInputError('Give a user id or an email address.');
  }
  const token = await getGoogleAccessToken(env.FIREBASE_SERVICE_ACCOUNT, 'https://www.googleapis.com/auth/identitytoolkit', { fetchFn });
  const res = await fetchFn(`https://identitytoolkit.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/accounts:lookup`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`User lookup failed (${res.status})`);
  const j = await res.json();
  return (j.users || []).map((u) => ({
    uid: u.localId,
    email: u.email ?? null,
    emailVerified: u.emailVerified === true,
    createdAt: u.createdAt ? Number(u.createdAt) : null,
    lastSignInAt: u.lastLoginAt ? Number(u.lastLoginAt) : null,
    disabled: u.disabled === true,
  }));
}
