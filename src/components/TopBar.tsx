import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, type as t } from '@/constants/theme';
import { useDrawer } from '@/context/DrawerContext';
import { Logo } from './Logo';

interface Props {
  title?: string;
  brand?: boolean;
  onBack?: () => void;
  onSearch?: () => void;
  onNotifications?: () => void;
  onProfile?: () => void;
  onMenu?: () => void;
  right?: React.ReactNode;
}

export function IconButton({
  name,
  label,
  onPress,
  size = 22,
}: {
  name: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  size?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.icon, pressed && styles.iconPressed]}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={name} size={size} color={colors.text} />
    </Pressable>
  );
}

export function TopBar({ title, brand, onBack, onSearch, onNotifications, onProfile, onMenu, right }: Props) {
  const { openDrawer } = useDrawer();
  const showMenu = Boolean(onMenu || onProfile || brand);
  const handleMenuPress = onMenu || openDrawer;

  return (
    <View style={styles.bar}>
      <View style={styles.left}>
        {onBack ? <IconButton name="chevron-back" label="Go back" onPress={onBack} /> : null}
        {brand ? (
          <Logo size={34} />
        ) : (
          <Text style={[styles.title, !onBack && styles.titleLarge]} numberOfLines={1} accessibilityRole="header">
            {title ?? 'Testimonies of Praise'}
          </Text>
        )}
      </View>
      <View style={styles.right}>
        {right ?? null}
        {onSearch ? <IconButton name="search" label="Search" onPress={onSearch} /> : null}
        {onNotifications ? <IconButton name="notifications-outline" label="Notifications" onPress={onNotifications} /> : null}
        {showMenu ? <IconButton name="menu" label="Open navigation menu" onPress={handleMenuPress} size={24} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  left: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, paddingLeft: 4 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { ...t.h3, fontSize: 17, color: colors.text, flexShrink: 1 },
  titleLarge: { ...t.h2, fontSize: 22 },
  icon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderSoft },
  iconPressed: { backgroundColor: 'rgba(255,255,255,0.14)' },
});
