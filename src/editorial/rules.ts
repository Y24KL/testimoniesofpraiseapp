/**
 * Editorial rules for the Home "Daily discovery" section. The admin writes the configuration, and these rules
 * decide what is shown. Nothing here generates content: a slot with nothing configured, or nothing published,
 * is simply not shown.
 */

export const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export interface Inspiration {
  text: string;
  source: string;
}

export interface RadioEntry {
  weekday: Weekday;
  /** Local time in the programme's own zone, "HH:MM" on a 24-hour clock. */
  localTime: string;
  /** Fixed offset from UTC in minutes. GMT+1 is 60. */
  utcOffsetMinutes: number;
  /** How the admin wants the zone shown, for example "GMT+1". */
  timeZoneLabel: string;
  title: string;
  /** Only confirmed entries are shown to people. */
  confirmed: boolean;
}

export interface Editorial {
  inspirations: Inspiration[];
  radioSchedule: RadioEntry[];
  featuredIds: { testimony?: string; lyrical?: string; article?: string };
  highlightChoirIds: string[];
}

export const EDITORIAL_LIMITS = { inspirations: 30, inspirationChars: 280, radio: 7, titleChars: 120, highlights: 6 } as const;
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/g;
const ID = /^[A-Za-z0-9_-]{1,100}$/;
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(CONTROL, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** Keeps only valid, well-formed entries. Anything else in the stored document is dropped. */
export function sanitizeEditorial(raw: unknown): Editorial {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

  const inspirations: Inspiration[] = [];
  if (Array.isArray(d.inspirations)) {
    for (const item of d.inspirations) {
      const t = text(typeof item === 'string' ? item : (item as Record<string, unknown>)?.text, EDITORIAL_LIMITS.inspirationChars);
      if (!t) continue;
      inspirations.push({ text: t, source: text((item as Record<string, unknown>)?.source, 120) });
      if (inspirations.length >= EDITORIAL_LIMITS.inspirations) break;
    }
  }

  const radioSchedule: RadioEntry[] = [];
  if (Array.isArray(d.radioSchedule)) {
    for (const item of d.radioSchedule) {
      const r = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
      const weekday = WEEKDAYS.find((w) => w === r.weekday);
      const localTime = typeof r.localTime === 'string' && TIME.test(r.localTime) ? r.localTime : null;
      const offset = r.utcOffsetMinutes;
      if (!weekday || !localTime || !Number.isInteger(offset) || Math.abs(offset as number) > 840) continue;
      radioSchedule.push({
        weekday,
        localTime,
        utcOffsetMinutes: offset as number,
        timeZoneLabel: text(r.timeZoneLabel, 40),
        title: text(r.title, EDITORIAL_LIMITS.titleChars),
        confirmed: r.confirmed === true,
      });
      if (radioSchedule.length >= EDITORIAL_LIMITS.radio) break;
    }
  }

  const f = (d.featuredIds && typeof d.featuredIds === 'object' ? d.featuredIds : {}) as Record<string, unknown>;
  const featuredIds: Editorial['featuredIds'] = {};
  for (const kind of ['testimony', 'lyrical', 'article'] as const) {
    if (typeof f[kind] === 'string' && ID.test(f[kind] as string)) featuredIds[kind] = f[kind] as string;
  }

  const highlightChoirIds = Array.isArray(d.highlightChoirIds)
    ? [...new Set(d.highlightChoirIds.filter((x): x is string => typeof x === 'string' && ID.test(x)))].slice(0, EDITORIAL_LIMITS.highlights)
    : [];

  return { inspirations, radioSchedule, featuredIds, highlightChoirIds };
}

/** The inspiration for a day. It rotates through the admin's list by day, and is null when the list is empty. */
export function pickInspiration(list: Inspiration[], nowUtcMs: number): Inspiration | null {
  if (list.length === 0) return null;
  const dayNumber = Math.floor(nowUtcMs / 86400000);
  return list[((dayNumber % list.length) + list.length) % list.length];
}

const DAY_MS = 86400000;

/**
 * The next confirmed broadcast at or after `nowUtcMs`, within the next 7 days. The local time is converted with
 * the entry's fixed offset, so Wednesday 13:00 at GMT+1 is Wednesday 12:00 UTC. Returns null if none is due.
 */
export function nextBroadcast(entries: RadioEntry[], nowUtcMs: number): { atUtcMs: number; entry: RadioEntry } | null {
  let best: { atUtcMs: number; entry: RadioEntry } | null = null;
  for (const entry of entries) {
    if (!entry.confirmed) continue;
    const [hh, mm] = entry.localTime.split(':').map(Number);
    const offsetMs = entry.utcOffsetMinutes * 60000;
    const localNow = new Date(nowUtcMs + offsetMs);
    for (let add = 0; add <= 7; add += 1) {
      const day = new Date(Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate() + add));
      if (WEEKDAYS[day.getUTCDay()] !== entry.weekday) continue;
      const atUtcMs = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hh, mm) - offsetMs;
      // Every matching weekday in the window is considered: today's broadcast may already have started.
      if (atUtcMs >= nowUtcMs && atUtcMs - nowUtcMs <= 7 * DAY_MS && (!best || atUtcMs < best.atUtcMs)) best = { atUtcMs, entry };
    }
  }
  return best;
}
