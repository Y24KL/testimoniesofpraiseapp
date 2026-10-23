import React, { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } from '@react-native-google-signin/google-signin';
import { CONFIG, isGoogleConfigured } from '@/constants/config';
import { radius, type as t } from '@/constants/theme';
import { useAuth } from '@/auth/AuthContext';
import { authMessage } from '@/utils/errors';

/**
 * Native Google Sign-In: the phone's own Google account picker (every account on the device),
 * then a Firebase credential from the returned ID token. Automatically enforces 6-digit email
 * OTP verification via AuthContext.
 *
 * Replaces the old browser-based expo-auth-session flow, which Google blocks for Android OAuth
 * clients ("Access blocked: doesn't comply with Google's OAuth 2.0 policy", Error 400) because it
 * relied on a custom-scheme redirect.
 *
 * The ID token's audience is the WEB client ID (that's what Firebase verifies). On Android the
 * app's signing-certificate SHA-1 must be registered on an Android OAuth client in the same Google
 * Cloud / Firebase project, otherwise Google returns DEVELOPER_ERROR (see docs/REDESIGN_2026.md).
 */
GoogleSignin.configure({
  webClientId: CONFIG.google.webClientId || undefined,
  iosClientId: CONFIG.google.iosClientId || undefined,
  scopes: ['email', 'profile'],
});

export function GoogleButton({ onError }: { onError: (message: string) => void }) {
  const { signInWithGoogleIdToken } = useAuth();
  const [busy, setBusy] = useState(false);

  const press = async () => {
    if (busy) return;
    if (!isGoogleConfigured || !CONFIG.google.webClientId) {
      return onError('Google sign-in is not configured for this build.');
    }
    setBusy(true);
    try {
      if (Platform.OS === 'android') await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      // Forget the previously chosen account so the picker always lists every account on the phone.
      await GoogleSignin.signOut().catch(() => undefined);
      const res = await GoogleSignin.signIn();
      if (!isSuccessResponse(res)) return; // user closed the picker
      const idToken = res.data.idToken;
      if (!idToken) return onError('Unable to sign you in with Google: missing ID token.');
      await signInWithGoogleIdToken(idToken);
    } catch (e) {
      if (isErrorWithCode(e)) {
        if (e.code === statusCodes.SIGN_IN_CANCELLED || e.code === statusCodes.IN_PROGRESS) return;
        if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) return onError('Google Play services is unavailable or out of date on this device.');
        if (__DEV__) console.warn('[GoogleAuth] native error', e.code, e.message);
        // DEVELOPER_ERROR (code 10) = app signing SHA-1 / client IDs not registered for this build.
        if (String(e.code) === '10' || /DEVELOPER_ERROR/i.test(e.message)) {
          return onError('Google sign-in is not set up for this version of the app yet. Please use email for now.');
        }
        return onError('Unable to sign you in with Google. Please try again.');
      }
      onError(authMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable
      onPress={press}
      disabled={busy}
      style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }, busy && { opacity: 0.6 }]}
      accessibilityRole="button"
      accessibilityLabel="Continue with Google"
      accessibilityState={{ busy }}
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
  btn: { minHeight: 52, borderRadius: radius.pill, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  text: { ...t.h3, color: '#1F1F1F', letterSpacing: 0.2 },
});
