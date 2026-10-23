import React, { useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, radius, type as t } from '@/constants/theme';

interface Props {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  /** primary = gold (main call to action), secondary = purple, outline/ghost/danger = low emphasis */
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
  compact?: boolean;
}

export function PrimaryButton({ title, onPress, loading, disabled, variant = 'primary', icon, style, accessibilityHint, compact }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
  const inactive = disabled || loading;
  const textColor = variant === 'primary' ? colors.onAccent : variant === 'danger' ? colors.danger : variant === 'ghost' ? colors.accent : colors.text;
  const base = [styles.base, compact && styles.compact];

  const content = (
    <>
      {loading ? <ActivityIndicator color={textColor} /> : icon ? <Ionicons name={icon} size={compact ? 16 : 18} color={textColor} /> : null}
      <Text style={[styles.text, compact && styles.textCompact, { color: textColor }]}>{title}</Text>
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
        {variant === 'primary' || variant === 'secondary' ? (
          <LinearGradient
            colors={variant === 'primary' ? gradients.gold : gradients.brand}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[base, variant === 'secondary' && styles.secondary]}
          >
            {content}
          </LinearGradient>
        ) : (
          <Animated.View style={[base, variant === 'outline' && styles.outline, variant === 'danger' && styles.dangerOutline]}>{content}</Animated.View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 52, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 22 },
  compact: { minHeight: 40, paddingHorizontal: 16 },
  secondary: { borderWidth: 1, borderColor: colors.primaryLight },
  outline: { borderWidth: 1.5, borderColor: 'rgba(245,197,66,0.45)', backgroundColor: 'rgba(28,8,41,0.6)' },
  dangerOutline: { borderWidth: 1.5, borderColor: colors.danger },
  text: { ...t.h3, letterSpacing: 0.3 },
  textCompact: { fontSize: 14 },
});
