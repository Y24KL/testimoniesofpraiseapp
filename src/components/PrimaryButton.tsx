import React, { useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, radius, type as t } from '@/constants/theme';

interface Props {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'outline' | 'ghost' | 'danger';
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}

export function PrimaryButton({ title, onPress, loading, disabled, variant = 'primary', icon, style, accessibilityHint }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
  const inactive = disabled || loading;
  const textColor = variant === 'primary' ? colors.text : variant === 'danger' ? colors.danger : colors.text;

  const content = (
    <>
      {loading ? <ActivityIndicator color={textColor} /> : icon ? <Ionicons name={icon} size={18} color={textColor} /> : null}
      <Text style={[styles.text, { color: textColor }]}>{title}</Text>
    </>
  );

  return (
    <Animated.View style={[{ transform: [{ scale }], opacity: inactive ? 0.55 : 1 }, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => to(0.97)}
        onPressOut={() => to(1)}
        disabled={inactive}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      >
        {variant === 'primary' ? (
          <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.base, styles.primary]}>
            {content}
          </LinearGradient>
        ) : (
          <Animated.View style={[styles.base, variant === 'outline' && styles.outline, variant === 'danger' && styles.dangerOutline]}>{content}</Animated.View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 52, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 20 },
  primary: { borderWidth: 1, borderColor: colors.primaryLight },
  outline: { borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  dangerOutline: { borderWidth: 1.5, borderColor: colors.danger },
  text: { ...t.h3, letterSpacing: 0.6 },
});
