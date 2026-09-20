import { Platform } from 'react-native';
import { CONFIG } from '@/constants/config';
import type { LiveConfig, Page } from '@/types';
import { AppError } from '@/utils/errors';
import { auth } from './firebase';
import { normalizeLive, normalizeNotification, normalizeResource, normalizeTestimony } from './normalize';
import type { ContentRepository, PageOptions } from './repository';

/* eslint-disable @typescript-eslint/no-explicit-any */
async function http<T = any>(path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  if (!CONFIG.apiBaseUrl) throw new AppError('unknown', 'EXPO_PUBLIC_API_BASE_URL is not set');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 15000);
  try {
    const token = await auth.currentUser?.getIdToken().catch(() => undefined);
    const res = await fetch(`${CONFIG.apiBaseUrl}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers ?? {}),
      },
    });
    if (res.status === 404) throw new AppError('notfound');
    if (res.status === 401 || res.status === 403) throw new AppError('permission');
    if (!res.ok) throw new AppError('unknown', `HTTP ${res.status}`);
    return (res.status === 204 ? undefined : await res.json()) as T;
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError('network');
  } finally {
    clearTimeout(t);
  }
}

const listOf = (j: any): any[] => (Array.isArray(j) ? j : j?.data ?? j?.items ?? j?.testimonies ?? j?.resources ?? j?.notifications ?? []);
const idOf = (r: any) => String(r.id ?? r._id ?? r.uid ?? '');

async function getPage<T>(path: string, map: (id: string, r: any) => T, o: PageOptions): Promise<Page<T>> {
  const page = typeof o.cursor === 'number' ? o.cursor : 1;
  const qs = `?page=${page}&limit=${o.limit}${o.featuredOnly ? '&featured=true' : ''}`;
  const list = listOf(await http(path + qs));
  return { items: list.map((r) => map(idOf(r), r)), cursor: page + 1, hasMore: list.length >= o.limit };
}

async function getOne<T>(path: string, id: string, map: (id: string, r: any) => T): Promise<T | null> {
  try {
    const j = await http(`${path}/${encodeURIComponent(id)}`);
    const r = j?.data ?? j;
    return r ? map(idOf(r) || id, r) : null;
  } catch (e) {
    if (e instanceof AppError && e.kind === 'notfound') return null;
    throw e;
  }
}

export const restRepository: ContentRepository = {
  getTestimonies: (o) => getPage(CONFIG.rest.testimonies, normalizeTestimony, o),
  getTestimony: (id) => getOne(CONFIG.rest.testimonies, id, normalizeTestimony),
  getResources: (o) => getPage(CONFIG.rest.resources, normalizeResource, o),
  getResource: (id) => getOne(CONFIG.rest.resources, id, normalizeResource),

  async getNotifications(max) {
    const list = listOf(await http(`${CONFIG.rest.notifications}?limit=${max}`));
    return list.map((r) => normalizeNotification(idOf(r), r));
  },

  subscribeLive(cb, onError) {
    let stopped = false;
    const tick = async () => {
      try {
        const j = await http(CONFIG.rest.live);
        if (!stopped) cb(normalizeLive(j?.data ?? j));
      } catch (e) {
        if (!stopped) onError?.(e);
      }
    };
    void tick();
    const h = setInterval(tick, CONFIG.livePollMs);
    return () => {
      stopped = true;
      clearInterval(h);
    };
  },

  async submitTestimony(input) {
    await http(CONFIG.rest.submit, { method: 'POST', body: JSON.stringify({ ...input, source: 'mobile' }) });
  },
  async registerPushToken(input) {
    await http(CONFIG.rest.pushToken, { method: 'POST', body: JSON.stringify(input) });
  },
  async unregisterPushToken(token) {
    await http(`${CONFIG.rest.pushToken}/${encodeURIComponent(token)}`, { method: 'DELETE' });
  },
  async recordEvent(event, params) {
    await http(CONFIG.rest.analytics, { method: 'POST', body: JSON.stringify({ event, params, platform: Platform.OS }) });
  },
};

export type { LiveConfig };
