import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

/** `isOffline` is only true when we positively know there is no connection. */
export function useNetwork() {
  const [isOffline, setOffline] = useState(false);
  useEffect(() => {
    const unsub = NetInfo.addEventListener((s) => setOffline(s.isConnected === false || s.isInternetReachable === false));
    return unsub;
  }, []);
  return { isOffline };
}
