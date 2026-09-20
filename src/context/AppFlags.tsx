import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/constants/config';

interface Flags {
  flagsReady: boolean;
  primerSeen: boolean;
  markPrimerSeen(): Promise<void>;
}
const Ctx = createContext<Flags | null>(null);

export function AppFlagsProvider({ children }: { children: React.ReactNode }) {
  const [flagsReady, setReady] = useState(false);
  const [primerSeen, setSeen] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEYS.primerSeen)
      .then((v) => setSeen(v === '1'))
      .finally(() => setReady(true));
  }, []);
  const markPrimerSeen = useCallback(async () => {
    setSeen(true);
    await AsyncStorage.setItem(STORAGE_KEYS.primerSeen, '1').catch(() => undefined);
  }, []);
  const value = useMemo(() => ({ flagsReady, primerSeen, markPrimerSeen }), [flagsReady, primerSeen, markPrimerSeen]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppFlags() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAppFlags must be used inside AppFlagsProvider');
  return v;
}
