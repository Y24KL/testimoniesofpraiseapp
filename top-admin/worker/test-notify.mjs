/**
 * End-to-end tests for the notification engine (src/notify): a content event is fanned out to devices and
 * delivered in the same run, and the per-person rules hold: categories, quiet hours, daily cap, dedupe,
 * dead tokens, retries and the engine switch. Uses an in-memory store with the same contract as the
 * Firestore store (preconditions, versions, atomic commits) and a fake Expo.
 *
 *   node test-notify.mjs
 */
import assert from 'node:assert/strict';
import { COL, eventCampaign, evaluate, normalizeLedger, normalizeSettings, runDispatcher } from './src/notify/engine.js';
import { parseEvent, NotifyInputError, createCampaign } from './src/notify/index.js';

let passed = 0;
const test = async (name, fn) => {
  await fn();
  passed += 1;
  console.log(`  ✔ ${name}`);
};

// ---------------- in-memory store (same contract as createFirestoreStore) ----------------
function memoryStore(initial = {}) {
  const docs = new Map();
  let clock = 0;
  const ver = () => `v${++clock}`;
  for (const [path, data] of Object.entries(initial)) docs.set(path, { data: structuredClone(data), version: ver() });
  const inCol = (col) => [...docs.entries()].filter(([p]) => p.startsWith(`${col}/`) && !p.slice(col.length + 1).includes('/')).map(([p, d]) => ({ id: p.slice(col.length + 1), data: structuredClone(d.data), version: d.version }));
  const setPath = (o, path, v) => { const ks = path.split('.'); let x = o; for (const k of ks.slice(0, -1)) x = x[k] = x[k] && typeof x[k] === 'object' ? x[k] : {}; x[ks.at(-1)] = v; };
  const getPath = (o, path) => path.split('.').reduce((x, k) => (x == null ? undefined : x[k]), o);
  const delPath = (o, path) => { const ks = path.split('.'); const p = ks.slice(0, -1).reduce((x, k) => (x == null ? undefined : x[k]), o); if (p) delete p[ks.at(-1)]; };
  const precondition = (w) => {
    const cur = docs.get(`${w.col}/${w.id}`);
    if (w.kind === 'create' || w.ifVersion === null) return !cur;
    if (typeof w.ifVersion === 'string') return cur?.version === w.ifVersion;
    if (w.kind === 'update') return Boolean(cur);
    return true;
  };
  const apply = (w) => {
    const key = `${w.col}/${w.id}`;
    if (w.kind === 'delete') { docs.delete(key); return { ok: true }; }
    let data = w.kind === 'create' || w.kind === 'set' ? structuredClone(w.data || {}) : structuredClone(docs.get(key)?.data || {});
    if (w.kind !== 'create' && w.kind !== 'set') for (const [k, v] of Object.entries(w.data || {})) setPath(data, k, structuredClone(v));
    for (const r of w.remove || []) delPath(data, r);
    for (const [k, n] of Object.entries(w.inc || {})) setPath(data, k, (Number(getPath(data, k)) || 0) + n);
    const version = ver();
    docs.set(key, { data, version });
    return { ok: true, version };
  };
  return {
    docs,
    doc: (path) => docs.get(path)?.data ?? null,
    col: inCol,
    async get(col, ids) {
      return new Map(ids.map((id) => { const d = docs.get(`${col}/${id}`); return [id, d ? { id, data: structuredClone(d.data), version: d.version } : null]; }));
    },
    async dueQuery(col, field, max, limit) {
      return inCol(col).filter((d) => typeof d.data[field] === 'number' && d.data[field] <= max).sort((a, b) => a.data[field] - b.data[field]).slice(0, limit);
    },
    async getPaths(paths) {
      return new Map(paths.map((p) => { const d = docs.get(p); return [p, d ? { id: p.split('/').pop(), data: structuredClone(d.data), version: d.version } : null]; }));
    },
    async whereIn(col, field, values) {
      return inCol(col).filter((d) => values.includes(d.data[field]));
    },
    async pageById(col, afterId, limit) {
      return inCol(col).sort((a, b) => (a.id < b.id ? -1 : 1)).filter((d) => !afterId || d.id > afterId).slice(0, limit);
    },
    async commit(writes, atomic) {
      if (atomic) {
        if (!writes.every(precondition)) return writes.map(() => ({ ok: false }));
        return writes.map(apply);
      }
      return writes.map((w) => (precondition(w) ? apply(w) : { ok: false }));
    },
  };
}

