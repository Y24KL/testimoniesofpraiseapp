import AsyncStorage from '@react-native-async-storage/async-storage';

const key = (uid: string) => `top:welcome-pending:${uid}`;

/** Call once, right when a brand-new account is created. */
export const markNewAccount = (uid: string) => AsyncStorage.setItem(key(uid), '1').catch(() => undefined);

export const isNewAccountPending = (uid: string) => AsyncStorage.getItem(key(uid)).then((v) => v === '1');

/** Call once the welcome screen has been shown/dismissed, so it never shows again for this account. */
export const clearNewAccount = (uid: string) => AsyncStorage.removeItem(key(uid)).catch(() => undefined);
