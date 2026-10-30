import React from 'react';
import { CloudDownload, Headphones, Home, PlayCircle, Sparkles, Video } from 'lucide-react';
import { navigate, type Route } from '../router';

export type TabName = 'home' | 'testimonies' | 'live' | 'listen' | 'assistant' | 'downloads';

export const TABS: { id: TabName; label: string; icon: React.FC<{ size?: number }> }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'testimonies', label: 'Testimonies', icon: PlayCircle },
  { id: 'live', label: 'Live', icon: Video },
  { id: 'listen', label: 'Listen', icon: Headphones },
  { id: 'assistant', label: 'Assistant', icon: Sparkles },
  { id: 'downloads', label: 'Saved', icon: CloudDownload },
];

/** Phone/tablet tab bar (hidden on desktop, where the sidebar takes over). */
export function BottomNavigation({ current }: { current: Route['name'] }) {
  return (
    <div className="bottom-nav-wrap">
      <nav className="bottom-nav" role="tablist" aria-label="Main navigation">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = current === id;
          return (
            <button key={id} type="button" role="tab" aria-selected={active} aria-label={label} onClick={() => navigate({ name: id } as Route)}>
              <span className="pill">
                <Icon size={22} />
              </span>
              {label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
