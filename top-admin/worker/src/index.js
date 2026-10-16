/**
 * Unified Server-Side Relay for Testimonies of Praise (Cloudflare Workers).
 *
 * Capabilities:
 * 1. Push Notification Relay: Sends Expo push notifications using caller's Firebase admin token.
 * 2. Secure Server-Side Bunny Storage Uploads: Keeps Bunny Storage AccessKeys safe on the server.
 * 3. Media Provider Status & Verification: Inspects configured providers and verifies URL reachability.
 *
 * Security: Secrets (BUNNY_STORAGE_ACCESS_KEY, etc.) never touch client devices.
 * Admin authorization is verified against Firestore rules using the caller's Firebase token.
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const PREFS = new Set(['testimonies', 'live', 'announcements']);
const TYPES = new Set(['testimony', 'live', 'announcement', 'featured', 'article', 'promotion', 'radio']);
const MAX_DEVICES = 5000;

const json = (body, status, headers) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

/** Verifies that the caller has admin rights in Firestore */
async function verifyAdmin(auth, env) {
  const base = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
  const q = await fetch(`${base}:runQuery`, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'pushTokens' }],
        where: { fieldFilter: { field: { fieldPath: 'prefs.testimonies' }, op: 'EQUAL', value: { booleanValue: true } } },
        limit: 1,
      },
    }),
  });
  return q.status !== 401 && q.status !== 403 && q.ok;
}

