import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { useAuth } from '@/auth/AuthContext';
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
  const { user, signOut, deleteAccount } = useAuth();
  const [busy, setBusy] = useState(false);

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
          {user?.photoURL ? (
            <Image source={user.photoURL} style={styles.avatar} accessibilityLabel="Profile photo" />
          ) : (
            <View style={[styles.avatar, styles.initials]}><Text style={styles.initialsText}>{initials(user?.displayName ?? user?.email)}</Text></View>
          )}
          <Text style={styles.name}>{user?.displayName ?? 'Friend'}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>
        <View style={{ gap: 8 }}>
          <Row icon="notifications-outline" label="Notification preferences" onPress={() => nav.navigate('NotificationSettings')} />
          <Row icon="download-outline" label="Downloads" onPress={() => nav.navigate('Tabs', { screen: 'Downloads' })} />
          <Row icon="heart-outline" label="Share your testimony" onPress={() => nav.navigate('ShareTestimony')} />
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
  name: { ...t.h2, color: colors.text },
  email: { ...t.body, color: colors.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 14, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  rowText: { ...t.h3, fontSize: 15, color: colors.text, flex: 1 },
});
