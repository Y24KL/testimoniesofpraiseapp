import { auth } from './firebase';

const URL_ = import.meta.env.VITE_PUSH_URL as string | undefined;
export const pushEnabled = Boolean(URL_);

export interface PushRequest {
  pref: 'testimonies' | 'live' | 'announcements';
  title: string;
  body: string;
  data: { type: string; contentId?: string };
}

/**
 * Sends a push through the free relay (worker/). The relay checks that the caller is an admin by
 * reading the device list with THEIR sign-in token, so nobody else can trigger notifications.
 */
export async function sendPush(req: PushRequest): Promise<{ ok: true; sent: number } | { ok: false; error: string }> {
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
    return { ok: true, sent: j.sent ?? 0 };
  } catch {
    return { ok: false, error: 'Could not reach the push relay.' };
  }
}
