import { auth } from './firebase';

// The push relay and the media/verification relay are the same Cloudflare Worker. Fall back to
// VITE_WORKER_URL so a deployment that only sets that one still sends pushes (Render had only
// VITE_WORKER_URL, which silently turned every push into "in-app only").
const clean = (u?: string) => (u ? u.replace(/\[cite:[^\]]+\]/g, '').trim().replace(/\/$/, '') : '');
const URL_ = clean(import.meta.env.VITE_PUSH_URL as string | undefined) || clean(import.meta.env.VITE_WORKER_URL as string | undefined);
export const pushEnabled = /^https?:\/\//i.test(URL_);

export interface PushRequest {
  pref: 'testimonies' | 'live' | 'announcements' | 'promotions' | 'choirs' | 'loveworld' | 'articles';
  title: string;
  body: string;
  data: { type: string; contentId?: string };
}

/**
 * Sends a push through the free relay (worker/). The relay checks that the caller is an admin by
 * reading the device list with THEIR sign-in token, so nobody else can trigger notifications.
 */
export interface PushResult {
  ok: true;
  sent: number;
  failed: number;
  devices: number;
  reasons?: Record<string, number>;
  firstError?: string;
}

/** One-line summary of a relay result for the admin, including why sends failed. */
export function describePush(r: PushResult): string {
  if (r.devices === 0) return 'No phones are signed up for this notification type yet, so no push was sent.';
  let s = `Push sent to ${r.sent} of ${r.devices} device${r.devices === 1 ? '' : 's'}.`;
  if (r.failed) {
    const why = Object.entries(r.reasons ?? {}).map(([k, n]) => `${k} ×${n}`).join(', ');
    s += ` ${r.failed} failed${why ? ` (${why})` : ''}${r.firstError ? `: ${r.firstError}` : ''}.`;
  }
  return s;
}

export async function sendPush(req: PushRequest): Promise<PushResult | { ok: false; error: string }> {
  if (!URL_) return { ok: false, error: 'Push relay is not configured.' };
  try {
    const token = await auth.currentUser?.getIdToken();
    if (!token) return { ok: false, error: 'You are signed out.' };
    const res = await fetch(URL_, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: j.error ?? `Relay error (${res.status}).` };
    return { ok: true, sent: j.sent ?? 0, failed: j.failed ?? 0, devices: j.devices ?? 0, reasons: j.reasons, firstError: j.firstError };
  } catch {
    return { ok: false, error: 'Could not reach the push relay.' };
  }
}
