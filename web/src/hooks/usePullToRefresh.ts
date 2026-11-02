import { useEffect } from 'react';

/** How far the finger must travel down (px) before the page reloads. */
const PULL_DISTANCE = 90;

/** True when no scrollable box between the touch and the page top has been scrolled away from 0. */
function insideTopOfScrollers(target: EventTarget | null): boolean {
  let node = target instanceof Element ? target : null;
  while (node && node !== document.body) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollTop > 0) return false;
    node = node.parentElement;
  }
  return true;
}

/**
 * Swipe down from the top of the page to reload it. iOS Safari has no pull-to-refresh on web pages, so this
 * gives iPhone users the same gesture. Only starts when the page and any scrolling box are at the top.
 */
export function usePullToRefresh() {
  useEffect(() => {
    let startY: number | null = null;

    const onStart = (e: TouchEvent) => {
      startY = window.scrollY === 0 && insideTopOfScrollers(e.target) ? e.touches[0].clientY : null;
    };
    const onMove = (e: TouchEvent) => {
      if (startY === null) return;
      if (e.touches[0].clientY - startY >= PULL_DISTANCE) {
        startY = null;
        window.location.reload();
      }
    };
    const onEnd = () => {
      startY = null;
    };

    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, []);
}
