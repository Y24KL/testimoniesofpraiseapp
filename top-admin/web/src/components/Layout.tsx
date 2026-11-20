import { useEffect, useRef, useState, type ReactNode } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import type { Route } from '../types';
import { NAV, QUICK_ACTIONS, ownerOf, routeMeta } from '../nav';
import { badgeCount, usePendingCounts } from '../hooks/usePendingCounts';
import { Icon } from './Icon';
import { GlobalSearch } from './GlobalSearch';

const COLLAPSE_KEY = 'top.admin.sidebarCollapsed';
const readCollapsed = () => {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
};

/** Closes a popover on outside click or Escape. */
function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey); };
  }, [open]);
  return { open, setOpen, ref };
}

export function Layout({ route, go, children }: { route: Route; go: (r: Route) => void; children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [drawer, setDrawer] = useState(false);
  const { counts } = usePendingCounts();
  const quick = usePopover();
  const account = usePopover();
  const active = ownerOf(route);
  const meta = routeMeta(route);
  const email = auth.currentUser?.email ?? '';
  const initial = (email[0] ?? 'A').toUpperCase();
  const queue = badgeCount(counts.notificationQueue);

  useEffect(() => {
    try {
      window.localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
    } catch {
      /* private mode: the preference just isn't remembered */
    }
  }, [collapsed]);

  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawer(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawer]);

  useEffect(() => {
    document.title = `${meta.title} · T.O.P Admin`;
    window.scrollTo({ top: 0 });
  }, [meta.title]);

  const navigate = (r: Route) => {
    go(r);
    setDrawer(false);
    quick.setOpen(false);
  };

  return (
    <div className={`app-shell ${collapsed ? 'collapsed' : ''} ${drawer ? 'drawer-open' : ''}`}>
      <div className="scrim" onClick={() => setDrawer(false)} aria-hidden="true" />
      <aside className="sidebar" aria-label="Main navigation">
        <div className="side-brand">
          <img src="/logo.png" alt="" />
          <div className="titles">
            <div className="t1">TESTIMONIES OF PRAISE</div>
            <div className="t2">ADMIN CONTROL CENTRE</div>
          </div>
        </div>
        <nav className="side-nav">
          {NAV.map((group) => (
            <div key={group.title} className="side-group">
              <div className="side-group-title">{group.title}</div>
              {group.items.map((item) => {
                const n = item.count ? badgeCount(counts[item.count]) : null;
                const on = active === item.name;
                return (
                  <button
                    key={item.name}
                    type="button"
                    className={`side-link ${on ? 'active' : ''}`}
                    aria-current={on ? 'page' : undefined}
                    title={collapsed ? `${item.label}${n ? ` (${n})` : ''}` : undefined}
                    onClick={() => navigate({ name: item.name } as Route)}
                  >
                    <Icon name={item.icon} size={18} />
                    <span className="label">{item.label}</span>
                    {n ? <span className="side-count" aria-label={`${n} pending`}>{n > 99 ? '99+' : n}</span> : null}
                    {n ? <span className="count-dot" aria-hidden="true" /> : null}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="side-footer">
          <div className="side-profile" title={collapsed ? email : undefined}>
            <span className="avatar" aria-hidden="true">{initial}</span>
            <div className="who">
              <b>Administrator</b>
              <span>{email}</span>
            </div>
          </div>
          <button type="button" className="side-link" onClick={() => void signOut(auth)} title={collapsed ? 'Sign out' : undefined}>
            <Icon name="logOut" size={18} />
            <span className="label">Sign out</span>
          </button>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <button type="button" className="icon-btn menu-toggle" aria-label="Open navigation" aria-expanded={drawer} onClick={() => setDrawer(true)}>
            <Icon name="menu" />
          </button>
          <button type="button" className="icon-btn collapse-toggle" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-pressed={collapsed} onClick={() => setCollapsed((c) => !c)}>
            <Icon name="panelLeft" />
          </button>
          <div className="title-area">
            <nav className="crumbs" aria-label="Breadcrumb">
              {meta.crumbs.map((c, i) => (
                <span key={`${c.label}-${i}`} className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                  {i > 0 ? <span className="sep">/</span> : null}
                  {c.route ? <button type="button" onClick={() => navigate(c.route!)}>{c.label}</button> : <span>{c.label}</span>}
                </span>
              ))}
            </nav>
            <div className="page-name">{meta.title}</div>
          </div>

          <GlobalSearch go={navigate} />

          <div className="pos-rel" ref={quick.ref}>
            <button type="button" className="btn primary small" aria-haspopup="menu" aria-expanded={quick.open} onClick={() => quick.setOpen((o) => !o)}>
              <Icon name="plus" size={16} /><span className="quick-label">Quick action</span>
            </button>
            {quick.open ? (
              <div className="menu" role="menu" style={{ right: 0, top: 'calc(100% + 8px)' }}>
                {QUICK_ACTIONS.map((a) => (
                  <button key={a.label} type="button" role="menuitem" className="menu-item" onClick={() => navigate(a.route)}>
                    <Icon name={a.icon} size={16} />{a.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <button type="button" className="icon-btn" aria-label={queue ? `Notification Centre, ${queue} awaiting approval` : 'Notification Centre'} title="Notifications awaiting approval" onClick={() => navigate({ name: 'notifications' })}>
            <Icon name="bell" />
            {queue ? <span className="dot-badge">{queue > 9 ? '9+' : queue}</span> : null}
          </button>

          <div className="account pos-rel" ref={account.ref}>
            <span className="account-email">{email}</span>
            <button type="button" className="icon-btn" style={{ padding: 0, border: 0, background: 'none' }} aria-label="Account menu" aria-haspopup="menu" aria-expanded={account.open} onClick={() => account.setOpen((o) => !o)}>
              <span className="avatar">{initial}</span>
            </button>
            {account.open ? (
              <div className="menu" role="menu" style={{ right: 0, top: 'calc(100% + 8px)' }}>
                <div style={{ padding: '8px 10px' }}>
                  <b className="small">Administrator</b>
                  <div className="small muted wrap-anywhere">{email}</div>
                </div>
                <div className="menu-sep" />
                <button type="button" role="menuitem" className="menu-item" onClick={() => void signOut(auth)}>
                  <Icon name="logOut" size={16} />Sign out
                </button>
              </div>
            ) : null}
          </div>
        </header>
        <main className="main" key={route.name}>{children}</main>
      </div>
    </div>
  );
}
