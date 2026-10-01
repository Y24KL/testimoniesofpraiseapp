import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import type { WebViewOpenWindowEvent } from 'react-native-webview/lib/WebViewTypes';
import { Ionicons } from '@expo/vector-icons';
import { CONFIG } from '@/constants/config';
import { colors, radius, type as t } from '@/constants/theme';

export interface KingsChatToken {
  accessToken: string;
  expiresInMillis: number;
  refreshToken: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess: (token: KingsChatToken) => void;
  onError: (message: string) => void;
}

/**
 * KingsChat's real, documented API (github.com/kingschat/kingschat-web-sdk):
 *   import kingsChatWebSdk from 'kingschat-web-sdk';
 *   kingsChatWebSdk.login({ clientId, scopes }) -> Promise<{ accessToken, expiresInMillis, refreshToken }>
 *
 * Their SDK is an npm package meant for a bundler, loaded here via unpkg's `?module` flag so it
 * can be `import`-ed directly in a plain page — the documented way to run a bundler-oriented
 * package with no bundler (see https://unpkg.com/#module-mode-default).
 *
 * `scopes: []` — their only documented scope is 'send_chat_message' (the sendMessage API, which
 * this app doesn't use). There's no documented profile-reading scope, because there's no
 * profile-fetch endpoint at all: login, refreshAuthenticationToken, and sendMessage are their
 * entire public API. So this app can get a valid token, but can't pull a name or photo from it.
 *
 * WHY THIS NEEDS A SECOND, REAL WEBVIEW (the thing that was broken before):
 * Their SDK opens its sign-in page as a genuine browser popup via `window.open(...)`, then talks
 * back to the page that opened it via `window.opener.postMessage(...)` once sign-in finishes —
 * the standard "OAuth popup" pattern. A single WebView has no real popup to open, so earlier
 * versions of this file tried to fake that (hijacking window.open, manually re-navigating,
 * faking window.opener) — which broke the handshake KingsChat's own page performs (origin
 * checks, session state tied to the real popup) and surfaced as "Internal error".
 * react-native-webview has a real feature for exactly this case — `setSupportMultipleWindows` +
 * `onOpenWindow` — which renders an actual second WebView acting as a genuine popup, so
 * window.open/window.opener/postMessage all work the normal way KingsChat's page expects.
 * (Android only — react-native-webview doesn't support this on iOS; iOS needs a different
 * approach, to revisit once Android is confirmed working.)
 */
const html = (clientId: string) => `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  html,body{margin:0;height:100%;background:#0b1330;display:flex;align-items:center;justify-content:center;font-family:sans-serif}
  #msg{color:#cbd5ff;text-align:center;padding:24px}
</style></head>
<body>
<div id="msg">Opening KingsChat sign-in…</div>
<script type="module">
  function send(type, payload) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type, payload }));
  }
  import('https://unpkg.com/kingschat-web-sdk?module')
    .then(function (mod) {
      var sdk = mod.default || mod;
      if (!sdk || !sdk.login) throw new Error('KingsChat sign-in could not load.');
      return sdk.login({ clientId: '${clientId}', scopes: [] });
    })
    .then(function (res) { send('success', res); })
    .catch(function (err) { send('error', (err && (err.message || err.toString())) || 'Sign-in was cancelled.'); });
</script>
</body></html>`;

export function KingsChatLoginModal({ visible, onClose, onSuccess, onError }: Props) {
  const [loading, setLoading] = useState(true);
  const [popupUrl, setPopupUrl] = useState<string | null>(null);
  const closedRef = useRef(false);

  const finish = useCallback(
    (type: 'success' | 'error', payload: KingsChatToken | string) => {
      if (closedRef.current) return;
      closedRef.current = true;
      if (type === 'success') onSuccess(payload as KingsChatToken);
      else onError(typeof payload === 'string' ? payload : 'Unable to sign you in with KingsChat.');
    },
    [onSuccess, onError],
  );

  const handleMessage = useCallback(
    (e: WebViewMessageEvent) => {
      try {
        const msg = JSON.parse(e.nativeEvent.data) as { type: 'success' | 'error'; payload: KingsChatToken | string };
        finish(msg.type, msg.payload);
      } catch {
        /* ignore malformed messages */
      }
    },
    [finish],
  );

  // Fires when the page inside the main WebView calls window.open(...) — this is KingsChat's own
  // sign-in popup. Rendering a second, real WebView for it is what lets their postMessage
  // handshake complete normally.
  const handleOpenWindow = useCallback((e: WebViewOpenWindowEvent) => {
    setPopupUrl(e.nativeEvent.targetUrl);
  }, []);

  const reset = () => {
    closedRef.current = false;
    setPopupUrl(null);
    setLoading(true);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent={false} onShow={reset}>
      <View style={styles.header}>
        <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
          <Ionicons name="close" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{popupUrl ? 'Sign in' : 'Opening KingsChat'}</Text>
        <View style={{ width: 26 }} />
      </View>

      {/* The "opener": runs KingsChat's SDK, which window.open()s the real sign-in page below. */}
      <WebView
        source={{ html: html(CONFIG.kingsChat.clientId) }}
        onMessage={handleMessage}
        onOpenWindow={handleOpenWindow}
        setSupportMultipleWindows
        javaScriptCanOpenWindowsAutomatically
        onLoadEnd={() => setLoading(false)}
        javaScriptEnabled
        domStorageEnabled
        style={popupUrl ? styles.hidden : styles.flex}
      />

      {/* The real popup: KingsChat's own sign-in page, as a genuine second window. */}
      {popupUrl ? (
        <WebView
          source={{ uri: popupUrl }}
          onMessage={handleMessage}
          javaScriptEnabled
          domStorageEnabled
          style={styles.flex}
        />
      ) : null}

      {loading ? (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 50, paddingBottom: 12, paddingHorizontal: 16, backgroundColor: colors.bg },
  headerTitle: { ...t.h3, color: colors.text },
  flex: { flex: 1, backgroundColor: '#0b1330' },
  hidden: { height: 0, width: 0 },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0b1330' },
});
