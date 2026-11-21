import { obj, str, hash } from './engine.js';
import { b64url } from './firestoreStore.js';

var EXPO_SEND = "https://exp.host/--/api/v2/push/send";
var EXPO_RECEIPTS = "https://exp.host/--/api/v2/push/getReceipts";
var RETRYABLE_TICKET = /* @__PURE__ */ new Set(["MessageRateExceeded"]);
var netErr = (code = "NetworkError") => ({ status: "error", code, retryable: true, tokenGone: false });
function createExpoSender(fetchFn = fetch, log = () => void 0) {
  async function batch(msgs, allowSplit = true) {
    let res;
    try {
      res = await fetchFn(EXPO_SEND, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify(msgs) });
    } catch {
      return msgs.map(() => netErr());
    }
    if (res.ok) {
      const data = (await res.json().catch(() => ({})))?.data || [];
      return msgs.map((_, i) => {
        const t = data[i];
        if (!t) return netErr("NoTicket");
        if (t.status === "ok") return { status: "ok", id: t.id };
        const code = t.details?.error || "Unknown";
        return { status: "error", code, retryable: RETRYABLE_TICKET.has(code), tokenGone: code === "DeviceNotRegistered" };
      });
    }
    const text = await res.text().catch(() => "");
    let err = null;
    try {
      err = JSON.parse(text)?.errors?.[0] ?? null;
    } catch {
    }
    if (allowSplit && err?.code === "PUSH_TOO_MANY_EXPERIENCE_IDS" && err.details && typeof err.details === "object") {
      const out = new Array(msgs.length);
      const groups = Object.values(err.details).map((tokens) => msgs.map((m, i) => [m, i]).filter(([m]) => (tokens || []).includes(m.to)));
      for (const g of groups) {
        const r = await batch(g.map(([m]) => m), false);
        g.forEach(([, i], k) => out[i] = r[k]);
      }
      return out.map((x) => x ?? netErr("NoTicket"));
    }
    log(`[notify] Expo HTTP ${res.status}: ${text.slice(0, 200)}`);
    const retryable = res.status === 429 || res.status >= 500;
    return msgs.map(() => ({ status: "error", code: `HTTP_${res.status}`, retryable, tokenGone: false }));
  }
  return {
    async expo(messages) {
      const out = [];
      for (let i = 0; i < messages.length; i += 100) out.push(...await batch(messages.slice(i, i + 100)));
      return out;
    },
    async receipts(ids) {
      const out = {};
      for (let i = 0; i < ids.length; i += 1e3) {
        const res = await fetchFn(EXPO_RECEIPTS, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ ids: ids.slice(i, i + 1e3) }) });
        if (!res.ok) throw new Error(`Expo receipts HTTP ${res.status}`);
        Object.assign(out, (await res.json())?.data || {});
      }
      return out;
    }
  };
}
var te = new TextEncoder();
var b64urlEncode = (bytes) => {
  let s = "";
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
var b64urlDecode = (str2) => {
  const s = String(str2).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(s + "=".repeat((4 - s.length % 4) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};
var concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};
async function hkdf(salt, ikm, info, length) {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, length * 8));
}
async function encryptWebPush(sub, plaintext, { salt = crypto.getRandomValues(new Uint8Array(16)), serverKeys } = {}) {
  const uaPublic = b64urlDecode(sub.keys.p256dh);
  const authSecret = b64urlDecode(sub.keys.auth);
  const keys = serverKeys || await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", keys.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, keys.privateKey, 256));
  const ikm = await hkdf(authSecret, shared, concat(te.encode("WebPush: info\0"), uaPublic, asPublic), 32);
  const cek = await hkdf(salt, ikm, te.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, te.encode("Content-Encoding: nonce\0"), 12);
  const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aes, concat(plaintext, new Uint8Array([2]))));
  const header = new Uint8Array(21 + asPublic.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = asPublic.length;
  header.set(asPublic, 21);
  return concat(header, cipher);
}
async function vapidAuthorization(endpoint, publicKey, privateKey, subject, now = Date.now()) {
  const pub = b64urlDecode(publicKey);
  const jwk = { kty: "EC", crv: "P-256", d: privateKey, x: b64urlEncode(pub.slice(1, 33)), y: b64urlEncode(pub.slice(33, 65)), ext: true };
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const head = b64urlEncode(te.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const body = b64urlEncode(te.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1e3) + 12 * 3600, sub: subject })));
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, te.encode(`${head}.${body}`));
  return `vapid t=${head}.${body}.${b64urlEncode(sig)}, k=${publicKey}`;
}
function createWebPushSender(env, fetchFn = fetch) {
  const pub = env.VAPID_PUBLIC_KEY;
  const priv = env.VAPID_PRIVATE_KEY;
  const subject = env.VAPID_SUBJECT || "https://testimoniesofpraiseapp.com";
  return async function webPush(sub, payload) {
    if (!pub || !priv) return { status: "error", code: "WebPushNotConfigured", retryable: false, tokenGone: false };
    let res;
    try {
      const body = await encryptWebPush(sub, te.encode(JSON.stringify(payload)));
      res = await fetchFn(sub.endpoint, {
        method: "POST",
        headers: { Authorization: await vapidAuthorization(sub.endpoint, pub, priv, subject), "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", TTL: "86400", Urgency: "normal" },
        body
      });
    } catch {
      return netErr();
    }
    if (res.status >= 200 && res.status < 300) return { status: "ok" };
    if (res.status === 404 || res.status === 410) return { status: "error", code: "SubscriptionGone", retryable: false, tokenGone: true };
    return { status: "error", code: `HTTP_${res.status}`, retryable: res.status === 429 || res.status >= 500, tokenGone: false };
  };
}

export { te, createExpoSender, createWebPushSender };
