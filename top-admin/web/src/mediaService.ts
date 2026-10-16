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
  providers: {
    bunny: {
      configured: boolean;
      storageZone: string | null;
      cdnHostname: string | null;
      endpoint: string;
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

export interface MediaVerifyResult {
  verified: boolean;
  status?: number;
  contentType?: string | null;
  contentLength?: string | null;
  error?: string;
}

// Environment variables
const workerBaseUrl = (
  (import.meta.env.VITE_WORKER_URL as string | undefined) ||
  (import.meta.env.VITE_PUSH_URL as string | undefined) ||
  ''
).replace(/\/$/, '');

const cloudinaryCloud = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined;
const cloudinaryPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string | undefined;

export const isCloudinaryAvailable = Boolean(cloudinaryCloud && cloudinaryPreset);
export const isWorkerAvailable = Boolean(workerBaseUrl);
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
 * Checks server media status (which providers are configured on the server)
 */
export async function checkServerMediaStatus(): Promise<ServerMediaStatus | null> {
  if (!workerBaseUrl) return null;
  try {
    const res = await fetch(`${workerBaseUrl}/api/media/status`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Verifies if a media URL actually exists and is reachable (HEAD request via worker)
 */
export async function verifyMediaReachability(targetUrl: string): Promise<MediaVerifyResult> {
  if (!workerBaseUrl) {
    // Client-side fallback check
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
  // If worker is configured, Bunny Storage is the preferred host for videos (no 100MB free credit limits!)
  if (isWorkerAvailable) {
    try {
      return await uploadToBunnyStorage(file, 'videos', onProgress);
    } catch (err: any) {
      // If Bunny upload fails because it's not configured on the worker, try Cloudinary if small enough
      if (
        isCloudinaryAvailable &&
        file.size <= MAX_CLOUDINARY_VIDEO_MB * 1024 * 1024
      ) {
        return uploadVideoToCloudinary(file, onProgress);
      }
      throw err;
    }
  }

  // Fallback to Cloudinary if worker is not configured
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
