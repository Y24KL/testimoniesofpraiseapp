import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, type as t } from '@/constants/theme';

const ICONS: Record<string, [React.ComponentProps<typeof Ionicons>['name'], React.ComponentProps<typeof Ionicons>['name']]> = {
  Home: ['home-outline', 'home'],
  Testimonies: ['play-circle-outline', 'play-circle'],
  Live: ['radio-outline', 'radio'],
  Downloads: ['download-outline', 'download'],
};

function Item({ label, focused, onPress, onLongPress, name }: { label: string; focused: boolean; onPress: () => void; onLongPress: () => void; name: string }) {
  const s = useRef(new Animated.Value(focused ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(s, { toValue: focused ? 1 : 0, useNativeDriver: true, speed: 20, bounciness: 6 }).start();
  }, [focused, s]);
  const scale = s.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] });
  const [off, on] = ICONS[name] ?? ICONS.Home;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.item}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons name={focused ? on : off} size={24} color={focused ? colors.accent : colors.textMuted} />
      </Animated.View>
      {/* Label + filled icon + indicator: never color alone */}
      <Text style={[styles.label, focused && { color: colors.accent }]}>{label.toUpperCase()}</Text>
      <View style={[styles.dot, focused && { backgroundColor: colors.accent }]} />
    </Pressable>
  );
}

export function BottomNavigation({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {state.routes.map((route, i) => {
        const focused = state.index === i;
        const label = (descriptors[route.key].options.title ?? route.name) as string;
        return (
          <Item
            key={route.key}
            name={route.name}
            label={label}
            focused={focused}
            onPress={() => {
              const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !e.defaultPrevented) navigation.navigate(route.name as never);
            }}
            onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 8 },
  item: { flex: 1, alignItems: 'center', gap: 2, minHeight: 48 },
  label: { ...t.caps, fontSize: 9, letterSpacing: 0.6, color: colors.textMuted },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'transparent' },
});
