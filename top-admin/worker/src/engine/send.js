/**
 * Sends approved queue entries through Expo, one person at a time, with a delivery record per person.
 *
 * Guarantees:
 *  - A person who already has a final record for an entry (sent, capped, no_device, or failed out of
 *    attempts) is never sent it again, even after a retry or a rerun.
 *  - Quiet hours defer a person; the record stays 'deferred' and the entry is revisited on later runs.
 *  - Frequency caps are checked per person; a capped person gets a final 'capped' record.
 *  - Transient transport failures are retried a few times; DeviceNotRegistered removes the token.
 *  - The kill switch is re-read before every entry, and the run stops at once when it is off.
 */
import { selectAudience } from './audience.js';
import { capDecision, DAY_MS, engineAllows } from './policy.js';

export const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
export const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';
export const CHUNK_SIZE = 100;
export const MAX_ATTEMPTS = 3;
const TRANSPORT_RETRIES = 2;
const MAX_ENTRIES_PER_RUN = 10;
const MAX_DEVICES = 5000;
const FINAL = new Set(['sent', 'capped', 'no_device']);

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export const safeId = (value) => String(value).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 300);

/** Devices opted in to one category, from pushTokens. The category filter keeps reads small. */
export async function loadDevices(store, category) {
  const rows = await store.query({
    collection: 'pushTokens',
    filters: [{ field: `prefs.${category}`, op: 'EQUAL', value: true }],
    limit: MAX_DEVICES,
  });
  return rows.map((r) => ({ docId: r.id, token: r.data.token, uid: r.data.uid, platform: r.data.platform, prefs: r.data.prefs, utcOffsetMinutes: r.data.utcOffsetMinutes }));
}

/** Send counts from the last 24 hours, keyed by uid. Old windows count as zero. */
export async function loadCounters(store, now) {
  const rows = await store.query({
    collection: 'notificationCounters',
    filters: [{ field: 'windowStart', op: 'GREATER_THAN', value: new Date(now - DAY_MS) }],
    limit: MAX_DEVICES,
  });
  return new Map(rows.map((r) => [r.id, r.data]));
}

/** One Expo request for up to CHUNK_SIZE messages. Returns { tickets } or { transport: true }. */
async function postChunk(messages, { fetchFn, sleep, expoUrl }) {
  for (let attempt = 0; attempt <= TRANSPORT_RETRIES; attempt += 1) {
    if (attempt > 0) await sleep(500 * 3 ** (attempt - 1));
    let response;
    try {
      response = await fetchFn(expoUrl, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(messages.map((m) => m.payload)),
      });
    } catch {
      continue;
    }
    if (response.status >= 500 || response.status === 429) continue;
    if (!response.ok) return { transport: true };
    const json = await response.json().catch(() => null);
    return Array.isArray(json?.data) ? { tickets: json.data } : { transport: true };
  }
  return { transport: true };
}

/**
 * Sends one message per device. Returns Map uid -> { tickets: [{ ticketId, docId }], ok, deadDocIds }.
 */
export async function deliverMessages(messages, { fetchFn = fetch, sleep = defaultSleep, expoUrl = EXPO_PUSH_URL } = {}) {
  const byUid = new Map();
  const entryFor = (uid) => {
    if (!byUid.has(uid)) byUid.set(uid, { tickets: [], ok: false, transient: false, deadDocIds: [], devices: 0 });
    return byUid.get(uid);
  };
  for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
    const chunk = messages.slice(i, i + CHUNK_SIZE);
    for (const m of chunk) entryFor(m.uid).devices += 1;
    const result = await postChunk(chunk, { fetchFn, sleep, expoUrl });
    chunk.forEach((m, idx) => {
      const out = entryFor(m.uid);
      if (result.transport) {
        out.transient = true;
        return;
      }
      const ticket = result.tickets[idx];
      if (ticket?.status === 'ok' && ticket.id) {
        out.ok = true;
        out.tickets.push({ ticketId: ticket.id, docId: m.docId });
      } else if (ticket?.details?.error === 'DeviceNotRegistered') {
        out.deadDocIds.push(m.docId);
      } else {
        out.transient = true;
      }
    });
  }
  return byUid;
}

