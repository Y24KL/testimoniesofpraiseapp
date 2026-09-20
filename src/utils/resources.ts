import type { Resource, ResourceGroup } from '@/types';
import { extensionOf } from './format';

export const RESOURCE_GROUPS: ResourceGroup[] = ['ALL', 'VIDEOS', 'GRAPHICS', 'ECARDS', 'PHOTOS', 'DOCUMENTS', 'ADOTOPOC'];

/** Best-effort bucket for a resource, from its admin-assigned category first, then its file type. */
export function resourceGroup(r: Resource): Exclude<ResourceGroup, 'ALL'> | 'OTHER' {
  const cat = (r.category ?? '').toLowerCase();
  if (cat.includes('adotopoc')) return 'ADOTOPOC';
  if (cat.includes('ecard') || cat.includes('e-card')) return 'ECARDS';
  if (cat.includes('graphic') || cat.includes('flyer')) return 'GRAPHICS';
  if (cat.includes('photo')) return 'PHOTOS';
  if (cat.includes('video')) return 'VIDEOS';
  if (cat.includes('document')) return 'DOCUMENTS';
  const ext = r.fileType.replace(/^.*\//, '') || extensionOf(r.fileUrl, '');
  if (/mp4|mov|m4v|webm|m3u8|video/.test(ext + r.fileType)) return 'VIDEOS';
  if (/pdf|doc|docx|ppt|pptx|xls|xlsx|txt/.test(ext)) return 'DOCUMENTS';
  if (/png|jpe?g|gif|webp|image/.test(ext + r.fileType)) return 'GRAPHICS';
  return 'OTHER';
}

export const isVideoResource = (r: Resource) => resourceGroup(r) === 'VIDEOS';
export const isImageResource = (r: Resource) => /png|jpe?g|gif|webp|image/.test(r.fileType + extensionOf(r.fileUrl, ''));

export function fileTypeLabel(r: Resource): string {
  const ext = (r.fileType.replace(/^.*\//, '') || extensionOf(r.fileUrl, 'file')).toUpperCase();
  return ext.length > 5 ? 'FILE' : ext;
}
