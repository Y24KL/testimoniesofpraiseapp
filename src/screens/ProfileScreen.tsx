import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { uploadAvatar } from '@/api/cloudinary';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { useAuth } from '@/auth/AuthContext';
import { isCloudinaryConfigured } from '@/constants/config';
import { colors, radius, type as t } from '@/constants/theme';
import { unregisterPushToken } from '@/notifications/push';
import { authMessage } from '@/utils/errors';
import { initials } from '@/utils/format';

function Row({ icon, label, onPress }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.row} accessibilityRole="button" accessibilityLabel={label}>
      <Ionicons name={icon} size={22} color={colors.accent} />
      <Text style={styles.rowText}>{label}</Text>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </Pressable>
  );
}

export function ProfileScreen() {
  const nav = useNavigation();
  const { user, signOut, deleteAccount, updatePhoto } = useAuth();
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const choosePhoto = async () => {
    setPhotoError(null);
    if (!isCloudinaryConfigured) return setPhotoError('Photo uploads aren’t set up yet.');
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true, // lets the user crop
      aspect: [1, 1],
      quality: 0.6, // keeps the upload small on mobile data
    });
    if (res.canceled || !res.assets[0]) return;
    setPhotoBusy(true);
    try {
      const a = res.assets[0];
      const url = await uploadAvatar(a.uri, a.fileName ?? `avatar-${Date.now()}.jpg`, a.mimeType ?? 'image/jpeg');
      await updatePhoto(url);
    } catch (e) {
      console.log('AVATAR UPLOAD ERROR', e);
      // In development builds, show the real reason so setup problems are easy to spot.
      const reason = (e as Error)?.message;
      setPhotoError(__DEV__ && reason ? `Couldn’t update your photo: ${reason}` : 'We couldn’t update your photo. Please try again.');
    }
    setPhotoBusy(false);
  };

  const removePhoto = async () => {
    setPhotoError(null);
    setPhotoBusy(true);
    try {
      await updatePhoto(null);
    } catch {
      setPhotoError('We couldn’t remove your photo. Please try again.');
    }
    setPhotoBusy(false);
  };

  const photoMenu = () =>
    Alert.alert('Profile photo', undefined, [
      { text: user?.photoURL ? 'Choose a new photo' : 'Add a photo', onPress: () => void choosePhoto() },
      ...(user?.photoURL ? [{ text: 'Remove photo', style: 'destructive' as const, onPress: () => void removePhoto() }] : []),
      { text: 'Cancel', style: 'cancel' as const },
    ]);

  const logout = async () => {
    setBusy(true);
    await unregisterPushToken(); // stop this device receiving the signed-out user's notifications
    await signOut();
  };

  const confirmDelete = () =>
    Alert.alert('Delete account?', 'This permanently deletes your account. This can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await unregisterPushToken();
            await deleteAccount();
          } catch (e) {
            Alert.alert('Unable to delete account', authMessage(e));
          }
        },
      },
    ]);

  return (
    <Screen>
      <TopBar title="Profile" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 20 }}>
        <View style={styles.head}>
          <Pressable onPress={photoMenu} disabled={photoBusy} accessibilityRole="button" accessibilityLabel="Change profile photo">
            {user?.photoURL ? (
              <Image source={user.photoURL} style={styles.avatar} accessibilityLabel="Profile photo" />
            ) : (
              <View style={[styles.avatar, styles.initials]}><Text style={styles.initialsText}>{initials(user?.displayName ?? user?.email)}</Text></View>
            )}
            <View style={styles.badge}>
              {photoBusy ? <ActivityIndicator size="small" color={colors.bg} /> : <Ionicons name="camera" size={16} color={colors.bg} />}
            </View>
          </Pressable>
          {photoError ? <Text style={styles.photoError}>{photoError}</Text> : null}
          <Text style={styles.name}>{user?.displayName ?? 'Friend'}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>
        <View style={{ gap: 8 }}>
          <Row icon="notifications-outline" label="Notification preferences" onPress={() => nav.navigate('NotificationSettings')} />
          <Row icon="download-outline" label="Downloads" onPress={() => nav.navigate('Tabs', { screen: 'Downloads' })} />
          <Row icon="heart-outline" label="Share your testimony" onPress={() => nav.navigate('ShareTestimony')} />
          <Row icon="gift-outline" label="Sponsor Testimonies of Praise" onPress={() => nav.navigate('Sponsor')} />
        </View>
        <PrimaryButton title="LOG OUT" icon="log-out-outline" variant="outline" onPress={logout} loading={busy} />
        <PrimaryButton title="DELETE ACCOUNT" variant="danger" onPress={confirmDelete} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', gap: 6, paddingVertical: 8 },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.card },
  initials: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderWidth: 2, borderColor: colors.accent },
  initialsText: { ...t.h1, color: colors.accent },
  badge: { position: 'absolute', right: 0, bottom: 0, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.bg },
  photoError: { ...t.small, color: colors.danger, textAlign: 'center' },
  name: { ...t.h2, color: colors.text },
  email: { ...t.body, color: colors.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 14, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  rowText: { ...t.h3, fontSize: 15, color: colors.text, flex: 1 },
});