// ---------------- fake Expo ----------------
function fakeSender(plan = () => null) {
  const sent = [];
  return {
    sent,
    async expo(msgs) {
      return msgs.map((m) => {
        const forced = plan(m);
        if (forced) return forced;
        sent.push(m);
        return { status: 'ok', id: `ticket-${sent.length}` };
      });
    },
    async receipts() { return {}; },
    async webPush() { return { status: 'ok' }; },
  };
}

const H = 3600000;
const NOW = Date.UTC(2026, 10, 21, 11, 0); // 12:00 in Lagos (UTC+1): outside quiet hours
const tok = (name) => `ExponentPushToken[${name}]`;
const device = (uid, name, prefs = { testimonies: true, live: true, announcements: true, loveworld: true }) => ({ uid, token: tok(name), platform: 'android', prefs, updatedAt: NOW - H });
const run = (store, sender, now = NOW) => runDispatcher(store, sender, { now });
async function publish(store, ev, now = NOW) {
  const c = eventCampaign({ contentId: null, ...ev }, now);
  await store.commit([{ col: COL.campaigns, id: c.id, kind: 'create', data: c.data }], false);
  return c.id;
}
const testimony = (id = 't1') => ({ type: 'testimony', contentId: id, title: 'A testimony of healing', body: 'Watch how God healed Ada.', category: 'testimonies' });

// ---------------- send on publish ----------------
await test('a published testimony reaches every opted-in device in the same run', async () => {
  const store = memoryStore({ 'pushTokens/a1': device('a', 'a1'), 'pushTokens/b1': device('b', 'b1') });
  const sender = fakeSender();
  await publish(store, testimony());
  const rep = await run(store, sender);
  assert.equal(rep.queued, 2);
  assert.equal(rep.sent, 2);
  assert.deepEqual(sender.sent.map((m) => m.to).sort(), [tok('a1'), tok('b1')]);
  const m = sender.sent[0];
  assert.equal(m.sound, 'default');
  assert.equal(m.channelId, 'default');
  assert.equal(m.priority, 'high');
  assert.equal(m.data.type, 'testimony');
  assert.equal(m.data.contentId, 't1');
});

await test('publishing the same content twice never sends it twice', async () => {
  const store = memoryStore({ 'pushTokens/a1': device('a', 'a1') });
  const sender = fakeSender();
  await publish(store, testimony());
  await run(store, sender);
  await publish(store, testimony()); // same campaign id: create fails
  await run(store, sender, NOW + 5 * 60000);
  await run(store, sender, NOW + 10 * 60000);
  assert.equal(sender.sent.length, 1);
});

await test('a person with that category switched off is not queued', async () => {
  const store = memoryStore({
    'pushTokens/a1': device('a', 'a1', { testimonies: false, live: true }),
    'pushTokens/b1': device('b', 'b1'),
  });
  const sender = fakeSender();
  await publish(store, testimony());
  const rep = await run(store, sender);
  assert.equal(rep.notQueued, 1);
  assert.deepEqual(sender.sent.map((m) => m.to), [tok('b1')]);
});

await test('per-person settings override the legacy device preferences', async () => {
  const store = memoryStore({
    'pushTokens/a1': device('a', 'a1'),
    'notificationSettings/a': { categories: { testimonies: false } },
  });
  const sender = fakeSender();
  await publish(store, testimony());
  await run(store, sender);
  assert.equal(sender.sent.length, 0);
});

