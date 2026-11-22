import { obj, typeToCategory, prefToCategory, ROUTE_TYPES, str, COL, runDispatcher, eventCampaign, normalizeEngineConfig } from './engine.js';
import { CONTENT_SOURCES, draftCopy, loadContent } from './draft.js';
import { serviceAccessToken, createFirestoreStore } from './firestoreStore.js';
import { createExpoSender, te, createWebPushSender, createFcmSender } from './senders.js';

var engineConfigured = (env) => Boolean(env.FIREBASE_SERVICE_ACCOUNT && env.FIREBASE_PROJECT_ID);
function makeStore(env, fetchFn = fetch) {
  return createFirestoreStore({
    projectId: env.FIREBASE_PROJECT_ID,
    getToken: () => serviceAccessToken(env.FIREBASE_SERVICE_ACCOUNT, fetchFn),
    fetchFn
  });
}
function makeSender(env, fetchFn = fetch) {
  const expo = createExpoSender(fetchFn, (m) => console.log(m));
  return { expo: expo.expo, receipts: expo.receipts, webPush: createWebPushSender(env, fetchFn), fcm: createFcmSender(env, fetchFn) };
}
function runEngine(env, { fetchFn = fetch, now } = {}) {
  return runDispatcher(makeStore(env, fetchFn), makeSender(env, fetchFn), {
    now,
    maxItems: Number(env.NOTIFY_MAX_ITEMS) || 100,
    pageSize: Number(env.NOTIFY_PAGE_SIZE) || 300,
    maxPages: Number(env.NOTIFY_MAX_PAGES) || 3,
    log: (m) => console.log(m)
  });
}
class NotifyInputError extends Error {}
function parseEvent(req) {
  const r = req && typeof req === "object" ? req : {};
  const data = r.data && typeof r.data === "object" ? r.data : {};
  const type = typeof data.type === "string" ? data.type : r.type;
  const contentId = data.contentId ?? r.contentId;
  if (typeof type !== "string" || !ROUTE_TYPES.has(type)) throw new NotifyInputError("Invalid data.");
  if (contentId !== void 0 && contentId !== null && (typeof contentId !== "string" || contentId.length > 100)) throw new NotifyInputError("Invalid data.");
  if (typeof r.title !== "string" || !r.title.trim() || r.title.length > 100) throw new NotifyInputError("Invalid title.");
  if (typeof r.body !== "string" || !r.body.trim() || r.body.length > 300) throw new NotifyInputError("Invalid message.");
  let category = typeToCategory(type);
  if (r.pref !== void 0) {
    const fromPref = prefToCategory(r.pref);
    if (!fromPref) throw new NotifyInputError("Unknown notification type.");
    if (type === "announcement" || type === "featured" || type === "promotion") category = fromPref;
  }
  if (r.urgent !== void 0 && typeof r.urgent !== "boolean") throw new NotifyInputError("Invalid urgency.");
  // Only announcements may be urgent (they then skip the daily limit; categories and quiet hours still apply).
  const urgent = r.urgent === true && category === "announcements";
  return { type, contentId: contentId || null, title: r.title.trim(), body: r.body.trim(), category, ...(urgent ? { urgent: true } : {}) };
}
/**
 * Creates the campaign for one admin event (Phase 3c). For published content it reads the item, attaches its
 * interest tags, and (if switched on) asks Praxiom for copy:
 *  - review mode:    a valid AI draft waits for approval (status "awaiting_approval", no dueAt);
 *                    without a valid draft the template goes out at once
 *  - automatic mode: a valid AI draft is used, otherwise the template
 *  - manual mode:    nothing is sent for published content (admins send announcements themselves)
 * Announcements and live broadcasts are never drafted or held. Returns what happened, for the portal.
 */
async function createCampaign(store, env, ev, { now = Date.now(), chat } = {}) {
  const c = eventCampaign(ev, now);
  if ((await store.get(COL.campaigns, [c.id])).get(c.id)) return { campaignId: c.id, created: false, held: null };
  const cfg = normalizeEngineConfig((await store.get(COL.config, [COL.configId])).get(COL.configId)?.data);
  const isContent = Boolean(CONTENT_SOURCES[ev.type]) && Boolean(ev.contentId);
  if (isContent && cfg.copyMode === "manual") return { campaignId: c.id, created: false, held: "manual" };
  const facts = isContent ? await loadContent(store, ev.type, ev.contentId).catch(() => null) : null;
  const data = { ...c.data, template: { title: c.data.title, body: c.data.body }, copySource: "template" };
  if (facts?.tags.length) data.tags = facts.tags;
  let held = null;
  if (facts && cfg.aiCopy) {
    const draft = await draftCopy(env, facts, chat ? { chat } : {});
    if (draft.ok) {
      data.draft = { title: draft.title, body: draft.body };
      if (cfg.copyMode === "review") {
        data.status = "awaiting_approval";
        delete data.dueAt;
        held = "review";
      } else {
        data.title = draft.title;
        data.body = draft.body;
        data.copySource = "ai";
      }
    } else data.draftError = draft.reason;
  }
  const [r] = await store.commit([{ col: COL.campaigns, id: c.id, kind: "create", data }], false);
  return { campaignId: c.id, created: r.ok, held: r.ok ? held : null, copySource: data.copySource };
}

async function publishEvent(env, ev, { fetchFn = fetch, now = Date.now(), chat } = {}) {
  const store = makeStore(env, fetchFn);
  const out = await createCampaign(store, env, ev, { now, chat });
  const report = out.held ? { queued: 0, sent: 0, inApp: 0, failed: 0 } : await runEngine(env, { fetchFn, now });
  return { ...out, report };
}

export { engineConfigured, makeStore, runEngine, NotifyInputError, parseEvent, publishEvent, createCampaign };
