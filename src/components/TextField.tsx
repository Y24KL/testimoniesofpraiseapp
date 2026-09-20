import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, type as t } from '@/constants/theme';

interface Props extends TextInputProps {
  label: string;
  error?: string;
  secure?: boolean; // adds a show/hide toggle
}

export function TextField({ label, error, secure, style, ...rest }: Props) {
  const [hidden, setHidden] = useState(!!secure);
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.box, focus && styles.focus, !!error && styles.err]}>
        <TextInput
          {...rest}
          style={[styles.input, style]}
          secureTextEntry={secure ? hidden : rest.secureTextEntry}
          placeholderTextColor={colors.textMuted + '99'}
          onFocus={(e) => {
            setFocus(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocus(false);
            rest.onBlur?.(e);
          }}
          accessibilityLabel={label}
        />
        {secure ? (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={10} accessibilityRole="button" accessibilityLabel={hidden ? `Show ${label}` : `Hide ${label}`}>
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={22} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.errText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { ...t.small, color: colors.textMuted, fontWeight: '700' },
  box: { flexDirection: 'row', alignItems: 'center', minHeight: 52, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 14 },
  focus: { borderColor: colors.primaryLight },
  err: { borderColor: colors.danger },
  input: { flex: 1, color: colors.text, fontSize: 16, paddingVertical: 12 },
  errText: { ...t.small, color: colors.danger },
});
