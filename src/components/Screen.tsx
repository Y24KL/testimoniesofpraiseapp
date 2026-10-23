import React, { useContext } from 'react';
import { StyleSheet, View, type ViewStyle, type StyleProp } from 'react-native';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { SafeAreaView, useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';
import { MiniPlayer } from '@/audio/MiniPlayer';
import { useAudioPlayer } from '@/audio/AudioPlayerContext';
import { colors } from '@/constants/theme';
import { OfflineBanner } from './OfflineBanner';

interface Props {
  children: React.ReactNode;
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
  banner?: boolean;
}

/**
 * Safe-area aware screen shell (notch / Dynamic Island / gesture bars) with the offline banner.
 * Screens pushed on top of the tabs also get the mini audio player at the bottom, so playback
 * stays controllable everywhere (inside the tabs it lives in the tab bar instead).
 */
export function Screen({ children, edges = ['top'], style, banner = true }: Props) {
  const inTabs = useContext(BottomTabBarHeightContext) !== undefined;
  const { track } = useAudioPlayer();
  const insets = useSafeAreaInsets();
  const showPlayer = !inTabs && !!track;
  return (
    <SafeAreaView style={[styles.root, style]} edges={edges}>
      {banner ? <OfflineBanner /> : null}
      <View style={styles.flex}>{children}</View>
      {showPlayer ? (
        <View style={{ paddingTop: 8, paddingBottom: edges.includes('bottom') ? 0 : insets.bottom }}>
          <MiniPlayer />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
});
