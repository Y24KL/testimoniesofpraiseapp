import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
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
 * KingsChat only ships a browser SDK (kingschat-web-sdk — see
 * https://github.com/kingschat/kingschat-web-sdk), not a React Native one. This runs that real,
 * documented SDK inside a WebView and relays its result back to the app with postMessage.
 *
 * NOT independently verified against a live KingsChat login on a phone — the SDK's login() call
 * opens KingsChat's own popup/redirect, and mobile WebView popup behaviour can differ from a
 * desktop browser. If the popup doesn't appear or nothing happens after signing in, that's the
 * first thing to report back.
 */
const html = (clientId: string) => `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<script src="https://unpkg.com/kingschat-web-sdk/dist/index.js"></script>
<style>
  html,body{margin:0;height:100%;background:#0b1330;display:flex;align-items:center;justify-content:center;font-family:sans-serif}
  #msg{color:#cbd5ff;text-align:center;padding:24px}
</style></head>
<body>
<div id="msg">Opening KingsChat sign-in…</div>
<script>
  function send(type, payload) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type, payload }));
  }
  function run() {
    var sdk = (window.kingsChatWebSdk && window.kingsChatWebSdk.default) || window.kingsChatWebSdk;
    if (!sdk || !sdk.login) { send('error', 'KingsChat sign-in could not load. Please check your connection and try again.'); return; }
    sdk.login({ clientId: '${clientId}', scopes: ['profile'] })
      .then(function (res) { send('success', res); })
      .catch(function (err) { send('error', (err && (err.message || err.toString())) || 'Sign-in was cancelled.'); });
  }
  if (document.readyState === 'complete') run(); else window.addEventListener('load', run);
</script>
</body></html>`;

export function KingsChatLoginModal({ visible, onClose, onSuccess, onError }: Props) {
  const [loading, setLoading] = useState(true);
  const closedRef = useRef(false);

  const handleMessage = useCallback(
    (e: WebViewMessageEvent) => {
      if (closedRef.current) return;
      try {
        const msg = JSON.parse(e.nativeEvent.data) as { type: 'success' | 'error'; payload: KingsChatToken | string };
        if (msg.type === 'success') {
          closedRef.current = true;
          onSuccess(msg.payload as KingsChatToken);
        } else {
          closedRef.current = true;
          onError(typeof msg.payload === 'string' ? msg.payload : 'Unable to sign you in with KingsChat.');
        }
      } catch {
        /* ignore malformed messages */
      }
    },
    [onSuccess, onError],
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent={false}>
      <View style={styles.header}>
        <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
          <Ionicons name="close" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Sign in with KingsChat</Text>
        <View style={{ width: 26 }} />
      </View>
      <WebView
        source={{ html: html(CONFIG.kingsChat.clientId) }}
        onMessage={handleMessage}
        onLoadEnd={() => setLoading(false)}
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows
        style={{ flex: 1, backgroundColor: '#0b1330' }}
      />
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
  loading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0b1330' },
});