// ---------------- timing rules ----------------
await test('quiet hours are off by default: a push at night is sent at once', async () => {
  const night = Date.UTC(2026, 10, 21, 22, 0); // 23:00 Lagos
  const store = memoryStore({ 'pushTokens/a1': device('a', 'a1') });
  const sender = fakeSender();
  await publish(store, testimony(), night);
  const rep = await run(store, sender, night);
  assert.equal(rep.sent, 1);
  assert.equal(rep.deferred, 0);
});

await test('for someone who turned quiet hours on, the push is held, then sent when they end', async () => {
  const night = Date.UTC(2026, 10, 21, 22, 0); // 23:00 Lagos
  const store = memoryStore({ 'pushTokens/a1': device('a', 'a1'), 'notificationSettings/a': { quietHours: { enabled: true, start: '22:00', end: '07:00' } } });
  const sender = fakeSender();
  await publish(store, testimony(), night);
  const rep = await run(store, sender, night);
  assert.equal(rep.sent, 0);
  assert.equal(rep.deferred, 1);
  await run(store, sender, Date.UTC(2026, 10, 22, 5, 0)); // 06:00 Lagos: still quiet
  assert.equal(sender.sent.length, 0);
  await run(store, sender, Date.UTC(2026, 10, 22, 6, 1)); // 07:01 Lagos
  assert.equal(sender.sent.length, 1);
});

await test('the daily limit holds further pushes until the next day', async () => {
  const store = memoryStore({ 'pushTokens/a1': device('a', 'a1'), 'notificationSettings/a': { dailyMax: 1 } });
  const sender = fakeSender();
  await publish(store, testimony('t1'));
  await run(store, sender);
  await publish(store, testimony('t2'), NOW + 3 * H);
  const rep = await run(store, sender, NOW + 3 * H);
  assert.equal(sender.sent.length, 1);
  assert.equal(rep.deferred, 1);
});

await test('by default a person gets up to 5 a day; the 6th waits for tomorrow', async () => {
  const store = memoryStore({ 'pushTokens/a1': device('a', 'a1') });
  const sender = fakeSender();
  let last;
  for (let i = 1; i <= 6; i += 1) {
    const at = NOW + i * 15 * 60000;
    await publish(store, testimony(`t${i}`), at);
    last = await run(store, sender, at);
  }
  assert.equal(sender.sent.length, 5);
  assert.equal(last.deferred, 1);
});

await test('three items published together all arrive within minutes, one per run', async () => {
  const store = memoryStore({ 'pushTokens/a1': device('a', 'a1') });
  const sender = fakeSender();
  for (const id of ['t1', 't2', 't3']) await publish(store, testimony(id));
  await run(store, sender);
  assert.equal(sender.sent.length, 1, 'one per person per run');
  await run(store, sender, NOW + 2 * 60000);
  await run(store, sender, NOW + 4 * 60000);
  assert.equal(sender.sent.length, 3, 'the rest follow on the next runs, not 2 hours later');
  assert.equal(new Set(sender.sent.map((m) => m.data.contentId)).size, 3);
});

await test('content sent on publish is not held back by the 2-hour gap', async () => {
  const store = memoryStore({ 'pushTokens/a1': device('a', 'a1') });
  const sender = fakeSender();
  await publish(store, testimony('t1'));
  await run(store, sender);
  await publish(store, testimony('t2'), NOW + 10 * 60000);
  await run(store, sender, NOW + 10 * 60000);
  assert.equal(sender.sent.length, 2);
});

await test('a live broadcast is delivered immediately', async () => {
  const store = memoryStore({ 'pushTokens/a1': device('a', 'a1') });
  const sender = fakeSender();
  await publish(store, { type: 'live', title: 'We are live', body: 'Join the service now.', category: 'live' });
  await run(store, sender);
  assert.equal(sender.sent.length, 1);
  assert.equal(sender.sent[0].data.type, 'live');
});

// ---------------- lanes: urgent and live ----------------
const announcement = (title, urgent = false) => ({ type: 'announcement', title, body: 'Please read this.', category: 'announcements', ...(urgent ? { urgent: true } : {}) });

