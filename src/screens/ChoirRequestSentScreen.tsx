import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { CHOIR_CONFIRMATION_TEXT } from '@/constants/choirFeature';
import { colors, radius, type as t } from '@/constants/theme';
import { KINGSCHAT_HANDLE, KINGSCHAT_PAGE_URL } from '@/utils/choirRequest';
import { openInExternalBrowser } from '@/utils/openExternal';

const KINGSCHAT_BLUE = '#1D6FE0';

/**
 * Shown once a choir/group request is saved. Reached with replace, so Back cannot resubmit the form.
 */
export function ChoirRequestSentScreen() {
  const nav = useNavigation();
  const [linkError, setLinkError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  const contact = async () => {
    if (opening) return;
    setOpening(true);
    setLinkError(null);
    try {
      await openInExternalBrowser(KINGSCHAT_PAGE_URL);
    } catch {
      setLinkError(`We couldn’t open KingsChat. Search for ${KINGSCHAT_HANDLE} in the KingsChat app.`);
    } finally {
      setOpening(false);
    }
  };

  // Clears the form screens so the hardware back button does not return to them.
  const returnHome = () => nav.reset({ index: 0, routes: [{ name: 'Tabs', params: { screen: 'Home' } }] });

  return (
    <Screen>
      <TopBar title="Request sent" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.badge}>
          <Ionicons name="checkmark" size={36} color={colors.success} />
        </View>
        <Text style={styles.message} accessibilityRole="header">
          {CHOIR_CONFIRMATION_TEXT}
        </Text>
        <Text style={styles.handle} selectable>
          {KINGSCHAT_HANDLE}
        </Text>

        {linkError ? (
          <Text style={styles.error} accessibilityRole="alert">
            {linkError}
          </Text>
        ) : null}

        <Pressable
          onPress={() => void contact()}
          disabled={opening}
          style={({ pressed }) => [styles.kingschat, pressed && { opacity: 0.85 }, opening && { opacity: 0.6 }]}
          accessibilityRole="link"
          accessibilityLabel="CONTACT US ON KINGCHAT"
          accessibilityState={{ busy: opening }}
        >
          <Text style={styles.kingschatText}>CONTACT US ON KINGCHAT</Text>
        </Pressable>

        <PrimaryButton title="RETURN TO HOME" icon="home-outline" variant="outline" onPress={returnHome} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, gap: 20, paddingBottom: 40, alignItems: 'stretch' },
  badge: {
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(61, 220, 151, 0.12)',
    borderWidth: 1.5,
    borderColor: colors.success,
  },
  message: { ...t.body, fontSize: 16, lineHeight: 24, color: colors.text, textAlign: 'center' },
  handle: { ...t.h2, fontSize: 20, color: colors.accent, textAlign: 'center' },
  error: { ...t.body, color: colors.danger, textAlign: 'center' },
  kingschat: {
    minHeight: 52,
    borderRadius: radius.pill,
    backgroundColor: KINGSCHAT_BLUE,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  kingschatText: { ...t.h3, color: '#FFFFFF', letterSpacing: 0.3 },
});
