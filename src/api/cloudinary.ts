import { CONFIG } from '@/constants/config';
import { AppError } from '@/utils/errors';

/** Uploads an image straight from the device to Cloudinary's free plan (unsigned preset). */
export async function uploadImage(uri: string, fileName: string, mimeType: string, folder: string): Promise<string> {
  const { cloudName, uploadPreset } = CONFIG.cloudinary;
  if (!cloudName || !uploadPreset) throw new AppError('unknown', 'Uploads are not configured.');

  const form = new FormData();
  // React Native's fetch accepts this shape for a file field.
  form.append('file', { uri, name: fileName, type: mimeType } as unknown as Blob);
  form.append('upload_preset', uploadPreset);
  form.append('folder', `testimonies-of-praise/${folder}`);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: form });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.secure_url) throw new AppError('unknown', json?.error?.message ?? 'Upload failed.');
  return json.secure_url as string;
}

export const uploadReceipt = (uri: string, fileName: string, mimeType: string) => uploadImage(uri, fileName, mimeType, 'receipts');
export const uploadAvatar = (uri: string, fileName: string, mimeType: string) => uploadImage(uri, fileName, mimeType, 'avatars');
