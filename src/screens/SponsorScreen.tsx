import React, { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/api/firebase';
import { uploadReceipt } from '@/api/cloudinary';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { TopBar } from '@/components/TopBar';
import { useAuth } from '@/auth/AuthContext';
import { CONFIG, isCloudinaryConfigured } from '@/constants/config';
import { colors, radius, type as t } from '@/constants/theme';

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <View style={styles.copyRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.copyLabel}>{label}</Text>
        <Text style={styles.copyValue}>{value}</Text>
      </View>
      <Text
        accessibilityRole="button"
        accessibilityLabel={`Copy ${label}`}
        onPress={async () => {
          await Clipboard.setStringAsync(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        style={styles.copyBtn}
      >
        {copied ? 'Copied' : 'Copy'}
      </Text>
    </View>
  );
}

export function SponsorScreen() {
  const nav = useNavigation();
  const { user } = useAuth();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickReceipt = async () => {
    setError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return setError('Please allow photo access to attach your receipt.');
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!res.canceled && res.assets[0]) setReceiptUri(res.assets[0].uri);
  };

  const submit = async () => {
    setError(null);
    if (!receiptUri) return setError('Please attach a photo of your transfer receipt.');
    setSubmitting(true);
    try {
      const receiptUrl = await uploadReceipt(receiptUri, `receipt-${Date.now()}.jpg`, 'image/jpeg');
      await addDoc(collection(db, 'sponsorships'), {
        uid: user?.uid,
        userEmail: user?.email ?? null,
        amount: amount.trim() || null,
        note: note.trim() || null,
        receiptUrl,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      setDone(true);
    } catch {
      setError('Something went wrong sending your receipt. Please try again.');
    }
    setSubmitting(false);
  };

  return (
    <Screen>
      <TopBar title="Sponsor Testimonies of Praise" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        {done ? (
          <View style={styles.success}>
            <Ionicons name="checkmark-circle" size={64} color={colors.success} />
            <Text style={styles.successText}>Thank you for your seed! We’ve received your receipt and will confirm it shortly.</Text>
            <PrimaryButton title="DONE" onPress={() => nav.goBack()} />
          </View>
        ) : (
          <>
            <Text style={styles.intro}>Every seed helps testimonies reach someone who needs to hear them. Thank you for sowing.</Text>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>BANK TRANSFER</Text>
              <CopyRow label="Bank" value={CONFIG.bank.bankName} />
              <CopyRow label="Account name" value={CONFIG.bank.accountName} />
              <CopyRow label="Account number" value={CONFIG.bank.accountNumber} />
              <Text style={styles.hint}>After transferring, attach your receipt below so we can confirm it.</Text>
            </View>

            <TextField label="Amount (optional)" value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="e.g. 5000" />
            <TextField label="Note (optional)" value={note} onChangeText={setNote} placeholder="Anything you'd like us to know" />

            <Text style={styles.label}>Transfer receipt *</Text>
            {receiptUri ? (
              <Image source={{ uri: receiptUri }} style={styles.preview} />
            ) : (
              <PrimaryButton title="ATTACH RECEIPT" icon="image-outline" variant="outline" onPress={() => void pickReceipt()} />
            )}
            {receiptUri ? <PrimaryButton title="CHANGE RECEIPT" variant="ghost" onPress={() => void pickReceipt()} /> : null}

            {!isCloudinaryConfigured ? <Text style={styles.warn}>Receipt uploads aren’t set up yet — ask an admin to finish setup.</Text> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <PrimaryButton title="SUBMIT" onPress={() => void submit()} loading={submitting} disabled={!isCloudinaryConfigured} />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  intro: { ...t.body, color: colors.textMuted },
  card: { gap: 10, padding: 16, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  cardTitle: { ...t.caps, color: colors.accent },
  copyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  copyLabel: { ...t.small, color: colors.textMuted },
  copyValue: { ...t.h3, fontSize: 15, color: colors.text },
  copyBtn: { ...t.small, color: colors.accent, fontWeight: '700' },
  hint: { ...t.small, color: colors.textMuted, marginTop: 4 },
  label: { ...t.small, color: colors.textMuted, fontWeight: '700' },
  preview: { width: '100%', height: 220, borderRadius: radius.md, backgroundColor: colors.card },
  warn: { ...t.small, color: colors.accent, textAlign: 'center' },
  error: { ...t.body, color: colors.danger, textAlign: 'center' },
  success: { alignItems: 'center', gap: 16, paddingTop: 40, paddingHorizontal: 8 },
  successText: { ...t.h3, fontSize: 16, color: colors.text, textAlign: 'center' },
});
