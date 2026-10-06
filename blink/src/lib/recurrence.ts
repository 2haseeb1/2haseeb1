/**
 * Recurrence maths — pure, timezone-aware, and deliberately boring.
 *
 * Naive `+ 7 * 24h` arithmetic drifts twice a year and lands tasks at 3am after a
 * DST shift. Everything here rebuilds a local calendar date and re-applies the
 * original wall-clock time instead.
 */

import { addDays, atClock } from './day';
import type { Recurrence } from './types';

/** Days of week (0=Sun) that a recurrence fires on. */
export function recurrenceDays(recurrence: Recurrence, anchorDow: number): number[] {
  switch (recurrence.kind) {
    case 'daily':
      return [0, 1, 2, 3, 4, 5, 6];
    case 'weekly':
      return recurrence.days.length > 0 ? recurrence.days : [anchorDow];
    case 'every':
      return [];
  }
}

/**
 * First occurrence strictly after `after`, at the given wall-clock time.
 *
 * @param anchorDow weekday used when a weekly rule has no explicit days.
 */
export function nextOccurrenceAfter(
  recurrence: Recurrence,
  after: number,
  hour: number,
  minute: number,
  anchorDow: number
): number {
  switch (recurrence.kind) {
    case 'daily': {
      const today = atClock(after, hour, minute);
      return today > after ? today : atClock(addDays(after, 1), hour, minute);
    }
    case 'weekly': {
      const days = recurrenceDays(recurrence, anchorDow);
      for (let offset = 0; offset <= 7; offset++) {
        const candidateDay = addDays(after, offset);
        if (!days.includes(new Date(candidateDay).getDay())) continue;
        const candidate = atClock(candidateDay, hour, minute);
        if (candidate > after) return candidate;
      }
      // Unreachable while `days` is non-empty, but keeps the signature total.
      return atClock(addDays(after, 7), hour, minute);
    }
    case 'every': {
      const days = Math.max(1, recurrence.days);
      const today = atClock(after, hour, minute);
      return today > after ? today : atClock(addDays(after, days), hour, minute);
    }
  }
}

/**
 * The next time a recurring task should come back once the current one is done.
 * Uses the task's own scheduled time-of-day so "gym at 7am" stays at 7am.
 */
export function nextOccurrence(
  recurrence: Recurrence,
  from: number,
  anchor: number | null
): number {
  const base = anchor ?? from;
  const d = new Date(base);
  return nextOccurrenceAfter(recurrence, from, d.getHours(), d.getMinutes(), d.getDay());
}

export function describeRecurrence(recurrence: Recurrence | null): string {
  if (!recurrence) return 'Does not repeat';
  switch (recurrence.kind) {
    case 'daily':
      return 'Every day';
    case 'weekly': {
      const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      if (recurrence.days.length === 7) return 'Every day';
      if (recurrence.days.length === 0) return 'Every week';
      return `Every ${recurrence.days.map((d) => names[d]).join(', ')}`;
    }
    case 'every':
      return recurrence.days === 1 ? 'Every day' : `Every ${recurrence.days} days`;
  }
}
