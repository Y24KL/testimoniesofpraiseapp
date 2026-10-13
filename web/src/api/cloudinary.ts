const env = import.meta.env;

const cloudName = env.VITE_CLOUDINARY_CLOUD_NAME || '';
const receiptsPreset = env.VITE_CLOUDINARY_RECEIPTS_PRESET || 'top_receipts';
const uploadPreset = env.VITE_CLOUDINARY_UPLOAD_PRESET || 'top_uploads';

export const isCloudinaryConfigured = Boolean(cloudName && (receiptsPreset || uploadPreset));

export async function uploadFile(file: File | Blob, fileName: string, folder: 'avatars' | 'receipts'): Promise<string> {
  if (!cloudName) {
    throw new Error('Cloudinary is not configured.');
  }

  const preset = folder === 'receipts' ? receiptsPreset : uploadPreset;
  const form = new FormData();
  form.append('file', file, fileName);
  form.append('upload_preset', preset);
  form.append('folder', `testimonies-of-praise/${folder}`);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: form,
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.secure_url) {
    throw new Error(json?.error?.message ?? 'Image upload failed. Please try again.');
  }

  return json.secure_url as string;
}

export const uploadReceipt = (file: File | Blob, name: string) => uploadFile(file, name, 'receipts');
export const uploadAvatar = (file: File | Blob, name: string) => uploadFile(file, name, 'avatars');
