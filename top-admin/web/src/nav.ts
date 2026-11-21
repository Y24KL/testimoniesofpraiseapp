import type { IconName } from './components/Icon';
import type { Route } from './types';

/** Pending-work counters shown beside sidebar entries and on the dashboard. */
export type CountKey = 'submissions' | 'choirRequests' | 'feedback' | 'sponsorships' | 'reports';

export interface NavItem {
  name: Route['name'];
  label: string;
  icon: IconName;
  count?: CountKey;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

/** Every entry is an existing admin page. Nothing here is a placeholder. */
export const NAV: NavGroup[] = [
  { title: 'Overview', items: [{ name: 'dashboard', label: 'Dashboard', icon: 'dashboard' }] },
  {
    title: 'Content Studio',
    items: [
      { name: 'testimonies', label: 'Video Testimonies', icon: 'video' },
      { name: 'written', label: 'Written Testimonies', icon: 'fileText' },
      { name: 'lyrical', label: 'Lyrical Analysis', icon: 'music' },
      { name: 'singers', label: 'LoveWorld Singers', icon: 'mic' },
      { name: 'articles', label: 'Articles & Updates', icon: 'newspaper' },
      { name: 'featuredChoirs', label: 'Featured Choirs', icon: 'users' },
      { name: 'promotions', label: 'Promotions', icon: 'megaphone' },
      { name: 'editorial', label: 'Daily Discovery', icon: 'sparkles' },
      { name: 'adotopoc', label: 'ADOTOPOC Resource Centre', icon: 'globe' },
      { name: 'media', label: 'Media & Storage', icon: 'hardDrive' },
    ],
  },
  {
    title: 'Community Management',
    items: [
      { name: 'submissions', label: 'Testimony Submissions', icon: 'inbox', count: 'submissions' },
      { name: 'choirRequests', label: 'Choir Requests', icon: 'userPlus', count: 'choirRequests' },
      { name: 'comments', label: 'Comments Moderation', icon: 'messageSquare' },
      { name: 'userFeedback', label: 'User Feedback', icon: 'messageCircle', count: 'feedback' },
      { name: 'sponsorships', label: 'Sponsorships', icon: 'heart', count: 'sponsorships' },
      { name: 'reports', label: 'Reports', icon: 'flag', count: 'reports' },
    ],
  },
  {
    title: 'Broadcast & Media',
    items: [
      { name: 'live', label: 'Live Stream', icon: 'radioTower' },
      { name: 'radio', label: 'TOP Radio', icon: 'radio' },
    ],
  },
  {
    title: 'Communication',
    items: [
      { name: 'announcements', label: 'Announcements', icon: 'send' },
      { name: 'notifications', label: 'Notification Centre', icon: 'bell' },
    ],
  },
  { title: 'System', items: [{ name: 'data', label: 'Data Management', icon: 'database' }] },
];

const ALL = NAV.flatMap((g) => g.items.map((i) => ({ ...i, group: g.title })));

/** The sidebar entry that owns a route. Editor routes belong to their list page. */
export function ownerOf(route: Route): Route['name'] {
  if (route.name === 'editor') return 'testimonies';
  if (route.name === 'articleEditor') return 'articles';
  if (route.name === 'writtenEditor') return 'written';
  return route.name;
}

export interface Crumb { label: string; route?: Route }

/** Page title and breadcrumb trail for the top bar. */
export function routeMeta(route: Route): { title: string; crumbs: Crumb[] } {
  const owner = ALL.find((i) => i.name === ownerOf(route));
  const group = owner?.group ?? 'Overview';
  const base: Crumb[] = [{ label: group }];
  if (route.name === 'editor' || route.name === 'articleEditor' || route.name === 'writtenEditor') {
    const isNew = !('id' in route) || !route.id;
    const noun = route.name === 'editor' ? 'testimony' : route.name === 'articleEditor' ? 'article' : 'written testimony';
    const title = isNew ? `New ${noun}` : `Edit ${noun}`;
    return { title, crumbs: [...base, { label: owner?.label ?? '', route: { name: ownerOf(route) } as Route }, { label: title }] };
  }
  return { title: owner?.label ?? 'Dashboard', crumbs: [...base, { label: owner?.label ?? 'Dashboard' }] };
}

/** Pages the global search can jump to directly. */
export const NAV_ITEMS = ALL;

/** Shortcuts offered in the top bar's quick-action menu and on the dashboard. */
export const QUICK_ACTIONS: { label: string; icon: IconName; route: Route }[] = [
  { label: 'Add testimony', icon: 'video', route: { name: 'editor' } },
  { label: 'Create written testimony', icon: 'fileText', route: { name: 'writtenEditor' } },
  { label: 'Go live', icon: 'radioTower', route: { name: 'live' } },
  { label: 'Add LoveWorld Singers video', icon: 'mic', route: { name: 'singers' } },
  { label: 'Write article', icon: 'newspaper', route: { name: 'articleEditor' } },
  { label: 'Send announcement', icon: 'send', route: { name: 'announcements' } },
  { label: 'Create promotion', icon: 'megaphone', route: { name: 'promotions' } },
];
