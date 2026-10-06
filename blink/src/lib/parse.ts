/**
 * Natural-language capture parser for Blink.
 *
 * Design rules that matter:
 *  1. **Deterministic and offline.** No network, no LLM. A capture that needs a
 *     server round-trip cannot be "frictionless".
 *  2. **Never strip what you did not understand.** Any word we don't match stays
 *     in the title, so a failed parse degrades into a plain task instead of a
 *     mangled one.
 *  3. **Pure.** `parseTaskInput(text, now)` is a function of its arguments, which
 *     is what makes the 40-odd cases in `parse.test.ts` cheap to write.
 */

import {
  addDays,
  atClock,
  dateFromDayKey,
  dayKey,
  HOUR_MS,
  MINUTE_MS,
  titleCaseFirst,
} from './day';
import { nextOccurrenceAfter } from './recurrence';
import type { Bucket, Recurrence } from './types';

export interface ParsedInput {
  /** Cleaned task title. Falls back to the raw input if everything matched. */
  title: string;
  dueAt: number | null;
  recurrence: Recurrence | null;
  /** Suggested bucket, when the user said "someday"/"later". */
  bucket: Bucket | null;
  /** Friendly labels for the confirmation chips, e.g. ['Tomorrow', '5 PM']. */
  matched: string[];
  /** True when we invented a clock time (day given, no time given). */
  timeAssumed: boolean;
  /** Original text, untouched. */
  raw: string;
}

/** Default clock time used when only a day is given. */
const DEFAULT_HOUR = 9;

const WEEKDAYS: [string, number][] = [
  ['sunday', 0],
  ['monday', 1],
  ['tuesday', 2],
  ['wednesday', 3],
  ['thursday', 4],
  ['friday', 5],
  ['saturday', 6],
  ['thurs', 4],
  ['thur', 4],
  ['tues', 2],
  ['weds', 3],
  ['sun', 0],
  ['mon', 1],
  ['tue', 2],
  ['wed', 3],
  ['thu', 4],
  ['fri', 5],
  ['sat', 6],
];

const MONTHS: [string, number][] = [
  ['january', 0],
  ['february', 1],
  ['march', 2],
  ['april', 3],
  ['may', 4],
  ['june', 5],
  ['july', 6],
  ['august', 7],
  ['september', 8],
  ['october', 9],
  ['november', 10],
  ['december', 11],
  ['sept', 8],
  ['jan', 0],
  ['feb', 1],
  ['mar', 2],
  ['apr', 3],
  ['jun', 5],
  ['jul', 6],
  ['aug', 7],
  ['sep', 8],
  ['oct', 9],
  ['nov', 10],
  ['dec', 11],
];

/** Longest-first so "thurs" wins before "thu". */
const weekdayAlternation = WEEKDAYS.map(([name]) => name)
  .sort((a, b) => b.length - a.length)
  .join('|');
const monthAlternation = MONTHS.map(([name]) => name)
  .sort((a, b) => b.length - a.length)
  .join('|');

function weekdayIndex(name: string): number {
  const found = WEEKDAYS.find(([n]) => n === name.toLowerCase());
  return found ? found[1] : 1;
}

function monthIndex(name: string): number {
  const found = MONTHS.find(([n]) => n === name.toLowerCase());
  return found ? found[1] : 0;
}

/** Whole days from `now`'s day to the next `target` weekday. 1..7, never 0. */
function daysUntilWeekday(now: number, target: number): number {
  const current = new Date(now).getDay();
  let delta = (target - current + 7) % 7;
  if (delta === 0) delta = 7;
  return delta;
}

interface Accumulator {
  ranges: [number, number][];
  labels: string[];
  /** Local-midnight timestamp of an explicitly named day. */
  dayTs: number | null;
  /** Exact timestamp from "in 20 minutes" style input. */
  relativeTs: number | null;
  hour: number | null;
  minute: number;
  recurrence: Recurrence | null;
  bucket: Bucket | null;
  dayMatched: boolean;
  timeMatched: boolean;
}

interface Match {
  start: number;
  end: number;
  /** Higher wins when two matches overlap at the same start. */
  weight: number;
  apply: (acc: Accumulator) => void;
}

