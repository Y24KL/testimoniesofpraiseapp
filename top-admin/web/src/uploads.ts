/**
 * Free launch mode: images and videos are uploaded straight from the browser to Cloudinary (free plan,
 * no card) with an UNSIGNED upload preset, and the returned https link is saved on the testimony.
 * If the two VITE_CLOUDINARY_* values aren't set, the portal simply hides the upload buttons and
 * admins paste links instead.
 */
const cloud = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined;
const preset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string | undefined;

export const uploadsEnabled = Boolean(cloud && preset);
export const MAX_VIDEO_MB = 100; // Cloudinary free plan limit per video

export function uploadToCloudinary(file: File, kind: 'image' | 'video', onProgress: (pct: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!cloud || !preset) return reject(new Error('Uploads are not configured.'));
    if (kind === 'video' && file.size > MAX_VIDEO_MB * 1024 * 1024) {
      return reject(new Error(`This video is over ${MAX_VIDEO_MB} MB, the free plan limit. Compress it (for example with HandBrake) or paste a link.`));
    }
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloud}/${kind}/upload`);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
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
