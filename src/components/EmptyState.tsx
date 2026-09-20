import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, type as t } from '@/constants/theme';

interface Props {
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  message?: string;
  children?: React.ReactNode;
}

export function EmptyState({ icon = 'sparkles-outline', title, message, children }: Props) {
  const o = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(o, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, [o]);
  return (
    <Animated.View style={[styles.wrap, { opacity: o }]}>
      <Ionicons name={icon} size={44} color={colors.primaryLight} />
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.msg}>{message}</Text> : null}
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  title: { ...t.h3, color: colors.text, textAlign: 'center' },
  msg: { ...t.body, color: colors.textMuted, textAlign: 'center' },
});
