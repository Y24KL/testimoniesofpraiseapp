import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AudioPlayerProvider } from '@/audio/AudioPlayerContext';
import { AuthProvider, useAuth } from '@/auth/AuthContext';
import { track } from '@/analytics';
import { LoadingPraise } from '@/components/LoadingPraise';
import { colors } from '@/constants/theme';
import { AppFlagsProvider, useAppFlags } from '@/context/AppFlags';
import { DownloadsProvider } from '@/downloads/DownloadsContext';
import { linking } from '@/navigation/linking';
import { navigationRef } from '@/navigation/ref';
import { AppDrawer } from '@/components/AppDrawer';
import { DrawerProvider } from '@/context/DrawerContext';
import { RootNavigator } from '@/navigation/RootNavigator';
import { usePushLifecycle } from '@/notifications/usePushLifecycle';
import { VoiceoverProvider } from '@/voiceover/VoiceoverProvider';
import { TutorialOverlay } from '@/voiceover/TutorialOverlay';

void SplashScreen.preventAutoHideAsync();

// --- FORCES FOREGROUND DROP-DOWN NOTIFICATIONS ---
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    priority: Notifications.AndroidNotificationPriority.HIGH,
  }),
});
// -------------------------------------------------

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.surface,
    primary: colors.accent,
    text: colors.text,
    border: colors.border,
  },
};

function Shell() {
  const { initializing, user, profileChecked } = useAuth();
  const { flagsReady } = useAppFlags();
  const ready = !initializing && flagsReady && profileChecked;
  usePushLifecycle();

  useEffect(() => {
    // Hand over from the native splash to our animated loader immediately.
    void SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    if (ready) track('app_open', { signedIn: !!user });
  }, [ready, user]);

  if (!ready) return <LoadingPraise />;
  return (
    <NavigationContainer ref={navigationRef} theme={theme} linking={linking}>
      <DrawerProvider>
        <RootNavigator />
        <AppDrawer />
        <TutorialOverlay />
      </DrawerProvider>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AuthProvider>
        <AppFlagsProvider>
          <DownloadsProvider>
            <AudioPlayerProvider>
              <VoiceoverProvider>
                <Shell />
              </VoiceoverProvider>
            </AudioPlayerProvider>
          </DownloadsProvider>
        </AppFlagsProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
