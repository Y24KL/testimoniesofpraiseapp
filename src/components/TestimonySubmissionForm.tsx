import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, type as t } from '@/constants/theme';
import { PrimaryButton } from './PrimaryButton';
import { TextField } from './TextField';

export interface SubmissionValues {
  fullName: string;
  churchZone: string;
  testimony: string;
}

interface Props {
  initialName?: string;
  submitting: boolean;
  error?: string | null;
  onSubmit: (v: SubmissionValues) => void;
}

const MIN_LENGTH = 20;

export function TestimonySubmissionForm({ initialName = '', submitting, error, onSubmit }: Props) {
  const [fullName, setFullName] = useState(initialName);
  const [churchZone, setChurchZone] = useState('');
  const [testimony, setTestimony] = useState('');
  const [touched, setTouched] = useState(false);

  const errs = {
    fullName: fullName.trim() ? '' : 'Please enter your full name.',
    churchZone: churchZone.trim() ? '' : 'Please enter your church zone.',
    testimony: testimony.trim().length >= MIN_LENGTH ? '' : `Please share a little more (at least ${MIN_LENGTH} characters).`,
  };
  const valid = !errs.fullName && !errs.churchZone && !errs.testimony;

  return (
    <View style={{ gap: 16 }}>
      <TextField label="Full Name" value={fullName} onChangeText={setFullName} autoCapitalize="words" textContentType="name" error={touched ? errs.fullName : undefined} />
      <TextField label="Church Zone" value={churchZone} onChangeText={setChurchZone} autoCapitalize="words" error={touched ? errs.churchZone : undefined} />
      <TextField
        label="Your Testimony"
        value={testimony}
        onChangeText={setTestimony}
        multiline
        textAlignVertical="top"
        style={{ minHeight: 160 }}
        maxLength={5000}
        error={touched ? errs.testimony : undefined}
      />
      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
      <PrimaryButton
        title="SUBMIT TESTIMONY"
        icon="paper-plane-outline"
        loading={submitting}
        onPress={() => {
          setTouched(true);
          if (valid) onSubmit({ fullName: fullName.trim(), churchZone: churchZone.trim(), testimony: testimony.trim() });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({ error: { ...t.body, color: colors.danger, textAlign: 'center' } });
