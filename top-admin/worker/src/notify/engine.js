import { te } from './senders.js';

var CATEGORIES = [
  "dailyPraise",
  "testimonies",
  "loveworldMusic",
  "lyricalAnalysis",
  "live",
  "featuredChoirs",
  "articles",
  "announcements",
  "community"
];
var DAILY_MAX_OPTIONS = [1, 3, 5];
var FREQUENCY_TO_MAX = { light: 1, balanced: 3, frequent: 5 };
var MIN_INTERVAL_OPTIONS = [120, 180, 240];
var HARD_MIN_INTERVAL_MIN = 120;
var DEFAULT_TIMEZONE = "Africa/Lagos";
var DEFAULT_CATEGORIES = Object.fromEntries(CATEGORIES.map((c) => [c, true]));
var DEFAULT_SETTINGS = {
  // Up to 5 a day unless the person picks fewer (decision 2026-11-21).
  dailyMax: 5,
  frequency: "frequent",
  categories: { ...DEFAULT_CATEGORIES },
  timezone: DEFAULT_TIMEZONE,
  // Off unless the person turns quiet hours on for themselves (decision 2026-11-21).
  quietHours: { enabled: false, start: "22:00", end: "07:00" },
  minIntervalMinutes: 120,
  signals: { counts: {}, opened: {}, seen: {} },
  lastActiveAt: null
};
function legacyToCategories(prefs) {
  const p = prefs || {};
  const on = (v) => v !== false;
  return {
    dailyPraise: true,
    testimonies: on(p.testimonies),
    loveworldMusic: on(p.loveworld),
    lyricalAnalysis: on(p.loveworld),
    live: on(p.live),
    featuredChoirs: on(p.choirs),
    articles: on(p.articles),
    announcements: on(p.announcements),
    community: on(p.promotions)
  };
}
var HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
var isHHMM = (v) => typeof v === "string" && HHMM.test(v);
var hhmmToMinutes = (v) => Number(v.slice(0, 2)) * 60 + Number(v.slice(3, 5));
var tzCache = /* @__PURE__ */ new Map();
function isValidTimeZone(tz) {
  if (typeof tz !== "string" || !tz || tz.length > 64) return false;
  if (tzCache.has(tz)) return tzCache.get(tz);
  let ok = false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(0);
    ok = true;
  } catch {
    ok = false;
  }
  tzCache.set(tz, ok);
  return ok;
}
var num = (v) => typeof v === "number" && Number.isFinite(v) ? v : null;
var obj = (v) => v && typeof v === "object" && !Array.isArray(v) ? v : {};
var MAX_SEEN = 200;
function normalizeSignals(raw) {
  const r = obj(raw);
  const counts = {};
  const opened = {};
  for (const c of CATEGORIES) {
    const n = num(obj(r.counts)[c]);
    if (n !== null && n > 0) counts[c] = Math.min(n, 1e6);
    const o = num(obj(r.opened)[c]);
    if (o !== null && o > 0) opened[c] = Math.min(o, 1e6);
  }
  const seen = Object.entries(obj(r.seen)).filter(([k, v]) => k.length <= 128 && num(v) !== null).sort((a, b) => b[1] - a[1]).slice(0, MAX_SEEN);
  return { counts, opened, seen: Object.fromEntries(seen) };
}
function normalizeSettings(raw, legacy, defaultTz = DEFAULT_TIMEZONE) {
  const r = obj(raw);
  const freq = r.frequency === "light" || r.frequency === "balanced" || r.frequency === "frequent" ? r.frequency : null;
  const dailyMax = DAILY_MAX_OPTIONS.includes(r.dailyMax) ? r.dailyMax : freq ? FREQUENCY_TO_MAX[freq] : DEFAULT_SETTINGS.dailyMax;
  const frequency = dailyMax === 1 ? "light" : dailyMax === 5 ? "frequent" : "balanced";
  const savedCats = obj(r.categories);
  const base = Object.keys(savedCats).length ? DEFAULT_CATEGORIES : legacy ? legacyToCategories(legacy) : DEFAULT_CATEGORIES;
  const categories = { ...base };
  for (const c of CATEGORIES) if (typeof savedCats[c] === "boolean") categories[c] = savedCats[c];
  const qh = obj(r.quietHours);
  const quietHours = {
    enabled: typeof qh.enabled === "boolean" ? qh.enabled : DEFAULT_SETTINGS.quietHours.enabled,
    start: isHHMM(qh.start) ? qh.start : DEFAULT_SETTINGS.quietHours.start,
    end: isHHMM(qh.end) ? qh.end : DEFAULT_SETTINGS.quietHours.end
  };
  const mi = num(r.minIntervalMinutes);
  return {
    dailyMax,
    frequency,
    categories,
    timezone: isValidTimeZone(r.timezone) ? r.timezone : isValidTimeZone(defaultTz) ? defaultTz : DEFAULT_TIMEZONE,
    quietHours,
    minIntervalMinutes: mi !== null && MIN_INTERVAL_OPTIONS.includes(mi) ? mi : DEFAULT_SETTINGS.minIntervalMinutes,
    signals: normalizeSignals(r.signals),
    lastActiveAt: num(r.lastActiveAt)
  };
}
function typeToCategory(type) {
  switch (type) {
    case "testimony":
    case "written":
    case "featured":
      return "testimonies";
    case "live":
      return "live";
    case "announcement":
      return "announcements";
    case "article":
      return "articles";
    case "choir":
      return "featuredChoirs";
    case "loveworld":
      return "loveworldMusic";
    case "lyrical":
      return "lyricalAnalysis";
    case "dailyPraise":
      return "dailyPraise";
    default:
      return "community";
  }
}
function prefToCategory(pref) {
  switch (pref) {
    case "testimonies":
      return "testimonies";
    case "live":
      return "live";
    case "announcements":
      return "announcements";
    case "promotions":
      return "community";
    case "choirs":
      return "featuredChoirs";
    case "loveworld":
      return "loveworldMusic";
    case "articles":
      return "articles";
    default:
      return null;
  }
}
var CATEGORY_DEFAULT_TYPE = {
  dailyPraise: "dailyPraise",
  testimonies: "testimony",
  loveworldMusic: "loveworld",
  lyricalAnalysis: "lyrical",
  live: "live",
  featuredChoirs: "choir",
  articles: "article",
  announcements: "announcement",
  community: "community"
};
var ROUTE_TYPES = /* @__PURE__ */ new Set([
  "testimony",
  "written",
  "featured",
  "live",
  "announcement",
  "article",
  "promotion",
  "radio",
  "resource",
  "choir",
  "loveworld",
  "lyrical",
  "dailyPraise",
  "community"
]);
var fmtCache = /* @__PURE__ */ new Map();
function fmt(tz) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
    fmtCache.set(tz, f);
  }
  return f;
}
function localParts(ms, tz) {
  const p = {};
  for (const part of fmt(tz).formatToParts(new Date(ms))) p[part.type] = part.value;
  const hour = Number(p.hour) % 24;
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: hour * 60 + Number(p.minute), hour };
}
function offsetMs(ms, tz) {
  const p = {};
  for (const part of fmt(tz).formatToParts(new Date(ms))) p[part.type] = part.value;
  const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour) % 24, Number(p.minute), Number(p.second));
  return asUtc - Math.floor(ms / 1e3) * 1e3;
}
function zonedTimeToUtc(date, minutes, tz) {
  const [y, m, d] = date.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, 0, minutes);
  const o1 = offsetMs(guess, tz);
  let t = guess - o1;
  const o2 = offsetMs(t, tz);
  if (o2 !== o1) t = guess - o2;
  return t;
}
function addDays(date, n) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
function inQuietHours(minutes, q) {
  if (!q.enabled) return false;
  const s = hhmmToMinutes(q.start);
  const e = hhmmToMinutes(q.end);
  if (s === e) return false;
  return s < e ? minutes >= s && minutes < e : minutes >= s || minutes < e;
}
function quietHoursEnd(ms, s) {
  const lp = localParts(ms, s.timezone);
  if (!inQuietHours(lp.minutes, s.quietHours)) return ms;
  const end = hhmmToMinutes(s.quietHours.end);
  const date = lp.minutes < end ? lp.date : addDays(lp.date, 1);
  return zonedTimeToUtc(date, end, s.timezone);
}
var DEFAULT_WINDOWS = [
  { id: "morning", time: "08:00", categories: ["dailyPraise"] },
  { id: "midday", time: "11:30", categories: ["testimonies"] },
  { id: "afternoon", time: "14:30", categories: ["loveworldMusic", "lyricalAnalysis"] },
  { id: "evening", time: "17:30", categories: ["community", "featuredChoirs", "articles", "announcements"] },
  { id: "night", time: "20:00", categories: ["live", "*"] }
];
function normalizeEngineConfig(raw) {
  const r = obj(raw);
  const list = Array.isArray(r.windows) ? r.windows : [];
  const windows = [];
  for (const w of list.slice(0, 12)) {
    const o = obj(w);
    if (!isHHMM(o.time)) continue;
    const cats = (Array.isArray(o.categories) ? o.categories : []).filter((c) => c === "*" || CATEGORIES.includes(c));
    if (!cats.length) continue;
    windows.push({ id: typeof o.id === "string" && o.id ? o.id.slice(0, 32) : o.time, time: o.time, categories: cats });
  }
  windows.sort((a, b) => hhmmToMinutes(a.time) - hhmmToMinutes(b.time));
  return {
    enabled: r.enabled !== false,
    windows: windows.length ? windows : DEFAULT_WINDOWS,
    defaultTimezone: isValidTimeZone(r.defaultTimezone) ? r.defaultTimezone : DEFAULT_TIMEZONE
  };
}
function nextWindowSlot(afterMs, tz, category, windows) {
  const usable = windows.filter((w) => w.categories.includes(category) || w.categories.includes("*"));
  if (!usable.length) return null;
  const start = localParts(afterMs, tz).date;
  for (let k = 0; k < 9; k++) {
    const date = addDays(start, k);
    for (const w of usable) {
      const at = zonedTimeToUtc(date, hhmmToMinutes(w.time), tz);
      if (at >= afterMs) return { at, windowId: w.id };
    }
  }
  return null;
}
var HOUR = 36e5;
var MINUTE = 6e4;
var DEFAULT_EXPIRY_HOURS = {
  dailyPraise: 16,
  testimonies: 72,
  loveworldMusic: 72,
  lyricalAnalysis: 72,
  live: 3,
  featuredChoirs: 72,
  articles: 72,
  announcements: 48,
  community: 72
};
var DEFAULT_PRIORITY = {
  dailyPraise: 60,
  testimonies: 50,
  loveworldMusic: 45,
  lyricalAnalysis: 45,
  live: 90,
  featuredChoirs: 40,
  articles: 40,
  announcements: 70,
  community: 35
};
var str = (v, max) => typeof v === "string" ? v.trim().slice(0, max) : "";
var safeId = (v) => v.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 120);
function safeDeepLink(v) {
  const s = str(v, 300);
  if (!s) return null;
  return /^(\/#\/|#\/|top:\/\/)[A-Za-z0-9/_\-?=&.%]*$/.test(s) ? s : null;
}
function normalizeCampaign(id, raw, now) {
  const r = obj(raw);
  const title = str(r.title, 100);
  const body = str(r.body ?? r.message, 300);
  if (!title || !body) return null;
  const type = typeof r.type === "string" && ROUTE_TYPES.has(r.type) ? r.type : null;
  const category = CATEGORIES.includes(r.category) ? r.category : typeToCategory(type);
  const publishAt = num(r.publishAt) ?? num(r.createdAt) ?? now;
  const expiresAt = num(r.expiresAt) ?? publishAt + DEFAULT_EXPIRY_HOURS[category] * HOUR;
  const pr = num(r.priority);
  const contentId = str(r.contentId, 100) || null;
  const audience = Array.isArray(r.audienceUids) ? r.audienceUids.filter((u) => typeof u === "string" && u && u.length <= 128).slice(0, 30) : null;
  const status = ["scheduled", "fanning_out", "queued", "cancelled", "expired", "invalid"].includes(r.status) ? r.status : "scheduled";
  return {
    id,
    title,
    body,
    category,
    type: type ?? CATEGORY_DEFAULT_TYPE[category],
    contentId,
    deepLink: safeDeepLink(r.deepLink),
    publishAt,
    expiresAt,
    priority: pr !== null ? Math.max(0, Math.min(100, pr)) : DEFAULT_PRIORITY[category],
    dedupeKey: str(r.dedupeKey, 150) || (contentId ? `${category}:${contentId}` : `campaign:${id}`),
    delivery: r.delivery === "immediate" || r.delivery === "window" ? r.delivery : category === "live" ? "immediate" : "window",
    audienceUids: audience && audience.length ? audience : null,
    status,
    cursor: typeof r.cursor === "string" ? r.cursor : null,
    source: str(r.source, 40) || "admin"
  };
}
var queueId = (campaignId, uid) => `${safeId(campaignId)}__${safeId(uid)}`.slice(0, 250);
function buildQueueItem(c, uid, s, now, windows) {
  if (!s.categories[c.category]) return { skip: "category_off" };
  const start = Math.max(c.publishAt, now);
  if (start >= c.expiresAt) return { skip: "expired" };
  let at = start;
  let windowId = null;
  if (c.delivery === "window") {
    const slot = nextWindowSlot(start, s.timezone, c.category, windows);
    if (slot && slot.at < c.expiresAt) {
      at = slot.at;
      windowId = slot.windowId;
    }
  }
  const id = queueId(c.id, uid);
  return {
    item: {
      uid,
      notificationId: id,
      campaignId: c.id,
      title: c.title,
      body: c.body,
      type: c.type,
      category: c.category,
      contentId: c.contentId,
      deepLink: c.deepLink,
      scheduledAt: at,
      dueAt: at,
      expiresAt: c.expiresAt,
      timezone: s.timezone,
      priority: c.priority,
      dedupeKey: c.dedupeKey,
      delivery: c.delivery,
      status: "scheduled",
      createdAt: now,
      sentAt: null,
      attempts: 0,
      deferrals: 0,
      windowId
    }
  };
}
var LEDGER_KEEP_MS = 35 * 24 * HOUR;
function normalizeLedger(raw) {
  const e = obj(obj(raw).entries);
  const entries = {};
  for (const [k, v] of Object.entries(e)) {
    const o = obj(v);
    const at = num(o.at);
    if (at === null || typeof o.day !== "string") continue;
    entries[k] = { at, day: o.day, key: typeof o.key === "string" ? o.key : "", cat: o.cat || "community" };
  }
  return { entries };
}
function ledgerStats(l, day) {
  let countToday = 0;
  let lastSentAt = 0;
  const keys = /* @__PURE__ */ new Set();
  for (const e of Object.values(l.entries)) {
    if (e.day === day) countToday += 1;
    if (e.at > lastSentAt) lastSentAt = e.at;
    if (e.key) keys.add(e.key);
  }
  return { countToday, lastSentAt, keys };
}
function ledgerWith(l, id, entry, now) {
  const entries = {};
  for (const [k, v] of Object.entries(l.entries)) if (now - v.at < LEDGER_KEEP_MS) entries[k] = v;
  entries[id] = entry;
  return { entries };
}
function ledgerWithout(l, id) {
  const entries = { ...l.entries };
  delete entries[id];
  return { entries };
}
var ACTIVE_WINDOW_MS = 6 * MINUTE;
var MAX_DEFERRALS = 24;
var MAX_ATTEMPTS = 5;
var PROCESSING_LEASE_MS = 10 * MINUTE;
var WINDOW_LATE_MS = 90 * MINUTE;
var minGapMs = (s) => Math.max(HARD_MIN_INTERVAL_MIN, s.minIntervalMinutes) * MINUTE;
function relevance(item, s, now) {
  const used = s.signals.counts[item.category] ?? 0;
  const opened = s.signals.opened[item.category] ?? 0;
  const ageH = Math.max(0, (now - item.scheduledAt) / HOUR);
  return item.priority + 15 * Math.min(1, used / 10) + 10 * Math.min(1, opened / 5) - Math.min(20, ageH * 0.5);
}
function deferTo(item, until, s, ctx) {
  if (item.delivery === "immediate") return until;
  const slot = nextWindowSlot(until, s.timezone, item.category, ctx.windows)?.at ?? until;
  return slot < item.expiresAt ? slot : until;
}
function evaluate(item, s, ledger, now, ctx) {
  if (now >= item.expiresAt) return { action: "skip", status: "expired", reason: "expired" };
  if (!s.categories[item.category]) return { action: "skip", status: "skipped", reason: "category_off" };
  if (item.contentId && s.signals.seen[item.contentId]) return { action: "skip", status: "skipped", reason: "already_seen" };
  const day = localParts(now, s.timezone).date;
  const st = ledgerStats(ledger, day);
  if (ledger.entries[item.notificationId] || st.keys.has(item.dedupeKey)) return { action: "skip", status: "skipped", reason: "duplicate" };
  const active = s.lastActiveAt !== null && now - s.lastActiveAt < ACTIVE_WINDOW_MS && s.lastActiveAt <= now + MINUTE;
  if (!ctx.hasDevices && !active) return { action: "skip", status: "skipped", reason: "no_devices" };
  const wrap = (until, reason) => {
    const at = deferTo(item, until, s, ctx);
    if (at >= item.expiresAt) return { action: "skip", status: "expired", reason: `expired_${reason}` };
    if (item.deferrals >= MAX_DEFERRALS) return { action: "skip", status: "skipped", reason: "too_many_deferrals" };
    return { action: "defer", until: at, reason };
  };
  if (st.countToday >= s.dailyMax) return wrap(zonedTimeToUtc(addDays(day, 1), 0, s.timezone), "daily_cap");
  // The 2-hour gap only paces time-slot campaigns; content sent on publish is not held back by it.
  if (item.delivery !== "immediate" && st.lastSentAt && now - st.lastSentAt < minGapMs(s)) return wrap(st.lastSentAt + minGapMs(s), "spacing");
  const qEnd = quietHoursEnd(now, s);
  if (qEnd > now) return wrap(qEnd, "quiet_hours");
  if (item.delivery === "window" && item.windowId && now - item.scheduledAt > WINDOW_LATE_MS) return wrap(now, "missed_window");
  return { action: "send", channel: active ? "in_app" : "push", score: relevance(item, s, now) };
}
var COL = {
  settings: "notificationSettings",
  queue: "notificationQueue",
  ledger: "notificationLedger",
  campaigns: "notificationCampaigns",
  stats: "notificationStats",
  tokens: "pushTokens",
  config: "settings",
  configId: "notificationEngine",
  inbox: (uid) => `users/${uid}/notifications`
};
function toTokenRow(d) {
  const r = d.data;
  const uid = typeof r.uid === "string" ? r.uid : "";
  if (!uid) return null;
  const token = typeof r.token === "string" ? r.token : "";
  const w = obj(r.web);
  const keys = obj(w.keys);
  const web = typeof w.endpoint === "string" && /^https:\/\//.test(w.endpoint) && typeof keys.p256dh === "string" && typeof keys.auth === "string" ? { endpoint: w.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } } : null;
  const kind = web ? "web" : /^Expo(nent)?PushToken\[/.test(token) ? "expo" : null;
  if (!kind) return null;
  return { id: d.id, uid, kind, token, web, prefs: r.prefs ? obj(r.prefs) : null, updatedAt: num(r.updatedAtMs) ?? num(r.updatedAt) ?? 0 };
}
function legacyFor(rows) {
  const withPrefs = rows.filter((r) => r.prefs).sort((a, b) => b.updatedAt - a.updatedAt);
  return withPrefs[0]?.prefs ?? null;
}
var Stats = class {
  inc = {};
  campaigns = /* @__PURE__ */ new Map();
  add(path, n = 1) {
    this.inc[path] = (this.inc[path] ?? 0) + n;
  }
  event(ev, cat, campaignId, extra) {
    this.add(`events.${ev}`);
    this.add(`categories.${cat}.${ev.replace("notification_", "")}`);
    if (extra) this.add(extra);
    const field = ev.replace("notification_", "");
    const c = this.campaigns.get(campaignId) ?? {};
    c[`counts.${field}`] = (c[`counts.${field}`] ?? 0) + 1;
    this.campaigns.set(campaignId, c);
  }
  campaign(campaignId, path, n = 1) {
    const c = this.campaigns.get(campaignId) ?? {};
    c[path] = (c[path] ?? 0) + n;
    this.campaigns.set(campaignId, c);
  }
  writes(now) {
    const out = [];
    if (Object.keys(this.inc).length) {
      out.push({ col: COL.stats, id: new Date(now).toISOString().slice(0, 10), kind: "merge", data: { updatedAt: now }, inc: this.inc });
    }
    for (const [id, inc] of this.campaigns) out.push({ col: COL.campaigns, id, kind: "merge", data: { lastActivityAt: now }, inc });
    return out;
  }
};
var reasonKey = (r) => `skipReasons.${r.replace(/[^A-Za-z0-9_]/g, "_")}`;
var chunk = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
var uniq = (a) => [...new Set(a)];
var backoffMs = (attempts) => Math.min(30 * MINUTE, MINUTE * 2 ** Math.max(0, attempts - 1));
async function tokensFor(store, uids) {
  const out = /* @__PURE__ */ new Map();
  const pages = await Promise.all(chunk(uids, 30).map((c) => store.whereIn(COL.tokens, "uid", c)));
  for (const d of pages.flat()) {
    const t = toTokenRow(d);
    if (!t) continue;
    out.set(t.uid, [...out.get(t.uid) ?? [], t]);
  }
  return out;
}
async function fanOut(store, cfg, now, o, rep, stats) {
  const due = await store.dueQuery(COL.campaigns, "dueAt", now, o.maxCampaigns);
  for (const doc of due) {
    rep.campaigns += 1;
    const c = normalizeCampaign(doc.id, doc.data, now);
    const finish = (status) => store.commit([{ col: COL.campaigns, id: doc.id, kind: "update", data: { status, finishedAt: now }, remove: ["dueAt"], ifVersion: doc.version }], false);
    if (!c) {
      await finish("invalid");
      continue;
    }
    if (c.status === "cancelled" || c.status === "expired" || c.status === "queued" || c.status === "invalid") {
      await finish(c.status);
      continue;
    }
    if (now >= c.expiresAt) {
      await finish("expired");
      continue;
    }
    let version = doc.version;
    let cursor = c.cursor;
    for (let p = 0; p < o.maxPages; p++) {
      let rows;
      let done;
      if (c.audienceUids) {
        rows = await store.whereIn(COL.tokens, "uid", c.audienceUids);
        done = true;
      } else {
        rows = await store.pageById(COL.tokens, cursor, o.pageSize);
        done = rows.length < o.pageSize;
      }
      const tokens = rows.map(toTokenRow).filter((t) => Boolean(t));
      const byUid = /* @__PURE__ */ new Map();
      for (const t of tokens) byUid.set(t.uid, [...byUid.get(t.uid) ?? [], t]);
      const uids = [...byUid.keys()];
      const settings = uids.length ? await store.get(COL.settings, uids) : /* @__PURE__ */ new Map();
      const creates = [];
      const items = [];
      let notQueued = 0;
      for (const uid of uids) {
        const s = normalizeSettings(settings.get(uid)?.data, legacyFor(byUid.get(uid) ?? []), cfg.defaultTimezone);
        const r = buildQueueItem(c, uid, s, now, cfg.windows);
        if ("skip" in r) {
          notQueued += 1;
          stats.add(reasonKey(r.skip));
          continue;
        }
        items.push(r.item);
        creates.push({ col: COL.queue, id: r.item.notificationId, kind: "create", data: r.item });
      }
      const results = creates.length ? await store.commit(creates, false) : [];
      let created = 0;
      results.forEach((res, i) => {
        if (!res.ok) return;
        created += 1;
        stats.add("events.notification_queued");
        stats.add(`categories.${items[i].category}.queued`);
      });
      rep.queued += created;
      rep.notQueued += notQueued;
      const nextCursor = rows.length ? rows[rows.length - 1].id : cursor;
      const [upd] = await store.commit(
        [{
          col: COL.campaigns,
          id: doc.id,
          kind: "update",
          ifVersion: version,
          data: done ? { status: "queued", cursor: nextCursor, queuedAt: now } : { status: "fanning_out", cursor: nextCursor },
          ...done ? { remove: ["dueAt"] } : {},
          inc: { "counts.queued": created, "counts.notQueued": notQueued }
        }],
        false
      );
      if (!upd.ok) {
        rep.conflicts += 1;
        o.log(`[notify] campaign ${doc.id} is being fanned out by another run`);
        break;
      }
      version = upd.version ?? version;
      cursor = nextCursor;
      if (done) break;
    }
  }
}
async function dispatchDue(store, sender, cfg, now, o, rep, stats) {
  const due = await store.dueQuery(COL.queue, "dueAt", now, o.maxItems);
  if (!due.length) return;
  const plain = [];
  const live = [];
  for (const d of due) {
    if (d.data.status === "processing") {
      plain.push({ col: COL.queue, id: d.id, kind: "update", ifVersion: d.version, data: { status: "failed", lastError: "interrupted", finishedAt: now }, remove: ["dueAt"] });
      stats.event("notification_failed", d.data.category, d.data.campaignId);
      rep.failed += 1;
    } else if (d.data.status === "scheduled") live.push(d);
    else plain.push({ col: COL.queue, id: d.id, kind: "update", ifVersion: d.version, data: {}, remove: ["dueAt"] });
  }
  const uids = uniq(live.map((d) => d.data.uid));
  const campaignIds = uniq(live.map((d) => d.data.campaignId));
  const [settingsMap, ledgerMap, tokenMap, campaignMap] = await Promise.all([
    store.get(COL.settings, uids),
    store.get(COL.ledger, uids),
    tokensFor(store, uids),
    store.get(COL.campaigns, campaignIds)
  ]);
  const claims = [];
  const skip = (d, status, reason) => {
    plain.push({ col: COL.queue, id: d.id, kind: "update", ifVersion: d.version, data: { status, skipReason: reason, finishedAt: now }, remove: ["dueAt"] });
    stats.event(status === "expired" ? "notification_expired" : "notification_skipped", d.data.category, d.data.campaignId, reasonKey(reason));
    if (status === "expired") rep.expired += 1;
    else rep.skipped += 1;
  };
  const defer = (d, until, reason) => {
    plain.push({ col: COL.queue, id: d.id, kind: "update", ifVersion: d.version, data: { dueAt: until, scheduledAt: until, lastDeferReason: reason }, inc: { deferrals: 1 } });
    stats.add(`deferReasons.${reason}`);
    rep.deferred += 1;
  };
  for (const uid of uids) {
    const mine = live.filter((d) => d.data.uid === uid);
    const tokens = tokenMap.get(uid) ?? [];
    const s = normalizeSettings(settingsMap.get(uid)?.data, legacyFor(tokens), cfg.defaultTimezone);
    const ledgerDoc = ledgerMap.get(uid) ?? null;
    const ledger = normalizeLedger(ledgerDoc?.data);
    const ctx = { windows: cfg.windows, hasDevices: tokens.length > 0 };
    const sendable = [];
    for (const d of mine) {
      const camp = campaignMap.get(d.data.campaignId);
      if (camp && camp.data.status === "cancelled") {
        skip(d, "skipped", "cancelled");
        continue;
      }
      const dec = evaluate(d.data, s, ledger, now, ctx);
      if (dec.action === "skip") skip(d, dec.status, dec.reason);
      else if (dec.action === "defer") defer(d, dec.until, dec.reason);
      else sendable.push({ d, dec });
    }
    if (!sendable.length) continue;
    sendable.sort((a, b) => b.dec.score - a.dec.score || a.d.data.scheduledAt - b.d.data.scheduledAt);
    const [best, ...rest] = sendable;
    for (const r of rest) {
      const after = now + minGapMs(s);
      const at = r.d.data.delivery === "immediate" ? after : nextWindowSlot(after, s.timezone, r.d.data.category, cfg.windows)?.at ?? after;
      if (at >= r.d.data.expiresAt) skip(r.d, "expired", "expired_slot_taken");
      else defer(r.d, at, "slot_taken");
    }
    const lp = localParts(now, s.timezone);
    claims.push({ item: best.d, channel: best.dec.channel, ledger, ledgerVersion: ledgerDoc ? ledgerDoc.version : null, day: lp.date, hour: lp.hour });
  }
  if (plain.length) await store.commit(plain, false);
  if (!claims.length) return;
  const nextLedger = (c) => ledgerWith(c.ledger, c.item.data.notificationId, { at: now, day: c.day, key: c.item.data.dedupeKey, cat: c.item.data.category }, now);
  const claimWrites = (c) => {
    const it = c.item.data;
    const next = nextLedger(c);
    return [
      { col: COL.queue, id: c.item.id, kind: "update", ifVersion: c.item.version, data: { status: "processing", dueAt: now + PROCESSING_LEASE_MS, claimedAt: now, channel: c.channel }, inc: { attempts: 1 } },
      { col: COL.ledger, id: it.uid, kind: "set", ifVersion: c.ledgerVersion, data: { ...next, uid: it.uid, updatedAt: now } }
    ];
  };
  const won = [];
  const all = await store.commit(claims.flatMap(claimWrites), true);
  if (all.every((r) => r.ok)) {
    claims.forEach((c, i) => won.push({ c, ledgerVersion: all[i * 2 + 1].version ?? null, written: nextLedger(c) }));
  } else {
    for (const c of claims) {
      const r = await store.commit(claimWrites(c), true);
      if (r.every((x) => x.ok)) won.push({ c, ledgerVersion: r[1].version ?? null, written: nextLedger(c) });
      else rep.conflicts += 1;
    }
  }
  if (!won.length) return;
  const messages = [];
  const webJobs = [];
  const results = won.map(() => []);
  const tickets = won.map(() => []);
  const deadTokens = /* @__PURE__ */ new Set();
  const inboxWrites = [];
  won.forEach(({ c }, i) => {
    const it = c.item.data;
    const data = { type: it.type, contentId: it.contentId ?? void 0, deepLink: it.deepLink ?? void 0, campaignId: it.campaignId, category: it.category, notificationId: it.notificationId };
    if (c.channel === "in_app") {
      inboxWrites.push({
        col: COL.inbox(it.uid),
        id: it.notificationId,
        kind: "set",
        data: { title: it.title, message: it.body, type: it.type, contentId: it.contentId, deepLink: it.deepLink, campaignId: it.campaignId, category: it.category, source: "engine", isRead: false, createdAtMs: now }
      });
      return;
    }
    for (const t of tokenMap.get(it.uid) ?? []) {
      if (t.kind === "expo") messages.push({ msg: { to: t.token, title: it.title, body: it.body, data, sound: "default", channelId: "default", priority: "high" }, claim: i, tokenId: t.id });
      else if (t.web) webJobs.push({ claim: i, row: t, payload: { title: it.title, body: it.body, data } });
    }
  });
  if (inboxWrites.length) {
    const r = await store.commit(inboxWrites, false);
    let k = 0;
    won.forEach(({ c }, i) => {
      if (c.channel !== "in_app") return;
      results[i].push(r[k++]?.ok ? { status: "ok" } : { status: "error", code: "InboxWriteFailed", retryable: true, tokenGone: false });
    });
  }
  if (messages.length) {
    const res = await sender.expo(messages.map((m) => m.msg)).catch(() => messages.map(() => ({ status: "error", code: "NetworkError", retryable: true, tokenGone: false })));
    messages.forEach((m, k) => {
      const r = res[k] ?? { status: "error", code: "NoTicket", retryable: true, tokenGone: false };
      results[m.claim].push(r);
      if (r.status === "ok" && r.id) tickets[m.claim].push({ id: r.id, tokenId: m.tokenId });
      if (r.status === "error") {
        stats.add(`tickets.${r.code.replace(/[^A-Za-z0-9_]/g, "_")}`);
        if (r.tokenGone) deadTokens.add(m.tokenId);
      } else stats.add("tickets.ok");
    });
  }
  for (const j of webJobs) {
    const r = await sender.webPush(j.row.web, j.payload).catch(() => ({ status: "error", code: "NetworkError", retryable: true, tokenGone: false }));
    results[j.claim].push(r);
    if (r.status === "error" && r.tokenGone) deadTokens.add(j.row.id);
    stats.add(r.status === "ok" ? "webpush.ok" : `webpush.${r.code.replace(/[^A-Za-z0-9_]/g, "_")}`);
  }
  const out = [];
  const rollbacks = [];
  won.forEach(({ c, ledgerVersion, written }, i) => {
    const it = c.item.data;
    const rs = results[i];
    const ok = rs.some((r) => r.status === "ok");
    const errs = rs.filter((r) => r.status === "error");
    if (ok) {
      const t = tickets[i].slice(0, 10);
      out.push({
        col: COL.queue,
        id: c.item.id,
        kind: "update",
        data: { status: "sent", sentAt: now, ticketIds: t.map((x) => x.id), tickets: t, ...t.length ? { receiptDueAt: now + 15 * MINUTE, receiptChecks: 0 } : {}, localHour: c.hour },
        remove: ["dueAt", "lastError"]
      });
      stats.event("notification_sent", it.category, it.campaignId, `hours.h${String(c.hour).padStart(2, "0")}`);
      if (c.channel === "in_app") {
        stats.add("channels.in_app");
        stats.campaign(it.campaignId, "counts.inApp");
        rep.inApp += 1;
      } else stats.add("channels.push");
      rep.sent += 1;
      return;
    }
    const retryable = rs.length === 0 ? false : errs.some((e) => e.retryable);
    const lastError = (errs[0]?.code ?? (rs.length ? "Unknown" : "NoDevices")).slice(0, 80);
    const attempts = (it.attempts ?? 0) + 1;
    rollbacks.push({ uid: it.uid, id: it.notificationId, version: ledgerVersion, ledger: written });
    if (retryable && attempts < MAX_ATTEMPTS && now + backoffMs(attempts) < it.expiresAt) {
      out.push({ col: COL.queue, id: c.item.id, kind: "update", data: { status: "scheduled", dueAt: now + backoffMs(attempts), lastError } });
      stats.add("retries");
      rep.retried += 1;
    } else {
      out.push({ col: COL.queue, id: c.item.id, kind: "update", data: { status: "failed", lastError, finishedAt: now }, remove: ["dueAt"] });
      stats.event("notification_failed", it.category, it.campaignId);
      rep.failed += 1;
    }
  });
  for (const id of deadTokens) out.push({ col: COL.tokens, id, kind: "delete" });
  rep.tokensRemoved += deadTokens.size;
  if (out.length) await store.commit(out, false);
  for (const rb of rollbacks) {
    let version = rb.version;
    let base = rb.ledger;
    for (let attempt = 0; attempt < 3 && base.entries[rb.id]; attempt++) {
      const [r] = await store.commit([{ col: COL.ledger, id: rb.uid, kind: "set", ifVersion: version, data: { ...ledgerWithout(base, rb.id), uid: rb.uid, updatedAt: now } }], true);
      if (r.ok) break;
      const cur = (await store.get(COL.ledger, [rb.uid])).get(rb.uid) ?? null;
      if (!cur) break;
      version = cur.version;
      base = normalizeLedger(cur.data);
    }
  }
}
async function checkReceipts(store, sender, now, rep, stats) {
  const due = await store.dueQuery(COL.queue, "receiptDueAt", now, 300);
  if (!due.length) return;
  const ids = uniq(due.flatMap((d) => (d.data.tickets ?? []).map((t) => t.id))).slice(0, 1e3);
  const receipts = ids.length ? await sender.receipts(ids).catch(() => null) : {};
  if (!receipts) return;
  const writes = [];
  const dead = /* @__PURE__ */ new Set();
  for (const d of due) {
    const ts = d.data.tickets ?? [];
    const got = ts.filter((t) => receipts[t.id]);
    if (got.length < ts.length && (d.data.receiptChecks ?? 0) < 3) {
      writes.push({ col: COL.queue, id: d.id, kind: "update", data: { receiptDueAt: now + 30 * MINUTE }, inc: { receiptChecks: 1 } });
      continue;
    }
    const codes = got.map((t) => receipts[t.id].status === "ok" ? "ok" : receipts[t.id].details?.error || "Error");
    got.forEach((t) => {
      if (receipts[t.id].details?.error === "DeviceNotRegistered") dead.add(t.tokenId);
    });
    for (const code of codes) stats.add(`receipts.${code.replace(/[^A-Za-z0-9_]/g, "_")}`);
    rep.receipts += codes.length;
    writes.push({ col: COL.queue, id: d.id, kind: "update", data: { receiptStatus: codes.length ? codes.every((c) => c === "ok") ? "ok" : codes.find((c) => c !== "ok") : "unknown" }, remove: ["receiptDueAt"] });
  }
  for (const id of dead) writes.push({ col: COL.tokens, id, kind: "delete" });
  rep.tokensRemoved += dead.size;
  if (writes.length) await store.commit(writes, false);
}
async function runDispatcher(store, sender, opts = {}) {
  const o = {
    now: opts.now ?? Date.now(),
    maxPages: opts.maxPages ?? 3,
    pageSize: opts.pageSize ?? 300,
    maxCampaigns: opts.maxCampaigns ?? 3,
    maxItems: opts.maxItems ?? 100,
    log: opts.log ?? (() => void 0)
  };
  const now = o.now;
  const rep = { enabled: true, campaigns: 0, queued: 0, notQueued: 0, sent: 0, inApp: 0, deferred: 0, skipped: 0, expired: 0, failed: 0, retried: 0, conflicts: 0, tokensRemoved: 0, receipts: 0 };
  const cfg = normalizeEngineConfig((await store.get(COL.config, [COL.configId])).get(COL.configId)?.data);
  if (!cfg.enabled) {
    rep.enabled = false;
    return rep;
  }
  const stats = new Stats();
  try {
    await fanOut(store, cfg, now, o, rep, stats);
    await dispatchDue(store, sender, cfg, now, o, rep, stats);
    await checkReceipts(store, sender, now, rep, stats);
  } finally {
    const w = stats.writes(now);
    if (w.length) await store.commit(w, false).catch(() => void 0);
  }
  o.log(`[notify] ${JSON.stringify(rep)}`);
  return rep;
}
function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}
function eventCampaign(ev, now) {
  const category = ev.category ?? typeToCategory(ev.type);
  const key = ev.key ? `${ev.type}:${ev.key}` : ev.type === "live" ? `live:${ev.liveKey || new Date(now).toISOString().slice(0, 10)}:${hash(ev.title)}` : `${ev.type}:${ev.contentId || hash(`${ev.title}|${ev.body}`)}`;
  const id = safeId(`ev_${key.replace(/:/g, "_")}`);
  return {
    id,
    data: {
      title: ev.title.slice(0, 100),
      body: ev.body.slice(0, 300),
      type: ev.type,
      category,
      contentId: ev.contentId ?? null,
      publishAt: now,
      expiresAt: now + DEFAULT_EXPIRY_HOURS[category] * HOUR,
      priority: DEFAULT_PRIORITY[category],
      dedupeKey: key,
      // Send on publish: every content event goes out straight away instead of waiting for a time slot.
      delivery: "immediate",
      status: "scheduled",
      dueAt: now,
      source: "event",
      createdAt: now,
      counts: { queued: 0, sent: 0, skipped: 0, failed: 0, expired: 0 }
    }
  };
}

export { num, obj, str, hash, typeToCategory, prefToCategory, ROUTE_TYPES, COL, runDispatcher, eventCampaign, normalizeSettings, evaluate, buildQueueItem, normalizeLedger, HARD_MIN_INTERVAL_MIN, DEFAULT_WINDOWS };