/** Works out each person's status for one entry. Pure apart from reading the delivery records it is given. */
export function planEntry({ devices, deliveries, sentLast24h, caps, quiet, category, now, maxAttempts = MAX_ATTEMPTS }) {
  const finalUids = new Set();
  const attempts = new Map();
  for (const d of deliveries) {
    if (FINAL.has(d.status) || (d.status === 'failed' && (d.attempts || 0) >= maxAttempts)) finalUids.add(d.uid);
    attempts.set(d.uid, d.attempts || 0);
  }
  const pending = devices.filter((d) => !finalUids.has(d.uid));
  const audience = selectAudience(pending, { category, nowUtcMs: now, quiet, caps, sentLast24h });
  const groups = new Map();
  for (const r of audience.recipients) {
    if (!groups.has(r.uid)) groups.set(r.uid, { uid: r.uid, deferred: r.sendAfterUtc > now });
  }
  // Capped people are recorded as final, so they never receive this entry later, after their cap resets.
  const capped = new Set();
  for (const d of pending) {
    if (!groups.has(d.uid) && capDecision(sentLast24h[d.uid], category, caps).allowed === false) capped.add(d.uid);
  }
  return {
    due: [...groups.values()].filter((g) => !g.deferred).map((g) => g.uid),
    deferred: [...groups.values()].filter((g) => g.deferred).map((g) => g.uid),
    capped: [...capped],
    attempts,
  };
}

/** Sends one approved entry. Returns a summary and writes delivery records through the store. */
export async function processEntry(store, key, entry, { now, devices, settingsCaps, quiet, sentLast24h, counters, fetchFn, sleep, expoUrl }) {
  const deliveries = (await store.query({ collection: 'notification_deliveries', filters: [{ field: 'queueKey', op: 'EQUAL', value: key }], limit: MAX_DEVICES })).map((r) => r.data);
  const plan = planEntry({ devices, deliveries, sentLast24h, caps: settingsCaps, quiet, category: entry.category, now });

  const messagesFor = (uids) =>
    devices
      .filter((d) => uids.includes(d.uid))
      .map((d) => ({
        uid: d.uid,
        docId: d.docId,
        payload: { to: d.token, title: entry.title, body: entry.body, data: { type: entry.type, contentId: entry.contentId }, sound: 'default', channelId: 'default', priority: 'high', _displayInForeground: true },
      }));

  const results = await deliverMessages(messagesFor(plan.due), { fetchFn, sleep, expoUrl });
  const writes = [];
  const removedDocIds = [];
  const counts = { sent: 0, failed: 0, no_device: 0, deferred: 0, capped: 0 };

  let openFailures = 0; // people whose send failed and who still have attempts left
  for (const uid of plan.due) {
    const r = results.get(uid);
    const prev = plan.attempts.get(uid) || 0;
    removedDocIds.push(...(r?.deadDocIds || []));
    let status;
    if (r?.ok) status = 'sent';
    else if (r && !r.transient && r.devices > 0 && r.deadDocIds.length === r.devices) status = 'no_device';
    else status = 'failed';
    counts[status] += 1;
    if (status === 'failed' && prev + 1 < MAX_ATTEMPTS) openFailures += 1;
    writes.push({
      op: 'set',
      path: `notification_deliveries/${safeId(key)}__${safeId(uid)}`,
      data: { queueKey: key, uid, status, attempts: status === 'failed' ? prev + 1 : prev, tickets: r?.tickets || [], receiptChecked: status !== 'sent', updatedAt: new Date(now), ...(status === 'sent' ? { sentAt: new Date(now) } : {}) },
      merge: false,
    });
    if (status === 'sent') {
      const c = counters.get(uid);
      const fresh = c && c.windowStart instanceof Date && c.windowStart.getTime() > now - DAY_MS;
      const next = fresh
        ? { windowStart: c.windowStart, total: (c.total || 0) + 1, byCategory: { ...(c.byCategory || {}), [entry.category]: ((c.byCategory || {})[entry.category] || 0) + 1 } }
        : { windowStart: new Date(now), total: 1, byCategory: { [entry.category]: 1 } };
      counters.set(uid, next);
      writes.push({ op: 'set', path: `notificationCounters/${safeId(uid)}`, data: next, merge: false });
    }
  }
  for (const uid of plan.deferred) {
    counts.deferred += 1;
    writes.push({ op: 'set', path: `notification_deliveries/${safeId(key)}__${safeId(uid)}`, data: { queueKey: key, uid, status: 'deferred', attempts: plan.attempts.get(uid) || 0, tickets: [], receiptChecked: true, updatedAt: new Date(now) }, merge: false });
  }
  for (const uid of plan.capped) {
    counts.capped += 1;
    writes.push({ op: 'set', path: `notification_deliveries/${safeId(key)}__${safeId(uid)}`, data: { queueKey: key, uid, status: 'capped', attempts: 0, tickets: [], receiptChecked: true, updatedAt: new Date(now) }, merge: false });
  }
  if (writes.length) await store.writeMany(writes);

  for (const docId of removedDocIds) await store.delete(`pushTokens/${docId}`);

  return { counts, removed: removedDocIds.length, complete: counts.deferred === 0 && openFailures === 0 };
}

