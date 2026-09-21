import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { BottomNavigation } from '@/components/BottomNavigation';
import { DownloadsScreen } from '@/screens/DownloadsScreen';
import { HomeScreen } from '@/screens/HomeScreen';
import { LiveScreen } from '@/screens/LiveScreen';
import { TestimoniesScreen } from '@/screens/TestimoniesScreen';
import { colors } from '@/constants/theme';
import type { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

export function TabNavigator() {
  return (
    <Tab.Navigator
      tabBar={(p) => <BottomNavigation {...p} />}
      screenOptions={{
        headerShown: false,
        animation: 'fade', // smooth tab transitions
        lazy: true, // don't load every tab at startup
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Home' }} />
      <Tab.Screen name="Testimonies" component={TestimoniesScreen} options={{ title: 'Testimonies' }} />
      <Tab.Screen name="Live" component={LiveScreen} options={{ title: 'Live' }} />
      <Tab.Screen name="Downloads" component={DownloadsScreen} options={{ title: 'Downloads' }} />
    </Tab.Navigator>
  );
}
