/**
 * Unified Server-Side Relay for Testimonies of Praise (Cloudflare Workers).
 *
 * Capabilities:
 * 1. Notification engine (src/notify): content events, scheduled dispatch, Expo + web push, in-app inbox.
 * 2. Secure Server-Side Bunny Storage Uploads: Keeps Bunny Storage AccessKeys safe on the server.
 * 3. Media Provider Status & Verification: Inspects configured providers and verifies URL reachability.
 *
 * Security: Secrets (BUNNY_STORAGE_ACCESS_KEY, etc.) never touch client devices.
 * Admin authorization is verified against Firestore rules using the caller's Firebase token.
 */

import { AUTH_ROUTES, AuthError, verifyFirebaseToken } from './auth.js';
import { handleKingsChatCallback, handleKingsChatRedeem, handleKingsChatState } from './kingschat.js';
import { AIEndpointError, createEmbeddings, enforceAiRateLimit, semanticSearch, validateSearchQuery } from './ai.js';
import { runAssistant } from './assistant.js';
import { searchClips } from './clips.js';
import { engineConfigured, NotifyInputError, parseEvent, publishEvent, runEngine } from './notify/index.js';
import { MAX_ITEMS_PER_REQUEST, suggestTags } from './tags.js';
import { homeSections } from './recommend.js';

// Durable Object that counts Praxiom chat requests in progress across the whole account (see praxiomGate.js).
export { PraxiomConcurrencyGate } from './praxiomGate.js';

export const WORKER_VERSION = '2.8.1';

const json = (body, status, headers) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });

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