await test('an urgent announcement skips the daily limit; a normal one waits', async () => {
  const store = memoryStore({ 'pushTokens/a1': device('a', 'a1'), 'notificationSettings/a': { dailyMax: 1 } });
  const sender = fakeSender();
  await publish(store, testimony('t1'));
  await run(store, sender);
  await publish(store, announcement('Service moved to 6pm', true), NOW + 5 * 60000);
  await run(store, sender, NOW + 5 * 60000);
  await publish(store, announcement('Weekly update'), NOW + 10 * 60000);
  const rep = await run(store, sender, NOW + 10 * 60000);
  assert.deepEqual(sender.sent.map((m) => m.title), ['A testimony of healing', 'Service moved to 6pm']);
  assert.equal(rep.deferred, 1, 'the normal announcement waits for tomorrow');
});

await test('urgent notifications do not use up the daily limit', async () => {
  const store = memoryStore({ 'pushTokens/a1': device('a', 'a1'), 'notificationSettings/a': { dailyMax: 1 } });
  const sender = fakeSender();
  await publish(store, announcement('Urgent one', true));
  await run(store, sender);
  await publish(store, testimony('t1'), NOW + 5 * 60000);
  await run(store, sender, NOW + 5 * 60000);
  assert.equal(sender.sent.length, 2);
});

await test('live broadcasts are outside the daily limit, at most 2 a day', async () => {
  const store = memoryStore({ 'pushTokens/a1': device('a', 'a1'), 'notificationSettings/a': { dailyMax: 1 } });
  const sender = fakeSender();
  await publish(store, testimony('t1'));
  await run(store, sender);
  let last;
  for (const [i, title] of ['Morning service', 'Evening service', 'Night vigil'].entries()) {
    const at = NOW + (i + 1) * 10 * 60000;
    await publish(store, { type: 'live', title, body: 'Join us live now.', category: 'live' }, at);
    last = await run(store, sender, at);
  }
  assert.deepEqual(sender.sent.map((m) => m.title), ['A testimony of healing', 'Morning service', 'Evening service']);
  assert.equal(last.skipped, 1, 'the third live broadcast that day is skipped');
});

await test('only announcements can be urgent', () => {
  assert.equal(parseEvent({ pref: 'announcements', title: 'T', body: 'B', urgent: true, data: { type: 'announcement' } }).urgent, true);
  assert.equal(parseEvent({ pref: 'testimonies', title: 'T', body: 'B', urgent: true, data: { type: 'testimony' } }).urgent, undefined);
  assert.throws(() => parseEvent({ pref: 'announcements', title: 'T', body: 'B', urgent: 'yes', data: { type: 'announcement' } }), NotifyInputError);
});

// ---------------- failures ----------------
await test('a token Expo cannot use (InvalidCredentials) is removed after 3 failures', async () => {
  const store = memoryStore({ 'pushTokens/old': device('a', 'old'), 'pushTokens/b1': device('b', 'b1') });
  const sender = fakeSender((m) => (m.to === tok('old') ? { status: 'error', code: 'InvalidCredentials', retryable: false, tokenGone: false } : null));
  for (let i = 1; i <= 3; i += 1) {
    const at = NOW + i * 10 * 60000;
    await publish(store, testimony(`t${i}`), at);
    await run(store, sender, at);
    if (i < 3) assert.equal(store.doc('pushTokens/old').credFailures, i, `failure ${i} counted`);
  }
  assert.equal(store.doc('pushTokens/old'), null, 'removed after the third failure');
  assert.ok(store.doc('pushTokens/b1'), 'healthy devices are untouched');
  assert.equal(sender.sent.length, 3, 'the healthy device got all three');
});

await test('a dead device token is removed and not retried', async () => {
  const store = memoryStore({ 'pushTokens/a1': device('a', 'a1') });
  const sender = fakeSender(() => ({ status: 'error', code: 'DeviceNotRegistered', retryable: false, tokenGone: true }));
  await publish(store, testimony());
  const rep = await run(store, sender);
  assert.equal(rep.tokensRemoved, 1);
  assert.equal(store.doc('pushTokens/a1'), null);
  assert.equal(rep.failed, 1);
});

