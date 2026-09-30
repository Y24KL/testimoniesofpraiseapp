import React, { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { KingsChatLoginModal, type KingsChatToken } from '@/auth/KingsChatLoginModal';
import { useAuth } from '@/auth/AuthContext';
import { radius, type as t } from '@/constants/theme';
import { authMessage } from '@/utils/errors';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const logo = require('../../assets/kingschat-logo.png');

// KingsChat's own blue gradient.
const KC_BLUE_LIGHT = '#38BDF8';
const KC_BLUE_DARK = '#2563EB';

export function KingsChatButton({ onError }: { onError: (message: string) => void }) {
  const { signInWithKingsChat } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleSuccess = async (token: KingsChatToken) => {
    setOpen(false);
    setBusy(true);
    try {
      await signInWithKingsChat(token);
    } catch (e) {
      onError(authMessage(e));
    }
    setBusy(false);
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        disabled={busy}
        style={({ pressed }) => [{ opacity: pressed || busy ? 0.85 : 1 }]}
        accessibilityRole="button"
        accessibilityLabel="Sign in with KingsChat"
      >
        <LinearGradient colors={[KC_BLUE_LIGHT, KC_BLUE_DARK]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btn}>
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={styles.row}>
              <Image source={logo} style={styles.logo} resizeMode="contain" />
              <Text style={styles.text}>SIGN IN WITH KINGSCHAT</Text>
            </View>
          )}
        </LinearGradient>
      </Pressable>
      <KingsChatLoginModal
        visible={open}
        onClose={() => setOpen(false)}
        onSuccess={(t) => void handleSuccess(t)}
        onError={(m) => {
          setOpen(false);
          onError(m);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  btn: { minHeight: 52, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 22, height: 22 },
  text: { ...t.h3, color: '#fff', letterSpacing: 0.6 },
});
