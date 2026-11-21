import { num, obj, str, hash } from './engine.js';
import { parseServiceAccount } from '../firebaseCustomToken.js';
import { te } from './senders.js';

var enc4 = new TextEncoder();
var b64url = (bytes) => {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
var cachedToken = null;
async function serviceAccessToken(serviceAccountRaw, fetchFn = fetch, now = Date.now()) {
  const sa = parseServiceAccount(serviceAccountRaw);
  if (cachedToken && cachedToken.email === sa.client_email && cachedToken.exp > now + 6e4) return cachedToken.token;
  const pem = sa.private_key.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const iat = Math.floor(now / 1e3);
  const head = b64url(enc4.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const body = b64url(
    enc4.encode(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/datastore", aud: "https://oauth2.googleapis.com/token", iat, exp: iat + 3600 }))
  );
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc4.encode(`${head}.${body}`)));
  const res = await fetchFn("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=${encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer")}&assertion=${head}.${body}.${b64url(sig)}`
  });
  if (!res.ok) throw new Error(`Service account token request failed (${res.status})`);
  const j = await res.json();
  cachedToken = { token: j.access_token, exp: now + (Number(j.expires_in) || 3600) * 1e3, email: sa.client_email };
  return cachedToken.token;
}
function toValue(v) {
  if (v === null || v === void 0) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "string") return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.filter((x) => x !== void 0).map(toValue) } };
  if (typeof v === "object") return { mapValue: { fields: toFields(v) } };
  return { stringValue: String(v) };
}
function toFields(o) {
  const out = {};
  for (const [k, v] of Object.entries(o || {})) if (v !== void 0) out[k] = toValue(v);
  return out;
}
function fromValue(v) {
  if (!v || typeof v !== "object") return null;
  if ("nullValue" in v) return null;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return Number(v.doubleValue);
  if ("stringValue" in v) return v.stringValue;
  if ("timestampValue" in v) return Date.parse(v.timestampValue);
  if ("referenceValue" in v) return v.referenceValue;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(fromValue);
  if ("mapValue" in v) return fromFields(v.mapValue.fields || {});
  return null;
}
function fromFields(f) {
  const out = {};
  for (const [k, v] of Object.entries(f || {})) out[k] = fromValue(v);
  return out;
}
var fieldPath = (dotted) => dotted.split(".").map((s) => /^[A-Za-z_][A-Za-z_0-9]*$/.test(s) ? s : `\`${s.replace(/\\/g, "\\\\").replace(/`/g, "\\`")}\``).join(".");
function nest(flat) {
  const out = {};
  for (const [path, v] of Object.entries(flat || {})) {
    const k = path.split(".");
    let cur = out;
    for (const p of k.slice(0, -1)) cur = cur[p] && typeof cur[p] === "object" && !Array.isArray(cur[p]) ? cur[p] : cur[p] = {};
    cur[k[k.length - 1]] = v;
  }
  return out;
}
function createFirestoreStore({ projectId, getToken, fetchFn = fetch }) {
  const root = `projects/${projectId}/databases/(default)/documents`;
  const base = `https://firestore.googleapis.com/v1/${root}`;
  const name = (col, id) => `${root}/${col}/${id}`;
  const idOf = (n) => n.slice(n.lastIndexOf("/") + 1);
  const parentOf = (col) => {
    const i = col.lastIndexOf("/");
    return i < 0 ? { parent: base, collectionId: col } : { parent: `${base}/${col.slice(0, i)}`, collectionId: col.slice(i + 1) };
  };
  async function call(url, body) {
    const res = await fetchFn(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${await getToken()}`, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const text = await res.text();
    let json2 = null;
    try {
      json2 = text ? JSON.parse(text) : null;
    } catch {
    }
    return { ok: res.ok, status: res.status, json: json2, text };
  }
  async function query(col, structuredQuery) {
    const { parent, collectionId } = parentOf(col);
    const r = await call(`${parent}:runQuery`, { structuredQuery: { from: [{ collectionId }], ...structuredQuery } });
    if (!r.ok) throw new Error(`Firestore query on ${col} failed (${r.status}): ${r.text.slice(0, 200)}`);
    return (r.json || []).filter((x) => x.document).map((x) => ({ id: idOf(x.document.name), data: fromFields(x.document.fields), version: x.document.updateTime }));
  }
  function toWrite(w) {
    const docName = name(w.col, w.id);
    if (w.kind === "delete") return { delete: docName, ...w.ifVersion ? { currentDocument: { updateTime: w.ifVersion } } : {} };
    const out = {};
    if (w.kind === "create" || w.kind === "set") {
      out.update = { name: docName, fields: toFields(w.data || {}) };
    } else {
      out.update = { name: docName, fields: toFields(nest(w.data || {})) };
      out.updateMask = { fieldPaths: [...Object.keys(w.data || {}), ...w.remove || []].map(fieldPath) };
    }
    const inc = Object.entries(w.inc || {}).filter(([, n]) => n !== 0);
    if (inc.length) out.updateTransforms = inc.map(([p, n]) => ({ fieldPath: fieldPath(p), increment: toValue(n) }));
    if (w.kind === "create" || w.ifVersion === null) out.currentDocument = { exists: false };
    else if (typeof w.ifVersion === "string") out.currentDocument = { updateTime: w.ifVersion };
    else if (w.kind === "update") out.currentDocument = { exists: true };
    return out;
  }
  return {
    async get(col, ids) {
      const out = new Map(ids.map((id) => [id, null]));
      for (let i = 0; i < ids.length; i += 100) {
        const r = await call(`${base}:batchGet`, { documents: ids.slice(i, i + 100).map((id) => name(col, id)) });
        if (!r.ok) throw new Error(`Firestore batchGet on ${col} failed (${r.status})`);
        for (const x of r.json || []) if (x.found) out.set(idOf(x.found.name), { id: idOf(x.found.name), data: fromFields(x.found.fields), version: x.found.updateTime });
      }
      return out;
    },
    dueQuery(col, field, max, limit) {
      if (limit <= 0) return Promise.resolve([]);
      return query(col, {
        where: { fieldFilter: { field: { fieldPath: field }, op: "LESS_THAN_OR_EQUAL", value: { integerValue: String(Math.floor(max)) } } },
        orderBy: [{ field: { fieldPath: field }, direction: "ASCENDING" }],
        limit
      });
    },
    whereIn(col, field, values) {
      if (!values.length) return Promise.resolve([]);
      return query(col, { where: { fieldFilter: { field: { fieldPath: field }, op: "IN", value: { arrayValue: { values: values.slice(0, 30).map(toValue) } } } } });
    },
    pageById(col, afterId, limit) {
      return query(col, {
        orderBy: [{ field: { fieldPath: "__name__" }, direction: "ASCENDING" }],
        ...afterId ? { startAt: { values: [{ referenceValue: name(col, afterId) }], before: false } } : {},
        limit
      });
    },
    async commit(writes, atomic) {
      if (!writes.length) return [];
      if (atomic) {
        const r = await call(`${base}:commit`, { writes: writes.map(toWrite) });
        if (r.ok) return (r.json?.writeResults || []).map((x) => ({ ok: true, version: x.updateTime || r.json.commitTime }));
        if ([400, 404, 409].includes(r.status) || /FAILED_PRECONDITION|ALREADY_EXISTS|NOT_FOUND|ABORTED/.test(r.text)) return writes.map(() => ({ ok: false }));
        throw new Error(`Firestore commit failed (${r.status}): ${r.text.slice(0, 200)}`);
      }
      const results = new Array(writes.length);
      let start = 0;
      while (start < writes.length) {
        const seen = /* @__PURE__ */ new Set();
        let end = start;
        while (end < writes.length && end - start < 400 && !seen.has(`${writes[end].col}/${writes[end].id}`)) seen.add(`${writes[end].col}/${writes[end++].id}`);
        const part = writes.slice(start, end);
        const r = await call(`${base}:batchWrite`, { writes: part.map(toWrite) });
        if (!r.ok) throw new Error(`Firestore batchWrite failed (${r.status}): ${r.text.slice(0, 200)}`);
        part.forEach((_, i) => {
          const code = r.json?.status?.[i]?.code ?? 0;
          results[start + i] = code === 0 ? { ok: true, version: r.json?.writeResults?.[i]?.updateTime } : { ok: false };
        });
        start = end;
      }
      return results;
    }
  };
}

export { b64url, serviceAccessToken, createFirestoreStore };
