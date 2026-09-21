import type { ReactNode } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import type { Route } from '../types';

const NAV: { name: Route['name']; label: string }[] = [
  { name: 'dashboard', label: 'Dashboard' },
  { name: 'testimonies', label: 'Testimonies' },
  { name: 'live', label: 'Live stream' },
  { name: 'submissions', label: 'Submissions' },
  { name: 'announcements', label: 'Announcements' },
];

export function Layout({ route, go, children }: { route: Route; go: (r: Route) => void; children: ReactNode }) {
  const active = route.name === 'editor' ? 'testimonies' : route.name;
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <img src="/logo.png" alt="" />
          <div><b>TESTIMONIES OF PRAISE</b><div className="small muted">App admin</div></div>
        </div>
        {NAV.map((n) => (
          <button key={n.name} className={`nav ${active === n.name ? 'on' : ''}`} onClick={() => go({ name: n.name } as Route)}>
            {n.label}
          </button>
        ))}
        <div className="spacer" />
        <div className="small muted" style={{ padding: '0 12px', wordBreak: 'break-all' }}>{auth.currentUser?.email}</div>
        <button className="nav" onClick={() => void signOut(auth)}>Sign out</button>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