/** Parses ALLOWED_ORIGINS ("a, b,c") into exact origins: no paths, no trailing slashes. */
export function parseAllowedOrigins(raw) {
  return String(raw || '')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

const LOCAL_DEV_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

/**
 * Exact-match allowlist check. Local dev origins are always accepted so `npm run dev` works;
 * anything else must be listed in ALLOWED_ORIGINS. There is no wildcard and no blind reflection.
 */
export function isAllowedOrigin(origin, allowed) {
  if (!origin) return false;
  return allowed.includes(origin) || LOCAL_DEV_ORIGIN.test(origin);
}

/** CORS headers for a request. Access-Control-Allow-Origin is only set for allowlisted origins. */
export function corsHeaders(origin, allowed) {
  const headers = {
    'Access-Control-Allow-Headers': 'authorization, content-type, x-file-name, x-folder, cache-control',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  if (isAllowedOrigin(origin, allowed)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

export default {
  /**
   * Cron trigger (wrangler.toml [triggers]): one notification dispatcher run. Runs are idempotent; a run with
   * nothing due, or with the engine switched off in settings/notificationEngine, returns at once.
   */
  async scheduled(_event, env, ctx) {
    if (!engineConfigured(env)) {
      console.error('[notify] FIREBASE_SERVICE_ACCOUNT is not set: the notification engine cannot run.');
      return;
    }
    ctx.waitUntil(runEngine(env).catch((e) => console.error('[notify] dispatcher run failed', e?.stack || e)));
  },

  async fetch(request, env) {
    try {
      return await handle(request, env);
    } catch (e) {
      // Never let an exception escape: an uncaught throw produces a Cloudflare error page with no
      // CORS headers, which the browser reports as an opaque "network/CORS" failure.
      const allowed = parseAllowedOrigins(env.ALLOWED_ORIGINS);
      console.error('[relay] unhandled error', e?.stack || e);
      return json({ error: 'Internal relay error.' }, 500, corsHeaders(request.headers.get('Origin') || '', allowed));
    }
  },
};

async function handle(request, env) {
  const allowed = parseAllowedOrigins(env.ALLOWED_ORIGINS);
  const origin = request.headers.get('Origin') || '';
  const isOriginAllowed = isAllowedOrigin(origin, allowed);
  const cors = corsHeaders(origin, allowed);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: isOriginAllowed ? 204 : 403, headers: cors });
  }

  const url = new URL(request.url);
  const pathname = url.pathname;

  // -------------------------------------------------------------
  // 1) Health & Media Provider Status Endpoint (GET /api/media/status)
  // -------------------------------------------------------------
  if (request.method === 'GET' && (pathname === '/api/media/status' || pathname === '/status')) {
    const hasAccessKey = Boolean(env.BUNNY_STORAGE_ACCESS_KEY);
    const hasZoneName = Boolean(env.BUNNY_STORAGE_ZONE_NAME);
    const hasCdnHost = Boolean(env.BUNNY_CDN_HOSTNAME);
    const hasEndpoint = Boolean(env.BUNNY_STORAGE_ENDPOINT);

    const missingBunny = [];
    if (!hasAccessKey) missingBunny.push('BUNNY_STORAGE_ACCESS_KEY');
    if (!hasZoneName) missingBunny.push('BUNNY_STORAGE_ZONE_NAME');

    const bunnyConfigured = hasAccessKey && hasZoneName;

    return json(
      {
        status: 'ok',
        version: WORKER_VERSION,
        timestamp: new Date().toISOString(),
        providers: {
          bunny: {
            configured: bunnyConfigured,
            hasAccessKey,
            storageZone: env.BUNNY_STORAGE_ZONE_NAME || null,
            cdnHostname:
              env.BUNNY_CDN_HOSTNAME ||
              (env.BUNNY_STORAGE_ZONE_NAME ? `${env.BUNNY_STORAGE_ZONE_NAME}.b-cdn.net` : null),
            endpoint: env.BUNNY_STORAGE_ENDPOINT || 'storage.bunnycdn.com',
            missingConfig: missingBunny,
            state: bunnyConfigured
              ? 'ready'
              : !hasZoneName
              ? 'missing_zone'
              : 'missing_secret',
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
      },
      200,
      {
        ...cors,
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    );
  }

  // -------------------------------------------------------------
  // 0) Email verification + trusted devices (POST /auth/...), used by the mobile app.
  //    Native apps send no Origin header; browsers from unknown sites are still refused.
  // -------------------------------------------------------------
  // KingsChat sign-in callback: KingsChat posts the code here (form POST). See kingschat.js.
  if (pathname === '/api/auth/kingschat/callback') return handleKingsChatCallback(request, env);
  if (request.method === 'GET' && pathname === '/api/auth/kingschat/state') return handleKingsChatState(request, env);
  if (request.method === 'POST' && pathname === '/api/auth/kingschat/redeem') return handleKingsChatRedeem(request, env);

  if (pathname.startsWith('/auth/') && AUTH_ROUTES[pathname]) {
    if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, cors);
    if (origin && !isOriginAllowed) return json({ error: 'Origin not allowed.' }, 403, cors);
    try {
      const caller = await verifyFirebaseToken(request.headers.get('Authorization'), env.FIREBASE_PROJECT_ID);
      const body = await request.json().catch(() => ({}));
      return json(await AUTH_ROUTES[pathname](env, caller, body), 200, { ...cors, 'Cache-Control': 'no-store' });
    } catch (e) {
      if (e instanceof AuthError) return json({ error: e.message, code: e.code }, e.status, { ...cors, 'Cache-Control': 'no-store' });
      throw e;
    }
  }

  // ---------------------------------------------------------------------------
  // AI SEARCH + EMBEDDINGS. Firebase ID tokens are required on native and web.
  // /api/ai/index-content is admin-only; public app clients may only embed one query.
  // ---------------------------------------------------------------------------
  if (pathname.startsWith('/api/ai/')) {
    if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, cors);
    if (origin && !isOriginAllowed) return json({ error: 'Origin not allowed.' }, 403, cors);

    const authorization = request.headers.get('Authorization') || '';
    try {
      const caller = await verifyFirebaseToken(authorization, env.FIREBASE_PROJECT_ID);
      const body = await request.json().catch(() => null);
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return json({ error: 'A valid JSON object is required.' }, 400, { ...cors, 'Cache-Control': 'no-store' });
      }

      let result;
      if (pathname === '/api/ai/search') {
        // Web search was removed with the move to Praxiom, which has no web access.
        return json({ error: 'Web search is no longer available.' }, 410, { ...cors, 'Cache-Control': 'no-store' });
      } else if (pathname === '/api/ai/semantic-search') {
        await enforceAiRateLimit(env, caller.uid, 'semantic-search', 25);
        result = await semanticSearch(env, authorization, body.query, body.limit);
      } else if (pathname === '/api/ai/clip-search') {
        result = await searchClips(env, authorization, caller.uid, body.query, body.limit);
      } else if (pathname === '/api/ai/assistant') {
        result = { ...(await runAssistant(env, authorization, caller.uid, body.messages)) };
      } else if (pathname === '/api/ai/embed-query') {
        await enforceAiRateLimit(env, caller.uid, 'embed-query', 30);
        if (typeof body.text !== 'string' || !body.text.trim() || body.text.length > 1000) {
          return json({ error: 'A query between 1 and 1,000 characters is required.' }, 400, { ...cors, 'Cache-Control': 'no-store' });
        }
        const embedded = await createEmbeddings(env, [body.text]);
        result = { embedding: embedded.embeddings[0], dimensions: embedded.dimensions, model: embedded.model };
      } else if (pathname === '/api/ai/home') {
        // Personal home sections for the signed-in caller. Reads use the caller's own token (rules apply).
        // A per-person edge cache (5 minutes) absorbs repeat calls without Firestore reads or KV writes.
        const cache = globalThis.caches?.default;
        const key = new Request(`https://cache.top.internal/home/v1/${encodeURIComponent(caller.uid)}`);
        const hit = cache ? await cache.match(key).then((r) => r?.json()).catch(() => null) : null;
        // Pull-to-refresh may bypass the cache, but at most once a minute.
        if (hit && (!body.refresh || Date.now() - (Number(hit.generatedAt) || 0) < 60000)) {
          result = hit;
        } else {
          result = await homeSections(env, authorization, caller.uid, body);
          if (cache) await cache.put(key, new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=300' } })).catch(() => undefined);
        }
      } else if (pathname === '/api/ai/suggest-tags') {
        // Admin only: interest-tag suggestions for content (Praxiom, with a keyword fallback).
        if (!(await verifyAdmin(authorization, env))) return json({ error: 'Admins only.' }, 403, { ...cors, 'Cache-Control': 'no-store' });
        if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > MAX_ITEMS_PER_REQUEST) {
          return json({ error: `Send between 1 and ${MAX_ITEMS_PER_REQUEST} items.` }, 400, { ...cors, 'Cache-Control': 'no-store' });
        }
        await enforceAiRateLimit(env, caller.uid, 'suggest-tags', 60);
        result = await suggestTags(env, body.items);
      } else if (pathname === '/api/ai/index-content') {
        if (!(await verifyAdmin(authorization, env))) return json({ error: 'Admins only.' }, 403, { ...cors, 'Cache-Control': 'no-store' });
        await enforceAiRateLimit(env, caller.uid, 'index-content', 120);
        const embedded = await createEmbeddings(env, body.texts);
        result = { embeddings: embedded.embeddings, dimensions: embedded.dimensions, model: embedded.model };
      } else {
        return json({ error: 'Unknown AI endpoint.' }, 404, { ...cors, 'Cache-Control': 'no-store' });
      }
      return json(result, 200, { ...cors, 'Cache-Control': 'no-store' });
    } catch (e) {
      if (e instanceof AuthError) return json({ error: e.message, code: e.code }, e.status, { ...cors, 'Cache-Control': 'no-store' });
      if (e instanceof AIEndpointError) return json({ error: e.message, code: e.code }, e.status, { ...cors, 'Cache-Control': 'no-store' });
      console.error('[ai] request failed', e?.stack || e);
      return json({ error: 'AI service temporarily unavailable.' }, 502, { ...cors, 'Cache-Control': 'no-store' });
    }
  }

  // Web push: the public VAPID key (safe to publish; the private key is a server secret).
  if (request.method === 'GET' && pathname === '/api/notifications/vapid-key') {
    return json({ publicKey: env.VAPID_PUBLIC_KEY || null }, 200, { ...cors, 'Cache-Control': 'public, max-age=3600' });
  }

  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, cors);
  if (!isOriginAllowed) return json({ error: 'Origin not allowed.' }, 403, cors);

  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return json({ error: 'Sign in required.' }, 401, cors);

  // -------------------------------------------------------------
  // 2) Secure Server-Side Bunny Storage Upload (POST /upload/bunny, /api/media/upload)
  // -------------------------------------------------------------
  if (pathname === '/upload/bunny' || pathname === '/api/media/upload') {
    const isAdmin = await verifyAdmin(auth, env);
    if (!isAdmin) return json({ error: 'Admins only.' }, 403, cors);

    if (!env.BUNNY_STORAGE_ACCESS_KEY || !env.BUNNY_STORAGE_ZONE_NAME) {
      return json(
        {
          error:
            'Bunny Storage is not configured on the server. Set BUNNY_STORAGE_ZONE_NAME and BUNNY_STORAGE_ACCESS_KEY in worker secrets.',
        },
        503,
        cors,
      );
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
    return json(
      {
        ok: true,
        url: cdnUrl,
        provider: 'bunny',
        filename: cleanFilename,
        folder,
        path: `${folder}/${cleanFilename}`,
        size: fileBody.byteLength,
        contentType,
      },
      200,
      cors,
    );
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
      return json(
        {
          verified: headRes.ok,
          status: headRes.status,
          contentType: headRes.headers.get('content-type') || null,
          contentLength: headRes.headers.get('content-length') || null,
        },
        200,
        cors,
      );
    } catch (e) {
      return json({ verified: false, error: e?.message || 'Verification request failed' }, 200, cors);
    }
  }

  // -------------------------------------------------------------
  // 4) Notification engine (admin only): content events and manual dispatch
  //    POST / or /api/push   { pref?, title, body, data: { type, contentId? } }  -> campaign + immediate run
  //    POST /api/notifications/dispatch                                          -> one dispatcher run
  // -------------------------------------------------------------
  const noStore = { ...cors, 'Cache-Control': 'no-store' };
  if (!(await verifyAdmin(auth, env))) return json({ error: 'Admins only.' }, 403, noStore);
  if (!engineConfigured(env)) {
    return json({ error: 'The notification engine is not configured on the server (FIREBASE_SERVICE_ACCOUNT is missing).' }, 503, noStore);
  }
  if (pathname === '/api/notifications/dispatch') {
    const report = await runEngine(env);
    return json({ ok: true, report }, 200, noStore);
  }
  let req;
  try {
    req = await request.json();
  } catch {
    return json({ error: 'Invalid request.' }, 400, noStore);
  }
  let ev;
  try {
    ev = parseEvent(req);
  } catch (e) {
    if (e instanceof NotifyInputError) return json({ error: e.message }, 400, noStore);
    throw e;
  }
  const { campaignId, created, report } = await publishEvent(env, ev);
  console.log(`[notify] event type=${ev.type} campaign=${campaignId} created=${created} queued=${report.queued} sent=${report.sent}`);
  return json(
    { ok: true, engine: true, campaignId, created, duplicate: !created, queued: report.queued, sent: report.sent, inApp: report.inApp, failed: report.failed },
    200,
    noStore,
  );
}
