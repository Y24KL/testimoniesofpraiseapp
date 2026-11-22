/**
 * Admin delivery tests through the real production pipeline (Notification System 3.0, step A).
 *
 * sendTestNotification: one campaign addressed to one person ("messages" category: always on, outside the daily
 * limit), then one engine run, exactly like a real send. testDeliveryStatus: per device, what happened at each
 * stage: queued, provider accepted (ticket), provider receipt (fetched from Expo on demand), or the failure.
 * Opening is not knowable here; the app records it when the person taps the notification.
 */
import { COL } from './engine.js';

const ID = /^[A-Za-z0-9_-]{1,128}$/;

export class TestInputError extends Error {}

/** Devices registered for a person, summarised without exposing tokens. */
export async function devicesFor(store, uid) {
  const rows = await store.whereIn(COL.tokens, 'uid', [uid]);
  return rows.map((r) => ({
    id: r.id.slice(0, 8),
    platform: r.data.platform ?? 'unknown',
    provider: r.data.fcmToken ? 'fcm' : r.data.web ? 'webpush' : 'expo',
    appVersion: r.data.appVersion ?? null,
    updatedAt: typeof r.data.updatedAt === 'number' ? r.data.updatedAt : null,
    credFailures: r.data.credFailures ?? 0,
  }));
}

export async function sendTestNotification(store, { uid, adminUid, now = Date.now() }) {
  if (typeof uid !== 'string' || !ID.test(uid)) throw new TestInputError('Choose a valid user.');
  if (!(await store.get('users', [uid])).get(uid)) throw new TestInputError('That user was not found.');
  const devices = await devicesFor(store, uid);
  if (!devices.length) return { campaignId: null, devices, created: false };
  const campaignId = `test_${uid.slice(0, 40)}_${now.toString(36)}`.replace(/[^A-Za-z0-9_-]/g, '_');
  const [r] = await store.commit([{
    col: COL.campaigns,
    id: campaignId,
    kind: 'create',
    data: {
      title: 'Test notification from Testimonies of Praise',
      body: 'If you can see this, notifications are working on this phone.',
      type: 'announcement',
      category: 'messages',
      audienceUids: [uid],
      publishAt: now,
      expiresAt: now + 60 * 60 * 1000,
      priority: 99,
      dedupeKey: `test:${campaignId}`,
      delivery: 'immediate',
      status: 'scheduled',
      dueAt: now,
      source: 'test',
      createdBy: adminUid,
      createdAt: now,
      copySource: 'template',
      counts: { queued: 0, sent: 0, skipped: 0, failed: 0, expired: 0 },
    },
  }], false);
  return { campaignId, devices, created: r.ok };
}

/** Per-device stages for one test (or any) campaign. Fetches Expo receipts if the engine has not yet. */
export async function testDeliveryStatus(store, sender, campaignId) {
  if (typeof campaignId !== 'string' || !ID.test(campaignId)) throw new TestInputError('Invalid campaign.');
  const campaign = (await store.get(COL.campaigns, [campaignId])).get(campaignId);
  if (!campaign) throw new TestInputError('That campaign was not found.');
  const items = await store.whereIn(COL.queue, 'campaignId', [campaignId]);
  const ticketIds = items.flatMap((i) => (Array.isArray(i.data.tickets) ? i.data.tickets.map((t) => t?.id).filter(Boolean) : []));
  let receipts = {};
  if (ticketIds.length && items.some((i) => !i.data.receiptStatus)) receipts = await sender.receipts(ticketIds.slice(0, 50)).catch(() => ({}));
  return {
    campaign: { id: campaignId, status: campaign.data.status, counts: campaign.data.counts ?? {} },
    people: items.map((i) => {
      const d = i.data;
      const tickets = Array.isArray(d.tickets) ? d.tickets : [];
      const live = tickets.map((t) => receipts[t?.id]).filter(Boolean);
      const receipt = d.receiptStatus
        ?? (live.length ? (live.every((x) => x.status === 'ok') ? 'ok' : live.find((x) => x.status !== 'ok')?.details?.error ?? 'error') : null);
      return {
        queued: true,
        status: d.status,
        channel: d.channel ?? null,
        accepted: d.status === 'sent',
        provider: d.status === 'sent' ? (tickets.length ? 'expo' : d.channel === 'in_app' ? 'in_app' : 'fcm') : null,
        tickets: tickets.length,
        receipt: d.status !== 'sent' ? null : tickets.length ? (receipt ?? 'pending') : 'not_available',
        error: d.lastError ?? d.skipReason ?? null,
        deferredBy: d.lastDeferReason ?? null,
      };
    }),
  };
}