function collect(input: string, now: number): Match[] {
  const matches: Match[] = [];
  const add = (
    pattern: RegExp,
    weight: number,
    apply: (m: RegExpExecArray, acc: Accumulator) => void
  ) => {
    const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
    let m: RegExpExecArray | null;
    while ((m = re.exec(input)) !== null) {
      if (m[0].length === 0) {
        re.lastIndex += 1;
        continue;
      }
      // Bind per iteration: the same `m` is reused by the loop, and these
      // closures are invoked later, once every pattern has been scanned.
      const found: RegExpExecArray = m;
      matches.push({
        start: found.index,
        end: found.index + found[0].length,
        weight,
        apply: (acc) => apply(found, acc),
      });
    }
  };

  const todayStart = dateFromDayKey(dayKey(now));

  // ---------------------------------------------------------------- recurrence
  add(/\b(?:every\s+day|everyday|daily)\b/i, 30, (_m, acc) => {
    acc.recurrence = { kind: 'daily' };
    acc.labels.push('Every day');
  });

  add(/\bevery\s+morning\b/i, 31, (_m, acc) => {
    acc.recurrence = { kind: 'daily' };
    acc.hour = 9;
    acc.minute = 0;
    acc.timeMatched = true;
    acc.labels.push('Every morning');
  });

  add(
    new RegExp(`\\bevery\\s+((?:${weekdayAlternation})(?:\\s*(?:,|and|&)\\s*(?:${weekdayAlternation}))*)\\b`, 'i'),
    32,
    (m, acc) => {
      const days = [...m[1].matchAll(new RegExp(weekdayAlternation, 'gi'))].map((d) =>
        weekdayIndex(d[0])
      );
      const unique = [...new Set(days)].sort((a, b) => a - b);
      acc.recurrence = { kind: 'weekly', days: unique };
      acc.labels.push(
        `Every ${unique
          .map((d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d])
          .join(', ')}`
      );
    }
  );

  add(/\bevery\s+(\d+)\s+days?\b/i, 33, (m, acc) => {
    const n = Math.max(1, parseInt(m[1], 10));
    acc.recurrence = { kind: 'every', days: n };
    acc.labels.push(n === 1 ? 'Every day' : `Every ${n} days`);
  });

  add(/\b(?:every\s+week|weekly)\b/i, 30, (_m, acc) => {
    const day = new Date(now).getDay();
    acc.recurrence = { kind: 'weekly', days: [day] };
    acc.labels.push('Every week');
  });

  // --------------------------------------------------------------------- days
  add(/\b(day after tomorrow)\b/i, 25, (_m, acc) => {
    acc.dayTs = addDays(todayStart, 2);
    acc.dayMatched = true;
    acc.labels.push('Day after tomorrow');
  });

  add(/\b(tomorrow|tmrw|tmw|tom)\b/i, 24, (_m, acc) => {
    acc.dayTs = addDays(todayStart, 1);
    acc.dayMatched = true;
    acc.labels.push('Tomorrow');
  });

  add(/\b(tonight)\b/i, 26, (_m, acc) => {
    acc.dayTs = todayStart;
    acc.hour = 20;
    acc.minute = 0;
    acc.timeMatched = true;
    acc.dayMatched = true;
    acc.labels.push('Tonight');
  });

  add(/\b(today)\b/i, 23, (_m, acc) => {
    acc.dayTs = todayStart;
    acc.dayMatched = true;
    acc.labels.push('Today');
  });

  add(/\bnext\s+week\b/i, 22, (_m, acc) => {
    acc.dayTs = addDays(todayStart, 7);
    acc.dayMatched = true;
    acc.labels.push('Next week');
  });

  add(/\bnext\s+month\b/i, 22, (_m, acc) => {
    const d = new Date(todayStart);
    d.setMonth(d.getMonth() + 1);
    acc.dayTs = d.getTime();
    acc.dayMatched = true;
    acc.labels.push('Next month');
  });

  add(new RegExp(`\\b(?:next\\s+)?(${weekdayAlternation})\\b`, 'i'), 21, (m, acc) => {
    const explicitNext = /^\s*next/i.test(m[0]);
    const target = weekdayIndex(m[1]);
    let delta = daysUntilWeekday(now, target);
    // "next Friday" shouldn't quietly mean tomorrow.
    if (explicitNext && delta <= 1) delta += 7;
    acc.dayTs = addDays(todayStart, delta);
    acc.dayMatched = true;
    const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    acc.labels.push(explicitNext ? `Next ${names[target]}` : names[target]);
  });

  // "in 20 minutes" / "in 2 hours" / "in 3 days"
  add(
    /\bin\s+(\d+|a|an)\s*(minutes?|mins?|hours?|hrs?|days?|weeks?)\b/i,
    20,
    (m, acc) => {
      const n = /^a/i.test(m[1]) ? 1 : parseInt(m[1], 10);
      const unit = m[2].toLowerCase();
      const ms = unit.startsWith('min')
        ? n * MINUTE_MS
        : unit.startsWith('h')
          ? n * HOUR_MS
          : unit.startsWith('d')
            ? n * 86_400_000
            : n * 7 * 86_400_000;
      acc.relativeTs = now + ms;
      acc.labels.push(`In ${n} ${unit.replace(/s$/, '')}${n === 1 ? '' : 's'}`);
    }
  );

  // shorthand: "in 2h", "in 30m"
  add(/\bin\s+(\d+)\s*(m|h|d|w)\b/i, 19, (m, acc) => {
    const n = parseInt(m[1], 10);
    const unit = m[2].toLowerCase();
    const ms = unit === 'm' ? n * MINUTE_MS : unit === 'h' ? n * HOUR_MS : unit === 'd' ? n * 86_400_000 : n * 7 * 86_400_000;
    acc.relativeTs = now + ms;
    acc.labels.push(`In ${n}${unit}`);
  });

  // "oct 12" / "12 oct" / "on the 5th"
  add(new RegExp(`\\b(${monthAlternation})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, 'i'), 18, (m, acc) => {
    const month = monthIndex(m[1]);
    const day = parseInt(m[2], 10);
    acc.dayTs = nextMonthDay(now, month, day);
    acc.dayMatched = true;
    acc.labels.push(`${m[1][0].toUpperCase()}${m[1].slice(1, 3).toLowerCase()} ${day}`);
  });

  add(/\bon\s+the\s+(\d{1,2})(?:st|nd|rd|th)\b/i, 17, (m, acc) => {
    const day = parseInt(m[1], 10);
    const d = new Date(now);
    d.setDate(day);
    if (d.getTime() < todayStart) d.setMonth(d.getMonth() + 1);
    acc.dayTs = dateFromDayKey(dayKey(d.getTime()));
    acc.dayMatched = true;
    acc.labels.push(`The ${day}${ordinalSuffix(day)}`);
  });

  add(/\b(someday|next\s+time|later)\b/i, 10, (_m, acc) => {
    acc.bucket = 'later';
    acc.labels.push('Later');
  });

  // -------------------------------------------------------------------- times
  add(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)\b/i, 15, (m, acc) => {
    let hour = parseInt(m[1], 10) % 12;
    const minute = m[2] ? parseInt(m[2], 10) : 0;
    if (/p/i.test(m[3])) hour += 12;
    setClock(acc, hour, minute);
  });

  add(/\b([01]?\d|2[0-3]):([0-5]\d)\b/, 16, (m, acc) => {
    setClock(acc, parseInt(m[1], 10), parseInt(m[2], 10));
  });

  add(/\b(noon)\b/i, 15, (_m, acc) => setClock(acc, 12, 0));
  add(/\b(midnight)\b/i, 15, (_m, acc) => setClock(acc, 0, 0));
  add(/\b(this\s+)?(morning)\b/i, 12, (_m, acc) => setClock(acc, 9, 0));
  add(/\b(this\s+)?(afternoon)\b/i, 12, (_m, acc) => setClock(acc, 14, 0));
  add(/\b(this\s+)?(evening)\b/i, 12, (_m, acc) => setClock(acc, 19, 0));
  add(/\b(this\s+)?(night)\b/i, 12, (_m, acc) => setClock(acc, 20, 0));

  return matches;
}

function setClock(acc: Accumulator, hour: number, minute: number): void {
  acc.hour = hour;
  acc.minute = minute;
  acc.timeMatched = true;
  const label = minute === 0 ? formatClock(hour, 0) : formatClock(hour, minute);
  if (!acc.labels.includes(label)) acc.labels.push(label);
}

/** Local, dependency-free 12-hour formatting for chip labels. */
function formatClock(hour24: number, minute: number): string {
  const suffix = hour24 < 12 ? 'AM' : 'PM';
  const h = hour24 % 12 === 0 ? 12 : hour24 % 12;
  if (hour24 === 12 && minute === 0) return 'Noon';
  if (hour24 === 0 && minute === 0) return 'Midnight';
  return minute === 0 ? `${h} ${suffix}` : `${h}:${`${minute}`.padStart(2, '0')} ${suffix}`;
}

/** Next occurrence of a given month/day, this year or next. */
function nextMonthDay(now: number, month: number, day: number): number {
  const year = new Date(now).getFullYear();
  const candidate = new Date(year, month, day);
  const todayStart = dateFromDayKey(dayKey(now));
  if (candidate.getTime() < todayStart) candidate.setFullYear(year + 1);
  return dateFromDayKey(dayKey(candidate.getTime()));
}

function ordinalSuffix(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return 'th';
  switch (n % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}

/**
 * Greedy non-overlapping selection: earliest match first, and at the same start
 * position the more specific (higher weight) rule wins. This is what keeps
 * "every monday at 7am" from matching "monday" as a plain weekday.
 */
function pickMatches(candidates: Match[]): Match[] {
  const sorted = [...candidates].sort((a, b) => a.start - b.start || b.weight - a.weight || b.end - a.end);
  const chosen: Match[] = [];
  let cursor = -1;
  for (const candidate of sorted) {
    if (candidate.start >= cursor && candidate.start >= 0) {
      chosen.push(candidate);
      cursor = candidate.end;
    }
  }
  return chosen;
}

function stripRanges(input: string, ranges: [number, number][]): string {
  const ordered = [...ranges].sort((a, b) => a[0] - b[0]);
  let out = '';
  let cursor = 0;
  for (const [start, end] of ordered) {
    out += `${input.slice(cursor, start)} `;
    cursor = end;
  }
  out += input.slice(cursor);
  let cleaned = out.replace(/\s+/g, ' ').trim();
  // Drop connector words left dangling by the removal ("call mom at" -> "call mom").
  const trailing = /[\s,]*\b(at|on|by|due|the|for|from|in|this|next)\b[\s,]*$/i;
  let previous = '';
  while (previous !== cleaned && trailing.test(cleaned)) {
    previous = cleaned;
    cleaned = cleaned.replace(trailing, '').replace(/\s+/g, ' ').trim();
  }
  return cleaned.replace(/^[\s,;:.\-–—]+|[\s,;:.\-–—]+$/g, '').trim();
}

export function parseTaskInput(raw: string, now: number = Date.now()): ParsedInput {
  const input = raw.trim();
  if (!input) {
    return {
      title: '',
      dueAt: null,
      recurrence: null,
      bucket: null,
      matched: [],
      timeAssumed: false,
      raw,
    };
  }

  const acc: Accumulator = {
    ranges: [],
    labels: [],
    dayTs: null,
    relativeTs: null,
    hour: null,
    minute: 0,
    recurrence: null,
    bucket: null,
    dayMatched: false,
    timeMatched: false,
  };

  for (const match of pickMatches(collect(input, now))) {
    acc.ranges.push([match.start, match.end]);
    match.apply(acc);
  }

  // ------------------------------------------------------------------- combine
  let dueAt: number | null = null;
  let timeAssumed = false;

  if (acc.relativeTs !== null) {
    dueAt = acc.relativeTs;
  } else if (acc.dayTs !== null) {
    const hour = acc.hour ?? DEFAULT_HOUR;
    timeAssumed = acc.hour === null;
    dueAt = atClock(acc.dayTs, hour, acc.minute);
  } else if (acc.hour !== null) {
    const base = atClock(now, acc.hour, acc.minute);
    dueAt = base > now ? base : addDays(base, 1);
  }

  // A recurrence with no anchor date still needs a first occurrence.
  if (acc.recurrence && dueAt === null) {
    dueAt = nextOccurrenceAfter(
      acc.recurrence,
      now,
      acc.hour ?? DEFAULT_HOUR,
      acc.minute,
      new Date(now).getDay()
    );
    if (acc.hour === null) timeAssumed = true;
  }

  const title = stripRanges(input, acc.ranges);
  const labels = [...new Set(acc.labels)];

  return {
    title: titleCaseFirst(title.length > 0 ? title : input),
    dueAt,
    recurrence: acc.recurrence,
    bucket: acc.bucket,
    matched: labels,
    timeAssumed,
    raw,
  };
}
