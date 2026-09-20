import React from 'react';
import { StyleSheet, View, type ViewStyle, type StyleProp } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors } from '@/constants/theme';
import { OfflineBanner } from './OfflineBanner';

interface Props {
  children: React.ReactNode;
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
  banner?: boolean;
}

/** Safe-area aware screen shell (notch / Dynamic Island / gesture bars) with the offline banner. */
export function Screen({ children, edges = ['top'], style, banner = true }: Props) {
  return (
    <SafeAreaView style={[styles.root, style]} edges={edges}>
      {banner ? <OfflineBanner /> : null}
      <View style={styles.flex}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
});
