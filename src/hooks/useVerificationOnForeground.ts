import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/auth/AuthContext';

/** Re-checks emailVerified whenever the app returns to the foreground, so the banner clears itself. */
export function useVerificationOnForeground() {
  const { needsEmailVerification, refreshEmailVerified } = useAuth();
  useEffect(() => {
    if (!needsEmailVerification) return;
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void refreshEmailVerified();
    });
    return () => sub.remove();
  }, [needsEmailVerification, refreshEmailVerified]);
}
