import React from 'react';
import { Image } from 'expo-image';
import type { ImageStyle, StyleProp } from 'react-native';

// Replace assets/logo.png with the real Testimonies of Praise logo (transparent PNG, square, 512px+).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const logo = require('../../assets/logo.png');

export function Logo({ size = 40, style }: { size?: number; style?: StyleProp<ImageStyle> }) {
  return <Image source={logo} style={[{ width: size, height: size }, style]} contentFit="contain" accessibilityLabel="Testimonies of Praise logo" />;
}
