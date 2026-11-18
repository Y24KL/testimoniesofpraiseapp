import { useEffect, useState } from 'react';
import { messageFor } from '@/utils/errors';
import { libraryKey, type LibraryKind } from './rules';
import { subscribeCollections, subscribeHistory, subscribeSaved, type Collection, type HistoryItem, type SavedItem } from './service';

export interface LiveList<T> {
  items: T[];
  status: 'loading' | 'ready' | 'error';
  error: string | null;
}

type Subscribe<T> = (uid: string, next: (items: T[]) => void, fail: (e: Error) => void) => () => void;

/** A live list for the signed-in person. Signed out, it is simply empty and ready. */
function useLiveList<T>(uid: string | null | undefined, subscribe: Subscribe<T>): LiveList<T> {
  const [state, setState] = useState<LiveList<T>>({ items: [], status: 'loading', error: null });
  useEffect(() => {
    if (!uid) {
      setState({ items: [], status: 'ready', error: null });
      return;
    }
    setState((s) => ({ ...s, status: 'loading', error: null }));
    return subscribe(
      uid,
      (items) => setState({ items, status: 'ready', error: null }),
      (e) => setState({ items: [], status: 'error', error: messageFor(e) }),
    );
  }, [uid, subscribe]);
  return state;
}

export const useSavedItems = (uid: string | null | undefined) => useLiveList<SavedItem>(uid, subscribeSaved);
export const useCollections = (uid: string | null | undefined) => useLiveList<Collection>(uid, subscribeCollections);
export const useHistory = (uid: string | null | undefined) => useLiveList<HistoryItem>(uid, subscribeHistory);

/** Whether one item is in the person's saved list. `ready` is false until the list has loaded. */
export function useIsSaved(uid: string | null | undefined, kind: LibraryKind, id: string): { saved: boolean; ready: boolean } {
  const list = useSavedItems(uid);
  const key = libraryKey(kind, id);
  return { saved: key !== null && list.items.some((i) => i.key === key), ready: list.status === 'ready' || !uid };
}
