import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, ActivityIndicator, View, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Google from 'expo-auth-session/providers/google';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { CONFIG, isGoogleConfigured } from '@/constants/config';
import { radius, type as t } from '@/constants/theme';
import { useAuth } from '@/auth/AuthContext';
import { authMessage } from '@/utils/errors';

WebBrowser.maybeCompleteAuthSession();

/**
 * Real Google OAuth (system browser / account chooser) -> Firebase credential.
 * Automatically enforces 6-digit email OTP verification via AuthContext.
 */
export function GoogleButton({ onError }: { onError: (message: string) => void }) {
  const { signInWithGoogleIdToken } = useAuth();
  const [busy, setBusy] = useState(false);

  // Determine platform client ID and reverse scheme
  const clientId = useMemo(() => {
    if (Platform.OS === 'ios') return CONFIG.google.iosClientId;
    if (Platform.OS === 'android') return CONFIG.google.androidClientId;
    return CONFIG.google.webClientId;
  }, []);

  const redirectUri = useMemo(() => {
    if (Platform.OS === 'ios') {
      // iOS Google OAuth strictly requires the reversed iOS client ID as the scheme
      const reversedClientId = CONFIG.google.iosClientId
        ? `com.googleusercontent.apps.${CONFIG.google.iosClientId.replace(/\.apps\.googleusercontent\.com$/, '')}`
        : 'com.testimoniesofpraise.app';
      return AuthSession.makeRedirectUri({
        scheme: reversedClientId,
        path: 'oauthredirect',
      });
    }

    if (Platform.OS === 'android') {
      return AuthSession.makeRedirectUri({
        scheme: 'com.testimoniesofpraise.app',
        path: 'oauthredirect',
      });
    }

    return AuthSession.makeRedirectUri();
  }, []);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest(
    {
      webClientId: CONFIG.google.webClientId || undefined,
      iosClientId: CONFIG.google.iosClientId || undefined,
      androidClientId: CONFIG.google.androidClientId || undefined,
      selectAccount: true,
      redirectUri,
    },
    {
      scheme: Platform.OS === 'ios' ? undefined : 'com.testimoniesofpraise.app',
    },
  );

  useEffect(() => {
    if (!response) return;

    if (__DEV__) {
      console.log('[GoogleAuth] OAuth response received:', {
        type: response.type,
        platform: Platform.OS,
        redirectUri,
        hasIdToken:
          response.type === 'success' &&
          Boolean(
            (response as any).params?.id_token || (response as any).authentication?.idToken,
          ),
      });
    }

    if (response.type === 'success') {
      const idToken = response.params?.id_token ?? (response as any).authentication?.idToken;
      const accessToken = response.params?.access_token ?? (response as any).authentication?.accessToken;

      if (!idToken) {
        setBusy(false);
        return onError('Unable to sign you in with Google: Missing ID token.');
      }

      signInWithGoogleIdToken(idToken, accessToken)
        .catch((e: any) => {
          if (__DEV__) console.warn('[GoogleAuth] Firebase credential error:', e);
          onError(authMessage(e));
        })
        .finally(() => setBusy(false));
    } else if (response.type === 'error') {
      setBusy(false);
      if (__DEV__) {
        console.warn('[GoogleAuth] Authentication error:', response.error);
      }
      onError('Unable to sign you in with Google. Please try again.');
    } else {
      // 'cancel' or 'dismiss': user closed account chooser
      setBusy(false);
    }
  }, [response, signInWithGoogleIdToken, onError, redirectUri]);

  const press = async () => {
    if (busy) return;

    if (!isGoogleConfigured || !clientId) {
      return onError('Google sign-in is not configured for this build.');
    }

    setBusy(true);
    try {
      const result = await promptAsync();
      if (result.type === 'cancel' || result.type === 'dismiss') {
        setBusy(false);
      }
    } catch (err: any) {
      setBusy(false);
      if (__DEV__) {
        console.warn('[GoogleAuth] promptAsync failed:', err);
      }
      onError('Unable to launch Google sign-in. Please check your network connection.');
    }
  };

  return (
    <Pressable
      onPress={press}
      disabled={!request || busy}
      style={({ pressed }) => [
        styles.btn,
        pressed && { opacity: 0.85 },
        (!request || busy) && { opacity: 0.6 },
      ]}
      accessibilityRole="button"
      accessibilityLabel="Continue with Google"
    >
      {busy ? (
        <ActivityIndicator color="#1F1F1F" />
      ) : (
        <View style={styles.row}>
          <Ionicons name="logo-google" size={20} color="#4285F4" />
          <Text style={styles.text}>Continue with Google</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 52,
    borderRadius: radius.pill,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  text: {
    ...t.h3,
    color: '#1F1F1F',
    letterSpacing: 0.2,
  },
});
