import { Linking } from 'react-native';
import { navigationRef } from '@/navigation/ref';

/**
 * Opens a support-message action button. In-app routes are mapped to known screens only (the server allows
 * the same first segments); anything unknown is ignored. Web links must be https and open in the browser.
 */
export function openSupportAction(action: { route?: string; url?: string }): void {
  if (action.url) {
    if (/^https:\/\//i.test(action.url)) void Linking.openURL(action.url);
    return;
  }
  if (!action.route || !navigationRef.isReady()) return;
  const [first, second, third] = action.route.replace(/^\/+/, '').split('/');
  const id = second && /^[A-Za-z0-9_-]{1,100}$/.test(second) ? second : undefined;
  switch (first) {
    case 'messages':
      if (id) navigationRef.navigate('Conversation', { threadId: id });
      else navigationRef.navigate('Messages');
      return;
    case 'choir':
      navigationRef.navigate('ChoirRequest');
      return;
    case 'sponsor':
      navigationRef.navigate('Sponsor');
      return;
    case 'share':
      navigationRef.navigate('ShareTestimony');
      return;
    case 'profile':
      navigationRef.navigate('Profile');
      return;
    case 'feedback':
      navigationRef.navigate('Feedback');
      return;
    case 'notifications':
      navigationRef.navigate('Notifications');
      return;
    case 'live':
      navigationRef.navigate('Tabs', { screen: 'Live' });
      return;
    case 'radio':
      navigationRef.navigate('Tabs', { screen: 'Listen' });
      return;
    case 'testimony':
      if (id) navigationRef.navigate('TestimonyDetails', { id });
      return;
    case 'written':
      if (id) navigationRef.navigate('WrittenTestimony', { id });
      return;
    case 'article':
      if (id) navigationRef.navigate('ArticleDetails', { id });
      return;
    case 'lyrical':
      if (id) navigationRef.navigate('LyricalAnalysisVideo', { id });
      return;
    case 'singers':
      if (id) navigationRef.navigate('LoveworldSingerVideo', { id });
      return;
    case 'correction':
      // Correction forms arrive with the corrections release; until then, open the matching form.
      if (second === 'choir') navigationRef.navigate('ChoirRequest');
      else if (second === 'sponsorship') navigationRef.navigate('Sponsor');
      void third;
      return;
    default:
  }
}
