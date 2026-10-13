import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { openDB, type IDBPDatabase } from 'idb';
import type { DownloadItem, Testimony } from '../types';
import { isHls } from '../api/repository';
import { track } from '../api/analytics';

const DB_NAME = 'top_offline_db';
const DB_VERSION = 1;
const STORE_NAME = 'downloads';

async function getDatabase(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    },
  });
}

interface DownloadsValue {
  items: DownloadItem[];
  ready: boolean;
  get(id: string): DownloadItem | undefined;
  getLocalVideoUrl(id: string): string | undefined;
  start(data: Testimony): Promise<void>;
  remove(id: string): Promise<void>;
  cancel(id: string): Promise<void>;
}

const DownloadsContext = createContext<DownloadsValue | null>(null);

export function DownloadsProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<DownloadItem[]>([]);
  const [ready, setReady] = useState(false);
  const [activeControllers, setActiveControllers] = useState<Record<string, AbortController>>({});
  const [objectUrls, setObjectUrls] = useState<Record<string, string>>({});

  const reloadItems = useCallback(async () => {
    try {
      const db = await getDatabase();
      const all: DownloadItem[] = await db.getAll(STORE_NAME);
      setItems(all.sort((a, b) => b.createdAt - a.createdAt));

      // Build object URLs for completed downloads
      const newUrls: Record<string, string> = {};
      for (const item of all) {
        if (item.status === 'done' && item.blob) {
          newUrls[item.id] = URL.createObjectURL(item.blob);
        }
      }
      setObjectUrls(newUrls);
    } catch (e) {
      console.error('Error opening downloads DB', e);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    reloadItems();
  }, [reloadItems]);

  const start = useCallback(async (data: Testimony) => {
    const id = data.id;
    if (isHls(data.videoUrl)) {
      alert('Live streams and HLS (.m3u8) feeds cannot be saved for offline viewing.');
      return;
    }

    const controller = new AbortController();
    setActiveControllers((prev) => ({ ...prev, [id]: controller }));

    const initialItem: DownloadItem = {
      key: `testimony:${id}`,
      id,
      title: data.title,
      thumbnail: data.thumbnail,
      remoteUrl: data.videoUrl,
      status: 'downloading',
      progress: 0,
      createdAt: Date.now(),
      data,
    };

    const db = await getDatabase();
    await db.put(STORE_NAME, initialItem);
    await reloadItems();

    try {
      const res = await fetch(data.videoUrl, {
        signal: controller.signal,
      });

      if (!res.ok) throw new Error('HTTP download failed');

      const contentLength = res.headers.get('content-length');
      const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;

      let blob: Blob;

      if (!res.body || totalBytes === 0) {
        blob = await res.blob();
      } else {
        const reader = res.body.getReader();
        let receivedBytes = 0;
        const chunks: Uint8Array[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          receivedBytes += value.length;
          const pct = totalBytes > 0 ? receivedBytes / totalBytes : 0.5;
          setItems((prev) =>
            prev.map((it) => (it.id === id ? { ...it, progress: pct } : it))
          );
        }

        blob = new Blob(chunks as any[], { type: 'video/mp4' });
      }

      const completedItem: DownloadItem = {
        ...initialItem,
        status: 'done',
        progress: 1,
        blob,
        sizeBytes: blob.size,
      };

      await db.put(STORE_NAME, completedItem);
      await reloadItems();
      track('download_complete', { kind: 'testimony', contentId: id });
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      const failedItem: DownloadItem = {
        ...initialItem,
        status: 'failed',
        failure: 'network',
      };
      await db.put(STORE_NAME, failedItem);
      await reloadItems();
    } finally {
      setActiveControllers((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    }
  }, [reloadItems]);

  const remove = useCallback(async (id: string) => {
    const db = await getDatabase();
    await db.delete(STORE_NAME, id);
    if (objectUrls[id]) {
      URL.revokeObjectURL(objectUrls[id]);
    }
    await reloadItems();
  }, [objectUrls, reloadItems]);

  const cancel = useCallback(async (id: string) => {
    const ctrl = activeControllers[id];
    if (ctrl) ctrl.abort();
    await remove(id);
  }, [activeControllers, remove]);

  const get = useCallback((id: string) => items.find((i) => i.id === id), [items]);
  const getLocalVideoUrl = useCallback((id: string) => objectUrls[id], [objectUrls]);

  return (
    <DownloadsContext.Provider
      value={{
        items,
        ready,
        get,
        getLocalVideoUrl,
        start,
        remove,
        cancel,
      }}
    >
      {children}
    </DownloadsContext.Provider>
  );
}

export function useDownloads() {
  const ctx = useContext(DownloadsContext);
  if (!ctx) throw new Error('useDownloads must be used within a DownloadsProvider');
  return ctx;
}
