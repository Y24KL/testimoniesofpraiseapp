import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, ActivityIndicator, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { CONFIG, isGoogleConfigured } from '@/constants/config';
import { radius, type as t } from '@/constants/theme';
import { useAuth } from '@/auth/AuthContext';
import { authMessage } from '@/utils/errors';

WebBrowser.maybeCompleteAuthSession();

/**
 * Real Google OAuth (system browser / account chooser) -> Firebase credential.
 * Google's brand rules want a white button with the multicolour "G"; swap the icon for the official
 * asset before store submission.
 */
export function GoogleButton({ onError }: { onError: (message: string) => void }) {
  const { signInWithGoogleIdToken } = useAuth();
  const [busy, setBusy] = useState(false);
  // The hook throws if a platform's client id is empty, so pass a placeholder and guard in onPress.
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: CONFIG.google.webClientId || 'not-configured',
    iosClientId: CONFIG.google.iosClientId || 'not-configured',
    androidClientId: CONFIG.google.androidClientId || 'not-configured',
    selectAccount: true,
  });

  useEffect(() => {
    if (!response) return;
    if (response.type === 'success') {
      const idToken = response.params?.id_token ?? response.authentication?.idToken;
      if (!idToken) {
        setBusy(false);
        return onError('Unable to sign you in.\nPlease check your details.');
      }
      signInWithGoogleIdToken(idToken, response.authentication?.accessToken)
        .catch((e) => onError(authMessage(e)))
        .finally(() => setBusy(false));
    } else {
      setBusy(false);
      if (response.type === 'error') onError('Unable to sign you in.\nPlease check your details.');
    }
  }, [response, signInWithGoogleIdToken, onError]);

  const press = async () => {
    if (!isGoogleConfigured) return onError('Google sign-in is not available right now.');
    setBusy(true);
    try {
      await promptAsync();
    } catch {
      setBusy(false);
      onError('Unable to sign you in.\nPlease check your details.');
    }
  };

  return (
    <Pressable
      onPress={press}
      disabled={!request || busy}
      style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }, (!request || busy) && { opacity: 0.6 }]}
      accessibilityRole="button"
      accessibilityLabel="Sign in with Google"
    >
      {busy ? (
        <ActivityIndicator color="#1F1F1F" />
      ) : (
        <View style={styles.row}>
          <Ionicons name="logo-google" size={20} color="#4285F4" />
          <Text style={styles.text}>SIGN IN WITH GOOGLE</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { minHeight: 52, borderRadius: radius.pill, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  text: { ...t.h3, color: '#1F1F1F', letterSpacing: 0.6 },
});
