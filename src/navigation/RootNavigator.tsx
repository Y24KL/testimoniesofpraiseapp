import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '@/auth/AuthContext';
import { colors } from '@/constants/theme';
import { useAppFlags } from '@/context/AppFlags';
import { EmailAuthScreen } from '@/screens/EmailAuthScreen';
import { ForgotPasswordScreen } from '@/screens/ForgotPasswordScreen';
import { VerifyEmailScreen } from '@/screens/VerifyEmailScreen';
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
import { AdotopocScreen } from '@/screens/AdotopocScreen';
import { PromotionsScreen } from '@/screens/PromotionsScreen';
import { ArticlesScreen } from '@/screens/ArticlesScreen';
import { ArticleDetailsScreen } from '@/screens/ArticleDetailsScreen';
import { AudioTestimonyScreen } from '@/screens/AudioTestimonyScreen';
import { TabNavigator } from './TabNavigator';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { user, isSessionVerified, isNewAccount } = useAuth();
  const { primerSeen } = useAppFlags();

  const pendingWelcome = Boolean(user && isSessionVerified && isNewAccount);

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      {!user ? (
        <Stack.Group>
          <Stack.Screen name="Welcome" component={WelcomeScreen} options={{ animation: 'fade' }} />
          <Stack.Screen name="EmailAuth" component={EmailAuthScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        </Stack.Group>
      ) : !isSessionVerified ? (
        <Stack.Screen
          name="VerifyEmail"
          component={VerifyEmailScreen}
          options={{ animation: 'fade' }}
        />
      ) : pendingWelcome ? (
        <Stack.Screen
          name="FirstTimeWelcome"
          component={FirstTimeWelcomeScreen}
          options={{ animation: 'fade' }}
        />
      ) : !primerSeen ? (
        <Stack.Screen
          name="NotificationPrimer"
          component={NotificationPrimerScreen}
          options={{ animation: 'fade' }}
        />
      ) : (
        <Stack.Group>
          <Stack.Screen name="Tabs" component={TabNavigator} options={{ animation: 'fade' }} />
          <Stack.Screen name="TestimonyDetails" component={TestimonyDetailsScreen} />
          <Stack.Screen
            name="ShareTestimony"
            component={ShareTestimonyScreen}
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          />
          <Stack.Screen
            name="Sponsor"
            component={SponsorScreen}
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
          <Stack.Screen name="Search" component={SearchScreen} options={{ animation: 'fade' }} />
          <Stack.Screen name="Adotopoc" component={AdotopocScreen} />
          <Stack.Screen name="Promotions" component={PromotionsScreen} />
          <Stack.Screen name="Articles" component={ArticlesScreen} />
          <Stack.Screen name="ArticleDetails" component={ArticleDetailsScreen} />
          <Stack.Screen name="AudioTestimony" component={AudioTestimonyScreen} />
        </Stack.Group>
      )}
    </Stack.Navigator>
  );
}
