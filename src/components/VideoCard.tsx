import React from 'react';
import type { Testimony } from '@/types';
import { TestimonyCard } from './TestimonyCard';

/** Compact horizontal video tile used in carousels ("Latest testimonies", "Recently added"). */
export function VideoCard({ item, onPress }: { item: Testimony; onPress: () => void }) {
  return <TestimonyCard item={item} onPress={onPress} variant="tile" />;
}