export default {
  async fetch(request, env) {
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
    const origin = request.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : (allowed.length === 0 ? '*' : 'null'),
      'Access-Control-Allow-Headers': 'authorization, content-type, x-file-name, x-folder',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      Vary: 'Origin',
    };

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    const pathname = url.pathname;

    // -------------------------------------------------------------
    // 1) Health & Media Provider Status Endpoint (GET /api/media/status)
    // -------------------------------------------------------------
    if (request.method === 'GET' && (pathname === '/api/media/status' || pathname === '/status')) {
      const bunnyConfigured = Boolean(env.BUNNY_STORAGE_ACCESS_KEY && env.BUNNY_STORAGE_ZONE_NAME);
      return json({
        status: 'ok',
        version: '2.1.0',
        providers: {
          bunny: {
            configured: bunnyConfigured,
            storageZone: env.BUNNY_STORAGE_ZONE_NAME || null,
            cdnHostname: env.BUNNY_CDN_HOSTNAME || (env.BUNNY_STORAGE_ZONE_NAME ? `${env.BUNNY_STORAGE_ZONE_NAME}.b-cdn.net` : null),
            endpoint: env.BUNNY_STORAGE_ENDPOINT || 'storage.bunnycdn.com',
          },
          cloudinary: {
            configured: Boolean(env.CLOUDINARY_CLOUD_NAME || env.VITE_CLOUDINARY_CLOUD_NAME),
            cloudName: env.CLOUDINARY_CLOUD_NAME || env.VITE_CLOUDINARY_CLOUD_NAME || null,
          },
          firebase: {
            configured: Boolean(env.FIREBASE_PROJECT_ID),
            projectId: env.FIREBASE_PROJECT_ID || null,
          },
        },
      }, 200, cors);
    }

    if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, cors);
    if (allowed.length > 0 && !allowed.includes(origin)) return json({ error: 'Origin not allowed.' }, 403, cors);

    const auth = request.headers.get('Authorization') || '';
    if (!auth.startsWith('Bearer ')) return json({ error: 'Sign in required.' }, 401, cors);

    // -------------------------------------------------------------
    // 2) Secure Server-Side Bunny Storage Upload (POST /upload/bunny, /api/media/upload)
    // -------------------------------------------------------------
    if (pathname === '/upload/bunny' || pathname === '/api/media/upload') {
      const isAdmin = await verifyAdmin(auth, env);
      if (!isAdmin) return json({ error: 'Admins only.' }, 403, cors);

      if (!env.BUNNY_STORAGE_ACCESS_KEY || !env.BUNNY_STORAGE_ZONE_NAME) {
        return json({
          error: 'Bunny Storage is not configured on the server. Set BUNNY_STORAGE_ZONE_NAME and BUNNY_STORAGE_ACCESS_KEY in worker secrets.',
        }, 503, cors);
      }

      let fileBody;
      let rawName = '';
      let folder = 'audio';
      let contentType = 'application/octet-stream';

      const ct = request.headers.get('content-type') || '';
      if (ct.includes('multipart/form-data')) {
        const formData = await request.formData();
        const file = formData.get('file');
        if (!file || typeof file === 'string') {
          return json({ error: 'No valid file found in multipart upload.' }, 400, cors);
        }
        rawName = file.name || `upload-${Date.now()}`;
        contentType = file.type || 'application/octet-stream';
        const formFolder = formData.get('folder');
        if (typeof formFolder === 'string' && formFolder.trim()) {
          folder = formFolder.trim().replace(/[^a-zA-Z0-9_-]/g, '');
        }
        fileBody = await file.arrayBuffer();
      } else {
        rawName = request.headers.get('x-file-name') || `upload-${Date.now()}`;
        const headerFolder = request.headers.get('x-folder');
        if (headerFolder) {
          folder = headerFolder.replace(/[^a-zA-Z0-9_-]/g, '');
        }
        contentType = ct || 'application/octet-stream';
        fileBody = await request.arrayBuffer();
      }

      if (!fileBody || fileBody.byteLength === 0) {
        return json({ error: 'Uploaded file is empty.' }, 400, cors);
      }

      const safeName = rawName.toLowerCase().replace(/[^a-z0-9._-]/g, '_');
      const cleanFilename = `${Date.now()}-${safeName}`;
      const storageEndpoint = env.BUNNY_STORAGE_ENDPOINT || 'storage.bunnycdn.com';
      const zoneName = env.BUNNY_STORAGE_ZONE_NAME;
      const cdnHost = env.BUNNY_CDN_HOSTNAME || `${zoneName}.b-cdn.net`;

      const uploadUrl = `https://${storageEndpoint}/${zoneName}/${folder}/${cleanFilename}`;
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          AccessKey: env.BUNNY_STORAGE_ACCESS_KEY,
          'Content-Type': contentType,
        },
        body: fileBody,
      });

      if (!uploadRes.ok) {
        const errText = await uploadRes.text().catch(() => '');
        return json({ error: `Bunny Storage upload error (${uploadRes.status}): ${errText}` }, 502, cors);
      }

      const cdnUrl = `https://${cdnHost}/${folder}/${cleanFilename}`;
      return json({
        ok: true,
        url: cdnUrl,
        provider: 'bunny',
        filename: cleanFilename,
        folder,
        path: `${folder}/${cleanFilename}`,
        size: fileBody.byteLength,
        contentType,
      }, 200, cors);
    }

    // -------------------------------------------------------------
    // 3) Media Verification Endpoint (POST /api/media/verify) - Migration Safeguard
    // -------------------------------------------------------------
    if (pathname === '/api/media/verify') {
      const isAdmin = await verifyAdmin(auth, env);
      if (!isAdmin) return json({ error: 'Admins only.' }, 403, cors);

      let bodyJson;
      try {
        bodyJson = await request.json();
      } catch {
        return json({ error: 'Invalid JSON request.' }, 400, cors);
      }
      const targetUrl = bodyJson?.url;
      if (!targetUrl || typeof targetUrl !== 'string' || !targetUrl.startsWith('http')) {
        return json({ error: 'Valid HTTP/HTTPS target URL is required.' }, 400, cors);
      }

      try {
        const headRes = await fetch(targetUrl, { method: 'HEAD' });
        return json({
          verified: headRes.ok,
          status: headRes.status,
          contentType: headRes.headers.get('content-type') || null,
          contentLength: headRes.headers.get('content-length') || null,
        }, 200, cors);
      } catch (e) {
        return json({ verified: false, error: e?.message || 'Verification request failed' }, 200, cors);
      }
    }

    // -------------------------------------------------------------
    // 4) Push Notification Relay (POST /, /api/push)
    // -------------------------------------------------------------
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

    // Read device tokens as caller to enforce admin permissions
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

    // Send through Expo in batches of 100
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

    // Tidy up invalid tokens
    let removed = 0;
    for (const name of dead.slice(0, 40)) {
      const d = await fetch(`https://firestore.googleapis.com/v1/${name}`, { method: 'DELETE', headers: { Authorization: auth } });
      if (d.ok) removed += 1;
    }

    return json({ sent, failed, removed }, 200, cors);
  },
};
