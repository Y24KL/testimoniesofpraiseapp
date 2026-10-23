/**
 * Unified Media Service & Upload Manager (Admin Portal)
 *
 * Responsibilities:
 * 1. Audio and large media: securely uploaded to Bunny Storage via the server-side Worker.
 *    (Bunny Storage AccessKey is NEVER exposed to the browser).
 * 2. Visual assets & images: uploaded to Cloudinary using secure presets.
 * 3. Provider detection & verification: ensures media links exist before publishing.
 * 4. Backward compatibility: preserves existing Cloudinary, Firebase, and HLS links.
 */

import { auth } from './firebase';

export type MediaProvider = 'bunny' | 'cloudinary' | 'firebase' | 'hls' | 'external';
export type MediaType = 'audio' | 'image' | 'video' | 'large_file';

export interface MediaUploadResult {
  url: string;
  provider: MediaProvider;
  filename?: string;
  size?: number;
  contentType?: string;
}

export interface ServerMediaStatus {
  status: string;
  version?: string;
  timestamp?: string;
  providers: {
    bunny: {
      configured: boolean;
      hasAccessKey?: boolean;
      storageZone: string | null;
      cdnHostname: string | null;
      endpoint: string;
      missingConfig?: string[];
      state?: string;
    };
    cloudinary: {
      configured: boolean;
      cloudName: string | null;
    };
    firebase: {
      configured: boolean;
      projectId: string | null;
    };
  };
}

export interface DetailedMediaStatusResult {
  ok: boolean;
  data: ServerMediaStatus | null;
  error?: string;
  errorKind?: 'missing_url' | 'network' | 'timeout' | 'server_error' | 'invalid_response' | 'outdated_worker';
  lastChecked: Date;
  workerUrl: string;
}

export interface MediaVerifyResult {
  verified: boolean;
  status?: number;
  contentType?: string | null;
  contentLength?: string | null;
  error?: string;
}

// Clean and validate environment variables
const rawWorkerUrl = (import.meta.env.VITE_WORKER_URL as string | undefined)?.trim();
const rawPushUrl = (import.meta.env.VITE_PUSH_URL as string | undefined)?.trim();

// Strip any stray markdown / citation annotations if present in env strings
const cleanUrl = (url?: string) => (url ? url.replace(/\[cite:[^\]]+\]/g, '').trim().replace(/\/$/, '') : '');

const workerUrlCandidate = cleanUrl(rawWorkerUrl);
const pushUrlCandidate = cleanUrl(rawPushUrl);

if (workerUrlCandidate && pushUrlCandidate && workerUrlCandidate !== pushUrlCandidate) {
  console.warn(
    `[MediaService] Configuration conflict: VITE_WORKER_URL (${workerUrlCandidate}) differs from VITE_PUSH_URL (${pushUrlCandidate}). Using VITE_WORKER_URL as canonical relay.`,
  );
}

export const workerBaseUrl = workerUrlCandidate || pushUrlCandidate || '';

const cloudinaryCloud = cleanUrl(import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined);
const cloudinaryPreset = cleanUrl(import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string | undefined);

