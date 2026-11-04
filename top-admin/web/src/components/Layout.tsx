import type { ReactNode } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import type { Route } from '../types';

/** Sidebar sections. Each item is an existing admin page; nothing here is a placeholder. */
const SECTIONS: { title: string; items: { name: Route['name']; label: string }[] }[] = [
  {
    title: 'Overview',
    items: [{ name: 'dashboard', label: 'Dashboard' }],
  },
  {
    title: 'Content',
    items: [
      { name: 'testimonies', label: 'Testimonies' },
      { name: 'written', label: 'Written testimonies' },
      { name: 'lyrical', label: 'Lyrical Analysis' },
      { name: 'singers', label: 'LoveWorld Singers' },
      { name: 'articles', label: 'Articles & Updates' },
      { name: 'adotopoc', label: 'ADOTOPOC Config' },
      { name: 'media', label: 'Media & Storage' },
    ],
  },
  {
    title: 'Community',
    items: [
      { name: 'submissions', label: 'Submissions' },
      { name: 'featuredChoirs', label: 'Featured choirs' },
      { name: 'choirRequests', label: 'Choir requests' },
      { name: 'comments', label: 'Comments' },
      { name: 'sponsorships', label: 'Sponsorships' },
    ],
  },
  {
    title: 'Broadcast',
    items: [
      { name: 'live', label: 'Live stream' },
      { name: 'radio', label: 'TOP Radio' },
    ],
  },
  {
    title: 'Communication',
    items: [
      { name: 'announcements', label: 'Announcements' },
      { name: 'promotions', label: 'Promotions' },
    ],
  },
  {
    title: 'Administration',
    items: [{ name: 'data', label: 'Data' }],
  },
];

export function Layout({ route, go, children }: { route: Route; go: (r: Route) => void; children: ReactNode }) {
  const active = route.name === 'editor' ? 'testimonies' : route.name === 'articleEditor' ? 'articles' : route.name === 'writtenEditor' ? 'written' : route.name;
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <img src="/logo.png" alt="" />
          <div><b>TESTIMONIES OF PRAISE</b><div className="small muted">App admin</div></div>
        </div>
        {SECTIONS.map((section) => (
          <nav key={section.title} aria-label={section.title} style={{ display: 'grid', gap: 2 }}>
            <div className="small muted" style={{ padding: '10px 12px 4px', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 11 }}>{section.title}</div>
            {section.items.map((n) => (
              <button key={n.name} className={`nav ${active === n.name ? 'on' : ''}`} onClick={() => go({ name: n.name } as Route)} aria-current={active === n.name ? 'page' : undefined}>
                {n.label}
              </button>
            ))}
          </nav>
        ))}
        <div className="spacer" />
        <div className="small muted" style={{ padding: '0 12px', wordBreak: 'break-all' }}>{auth.currentUser?.email}</div>
        <button className="nav" onClick={() => void signOut(auth)}>Sign out</button>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
