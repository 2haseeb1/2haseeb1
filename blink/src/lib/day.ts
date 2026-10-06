/**
 * Calendar helpers.
 *
 * Everything here is a pure function of local time — no Intl, no date library.
 * Hermes' Intl support varies by platform build, and a todo app that shows the
 * wrong day is worse than one that shows a plain `Fri, Oct 10`.
 */

export const MINUTE_MS = 60_000;
export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;

const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Local calendar day key, e.g. "2026-10-06". Sortable as a string. */
export function dayKey(ts: number): string {
  const d = new Date(ts);
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function dayKeyFromDate(d: Date): string {
  return dayKey(d.getTime());
}

/** Local midnight at the start of the day containing `ts`. */
export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Calendar-safe day arithmetic (handles month ends and DST shifts). */
export function addDays(ts: number, days: number): number {
  const d = new Date(ts);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

export function addDaysToKey(key: string, days: number): string {
  return dayKey(addDays(dateFromDayKey(key), days));
}

export function dateFromDayKey(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

export function isSameDay(a: number, b: number): boolean {
  return dayKey(a) === dayKey(b);
}

export function isToday(ts: number, now = Date.now()): boolean {
  return isSameDay(ts, now);
}

/**
 * The moment "today" started for planning purposes.
 *
 * With `rolloverHour = 4`, a task due yesterday is still fair game at 2am, which
 * is exactly what night owls expect. Rollover only affects *scheduling*; streaks
 * and the done-log stay on plain calendar days so history never rewrites itself.
 */
export function logicalDayStart(now: number, rolloverHour: number): number {
  const d = new Date(now);
  if (d.getHours() < rolloverHour) {
    d.setDate(d.getDate() - 1);
  }
  d.setHours(rolloverHour, 0, 0, 0);
  return d.getTime();
}

/** "5:00 PM" — 12-hour clock, no leading zero, locale-independent. */
export function formatTime(ts: number): string {
  const d = new Date(ts);
  const h24 = d.getHours();
  const minutes = d.getMinutes();
  const suffix = h24 < 12 ? 'AM' : 'PM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const mm = `${minutes}`.padStart(2, '0');
  return minutes === 0 ? `${h12} ${suffix}` : `${h12}:${mm} ${suffix}`;
}

/** "Today", "Tomorrow", "Yesterday", "Fri, Oct 10" (+ year when it differs). */
export function formatDayLabel(ts: number, now = Date.now()): string {
  const diff = daysBetween(now, ts);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  const d = new Date(ts);
  const base = `${DAYS_SHORT[d.getDay()]}, ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
  return d.getFullYear() === new Date(now).getFullYear()
    ? base
    : `${base}, ${d.getFullYear()}`;
}

/** Whole calendar days from `from` to `to` (negative when `to` is in the past). */
export function daysBetween(from: number, to: number): number {
  const a = new Date(from);
  a.setHours(0, 0, 0, 0);
  const b = new Date(to);
  b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

/**
 * Human due label for a task row.
 *
 * Note the absence of the word "overdue": unfinished work silently rolls forward
 * and is presented as due now. Guilt is not a retention feature.
 */
export function formatDue(
  ts: number | null,
  now = Date.now(),
  opts: { withTime?: boolean } = {}
): string {
  if (ts === null) return '';
  const withTime = opts.withTime ?? true;
  const diff = daysBetween(now, ts);
  const time = formatTime(ts);
  if (diff === 0) {
    if (ts < now) return withTime ? `Now · was ${time}` : 'Now';
    return withTime ? `Today ${time}` : 'Today';
  }
  if (diff === 1) return withTime ? `Tomorrow ${time}` : 'Tomorrow';
  if (diff < 0) return withTime ? `Rolled over · ${time}` : 'Rolled over';
  if (diff < 7) return withTime ? `${formatDayLabel(ts, now)} ${time}` : formatDayLabel(ts, now);
  return `${MONTHS_SHORT[new Date(ts).getMonth()]} ${new Date(ts).getDate()}${
    withTime ? ` · ${time}` : ''
  }`;
}

/** "3 days ago" / "just now" style label for the done log. */
export function formatRelative(ts: number, now = Date.now()): string {
  const diff = now - ts;
  if (diff < MINUTE_MS) return 'just now';
  if (diff < HOUR_MS) return `${Math.round(diff / MINUTE_MS)}m ago`;
  if (diff < DAY_MS) return `${Math.round(diff / HOUR_MS)}h ago`;
  const days = daysBetween(now, ts);
  if (days <= -1 && days > -7) return `${Math.abs(days)}d ago`;
  return formatDayLabel(ts, now);
}

/** The last `count` day keys ending with `now`'s day, oldest first. */
export function lastDayKeys(now: number, count: number): string[] {
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    keys.push(dayKey(addDays(now, -i)));
  }
  return keys;
}

/**
 * Consecutive days with at least one completion, counting back from today.
 *
 * A streak stays alive until the end of today if you finished something
 * yesterday — it only resets once a full day is missed.
 */
export function computeStreak(doneKeys: Iterable<string>, now = Date.now()): number {
  const set = new Set(doneKeys);
  let cursor = dayKey(now);
  if (!set.has(cursor)) {
    cursor = addDaysToKey(cursor, -1);
    if (!set.has(cursor)) return 0;
  }
  let streak = 0;
  while (set.has(cursor)) {
    streak += 1;
    cursor = addDaysToKey(cursor, -1);
  }
  return streak;
}

/** True when today's completions already extend the streak. */
export function completedToday(doneKeys: Iterable<string>, now = Date.now()): boolean {
  return new Set(doneKeys).has(dayKey(now));
}

export function hourFromClock(clock: string): number {
  const [h] = clock.split(':').map(Number);
  return Number.isFinite(h) ? h : 8;
}

export function minuteFromClock(clock: string): number {
  const [, m] = clock.split(':').map(Number);
  return Number.isFinite(m) ? m : 0;
}

/** Build a timestamp for `HH:mm` on the day containing `dayTs`. */
export function atClock(dayTs: number, hour: number, minute = 0): number {
  const d = new Date(dayTs);
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
}

/** Matches a string that begins with a URL scheme, e.g. `https://…` or `mailto:`. */
const URL_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;

export function titleCaseFirst(input: string): string {
  if (!input) return input;
  // Capitalising a link breaks it: `Https://example.com` is not a resolvable
  // scheme. Shared links reach the parser as task titles, so this matters.
  if (URL_SCHEME.test(input)) return input;
  const first = input.charAt(0);
  if (first === first.toUpperCase()) return input;
  return first.toUpperCase() + input.slice(1);
}
