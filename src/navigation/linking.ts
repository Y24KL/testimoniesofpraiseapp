import * as Linking from 'expo-linking';
import type { LinkingOptions } from '@react-navigation/native';
import type { RootStackParamList } from './types';

/**
 * testimoniesofpraise://testimony/{id}
 * testimoniesofpraise://live
 * A link that arrives while signed out is dropped (the auth screens are shown instead).
 */
export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['testimoniesofpraise://', Linking.createURL('/', { scheme: 'testimoniesofpraise' })],
  config: {
    screens: {
      Tabs: { screens: { Live: 'live' } },
      TestimonyDetails: 'testimony/:id',
    },
  },
};
