import { obj, typeToCategory, prefToCategory, ROUTE_TYPES, str, COL, runDispatcher, eventCampaign } from './engine.js';
import { serviceAccessToken, createFirestoreStore } from './firestoreStore.js';
import { createExpoSender, te, createWebPushSender } from './senders.js';

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
  return { expo: expo.expo, receipts: expo.receipts, webPush: createWebPushSender(env, fetchFn) };
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
  return { type, contentId: contentId || null, title: r.title.trim(), body: r.body.trim(), category };
}
async function publishEvent(env, ev, { fetchFn = fetch, now = Date.now() } = {}) {
  const store = makeStore(env, fetchFn);
  const c = eventCampaign(ev, now);
  const [r] = await store.commit([{ col: COL.campaigns, id: c.id, kind: "create", data: c.data }], false);
  const report = await runEngine(env, { fetchFn, now });
  return { campaignId: c.id, created: r.ok, report };
}

export { engineConfigured, makeStore, runEngine, NotifyInputError, parseEvent, publishEvent };
