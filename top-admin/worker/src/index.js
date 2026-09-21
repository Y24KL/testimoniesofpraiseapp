/**
 * Free push relay for Testimonies of Praise (Cloudflare Workers, free plan).
 *
 * Why it exists: on Firebase's free (Spark) plan there are no Cloud Functions, and browsers can't call
 * Expo's push API directly (CORS). This tiny relay does that one job.
 *
 * Security: it holds NO secrets. It reads the device list from Firestore using the CALLER's own
 * Firebase sign-in token. Firestore's security rules only let admins read `pushTokens`, so a
 * non-admin (or forged) token is rejected by Firestore and nothing is sent.
 */
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const PREFS = new Set(['testimonies', 'live', 'announcements']);
const TYPES = new Set(['testimony', 'live', 'announcement', 'featured']);
const MAX_DEVICES = 5000; // free plan allows 50 outgoing requests per call (100 messages each)

const json = (body, status, headers) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

export default {
  async fetch(request, env) {
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
    const origin = request.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : 'null',
      'Access-Control-Allow-Headers': 'authorization, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      Vary: 'Origin',
    };

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, cors);
    if (!allowed.includes(origin)) return json({ error: 'Origin not allowed.' }, 403, cors);

    const auth = request.headers.get('Authorization') || '';
    if (!auth.startsWith('Bearer ')) return json({ error: 'Sign in required.' }, 401, cors);

    let req;
    try {
      req = await request.json();
    } catch {
      return json({ error: 'Invalid request.' }, 400, cors);
    }
    const { pref, title, body, data } = req || {};
    if (!PREFS.has(pref)) return json({ error: 'Unknown notification type.' }, 400, cors);
    if (typeof title !== 'string' || !title.trim() || title.length > 100) return json({ error: 'Invalid title.' }, 400, cors);
    if (typeof body !== 'string' || !body.trim() || body.length > 300) return json({ error: 'Invalid message.' }, 400, cors);
    if (!data || !TYPES.has(data.type) || (data.contentId !== undefined && (typeof data.contentId !== 'string' || data.contentId.length > 100))) {
      return json({ error: 'Invalid data.' }, 400, cors);
    }

    // 1) Read device tokens as the caller. Only admins are allowed to (Firestore rules).
    const base = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
    const q = await fetch(`${base}:runQuery`, {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'pushTokens' }],
          where: { fieldFilter: { field: { fieldPath: `prefs.${pref}` }, op: 'EQUAL', value: { booleanValue: true } } },
          limit: MAX_DEVICES,
        },
      }),
    });
    if (q.status === 401 || q.status === 403) return json({ error: 'Admins only.' }, 403, cors);
    if (!q.ok) return json({ error: 'Could not read devices.' }, 502, cors);

    const rows = (await q.json()).filter((r) => r.document);
    const devices = rows
      .map((r) => ({ name: r.document.name, token: r.document.fields?.token?.stringValue }))
      .filter((d) => typeof d.token === 'string' && d.token.startsWith('Expo'));
    if (devices.length === 0) return json({ sent: 0, failed: 0, removed: 0 }, 200, cors);

    // 2) Send through Expo in batches of 100.
    let sent = 0;
    let failed = 0;
    const dead = [];
    for (let i = 0; i < devices.length; i += 100) {
      const chunk = devices.slice(i, i + 100);
      const messages = chunk.map((d) => ({
        to: d.token,
        title,
        body,
        data,
        sound: 'default',
        channelId: 'default',
      }));
      let res;
      try {
        res = await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify(messages),
        });
      } catch {
        failed += chunk.length;
        continue;
      }
      if (!res.ok) {
        failed += chunk.length;
        continue;
      }
      const tickets = (await res.json()).data || [];
      tickets.forEach((t, idx) => {
        if (t.status === 'ok') sent += 1;
        else {
          failed += 1;
          if (t.details?.error === 'DeviceNotRegistered') dead.push(chunk[idx].name);
        }
      });
    }

    // 3) Tidy up tokens the phone platforms say no longer exist (admins may delete, per the rules).
    let removed = 0;
    for (const name of dead.slice(0, 40)) {
      const d = await fetch(`https://firestore.googleapis.com/v1/${name}`, { method: 'DELETE', headers: { Authorization: auth } });
      if (d.ok) removed += 1;
    }

    return json({ sent, failed, removed }, 200, cors);
  },
};
