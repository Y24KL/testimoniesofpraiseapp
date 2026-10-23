import type { NotificationType } from '@/types';
import { navigationRef } from '@/navigation/ref';

export interface NotificationTarget {
  type?: NotificationType | string;
  contentId?: string;
}

/** Opens the exact screen a notification (push or in-app list item) points at. */
export function openTarget({ type, contentId }: NotificationTarget): void {
  if (!navigationRef.isReady()) return;
  switch (type) {
    case 'testimony':
    case 'featured':
      if (contentId) navigationRef.navigate('TestimonyDetails', { id: contentId });
      else navigationRef.navigate('Tabs', { screen: 'Testimonies' });
      break;
    case 'live':
      navigationRef.navigate('Tabs', { screen: 'Live' });
      break;
    case 'article':
      if (contentId) navigationRef.navigate('ArticleDetails', { id: contentId });
      else navigationRef.navigate('Articles');
      break;
    case 'promotion':
      navigationRef.navigate('Promotions');
      break;
    case 'radio':
      navigationRef.navigate('Tabs', { screen: 'Listen' });
      break;
    case 'resource':
      navigationRef.navigate('Adotopoc');
      break;
    default:
      navigationRef.navigate('Notifications');
  }
}
