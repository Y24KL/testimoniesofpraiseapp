import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, type as t } from '@/constants/theme';
import { PROFILE_TITLES, type ProfileTitle } from '@/profile/validation';

interface Props {
  value: string;
  onChange: (title: ProfileTitle) => void;
  error?: string;
  disabled?: boolean;
}

/** Single-choice title list (Mr, Mrs, … Evangelist). Each option is a radio for screen readers. */
export function TitlePicker({ value, onChange, error, disabled }: Props) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.label} nativeID="title-picker-label">
        Title *
      </Text>
      <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabelledBy="title-picker-label">
        {PROFILE_TITLES.map((option) => {
          const on = value === option;
          return (
            <Pressable
              key={option}
              onPress={() => onChange(option)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on, disabled: !!disabled }}
              accessibilityLabel={option}
              disabled={disabled}
              style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && { opacity: 0.85 }]}
            >
              {on ? <Ionicons name="checkmark" size={14} color={colors.onAccent} /> : null}
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{option}</Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { ...t.small, color: colors.textMuted, fontWeight: '700' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    minHeight: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { ...t.small, color: colors.text, fontWeight: '700' },
  chipTextOn: { color: colors.onAccent },
  error: { ...t.caption, color: colors.danger },
});
