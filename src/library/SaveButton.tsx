import React, { useState } from 'react';
import { Alert } from 'react-native';
import { useAuth } from '@/auth/AuthContext';
import { PrimaryButton } from '@/components/PrimaryButton';
import type { LibraryKind } from './rules';
import { useIsSaved } from './hooks';
import { saveItem, unsaveItem, type SaveInput } from './service';

interface Props extends SaveInput {
  style?: object;
}

/** Adds or removes an item from My T.O.P. Shows the current state, and asks to sign in when there is no account. */
export function SaveButton({ kind, id, title, subtitle, thumbnail, style }: Props & { kind: LibraryKind }) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const { saved, ready } = useIsSaved(uid, kind, id);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (!uid) {
      Alert.alert('Sign in to save', 'Sign in to add this to My T.O.P. and find it on any device.');
      return;
    }
    setBusy(true);
    try {
      if (saved) await unsaveItem(uid, kind, id);
      else await saveItem(uid, { kind, id, title, subtitle, thumbnail });
    } catch {
      Alert.alert('Could not update My T.O.P.', 'Please check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <PrimaryButton
      title={saved ? 'Saved to My T.O.P.' : 'Save to My T.O.P.'}
      icon={saved ? 'bookmark' : 'bookmark-outline'}
      variant="outline"
      loading={busy}
      disabled={uid !== null && !ready}
      onPress={() => void toggle()}
      style={style}
      accessibilityHint={saved ? 'Removes this from My T.O.P.' : 'Adds this to My T.O.P.'}
    />
  );
}