await test('a transient Expo outage is retried later and delivered exactly once', async () => {
  const store = memoryStore({ 'pushTokens/a1': device('a', 'a1') });
  let down = true;
  const sender = fakeSender(() => (down ? { status: 'error', code: 'HTTP_503', retryable: true, tokenGone: false } : null));
  await publish(store, testimony());
  const first = await run(store, sender);
  assert.equal(first.retried, 1);
  down = false;
  await run(store, sender, NOW + 2 * 60000);
  await run(store, sender, NOW + 10 * 60000);
  assert.equal(sender.sent.length, 1);
});

await test('with the engine switched off nothing is queued or sent', async () => {
  const store = memoryStore({ 'pushTokens/a1': device('a', 'a1'), 'settings/notificationEngine': { enabled: false } });
  const sender = fakeSender();
  await publish(store, testimony());
  const rep = await run(store, sender);
  assert.equal(rep.enabled, false);
  assert.equal(sender.sent.length, 0);
});

// ---------------- pure rules ----------------
await test('settings normalise safely: bad values fall back to defaults', () => {
  const s = normalizeSettings({ dailyMax: 99, timezone: 'Mars/Base', quietHours: { start: '25:00' } }, null);
  assert.equal(s.dailyMax, 5);
  assert.equal(s.timezone, 'Africa/Lagos');
  assert.equal(s.quietHours.start, '22:00');
  assert.equal(s.minIntervalMinutes, 120);
});

await test('content already seen by the person is skipped', () => {
  const s = normalizeSettings({ signals: { seen: { t1: NOW - H } } }, null);
  const item = { contentId: 't1', category: 'testimonies', expiresAt: NOW + H, notificationId: 'n', dedupeKey: 'k', delivery: 'immediate', scheduledAt: NOW, deferrals: 0 };
  const d = evaluate(item, s, normalizeLedger(null), NOW, { windows: [], hasDevices: true });
  assert.equal(d.action, 'skip');
  assert.equal(d.reason, 'already_seen');
});

await test('admin event input is validated', () => {
  assert.deepEqual(parseEvent({ pref: 'testimonies', title: ' T ', body: ' B ', data: { type: 'testimony', contentId: 'x' } }), { type: 'testimony', contentId: 'x', title: 'T', body: 'B', category: 'testimonies' });
  assert.equal(parseEvent({ pref: 'promotions', title: 'T', body: 'B', data: { type: 'announcement' } }).category, 'community');
  assert.throws(() => parseEvent({ title: 'T', body: 'B', data: { type: 'nope' } }), NotifyInputError);
  assert.throws(() => parseEvent({ pref: 'nope', title: 'T', body: 'B', data: { type: 'testimony' } }), NotifyInputError);
  assert.throws(() => parseEvent({ title: '', body: 'B', data: { type: 'testimony' } }), NotifyInputError);
});

// ---------------- Phase 3c: Praxiom copy, modes, targeting ----------------
const PX = { PRAXIOM_API_KEY: 'px_test' };
const HEALED = { title: 'Healed of malaria', description: 'Sister Ada was healed after the church prayed with her.', isPublished: true, tags: ['healing'] };
const chatSaying = (title, body, seen = []) => async (_env, req) => { seen.push(req); return { text: JSON.stringify({ title, body }) }; };
const goodChat = (seen) => chatSaying('A testimony of healing', 'Watch "Healed of malaria" and see how God answered the church’s prayers.', seen);
const contentEv = { type: 'testimony', contentId: 't1', title: 'NEW TESTIMONY AVAILABLE', body: 'A new testimony has just been added.', category: 'testimonies' };
const approve = (store, id, copy) => store.commit([{ col: COL.campaigns, id, kind: 'update', data: { status: 'scheduled', dueAt: 0, title: copy.title, body: copy.body, copySource: 'ai' } }], false);