export const isCloudinaryAvailable = Boolean(cloudinaryCloud && cloudinaryPreset);
export const isWorkerAvailable = Boolean(workerBaseUrl && /^https?:\/\//i.test(workerBaseUrl));
export const MAX_CLOUDINARY_VIDEO_MB = 100;

/**
 * Detects the hosting provider of any given media URL.
 */
export function identifyProvider(url: string | null | undefined): MediaProvider {
  if (!url || typeof url !== 'string') return 'external';
  const clean = url.trim().toLowerCase();

  if (clean.includes('.m3u8') || clean.includes('/hls/')) {
    return 'hls';
  }

  if (
    clean.includes('.b-cdn.net') ||
    clean.includes('bunnycdn.com') ||
    clean.includes('storage.bunny') ||
    clean.includes('media.testimoniesofpraise.org')
  ) {
    return 'bunny';
  }

  if (clean.includes('res.cloudinary.com') || clean.includes('cloudinary.com')) {
    return 'cloudinary';
  }

  if (clean.includes('firebasestorage.googleapis.com')) {
    return 'firebase';
  }

  return 'external';
}

export function isBunnyUrl(url: string | null | undefined): boolean {
  return identifyProvider(url) === 'bunny';
}

export function isCloudinaryUrl(url: string | null | undefined): boolean {
  return identifyProvider(url) === 'cloudinary';
}

export function isHlsUrl(url: string | null | undefined): boolean {
  return identifyProvider(url) === 'hls';
}

export function getProviderDisplayName(provider: MediaProvider): string {
  switch (provider) {
    case 'bunny':
      return 'Bunny Storage (CDN)';
    case 'cloudinary':
      return 'Cloudinary';
    case 'firebase':
      return 'Firebase Storage';
    case 'hls':
      return 'Live Stream (HLS)';
    case 'external':
    default:
      return 'External Host';
  }
}

/**
 * Checks server media status with comprehensive error diagnostics, timeout, and cache-busting.
 */
export async function checkDetailedServerMediaStatus(): Promise<DetailedMediaStatusResult> {
  const now = new Date();
  if (!workerBaseUrl) {
    return {
      ok: false,
      data: null,
      error: 'Worker URL (VITE_WORKER_URL or VITE_PUSH_URL) is not configured in admin environment.',
      errorKind: 'missing_url',
      lastChecked: now,
      workerUrl: '',
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  const fail = (errorKind: DetailedMediaStatusResult['errorKind'], error: string): DetailedMediaStatusResult => ({
    ok: false,
    data: null,
    error,
    errorKind,
    lastChecked: now,
    workerUrl: workerBaseUrl,
  });

  try {
    // Keep this a CORS "simple request": no custom headers (a Cache-Control *request* header forces a
    // preflight that older relays reject). `cache: 'no-store'` + the _t param already bypass caches.
    const res = await fetch(`${workerBaseUrl}/api/media/status?_t=${Date.now()}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return fail('server_error', `Worker returned HTTP ${res.status}: ${errText.slice(0, 150) || res.statusText}`);
    }

    let json: any;
    try {
      json = await res.json();
    } catch {
      return fail('invalid_response', 'Worker responded, but the body was not valid JSON.');
    }
    if (json && typeof json === 'object' && !json.providers && json.status === 'ok') {
      // Reachable, but the deployed script predates the media-status endpoint (it answers every
      // route with {"status":"ok"}). Uploads and push relay will not work until it is redeployed.
      return fail(
        'outdated_worker',
        'Worker is reachable, but the deployed script is outdated and does not report media status. Redeploy top-admin/worker (npm run deploy).',
      );
    }
    if (!json || typeof json !== 'object' || !json.providers) {
      return fail('invalid_response', 'Invalid response format received from Cloudflare Worker.');
    }

    return {
      ok: true,
      data: json as ServerMediaStatus,
      lastChecked: now,
      workerUrl: workerBaseUrl,
    };
  } catch (err: any) {
    if (err?.name === 'AbortError') return fail('timeout', 'Connection to the Worker relay timed out after 8 seconds.');
    if (import.meta.env.DEV) console.warn('[MediaService] status check failed', err);
    // The browser hides the reason for a failed fetch: it may be DNS/offline, a Worker crash, or a
    // CORS rejection. Say so instead of guessing.
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    return fail(
      'network',
      offline
        ? 'You appear to be offline.'
        : `Could not reach the Worker (network error or CORS rejection). Check the Worker is deployed and that "${window.location.origin}" is listed in its ALLOWED_ORIGINS.`,
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Backward-compatible helper returning ServerMediaStatus or null.
 */
export async function checkServerMediaStatus(): Promise<ServerMediaStatus | null> {
  const result = await checkDetailedServerMediaStatus();
  return result.ok ? result.data : null;
}

/**
 * Verifies if a media URL actually exists and is reachable (HEAD request via worker)
 */
export async function verifyMediaReachability(targetUrl: string): Promise<MediaVerifyResult> {
  if (!workerBaseUrl) {
    try {
      const res = await fetch(targetUrl, { method: 'HEAD', mode: 'no-cors' });
      return { verified: true, status: 200 };
    } catch (e: any) {
      return { verified: false, error: e?.message || 'Failed to reach URL' };
    }
  }

  const token = await auth.currentUser?.getIdToken();
  if (!token) return { verified: false, error: 'Sign-in required to verify media.' };

  try {
    const res = await fetch(`${workerBaseUrl}/api/media/verify`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: targetUrl }),
    });

    const data = await res.json();
    return {
      verified: Boolean(data?.verified),
      status: data?.status,
      contentType: data?.contentType,
      contentLength: data?.contentLength,
      error: data?.error,
    };
  } catch (e: any) {
    return { verified: false, error: e?.message || 'Verification failed.' };
  }
}

/**
 * Uploads audio or large files to Bunny Storage via the secure server-side worker.
 * Secrets never touch the browser.
 */
export function uploadToBunnyStorage(
  file: File,
  folder = 'audio-testimonies',
  onProgress?: (pct: number) => void,
): Promise<MediaUploadResult> {
  return new Promise(async (resolve, reject) => {
    if (!workerBaseUrl) {
      return reject(
        new Error(
          'Server relay URL (VITE_WORKER_URL or VITE_PUSH_URL) is not configured in admin .env.',
        ),
      );
    }

    let token: string | undefined;
    try {
      token = await auth.currentUser?.getIdToken();
    } catch {
      return reject(new Error('Authentication failed. Please sign in again.'));
    }

    if (!token) {
      return reject(new Error('Sign-in required to upload files.'));
    }

    const xhr = new XMLHttpRequest();
    const uploadEndpoint = `${workerBaseUrl}/upload/bunny`;

    xhr.open('POST', uploadEndpoint);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('x-file-name', file.name);
    xhr.setRequestHeader('x-folder', folder);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
    }

    xhr.onload = () => {
      try {
        const res = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && res.ok && res.url) {
          resolve({
            url: res.url,
            provider: 'bunny',
            filename: res.filename,
            size: res.size ?? file.size,
            contentType: res.contentType ?? file.type,
          });
        } else {
          reject(new Error(res?.error || `Upload failed with status ${xhr.status}`));
        }
      } catch {
        reject(new Error(`Server error (${xhr.status}). Check server worker logs.`));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error occurred during upload. Check internet connection and CORS.'));
    };

    xhr.send(file);
  });
}

/**
 * Uploads an image straight to Cloudinary (for thumbnails, article covers, promotion banners).
 */
export function uploadImageToCloudinary(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<MediaUploadResult> {
  return new Promise((resolve, reject) => {
    if (!cloudinaryCloud || !cloudinaryPreset) {
      return reject(new Error('Cloudinary is not configured. Set VITE_CLOUDINARY_* in .env'));
    }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudinaryCloud}/image/upload`);

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
    }

    xhr.onload = () => {
      try {
        const j = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && j.secure_url) {
          resolve({
            url: j.secure_url,
            provider: 'cloudinary',
            filename: j.original_filename,
            size: j.bytes,
            contentType: file.type,
          });
        } else {
          reject(new Error(j?.error?.message ?? 'Cloudinary upload failed.'));
        }
      } catch {
        reject(new Error('Failed to parse Cloudinary response.'));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during Cloudinary upload.'));

    const fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', cloudinaryPreset);
    fd.append('folder', 'testimonies-of-praise');
    xhr.send(fd);
  });
}

/**
 * Unified Audio Upload:
 * Routes audio files to Bunny Storage via the secure server-side worker.
 */
export async function uploadAudio(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<MediaUploadResult> {
  return uploadToBunnyStorage(file, 'audio-testimonies', onProgress);
}

/**
 * Unified Video Upload:
 * Automatically routes large videos to Bunny Storage, or falls back to Cloudinary if within limits.
 */
export async function uploadVideo(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<MediaUploadResult> {
  if (isWorkerAvailable) {
    try {
      return await uploadToBunnyStorage(file, 'videos', onProgress);
    } catch (err: any) {
      if (
        isCloudinaryAvailable &&
        file.size <= MAX_CLOUDINARY_VIDEO_MB * 1024 * 1024
      ) {
        return uploadVideoToCloudinary(file, onProgress);
      }
      throw err;
    }
  }

  if (isCloudinaryAvailable) {
    if (file.size > MAX_CLOUDINARY_VIDEO_MB * 1024 * 1024) {
      throw new Error(
        `This video is over ${MAX_CLOUDINARY_VIDEO_MB} MB. Configure Bunny Storage on the worker or compress the file.`,
      );
    }
    return uploadVideoToCloudinary(file, onProgress);
  }

  throw new Error('No storage provider is currently configured for video uploads.');
}

function uploadVideoToCloudinary(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<MediaUploadResult> {
  return new Promise((resolve, reject) => {
    if (!cloudinaryCloud || !cloudinaryPreset) {
      return reject(new Error('Cloudinary is not configured.'));
    }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudinaryCloud}/video/upload`);

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
    }

    xhr.onload = () => {
      try {
        const j = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && j.secure_url) {
          resolve({
            url: j.secure_url,
            provider: 'cloudinary',
            filename: j.original_filename,
            size: j.bytes,
            contentType: file.type,
          });
        } else {
          reject(new Error(j?.error?.message ?? 'Cloudinary video upload failed.'));
        }
      } catch {
        reject(new Error('Failed to parse Cloudinary response.'));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during video upload.'));

    const fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', cloudinaryPreset);
    fd.append('folder', 'testimonies-of-praise');
    xhr.send(fd);
  });
}
