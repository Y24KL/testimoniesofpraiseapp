/**
 * Unified Uploads Module for Admin Portal
 *
 * Provides:
 * - Bunny Storage for audio and large video uploads (via server-side worker)
 * - Cloudinary for images, thumbnails, and banners
 * - Fallbacks and backward compatibility for existing uploadToCloudinary calls
 */

import {
  uploadToBunnyStorage,
  uploadAudio,
  uploadVideo,
  uploadImageToCloudinary,
  identifyProvider,
  getProviderDisplayName,
  isWorkerAvailable,
  isCloudinaryAvailable,
} from './mediaService';

export {
  uploadToBunnyStorage,
  uploadAudio,
  uploadVideo,
  uploadImageToCloudinary,
  identifyProvider,
  getProviderDisplayName,
};

const cloud = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined;
const preset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string | undefined;

export const uploadsEnabled = Boolean((cloud && preset) || isWorkerAvailable);
export const MAX_VIDEO_MB = 100; // Cloudinary free plan limit per video

/**
 * Backward-compatible uploadToCloudinary helper
 */
export function uploadToCloudinary(
  file: File,
  kind: 'image' | 'video',
  onProgress: (pct: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!cloud || !preset) return reject(new Error('Uploads are not configured.'));
    if (kind === 'video' && file.size > MAX_VIDEO_MB * 1024 * 1024) {
      return reject(
        new Error(
          `This video is over ${MAX_VIDEO_MB} MB, the Cloudinary free plan limit. Use Bunny Storage or paste a link.`,
        ),
      );
    }
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloud}/${kind}/upload`);
    xhr.upload.onprogress = (e) =>
      e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      try {
        const j = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && j.secure_url) resolve(j.secure_url as string);
        else reject(new Error(j?.error?.message ?? 'Upload failed.'));
      } catch {
        reject(new Error('Upload failed.'));
      }
    };
    xhr.onerror = () => reject(new Error('Network error while uploading.'));
    const fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', preset);
    fd.append('folder', 'testimonies-of-praise');
    xhr.send(fd);
  });
}