await test('review mode (default): a valid Praxiom draft waits for approval and nothing is sent', async () => {
  const store = memoryStore({ 'pushTokens/a1': device('a', 'a1'), 'testimonies/t1': HEALED });
  const sender = fakeSender();
  const out = await createCampaign(store, PX, contentEv, { now: NOW, chat: goodChat() });
  assert.equal(out.held, 'review');
  const c = store.doc(`notificationCampaigns/${out.campaignId}`);
  assert.equal(c.status, 'awaiting_approval');
  assert.equal(c.dueAt, undefined);
  assert.deepEqual(c.template, { title: contentEv.title, body: contentEv.body });
  assert.equal(c.draft.title, 'A testimony of healing');
  assert.deepEqual(c.tags, ['healing']);
  await run(store, sender);
  assert.equal(sender.sent.length, 0);
  await approve(store, out.campaignId, c.draft);
  await run(store, sender, NOW + 60000);
  assert.equal(sender.sent.length, 1);
  assert.equal(sender.sent[0].title, 'A testimony of healing');
});

await test('a draft that invents a fact is rejected and the template goes out at once', async () => {
  const store = memoryStore({ 'pushTokens/a1': device('a', 'a1'), 'testimonies/t1': HEALED });
  const out = await createCampaign(store, PX, contentEv, { now: NOW, chat: chatSaying('Healed in 3 days', 'Watch "Healed of malaria": healed in 3 days!') });
  assert.equal(out.held, null);
  const c = store.doc(`notificationCampaigns/${out.campaignId}`);
  assert.equal(c.status, 'scheduled');
  assert.equal(c.title, contentEv.title);
  assert.equal(c.copySource, 'template');
  assert.match(c.draftError, /number/);
});

await test('sensitive words are allowed only when the content itself uses them', async () => {
  const store = memoryStore({ 'testimonies/t1': { ...HEALED, description: 'A miracle: Sister Ada was healed after prayer.' } });
  const out = await createCampaign(store, PX, contentEv, { now: NOW, chat: chatSaying('A miracle of healing', 'Watch "Healed of malaria", a miracle after prayer.') });
  assert.equal(out.held, 'review');
  const store2 = memoryStore({ 'testimonies/t1': HEALED });
  const out2 = await createCampaign(store2, PX, contentEv, { now: NOW, chat: chatSaying('A miracle of healing', 'Watch "Healed of malaria", a miracle after prayer.') });
  assert.equal(out2.held, null, 'the content never says "miracle", so the draft is refused');
});

await test('automatic mode uses a valid draft straight away', async () => {
  const store = memoryStore({ 'pushTokens/a1': device('a', 'a1'), 'testimonies/t1': HEALED, 'settings/notificationEngine': { copyMode: 'automatic' } });
  const sender = fakeSender();
  const out = await createCampaign(store, PX, contentEv, { now: NOW, chat: goodChat() });
  assert.equal(out.copySource, 'ai');
  await run(store, sender);
  assert.equal(sender.sent[0].title, 'A testimony of healing');
});

await test('manual mode sends nothing for published content, but announcements still go out', async () => {
  const store = memoryStore({ 'pushTokens/a1': device('a', 'a1'), 'testimonies/t1': HEALED, 'settings/notificationEngine': { copyMode: 'manual' } });
  const sender = fakeSender();
  const out = await createCampaign(store, PX, contentEv, { now: NOW, chat: goodChat() });
  assert.equal(out.held, 'manual');
  assert.equal(store.col('notificationCampaigns').length, 0);
  await createCampaign(store, PX, { type: 'announcement', title: 'Service at 6', body: 'Join us.', category: 'announcements' }, { now: NOW });
  await run(store, sender);
  assert.equal(sender.sent.length, 1);
});

