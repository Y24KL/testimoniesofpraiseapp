import { CONFIG } from '@/constants/config';

export const deepLink = {
  testimony: (id: string) => `testimoniesofpraise://testimony/${encodeURIComponent(id)}`,
  resource: (id: string) => `testimoniesofpraise://resource/${encodeURIComponent(id)}`,
  live: () => 'testimoniesofpraise://live',
};

/** Custom-scheme links are not clickable for people without the app, so share the website too. */
export const shareMessage = (title: string) => `${title}\n\nWatch on Testimonies of Praise: ${CONFIG.websiteUrl}`;
