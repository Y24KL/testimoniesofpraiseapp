import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '@/components/PrimaryButton';
import { TopBar } from '@/components/TopBar';
import { useAuth } from '@/auth/AuthContext';
import { colors, gradients, radius, type as t } from '@/constants/theme';

export function VerifyEmailScreen() {
  const {
    user,
    verificationEmail,
    verifyOtp,
    resendOtp,
    signOut,
  } = useAuth();

  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(60);

  const inputRef = useRef<TextInput>(null);

  // Active 60-second cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Focus input automatically on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  const handleVerify = async (codeToSubmit = code) => {
    const cleaned = codeToSubmit.replace(/\D/g, '').slice(0, 6);
    if (cleaned.length !== 6) {
      setError('Please enter all 6 digits of your verification code.');
      return;
    }

    setError(null);
    setBusy(true);
    try {
      await verifyOtp(cleaned);
      // Navigation is triggered automatically when isSessionVerified becomes true in AuthContext
    } catch (e: any) {
      setError(e?.message || 'Verification failed. Please check the code and try again.');
      setBusy(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setError(null);
    setResending(true);
    try {
      await resendOtp();
      setCooldown(60);
      setCode('');
      inputRef.current?.focus();
    } catch (e: any) {
      setError(e?.message || 'Failed to resend code. Please try again in a moment.');
    } finally {
      setResending(false);
    }
  };

  const handleCodeChange = (text: string) => {
    const numeric = text.replace(/\D/g, '').slice(0, 6);
    setCode(numeric);
    setError(null);
    if (numeric.length === 6) {
      void handleVerify(numeric);
    }
  };

  const displayEmail = verificationEmail || user?.email || 'your registered email';

  return (
    <LinearGradient colors={gradients.hero} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <TopBar
          title="Verify Email"
          right={
            <Pressable
              onPress={() => void signOut()}
              style={styles.signOutBtn}
              accessibilityRole="button"
              accessibilityLabel="Sign out"
            >
              <Text style={styles.signOutText}>Sign Out</Text>
            </Pressable>
          }
        />
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.centerHeader}>
              <View style={styles.iconCircle}>
                <Ionicons name="mail-unread-outline" size={42} color={colors.accent} />
              </View>
              <Text style={styles.title}>Check Your Email</Text>
              <Text style={styles.subtitle}>
                We've sent a 6-digit verification code to:{'\n'}
                <Text style={styles.emailHighlight}>{displayEmail}</Text>
              </Text>
            </View>

            {/* Hidden Input for Keyboard and Paste Support */}
            <TextInput
              ref={inputRef}
              value={code}
              onChangeText={handleCodeChange}
              keyboardType="number-pad"
              maxLength={6}
              textContentType="oneTimeCode"
              autoFocus
              style={styles.hiddenInput}
              accessibilityLabel="Six-digit verification code"
            />

            {/* 6-Digit Display Slots */}
            <Pressable
              style={styles.digitsRow}
              onPress={() => inputRef.current?.focus()}
              accessibilityRole="button"
              accessibilityLabel="Verification code input slots"
            >
              {[0, 1, 2, 3, 4, 5].map((index) => {
                const char = code[index] || '';
                const isFocused = code.length === index || (index === 5 && code.length === 6);
                return (
                  <View
                    key={index}
                    style={[
                      styles.digitSlot,
                      Boolean(char) && styles.digitSlotFilled,
                      isFocused && styles.digitSlotFocused,
                    ]}
                  >
                    <Text style={styles.digitText}>{char}</Text>
                  </View>
                );
              })}
            </Pressable>

            {error ? (
              <View style={styles.errorContainer} accessibilityRole="alert">
                <Ionicons name="alert-circle" size={18} color={colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.actionContainer}>
              <PrimaryButton
                title="Verify & continue"
                onPress={() => handleVerify()}
                loading={busy}
                disabled={code.length !== 6 || busy}
              />

              <View style={styles.resendRow}>
                {cooldown > 0 ? (
                  <Text style={styles.cooldownText}>
                    Resend code in <Text style={{ color: colors.accent }}>{cooldown}s</Text>
                  </Text>
                ) : (
                  <Pressable
                    onPress={handleResend}
                    disabled={resending}
                    style={styles.resendBtn}
                    accessibilityRole="button"
                  >
                    {resending ? (
                      <ActivityIndicator size="small" color={colors.accent} />
                    ) : (
                      <Text style={styles.resendLink}>Resend Code</Text>
                    )}
                  </Pressable>
                )}
              </View>
            </View>

            <View style={styles.footerNote}>
              <Text style={styles.noteText}>
                Verification codes are valid for 10 minutes. For maximum account security, a verification
                code is required when registering or signing in on a fresh installation.
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 24,
    gap: 24,
    flexGrow: 1,
    justifyContent: 'center',
  },
  signOutBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  signOutText: {
    ...t.small,
    color: colors.textMuted,
    fontWeight: '600',
  },
  centerHeader: {
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(75, 0, 110, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.accent,
    marginBottom: 4,
  },
  title: {
    ...t.h1,
    fontSize: 26,
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    ...t.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  emailHighlight: {
    color: colors.text,
    fontWeight: '700',
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0.01,
    width: 1,
    height: 1,
  },
  digitsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginVertical: 12,
  },
  digitSlot: {
    width: 48,
    height: 58,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digitSlotFilled: {
    borderColor: 'rgba(245, 197, 66, 0.5)',
    backgroundColor: 'rgba(75, 0, 110, 0.25)',
  },
  digitSlotFocused: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(75, 0, 110, 0.4)',
  },
  digitText: {
    ...t.h1,
    fontSize: 26,
    color: colors.accent,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: 'rgba(235, 87, 87, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(235, 87, 87, 0.3)',
  },
  errorText: {
    ...t.small,
    color: colors.danger,
    textAlign: 'center',
    flex: 1,
  },
  actionContainer: {
    gap: 16,
    marginTop: 8,
  },
  resendRow: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 28,
  },
  cooldownText: {
    ...t.body,
    fontSize: 14,
    color: colors.textMuted,
  },
  resendBtn: {
    padding: 6,
  },
  resendLink: {
    ...t.body,
    fontSize: 15,
    color: colors.accent,
    fontWeight: '700',
  },
  footerNote: {
    marginTop: 20,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  noteText: {
    ...t.small,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
