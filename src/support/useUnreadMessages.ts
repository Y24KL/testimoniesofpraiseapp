import { useEffect, useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { subscribeThreads } from './service';

/** Total unread support messages for the signed-in person (0 when signed out or offline). */
export function useUnreadMessages(): number {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!user) {
      setCount(0);
      return;
    }
    return subscribeThreads(user.uid, (threads) => setCount(threads.reduce((n, t) => n + t.unreadForUser, 0)), () => setCount(0));
  }, [user]);
  return count;
}
