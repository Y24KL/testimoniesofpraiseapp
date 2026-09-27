import React, { useEffect, useState } from 'react';
import { isNewAccountPending } from '@/onboarding/welcome';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '@/auth/AuthContext';
import { colors } from '@/constants/theme';
import { useAppFlags } from '@/context/AppFlags';
import { EmailAuthScreen } from '@/screens/EmailAuthScreen';
import { ForgotPasswordScreen } from '@/screens/ForgotPasswordScreen';
import { NotificationPrimerScreen } from '@/screens/NotificationPrimerScreen';
import { FirstTimeWelcomeScreen } from '@/screens/FirstTimeWelcomeScreen';
import { NotificationSettingsScreen } from '@/screens/NotificationSettingsScreen';
import { NotificationsScreen } from '@/screens/NotificationsScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { SearchScreen } from '@/screens/SearchScreen';
import { ShareTestimonyScreen } from '@/screens/ShareTestimonyScreen';
import { SponsorScreen } from '@/screens/SponsorScreen';
import { TestimonyDetailsScreen } from '@/screens/TestimonyDetailsScreen';
import { WelcomeScreen } from '@/screens/WelcomeScreen';
import { TabNavigator } from './TabNavigator';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { user, isNewAccount } = useAuth();
  const { primerSeen } = useAppFlags();
  const [checkingWelcome, setCheckingWelcome] = useState(true);
  const [pendingWelcome, setPendingWelcome] = useState(false);

  useEffect(() => {
    if (!user) {
      setCheckingWelcome(false);
      setPendingWelcome(false);
      return;
    }
    setCheckingWelcome(true);
    // isNewAccount (set the instant an account is created) short-circuits the AsyncStorage check.
    if (isNewAccount) {
      setPendingWelcome(true);
      setCheckingWelcome(false);
      return;
    }
    isNewAccountPending(user.uid).then((pending) => {
      setPendingWelcome(pending);
      setCheckingWelcome(false);
    });
  }, [user, isNewAccount]);

  if (user && checkingWelcome) return null; // brief check against AsyncStorage; avoids a Home flash before the welcome screen

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: colors.bg } }}>
      {!user ? (
        <Stack.Group>
          <Stack.Screen name="Welcome" component={WelcomeScreen} options={{ animation: 'fade' }} />
          <Stack.Screen name="EmailAuth" component={EmailAuthScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        </Stack.Group>
      ) : pendingWelcome ? (
        <Stack.Screen name="FirstTimeWelcome" component={FirstTimeWelcomeScreen} options={{ animation: 'fade' }} />
      ) : !primerSeen ? (
        <Stack.Screen name="NotificationPrimer" component={NotificationPrimerScreen} options={{ animation: 'fade' }} />
      ) : (
        <Stack.Group>
          <Stack.Screen name="Tabs" component={TabNavigator} options={{ animation: 'fade' }} />
          <Stack.Screen name="TestimonyDetails" component={TestimonyDetailsScreen} />
          <Stack.Screen name="ShareTestimony" component={ShareTestimonyScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="Sponsor" component={SponsorScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
          <Stack.Screen name="Search" component={SearchScreen} options={{ animation: 'fade' }} />
        </Stack.Group>
      )}
    </Stack.Navigator>
  );
}
