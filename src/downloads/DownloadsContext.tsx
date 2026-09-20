import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
// SDK 54+: the classic imperative API lives at expo-file-system/legacy.
import * as FS from 'expo-file-system/legacy';
import { STORAGE_KEYS } from '@/constants/config';
import { track } from '@/analytics';
import type { DownloadFailure, DownloadItem, Resource, Testimony } from '@/types';
import { extensionOf, isHls, safeId } from '@/utils/format';

const DIR = `${FS.documentDirectory}downloads/`;

export interface DownloadRequest {
  kind: 'testimony' | 'resource';
  data: Testimony | Resource;
}

interface DownloadsValue {
  items: DownloadItem[];
  ready: boolean;
  get(key: string): DownloadItem | undefined;
  localUri(key: string): string | undefined;
  start(req: DownloadRequest): Promise<void>;
  cancel(key: string): Promise<void>;
  remove(key: string): Promise<void>;
}

const Ctx = createContext<DownloadsValue | null>(null);
export const downloadKey = (kind: 'testimony' | 'resource', id: string) => `${kind}:${id}`;

export function DownloadsProvider({ children }: { children: React.ReactNode }) {
  const [map, setMap] = useState<Record<string, DownloadItem>>({});
  const [ready, setReady] = useState(false);
  const jobs = useRef<Record<string, FS.DownloadResumable>>({});
  const mapRef = useRef(map);
  mapRef.current = map;

  const persist = useCallback((next: Record<string, DownloadItem>) => {
    void AsyncStorage.setItem(STORAGE_KEYS.downloads, JSON.stringify(next)).catch(() => undefined);
  }, []);

  const patch = useCallback(
    (key: string, changes: Partial<DownloadItem>, save: boolean) => {
      setMap((prev) => {
        if (!prev[key]) return prev;
        const next = { ...prev, [key]: { ...prev[key], ...changes } };
        if (save) persist(next);
        return next;
      });
    },
    [persist],
  );

  // Load + reconcile with what is actually on disk.
  useEffect(() => {
    (async () => {
      try {
        await FS.makeDirectoryAsync(DIR, { intermediates: true }).catch(() => undefined);
        const raw = await AsyncStorage.getItem(STORAGE_KEYS.downloads);
        const stored: Record<string, DownloadItem> = raw ? JSON.parse(raw) : {};
        const cleaned: Record<string, DownloadItem> = {};
        for (const [k, item] of Object.entries(stored)) {
          if (item.status === 'done') {
            const info = await FS.getInfoAsync(DIR + item.fileName);
            if (info.exists) cleaned[k] = item;
          } else {
            // A download that was running when the app was closed is now interrupted.
            cleaned[k] = { ...item, status: 'failed', failure: 'network' };
          }
        }
        setMap(cleaned);
        persist(cleaned);
      } finally {
        setReady(true);
      }
    })();
  }, [persist]);

  const fail = useCallback((key: string, failure: DownloadFailure) => patch(key, { status: 'failed', failure }, true), [patch]);

  const start = useCallback(
    async ({ kind, data }: DownloadRequest) => {
      const id = data.id;
      const key = downloadKey(kind, id);
      const url = kind === 'testimony' ? (data as Testimony).videoUrl : (data as Resource).fileUrl;
      const existing = mapRef.current[key];

      // Duplicate prevention
      if (existing && (existing.status === 'downloading' || existing.status === 'done')) return;
      if (jobs.current[key]) return;

      const fileType = kind === 'testimony' ? 'mp4' : (data as Resource).fileType;
      const fileName = `${kind}-${safeId(id)}.${extensionOf(url, fileType || 'bin')}`;
      const base: DownloadItem = {
        key,
        id,
        kind,
        title: data.title,
        thumbnail: data.thumbnail,
        remoteUrl: url,
        fileName,
        fileType,
        status: 'downloading',
        progress: 0,
        createdAt: Date.now(),
        data,
      };
      setMap((prev) => {
        const next = { ...prev, [key]: base };
        persist(next);
        return next;
      });

      // HLS streams are many segment files; they cannot be saved as a single offline file.
      if (!url || isHls(url)) return fail(key, 'unsupported');

      try {
        await FS.makeDirectoryAsync(DIR, { intermediates: true }).catch(() => undefined);

        // Insufficient-storage check (best effort: needs a Content-Length)
        try {
          const head = await fetch(url, { method: 'HEAD' });
          const size = Number(head.headers.get('content-length') ?? 0);
          if (size > 0) {
            const free = await FS.getFreeDiskStorageAsync();
            if (free < size * 1.1) return fail(key, 'storage');
          }
        } catch {
          /* ignore: the download itself will surface a network error */
        }

        let lastPct = -1;
        const job = FS.createDownloadResumable(url, DIR + fileName, {}, (p) => {
          const total = p.totalBytesExpectedToWrite;
          if (!total) return;
          const pct = Math.floor((p.totalBytesWritten / total) * 100);
          if (pct !== lastPct) {
            lastPct = pct;
            patch(key, { progress: pct / 100 }, false);
          }
        });
        jobs.current[key] = job;
        const res = await job.downloadAsync();
        delete jobs.current[key];

        if (!res || res.status < 200 || res.status >= 300) {
          await FS.deleteAsync(DIR + fileName, { idempotent: true });
          return fail(key, 'http');
        }
        const info = await FS.getInfoAsync(res.uri);
        patch(key, { status: 'done', progress: 1, failure: undefined, sizeBytes: info.exists ? info.size : undefined }, true);
        track('download_complete', { kind, contentId: id });
      } catch (e) {
        delete jobs.current[key];
        if (!mapRef.current[key]) return; // cancelled by the user
        await FS.deleteAsync(DIR + fileName, { idempotent: true }).catch(() => undefined);
        const msg = String((e as Error)?.message ?? '');
        fail(key, /space|ENOSPC|storage/i.test(msg) ? 'storage' : 'network');
      }
    },
    [fail, patch, persist],
  );

  const remove = useCallback(
    async (key: string) => {
      const item = mapRef.current[key];
      setMap((prev) => {
        const { [key]: _gone, ...rest } = prev;
        persist(rest);
        return rest;
      });
      if (item) await FS.deleteAsync(DIR + item.fileName, { idempotent: true }).catch(() => undefined);
    },
    [persist],
  );

  const cancel = useCallback(
    async (key: string) => {
      const job = jobs.current[key];
      delete jobs.current[key];
      try {
        await job?.cancelAsync();
      } catch {
        /* ignore */
      }
      await remove(key);
    },
    [remove],
  );

  const value = useMemo<DownloadsValue>(
    () => ({
      items: Object.values(map).sort((a, b) => b.createdAt - a.createdAt),
      ready,
      get: (key) => map[key],
      localUri: (key) => (map[key]?.status === 'done' ? DIR + map[key].fileName : undefined),
      start,
      cancel,
      remove,
    }),
    [map, ready, start, cancel, remove],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDownloads(): DownloadsValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useDownloads must be used inside DownloadsProvider');
  return v;
}
