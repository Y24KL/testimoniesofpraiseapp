import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { colors, gradients, radius, type as t } from '@/constants/theme';
import type { Promotion } from '@/types';

interface Props {
  item: Promotion;
  compact?: boolean;
}

export function PromotionCard({ item, compact = false }: Props) {
  const nav = useNavigation();

  const handlePress = async () => {
    if (!item.destinationUrl) return;
    if (item.target === 'external' || item.destinationUrl.startsWith('http://') || item.destinationUrl.startsWith('https://')) {
      const can = await Linking.canOpenURL(item.destinationUrl);
      if (can) {
        await Linking.openURL(item.destinationUrl);
        return;
      }
    }

    // Internal navigation targets (e.g. "radio", "adotopoc", "articles", "sponsor", "share")
    const dest = item.destinationUrl.toLowerCase().trim();
    if (dest === 'radio') nav.navigate('Radio');
    else if (dest === 'adotopoc') nav.navigate('Adotopoc');
    else if (dest === 'articles') nav.navigate('Articles');
    else if (dest === 'sponsor') nav.navigate('Sponsor');
    else if (dest === 'share') nav.navigate('ShareTestimony');
    else if (dest.startsWith('article:')) {
      const id = dest.replace('article:', '').trim();
      nav.navigate('ArticleDetails', { id });
    } else {
      // Fallback try open URL
      await Linking.openURL(item.destinationUrl).catch(() => undefined);
    }
  };

  if (compact) {
    return (
      <Pressable
        onPress={handlePress}
        style={styles.compactCard}
        accessibilityRole="button"
        accessibilityLabel={item.title}
      >
        <Image source={item.imageUrl} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
        <LinearGradient
          colors={['transparent', 'rgba(18, 0, 28, 0.95)']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.compactContent}>
          {item.category ? (
            <View style={styles.chip}>
              <Text style={styles.chipText}>{item.category.toUpperCase()}</Text>
            </View>
          ) : null}
          <Text style={styles.compactTitle} numberOfLines={2}>
            {item.title}
          </Text>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      style={styles.fullCard}
      accessibilityRole="button"
      accessibilityLabel={item.title}
    >
      <View style={styles.imageContainer}>
        {item.imageUrl ? (
          <Image source={item.imageUrl} style={styles.image} contentFit="cover" transition={250} />
        ) : (
          <LinearGradient colors={gradients.card} style={styles.imagePlaceholder}>
            <Ionicons name="megaphone-outline" size={36} color={colors.accent} />
          </LinearGradient>
        )}
        <LinearGradient
          colors={['transparent', 'rgba(18, 0, 28, 0.9)']}
          style={StyleSheet.absoluteFill}
        />
        {item.category ? (
          <View style={styles.badgeContainer}>
            <View style={styles.chip}>
              <Text style={styles.chipText}>{item.category.toUpperCase()}</Text>
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <Text style={styles.title}>{item.title}</Text>
        {item.description ? (
          <Text style={styles.desc} numberOfLines={3}>
            {item.description}
          </Text>
        ) : null}

        <View style={styles.footer}>
          <Text style={styles.ctaText}>
            {item.target === 'external' ? 'Learn More' : 'Explore'}
          </Text>
          <Ionicons
            name={item.target === 'external' ? 'open-outline' : 'arrow-forward'}
            size={16}
            color={colors.accent}
          />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  compactCard: {
    width: 260,
    height: 150,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    justifyContent: 'flex-end',
    padding: 12,
  },
  compactContent: {
    gap: 4,
  },
  compactTitle: {
    ...t.h3,
    color: colors.text,
    fontSize: 15,
  },
  fullCard: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  imageContainer: {
    height: 170,
    width: '100%',
    position: 'relative',
    backgroundColor: colors.primary,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeContainer: {
    position: 'absolute',
    top: 12,
    left: 12,
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(245, 197, 66, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(245, 197, 66, 0.5)',
    alignSelf: 'flex-start',
  },
  chipText: {
    ...t.label,
    color: colors.accent,
    fontSize: 10,
    fontWeight: '700',
  },
  body: {
    padding: 16,
    gap: 8,
  },
  title: {
    ...t.h2,
    fontSize: 18,
    color: colors.text,
  },
  desc: {
    ...t.body,
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  ctaText: {
    ...t.label,
    color: colors.accent,
    fontWeight: '700',
    fontSize: 13,
  },
});
