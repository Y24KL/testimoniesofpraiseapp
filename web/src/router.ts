import { useEffect, useState } from 'react';

/**
 * Tiny hash router. Every screen has a real URL (`/#/live`, `/#/testimony/abc`) so refresh, the
 * browser back button, bookmarks and shared links work on any static host with no rewrite rules.
 * Older links without the slash (`#live`, `#testimony/abc`, `#radio`) keep working.
 */
export type Route =
  | { name: 'home' }
  | { name: 'testimonies' }
  | { name: 'live' }
  | { name: 'listen' }
  | { name: 'downloads' }
  | { name: 'testimony'; id: string }
  | { name: 'audio'; id: string }
  | { name: 'written' }
  | { name: 'writtenTestimony'; id: string }
  | { name: 'share' }
  | { name: 'sponsor' }
  | { name: 'notifications' }
  | { name: 'notificationSettings' }
  | { name: 'profile' }
  | { name: 'search' }
  | { name: 'promotions' }
  | { name: 'articles' }
  | { name: 'article'; id: string }
  | { name: 'adotopoc' }
  | { name: 'assistant' }
  // signed-out only
  | { name: 'signin' }
  | { name: 'signup' }
  | { name: 'forgot' };

export const TAB_ROUTES = new Set<Route['name']>(['home', 'testimonies', 'live', 'listen', 'downloads']);

const STATIC: Record<string, Route> = {
  '': { name: 'home' },
  home: { name: 'home' },
  testimonies: { name: 'testimonies' },
  live: { name: 'live' },
  listen: { name: 'listen' },
  radio: { name: 'listen' },
  downloads: { name: 'downloads' },
  share: { name: 'share' },
  sponsor: { name: 'sponsor' },
  notifications: { name: 'notifications' },
  'settings/notifications': { name: 'notificationSettings' },
  profile: { name: 'profile' },
  search: { name: 'search' },
  promotions: { name: 'promotions' },
  articles: { name: 'articles' },
  written: { name: 'written' },
  adotopoc: { name: 'adotopoc' },
  assistant: { name: 'assistant' },
  signin: { name: 'signin' },
  signup: { name: 'signup' },
  forgot: { name: 'forgot' },
};

export function parseHash(hash: string): Route {
  const path = decodeURIComponent(hash.replace(/^#\/?/, '').replace(/\/+$/, ''));
  if (path in STATIC) return STATIC[path];
  const w = path.match(/^written\/([^/?#]+)$/);
  if (w) return { name: 'writtenTestimony', id: w[1] };
  const m = path.match(/^(testimony|audio|article)\/([^/?#]+)$/);
  if (m) return m[1] === 'testimony' ? { name: 'testimony', id: m[2] } : m[1] === 'audio' ? { name: 'audio', id: m[2] } : { name: 'article', id: m[2] };
  return { name: 'home' };
}

export function pathFor(route: Route): string {
  switch (route.name) {
    case 'home':
      return '/';
    case 'testimony':
      return `/testimony/${encodeURIComponent(route.id)}`;
    case 'audio':
      return `/audio/${encodeURIComponent(route.id)}`;
    case 'writtenTestimony':
      return `/written/${encodeURIComponent(route.id)}`;
    case 'article':
      return `/article/${encodeURIComponent(route.id)}`;
    case 'notificationSettings':
      return '/settings/notifications';
    default:
      return `/${route.name}`;
  }
}

// Each in-app navigation stores its depth in history.state, so "back" from a deep link that was
// opened directly goes to Home instead of leaving the site.
const depth = (): number => (window.history.state && typeof window.history.state.topIdx === 'number' ? window.history.state.topIdx : 0);

export function navigate(route: Route, opts: { replace?: boolean } = {}) {
  const target = `#${pathFor(route)}`;
  if (window.location.hash === target || (target === '#/' && !window.location.hash)) return;
  if (opts.replace) window.history.replaceState({ topIdx: depth() }, '', target);
  else window.history.pushState({ topIdx: depth() + 1 }, '', target);
  window.dispatchEvent(new Event('top:navigate'));
  window.scrollTo({ top: 0 });
}

export function goBack(fallback: Route = { name: 'home' }) {
  if (depth() > 0) window.history.back();
  else navigate(fallback, { replace: true });
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    const events = ['hashchange', 'popstate', 'top:navigate'];
    events.forEach((e) => window.addEventListener(e, onChange));
    return () => events.forEach((e) => window.removeEventListener(e, onChange));
  }, []);
  return route;
}
