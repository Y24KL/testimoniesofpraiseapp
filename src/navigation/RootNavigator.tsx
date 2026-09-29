import React from 'react';
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
  // isNewAccount is resolved inside AuthContext as part of auth restore, so by the time this
  // component mounts it's already correct — reading it directly here avoids the double-check
  // (context flag vs. a separate AsyncStorage read) that used to race on "GET STARTED".
  const pendingWelcome = !!user && isNewAccount;

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
