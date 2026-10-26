import { Linking, Platform } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';

/** True for absolute http(s) links only. */
export function isWebUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const u = new URL(url.trim());
    return (u.protocol === 'https:' || u.protocol === 'http:') && !!u.hostname;
  } catch {
    return false;
  }
}

/**
 * Opens a web page OUTSIDE the app (never an in-app WebView): Chrome when it is installed,
 * otherwise the phone's default browser. The app stays where the user left it.
 * Throws when the link is invalid or no browser can open it, so callers can show a message.
 */
export async function openInExternalBrowser(rawUrl: string): Promise<'chrome' | 'browser'> {
  if (!isWebUrl(rawUrl)) throw new Error('This link is missing or invalid.');
  const url = rawUrl.trim();

  if (Platform.OS === 'android') {
    try {
      // Explicit VIEW intent to Chrome; throws ActivityNotFoundException when Chrome isn't installed.
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', { data: url, packageName: 'com.android.chrome' });
      return 'chrome';
    } catch {
      /* fall back to the default browser */
    }
  } else if (Platform.OS === 'ios') {
    // Chrome for iOS handles googlechrome(s)://; needs LSApplicationQueriesSchemes (app.config.ts).
    const chromeUrl = url.replace(/^https:\/\//i, 'googlechromes://').replace(/^http:\/\//i, 'googlechrome://');
    if (await Linking.canOpenURL(chromeUrl).catch(() => false)) {
      try {
        await Linking.openURL(chromeUrl);
        return 'chrome';
      } catch {
        /* fall back to Safari / default browser */
      }
    }
  } else if (typeof window !== 'undefined') {
    const w = window.open(url, '_blank', 'noopener,noreferrer');
    if (w) return 'browser';
  }

  await Linking.openURL(url);
  return 'browser';
}