await test('with Praxiom switched off, or not configured, the template goes out at once', async () => {
  let called = false;
  const chat = async () => { called = true; return { text: '{}' }; };
  const off = memoryStore({ 'testimonies/t1': HEALED, 'settings/notificationEngine': { aiCopy: false } });
  assert.equal((await createCampaign(off, PX, contentEv, { now: NOW, chat })).held, null);
  const noKey = memoryStore({ 'testimonies/t1': HEALED });
  assert.equal((await createCampaign(noKey, {}, contentEv, { now: NOW, chat })).held, null);
  assert.equal(called, false);
});

await test('Praxiom gets only the item’s public facts, once per item, and never for a duplicate', async () => {
  const seen = [];
  const store = memoryStore({ 'pushTokens/a1': device('secret-uid', 'a1'), 'testimonies/t1': HEALED });
  await createCampaign(store, PX, contentEv, { now: NOW, chat: goodChat(seen) });
  await createCampaign(store, PX, contentEv, { now: NOW + 1000, chat: goodChat(seen) });
  assert.equal(seen.length, 1);
  const sent = JSON.stringify(seen[0].messages);
  assert.ok(sent.includes('Healed of malaria'));
  assert.equal(sent.includes('secret-uid'), false);
  assert.equal(sent.includes('ExponentPushToken'), false);
});

await test('announcements and live broadcasts are never drafted or held', async () => {
  let called = false;
  const store = memoryStore({});
  const out = await createCampaign(store, PX, { type: 'live', title: 'We are live', body: 'Join now.', category: 'live' }, { now: NOW, chat: async () => { called = true; return { text: '{}' }; } });
  assert.equal(out.held, null);
  assert.equal(called, false);
});

const people = (extra = {}) => memoryStore({
  'pushTokens/a1': device('a', 'a1'), 'users/a/private/discovery': { interests: ['healing'] },
  'pushTokens/b1': device('b', 'b1'), 'users/b/private/discovery': { interests: ['finances'] },
  'pushTokens/c1': device('c', 'c1'),
  'pushTokens/d1': device('d', 'd1'), 'users/d/private/discovery': { interests: ['finances'], optOut: true },
  'testimonies/t1': HEALED,
  ...extra,
});
const sentTo = (sender) => sender.sent.map((m) => m.to.replace(/ExponentPushToken\[|\]/g, '')).sort();

await test('interested first (default): matching people now, others 3 hours later', async () => {
  const store = people({ 'settings/notificationEngine': { aiCopy: false } });
  const sender = fakeSender();
  await createCampaign(store, PX, contentEv, { now: NOW });
  await run(store, sender);
  assert.deepEqual(sentTo(sender), ['a1', 'c1', 'd1'], 'healing fan now; no interests and opted-out are treated as before');
  await run(store, sender, NOW + 3 * H + 60000);
  assert.deepEqual(sentTo(sender), ['a1', 'b1', 'c1', 'd1'], 'the finances fan gets it later the same day');
});

await test('interested only: people whose interests do not match are not notified', async () => {
  const store = people({ 'settings/notificationEngine': { aiCopy: false, targeting: 'interested_only' } });
  const sender = fakeSender();
  await createCampaign(store, PX, contentEv, { now: NOW });
  await run(store, sender);
  await run(store, sender, NOW + 4 * H);
  assert.deepEqual(sentTo(sender), ['a1', 'c1', 'd1']);
});

await test('notify everyone: interests are ignored', async () => {
  const store = people({ 'settings/notificationEngine': { aiCopy: false, targeting: 'everyone' } });
  const sender = fakeSender();
  await createCampaign(store, PX, contentEv, { now: NOW });
  await run(store, sender);
  assert.equal(sender.sent.length, 4);
});

await test('untagged content and announcements are never targeted', async () => {
  const store = people({ 'testimonies/t1': { ...HEALED, tags: [] }, 'settings/notificationEngine': { aiCopy: false, targeting: 'interested_only' } });
  const sender = fakeSender();
  await createCampaign(store, PX, contentEv, { now: NOW });
  await run(store, sender);
  assert.equal(sender.sent.length, 4);
});

console.log(`\nnotification engine: ${passed} tests passed`);
