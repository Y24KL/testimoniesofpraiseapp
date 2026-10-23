import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MiniPlayer } from '@/audio/MiniPlayer';
import { colors, type as t } from '@/constants/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
const ICONS: Record<string, [IconName, IconName]> = {
  Home: ['home-outline', 'home'],
  Testimonies: ['play-circle-outline', 'play-circle'],
  Live: ['videocam-outline', 'videocam'],
  Listen: ['headset-outline', 'headset'],
  Downloads: ['cloud-download-outline', 'cloud-download'],
};

function Item({ label, focused, onPress, onLongPress, name }: { label: string; focused: boolean; onPress: () => void; onLongPress: () => void; name: string }) {
  const s = useRef(new Animated.Value(focused ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(s, { toValue: focused ? 1 : 0, duration: 180, useNativeDriver: true }).start();
  }, [focused, s]);
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
      <View style={styles.iconWrap}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.pill, { opacity: s, transform: [{ scaleX: s.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }]} />
        <Ionicons name={focused ? on : off} size={22} color={focused ? colors.accent : colors.textSubtle} />
      </View>
      {/* Label + filled icon + pill: state is never shown by color alone */}
      <Text style={[styles.label, focused && styles.labelOn]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

export function BottomNavigation({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View>
      {/* Persistent audio player sits on top of the tab bar so playback survives tab switches. */}
      <MiniPlayer />
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
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 8, paddingHorizontal: 4 },
  item: { flex: 1, alignItems: 'center', gap: 4, minHeight: 50 },
  iconWrap: { width: 56, height: 30, alignItems: 'center', justifyContent: 'center' },
  pill: { borderRadius: 15, backgroundColor: colors.accentSoft },
  label: { ...t.label, fontSize: 10.5, letterSpacing: 0.2, color: colors.textSubtle },
  labelOn: { color: colors.accent },
});
