/**
 * Audience selection over device registrations (the pushTokens collection). Pure: the caller loads the
 * devices and the recent send counts, and gets back who should receive a notification, and when.
 */
import { capDecision, DEFAULT_OFFSET_MINUTES, isInQuietHours, nextSendableUtc } from './policy.js';

const PLATFORMS = new Set(['android', 'ios']);

export function isUsableDevice(device) {
  return Boolean(
    device &&
      typeof device.token === 'string' &&
      /^Expo(nent)?PushToken\[.+\]$/.test(device.token) &&
      typeof device.uid === 'string' &&
      device.uid.length > 0 &&
      device.prefs &&
      typeof device.prefs === 'object' &&
      PLATFORMS.has(device.platform) &&
      (device.utcOffsetMinutes === undefined || (Number.isInteger(device.utcOffsetMinutes) && Math.abs(device.utcOffsetMinutes) <= 840)),
  );
}

/**
 * devices: [{ token, uid, platform, prefs, utcOffsetMinutes? }]
 * options: { category, nowUtcMs, quiet, caps, sentLast24h: { uid: { total, byCategory } }, defaultOffsetMinutes }
 *
 * The frequency cap applies per user, so a person with several devices is counted once. A user over the cap
 * is skipped. A user inside quiet hours is kept, with `sendAfterUtc` set to the end of quiet hours.
 */
export function selectAudience(devices, { category, nowUtcMs, quiet = null, caps = {}, sentLast24h = {}, defaultOffsetMinutes = DEFAULT_OFFSET_MINUTES }) {
  const skipped = { invalid: 0, duplicate: 0, prefOff: 0, cap: 0 };
  const decisions = new Map(); // uid -> { allowed, sendAfterUtc } so the cap is evaluated once per person
  const seenTokens = new Set();
  const recipients = [];
  let deferred = 0;

  for (const device of devices) {
    if (!isUsableDevice(device)) {
      skipped.invalid += 1;
      continue;
    }
    if (seenTokens.has(device.token)) {
      skipped.duplicate += 1;
      continue;
    }
    seenTokens.add(device.token);
    if (device.prefs[category] !== true) {
      skipped.prefOff += 1;
      continue;
    }

    if (!decisions.has(device.uid)) {
      const offset = Number.isInteger(device.utcOffsetMinutes) ? device.utcOffsetMinutes : defaultOffsetMinutes;
      const cap = capDecision(sentLast24h[device.uid], category, caps);
      decisions.set(device.uid, {
        allowed: cap.allowed,
        offset,
        sendAfterUtc: isInQuietHours(nowUtcMs, offset, quiet) ? nextSendableUtc(nowUtcMs, offset, quiet) : nowUtcMs,
      });
    }
    const decision = decisions.get(device.uid);
    if (!decision.allowed) {
      skipped.cap += 1;
      continue;
    }
    if (decision.sendAfterUtc > nowUtcMs) deferred += 1;
    recipients.push({ token: device.token, uid: device.uid, platform: device.platform, sendAfterUtc: decision.sendAfterUtc });
  }

  return { recipients, deferred, skipped };
}
