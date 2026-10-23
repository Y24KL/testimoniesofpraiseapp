import React from 'react';
import { Bell, BookOpen, Globe, Heart, HandCoins, Megaphone, Search, Settings, User } from 'lucide-react';
import { navigate, type Route } from '../router';
import { TABS } from './BottomNavigation';

const MORE: { route: Route; label: string; icon: React.FC<{ size?: number }> }[] = [
  { route: { name: 'search' }, label: 'Search', icon: Search },
  { route: { name: 'articles' }, label: 'Articles', icon: BookOpen },
  { route: { name: 'adotopoc' }, label: 'ADOTOPOC', icon: Globe },
  { route: { name: 'promotions' }, label: 'Events', icon: Megaphone },
  { route: { name: 'share' }, label: 'Share testimony', icon: Heart },
  { route: { name: 'sponsor' }, label: 'Sponsor TOP', icon: HandCoins },
];

const ACCOUNT: { route: Route; label: string; icon: React.FC<{ size?: number }> }[] = [
  { route: { name: 'notifications' }, label: 'Notifications', icon: Bell },
  { route: { name: 'notificationSettings' }, label: 'Preferences', icon: Settings },
  { route: { name: 'profile' }, label: 'Profile', icon: User },
];

/** Desktop sidebar: every main section one click away. */
export function SideNav({ current, isLive }: { current: Route['name']; isLive: boolean }) {
  const link = (route: Route, label: string, Icon: React.FC<{ size?: number }>, extra?: React.ReactNode) => (
    <button key={label} type="button" className="side-link" aria-current={current === route.name ? 'page' : undefined} onClick={() => navigate(route)}>
      <Icon size={20} />
      {label}
      {extra}
    </button>
  );
  return (
    <aside className="side-nav" aria-label="Main navigation">
      <button type="button" className="side-brand" onClick={() => navigate({ name: 'home' })} aria-label="Testimonies of Praise home">
        <picture>
          <source srcSet="/logo.webp" type="image/webp" />
          <img src="/logo.png" alt="" width={61} height={44} />
        </picture>
        <span>
          Testimonies
          <br />
          of Praise
        </span>
      </button>
      {TABS.map((t) => link({ name: t.id } as Route, t.label, t.icon, t.id === 'live' && isLive ? <span className="live-dot pulse" aria-label="Live now" /> : null))}
      <div className="side-section">Discover</div>
      {MORE.map((m) => link(m.route, m.label, m.icon))}
      <div className="side-section">Account</div>
      {ACCOUNT.map((m) => link(m.route, m.label, m.icon))}
    </aside>
  );
}
