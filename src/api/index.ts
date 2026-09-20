import { CONFIG } from '@/constants/config';
import { firestoreRepository } from './firestoreRepository';
import { restRepository } from './restRepository';
import type { ContentRepository } from './repository';

export const repo: ContentRepository = CONFIG.backendMode === 'rest' ? restRepository : firestoreRepository;
export type { ContentRepository } from './repository';
