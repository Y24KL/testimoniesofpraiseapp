import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/AuthContext';
import { colors, radius, type as t } from '@/constants/theme';
import { useDrawer } from '@/context/DrawerContext';
import { Logo } from './Logo';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.84, 340);

interface MenuItem {
  id: string;
  title: string;
  subtitle?: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  customImage?: any;
  iconColor?: string;
  iconBg?: string;
  badge?: string;
  badgeBg?: string;
  badgeColor?: string;
  onPress: () => void;
}

export function AppDrawer() {
  const { isOpen, closeDrawer } = useDrawer();
  const { user, signOut } = useAuth();
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isOpen) {
      Animated.parallel([
        Animated.timing(anim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      anim.setValue(0);
    }
  }, [isOpen, anim]);

  const handleClose = () => {
    Animated.timing(anim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      closeDrawer();
    });
  };

  const handleNavigate = (action: () => void) => {
    handleClose();
    setTimeout(() => {
      action();
    }, 150);
  };

  if (!isOpen) return null;

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [DRAWER_WIDTH, 0],
  });

  const backdropOpacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const menuItems: MenuItem[] = [
    {
      id: 'live',
      title: 'Click to watch Live',
      subtitle: 'Livestream & Live Chat',
      icon: 'videocam-outline',
      iconColor: colors.live,
      iconBg: 'rgba(255, 59, 78, 0.15)',
      onPress: () => nav.navigate('Tabs', { screen: 'Live' }),
    },
    {
      id: 'radio',
      title: 'T.O.P on Loveworld Radio',
      subtitle: '24/7 Live Audio Stream',
      icon: 'radio-outline',
      iconColor: colors.accent,
      iconBg: 'rgba(245, 197, 66, 0.15)',
      badge: 'LIVE 24/7',
      badgeBg: 'rgba(255, 59, 78, 0.2)',
      badgeColor: colors.live,
      onPress: () => nav.navigate('Tabs', { screen: 'Listen' }),
    },
    {
      id: 'adotopoc',
      title: 'ADOTOPOC Resource Center',
      subtitle: 'Resource Center & Media',
      customImage: require('../../assets/LOG_xcvt3v.webp'),

      iconBg: 'transparent',
      onPress: () => nav.navigate('Adotopoc'),
    },
    {
      id: 'written',
      title: 'Read Testimonies',
      subtitle: 'Read Stories of Praise',
      icon: 'document-text-outline',
      iconColor: colors.accent,
      iconBg: 'rgba(245, 197, 66, 0.15)',
      onPress: () => nav.navigate('WrittenTestimonies'),
    },
    {
      id: 'testimonies',
      title: 'Watch powerful Testimonies',
      subtitle: 'Praise Video Archive',
      icon: 'play-circle-outline',
      iconColor: colors.accent,
      iconBg: 'rgba(245, 197, 66, 0.15)',
      onPress: () => nav.navigate('Tabs', { screen: 'Testimonies' }),
    },
    {
      id: 'sponsor',
      title: 'Sponsor Testimonies of Praise show',
      subtitle: 'Partner & support the ministry',
      icon: 'heart-outline',
      iconColor: colors.live,
      iconBg: 'rgba(255, 59, 78, 0.15)',
      onPress: () => nav.navigate('Sponsor'),
    },
    {
      id: 'articles',
      title: 'Articles & Insights',
      subtitle: 'Publications & Study',
      icon: 'book-outline',
      iconColor: colors.primaryLight,
      iconBg: 'rgba(186, 104, 200, 0.2)',
      onPress: () => nav.navigate('Articles'),
    },
    {
      id: 'promotions',
      title: 'Promotions',
      subtitle: 'Events & Featured Campaigns',
      icon: 'pricetag-outline',
      iconColor: colors.accent,
      iconBg: 'rgba(245, 197, 66, 0.15)',
      onPress: () => nav.navigate('Promotions'),
    },
    {
      id: 'share',
      title: 'Share Testimony',
      subtitle: 'Send your praise report',
      icon: 'create-outline',
      iconColor: colors.primaryLight,
      iconBg: 'rgba(186, 104, 200, 0.2)',
      onPress: () => nav.navigate('ShareTestimony'),
    },
    {
      id: 'downloads',
      title: 'Downloads',
      subtitle: 'Offline Saved Media',
      icon: 'download-outline',
      iconColor: colors.accent,
      iconBg: 'rgba(245, 197, 66, 0.15)',
      onPress: () => nav.navigate('Tabs', { screen: 'Downloads' }),
    },
    {
      id: 'notifications',
      title: 'Notifications',
      subtitle: 'Announcements & Updates',
      icon: 'notifications-outline',
      iconColor: colors.textMuted,
      iconBg: 'rgba(255, 255, 255, 0.08)',
      onPress: () => nav.navigate('Notifications'),
    },
    {
      id: 'settings',
      title: 'Preferences',
      subtitle: 'Notification & App Settings',
      icon: 'settings-outline',
      iconColor: colors.textMuted,
      iconBg: 'rgba(255, 255, 255, 0.08)',
      onPress: () => nav.navigate('NotificationSettings'),
    },

  ];

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        {/* Backdrop */}
        <TouchableWithoutFeedback onPress={handleClose}>
          <Animated.View
            style={[
              styles.backdrop,
              {
                opacity: backdropOpacity,
              },
            ]}
          />
        </TouchableWithoutFeedback>

        {/* Sliding Drawer Container */}
        <Animated.View
          style={[
            styles.drawer,
            {
              width: DRAWER_WIDTH,
              paddingTop: Math.max(insets.top, 16),
              paddingBottom: Math.max(insets.bottom, 16),
              transform: [{ translateX }],
            },
          ]}
        >
          {/* Top Bar Header */}
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <Logo size={28} />
              <Text style={styles.brandTitle} numberOfLines={1}>
                Menu
              </Text>
            </View>
            <Pressable
              onPress={handleClose}
              style={styles.closeBtn}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close menu"
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>

          {/* Profile Card Section (Profile is nested inside the Hamburger Menu) */}
          <Pressable
            style={styles.profileCard}
            onPress={() => handleNavigate(() => nav.navigate('Profile'))}
            accessibilityRole="button"
            accessibilityLabel="View profile"
          >
            <View style={styles.profileAvatarWrap}>
              {user?.photoURL ? (
                <Image
                  source={user.photoURL}
                  style={styles.profileAvatar}
                  contentFit="cover"
                  accessibilityLabel="Your profile photo"
                />
              ) : (
                <View style={styles.profileAvatarFallback}>
                  <Ionicons name="person" size={20} color={colors.accent} />
                </View>
              )}
            </View>

            <View style={styles.profileInfo}>
              <Text style={styles.profileName} numberOfLines={1}>
                {user?.displayName || 'My Profile'}
              </Text>
              <Text style={styles.profileEmail} numberOfLines={1}>
                {user?.email || 'Tap to view account details'}
              </Text>
            </View>

            <View style={styles.profileArrow}>
              <Ionicons name="chevron-forward" size={18} color={colors.accent} />
            </View>
          </Pressable>

          <View style={styles.divider} />

          {/* Feature Items List */}
          <ScrollView
            style={styles.scrollList}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.sectionLabel}>ALL FEATURES</Text>

            {menuItems.map((item) => (
              <Pressable
                key={item.id}
                style={({ pressed }) => [
                  styles.menuItem,
                  pressed && { backgroundColor: 'rgba(255, 255, 255, 0.05)' },
                ]}
                onPress={() => handleNavigate(item.onPress)}
                accessibilityRole="button"
                accessibilityLabel={item.title}
              >
                <View
                  style={[
                    styles.itemIconCircle,
                    item.customImage && styles.itemImageCircle,
                    { backgroundColor: item.iconBg || 'rgba(255, 255, 255, 0.08)' },
                  ]}
                >
                  {item.customImage ? (
                    <Image source={item.customImage} style={styles.itemImage} contentFit="contain" />
                  ) : (
                    <Ionicons
                    name={item.icon!}
                    size={20}
                    color={item.iconColor || colors.text}
                  />
                  )}
                </View>

                <View style={styles.itemTextWrap}>
                  <View style={styles.itemTitleRow}>
                    <Text style={styles.itemTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    {item.badge ? (
                      <View
                        style={[
                          styles.itemBadge,
                          { backgroundColor: item.badgeBg || colors.primaryLight },
                        ]}
                      >
                        <Text
                          style={[
                            styles.itemBadgeText,
                            { color: item.badgeColor || colors.text },
                          ]}
                        >
                          {item.badge}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  {item.subtitle ? (
                    <Text style={styles.itemSubtitle} numberOfLines={1}>
                      {item.subtitle}
                    </Text>
                  ) : null}
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={colors.border}
                  style={styles.itemChevron}
                />
              </Pressable>
            ))}
          </ScrollView>

          {/* Footer Section */}
          <View style={styles.footer}>
            {user ? (
              <Pressable
                style={styles.signOutBtn}
                onPress={() => {
                  handleClose();
                  void signOut();
                }}
                accessibilityRole="button"
                accessibilityLabel="Sign out"
              >
                <Ionicons name="log-out-outline" size={18} color={colors.danger} />
                <Text style={styles.signOutText}>Sign Out</Text>
              </Pressable>
            ) : null}
            <Text style={styles.versionText}>Testimonies of Praise • v1.0.0</Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(18, 0, 28, 0.75)',
  },
  drawer: {
    height: '100%',
    backgroundColor: colors.surface,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 20,
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandTitle: {
    ...t.h2,
    fontSize: 20,
    color: colors.text,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 10,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  profileAvatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: colors.accent,
    overflow: 'hidden',
    backgroundColor: colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatar: {
    width: '100%',
    height: '100%',
  },
  profileAvatarFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: {
    flex: 1,
    gap: 2,
  },
  profileName: {
    ...t.h3,
    fontSize: 15,
    color: colors.text,
  },
  profileEmail: {
    ...t.caption,
    fontSize: 12,
    color: colors.textMuted,
  },
  profileArrow: {
    padding: 4,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 16,
    marginVertical: 4,
  },
  sectionLabel: {
    ...t.caps,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 1.2,
    paddingHorizontal: 8,
    paddingTop: 10,
    paddingBottom: 6,
  },
  scrollList: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingBottom: 20,
    gap: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    gap: 12,
  },
  itemIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Logo badges (ADOTOPOC) are detailed artwork: give them more room than a 20px icon.
  itemImageCircle: { width: 50, height: 50, borderRadius: 25, marginLeft: -6, marginRight: -6 },
  itemImage: { width: 50, height: 50 },
  itemTextWrap: {
    flex: 1,
    gap: 2,
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemTitle: {
    ...t.h3,
    fontSize: 14,
    color: colors.text,
  },
  itemSubtitle: {
    ...t.caption,
    fontSize: 11,
    color: colors.textMuted,
  },
  itemBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  itemBadgeText: {
    ...t.label,
    fontSize: 9,
    fontWeight: '800',
  },
  itemChevron: {
    marginLeft: 4,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
    alignItems: 'center',
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 107, 127, 0.1)',
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  signOutText: {
    ...t.label,
    fontSize: 12,
    color: colors.danger,
    fontWeight: '700',
  },
  versionText: {
    ...t.caption,
    fontSize: 10,
    color: colors.textMuted,
  },
});
