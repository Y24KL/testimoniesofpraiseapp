import React from 'react';
import { Image } from 'expo-image';
import type { ImageStyle, StyleProp } from 'react-native';

// Official badge (1024x735 source, shipped as a 600px WebP: ~90 KB instead of 1.1 MB).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const logo = require('../../assets/logo.webp');
const ASPECT = 600 / 431;

/** `size` is the logo height; width follows the badge's real aspect ratio. */
export function Logo({ size = 40, style }: { size?: number; style?: StyleProp<ImageStyle> }) {
  return (
    <Image
      source={logo}
      style={[{ width: Math.round(size * ASPECT), height: size }, style]}
      contentFit="contain"
      accessibilityLabel="Testimonies of Praise logo"
    />
  );
}
