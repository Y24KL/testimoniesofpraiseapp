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
  
  // 1. Intercept the blocked popup and send the actual login URL to React Native
  window.open = function(url) {
    send('open_url', url);
    return { close: function(){} }; 
  };

  import('https://esm.sh/kingschat-web-sdk')
    .then(function (mod) {
      var sdk = mod.default || mod;
      return sdk.login({ clientId: '${clientId}', scopes: [] });
    })
    .catch(function (err) { /* ignore, URL is already captured */ });
</script>
</body></html>`;

// 2. Inject a fake "opener" into the real KingsChat page so it can securely send the token back
const injectedJs = `
  window.opener = {
    postMessage: function(data) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'success_from_opener', payload: data }));
    }
  };
  true;
`;

export function KingsChatLoginModal({ visible, onClose, onSuccess, onError }: Props) {
  const [loading, setLoading] = useState(true);
  const [loginUrl, setLoginUrl] = useState<string | null>(null);
  const closedRef = useRef(false);

  const handleMessage = useCallback(
    (e: WebViewMessageEvent) => {
      if (closedRef.current) return;
      try {
        const msg = JSON.parse(e.nativeEvent.data);
        
        // Switch the WebView from the local HTML directly to the real KingsChat URL
        if (msg.type === 'open_url') {
          setLoginUrl(msg.payload);
          return;
        }

        // Catch the token returning from our injected mock window
        if (msg.type === 'success_from_opener') {
          let tokenData = msg.payload;
          if (typeof tokenData === 'string') {
            try { tokenData = JSON.parse(tokenData); } catch (e) {}
          }
          
          if (tokenData && (tokenData.accessToken || tokenData.access_token)) {
             closedRef.current = true;
             onSuccess({
               accessToken: tokenData.accessToken || tokenData.access_token,
               refreshToken: tokenData.refreshToken || tokenData.refresh_token || '',
               expiresInMillis: tokenData.expiresInMillis || tokenData.expires_in || 0,
             });
          }
          return;
        }

        if (msg.type === 'success') {
          closedRef.current = true;
          onSuccess(msg.payload as KingsChatToken);
        } else if (msg.type === 'error') {
          closedRef.current = true;
          onError(typeof msg.payload === 'string' ? msg.payload : 'Unable to sign you in with KingsChat.');
        }
      } catch {
        /* ignore malformed messages */
      }
    },
    [onSuccess, onError],
  );

  const handleNavigationStateChange = (navState: any) => {
    if (closedRef.current) return;
    const url = navState.url;
    
    // 3. Failsafe: Catch the token if KingsChat redirects the URL instead of using messaging
    if (url.includes('access_token=') || url.includes('accessToken=')) {
      const accessToken = url.match(/(?:access_token|accessToken)=([^&]+)/)?.[1];
      const refreshToken = url.match(/(?:refresh_token|refreshToken)=([^&]+)/)?.[1];
      const expiresIn = url.match(/(?:expires_in|expiresIn)=([^&]+)/)?.[1];
      
      if (accessToken) {
        closedRef.current = true;
        onSuccess({
          accessToken,
          refreshToken: refreshToken || '',
          expiresInMillis: expiresIn ? parseInt(expiresIn, 10) : 0,
        });
      }
    }
  };

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
        source={
          loginUrl 
            ? { uri: loginUrl } 
            : { 
                html: html(CONFIG.kingsChat.clientId), 
                baseUrl: 'https://localhost' // This fakes a secure web environment
              }
        }
        onMessage={handleMessage}
        onNavigationStateChange={handleNavigationStateChange}
        injectedJavaScript={loginUrl ? injectedJs : undefined}
        onLoadEnd={() => setLoading(false)}
        javaScriptEnabled
        domStorageEnabled
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