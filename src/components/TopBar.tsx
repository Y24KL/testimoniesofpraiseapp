import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/auth/AuthContext';
import { colors, type as t } from '@/constants/theme';
import { Logo } from './Logo';

interface Props {
  title?: string;
  brand?: boolean;
  onBack?: () => void;
  onSearch?: () => void;
  onNotifications?: () => void;
  onProfile?: () => void;
}

function IconBtn({ name, label, onPress }: { name: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.icon} hitSlop={8} accessibilityRole="button" accessibilityLabel={label}>
      <Ionicons name={name} size={24} color={colors.text} />
    </Pressable>
  );
}

export function TopBar({ title, brand, onBack, onSearch, onNotifications, onProfile }: Props) {
  const { user } = useAuth();
  return (
    <View style={styles.bar}>
      <View style={styles.left}>
        {onBack ? <IconBtn name="chevron-back" label="Go back" onPress={onBack} /> : null}
        {brand ? <Logo size={34} /> : null}
        <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
          {title ?? 'Testimonies of Praise'}
        </Text>
      </View>
      <View style={styles.right}>
        {onSearch ? <IconBtn name="search-outline" label="Search" onPress={onSearch} /> : null}
        {onNotifications ? <IconBtn name="notifications-outline" label="Notifications" onPress={onNotifications} /> : null}
        {onProfile ? (
          <Pressable onPress={onProfile} style={styles.icon} hitSlop={8} accessibilityRole="button" accessibilityLabel="Profile">
            {user?.photoURL ? (
              <Image source={user.photoURL} style={styles.avatar} contentFit="cover" accessibilityLabel="Your profile photo" />
            ) : (
              <Ionicons name="person-circle-outline" size={24} color={colors.text} />
            )}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  left: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  right: { flexDirection: 'row', alignItems: 'center' },
  title: { ...t.h3, color: colors.text, flexShrink: 1 },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: colors.accent, backgroundColor: colors.card },
});