/** Sends every approved entry that is due. */
export async function sendApproved(store, { now, fetchFn = fetch, sleep = defaultSleep, expoUrl = EXPO_PUSH_URL, quiet, caps, maxEntries = MAX_ENTRIES_PER_RUN }) {
  const summary = { entries: 0, completed: 0, counts: { sent: 0, failed: 0, no_device: 0, deferred: 0, capped: 0 }, removed: 0, stopped: null };
  const approved = await store.query({
    collection: 'notification_queue',
    filters: [{ field: 'status', op: 'EQUAL', value: 'approved' }],
    orderBy: [{ field: 'sendAfter', direction: 'ASCENDING' }],
    limit: maxEntries,
  });
  for (const { id: key, data: entry } of approved) {
    if (!(entry.sendAfter instanceof Date) || entry.sendAfter.getTime() > now) continue;
    // Re-read the kill switch for every entry: an admin can stop the engine in the middle of a run.
    const settings = await store.get('settings/notifications');
    const gate = engineAllows(settings && { enabled: settings.enabled === true, categories: settings.categories || {} }, entry.category);
    if (!gate.allowed) {
      summary.stopped = gate.reason;
      if (gate.reason === 'engine_disabled') break;
      continue;
    }
    summary.entries += 1;
    const devices = await loadDevices(store, entry.category);
    const counters = await loadCounters(store, now);
    const sentLast24h = Object.fromEntries(counters);
    const result = await processEntry(store, key, entry, { now, devices, settingsCaps: caps, quiet, sentLast24h, counters, fetchFn, sleep, expoUrl });
    for (const k of Object.keys(summary.counts)) summary.counts[k] += result.counts[k];
    summary.removed += result.removed;
    if (result.complete) {
      summary.completed += 1;
      // An entry where nobody was reached is 'failed', so it shows in the admin view as needing attention.
      const status = result.counts.sent === 0 && result.counts.failed + result.counts.no_device > 0 ? 'failed' : 'sent';
      await store.update(`notification_queue/${key}`, { status, completedAt: new Date(now) });
      await store.set(`notification_history/${safeId(key)}`, {
        queueKey: key,
        type: entry.type,
        contentId: entry.contentId,
        category: entry.category,
        title: entry.title,
        sent: result.counts.sent,
        failed: result.counts.failed,
        noDevice: result.counts.no_device,
        capped: result.counts.capped,
        removedTokens: result.removed,
        completedAt: new Date(now),
      });
    }
  }
  return summary;
}
