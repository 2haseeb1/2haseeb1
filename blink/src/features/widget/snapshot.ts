/**
 * Widget snapshot — the single data shape both home-screen widgets render from.
 *
 * Why this exists as its own module:
 *
 *  1. **Widgets cannot read the store.** A widget extension runs in its own
 *     process with its own JS runtime, so its content must be pushed to it as a
 *     plain snapshot. That means the interesting product logic ("what is the one
 *     thing right now?") has to live outside React, in a pure function.
 *  2. **Props cross a process boundary.** Everything here must be
 *     JSON-serialisable — no Dates, no class instances, no functions. `Date`
 *     objects would arrive in the widget context as the empty object `{}`, which
 *     fails silently, so the snapshot stores pre-formatted strings and epoch
 *     numbers instead.
 */

import { atClock, addDays, logicalDayStart } from '@/lib/day';
import { rolloverTasks } from '@/lib/rollover';
import type { Task } from '@/lib/types';

import { doneToday, nowCard, streakDays, todayQueue } from '../tasks/selectors';

/** How many upcoming tasks the medium/large widget lists under the focus task. */
export const UP_NEXT_LIMIT = 3;

export interface WidgetSnapshot {
  /** Title of the focus task, or '' when there is nothing to do. */
  title: string;
  /** Pre-formatted due label ("Today 5 PM"), or '' when the task has no date. */
  due: string;
  /** Epoch ms of the focus task's due date, or 0. */
  dueAt: number;
  /** Titles queued behind the focus task, at most UP_NEXT_LIMIT. */
  upNext: string[];
  /** Open tasks in today's queue, including the focus task. */
  openCount: number;
  doneToday: number;
  streak: number;
  /** Convenience flag so the widget layout stays branch-light. */
  clear: boolean;
  /** Epoch ms this snapshot was computed; shown as a staleness hint if needed. */
  updatedAt: number;
}

export const EMPTY_SNAPSHOT: WidgetSnapshot = {
  title: '',
  due: '',
  dueAt: 0,
  upNext: [],
  openCount: 0,
  doneToday: 0,
  streak: 0,
  clear: true,
  updatedAt: 0,
};

/**
 * Builds the snapshot for a given moment.
 *
 * `now` is a parameter rather than a call to `Date.now()` so the widget timeline
 * can be generated for future moments (see `buildWidgetTimeline`) and so the
 * whole thing stays testable.
 */
export function buildWidgetSnapshot(tasks: Task[], now: number): WidgetSnapshot {
  const queue = todayQueue(tasks, now);
  const focus = nowCard(tasks, now);

  if (!focus) {
    return {
      ...EMPTY_SNAPSHOT,
      doneToday: doneToday(tasks, now).length,
      streak: streakDays(tasks, now),
      updatedAt: now,
    };
  }

  return {
    title: focus.title,
    due: formatWidgetDue(focus.dueAt, now),
    dueAt: focus.dueAt ?? 0,
    upNext: queue
      .filter((task) => task.id !== focus.id)
      .slice(0, UP_NEXT_LIMIT)
      .map((task) => task.title),
    openCount: queue.length,
    doneToday: doneToday(tasks, now).length,
    streak: streakDays(tasks, now),
    clear: false,
    updatedAt: now,
  };
}

/**
 * Compact due label for a widget.
 *
 * Deliberately shorter than the in-app `formatDue`: a widget gets one line, so
 * "Today 5 PM" becomes "5 PM" and "Tomorrow 9 AM" becomes "Tomorrow". The word
 * "overdue" does not appear here either — rolled-over work is just due now.
 */
export function formatWidgetDue(dueAt: number | null, now: number): string {
  if (dueAt === null) return '';

  const due = new Date(dueAt);
  const startOfToday = logicalDayStart(now, 0);
  const dayOffset = Math.round((startOfToday - logicalDayStart(dueAt, 0)) / 86_400_000);

  const time = formatShortClock(due.getHours(), due.getMinutes());

  if (dayOffset === 0) {
    // Already past, or due within the hour: say so plainly.
    if (dueAt <= now) return 'Now';
    return time;
  }
  if (dayOffset === -1) return `Tomorrow ${time}`;
  if (dayOffset === 1) return 'Yesterday';
  if (dayOffset < -1 && dayOffset >= -6) {
    return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][
      due.getDay()
    ];
  }
  return `${MONTHS[due.getMonth()]} ${due.getDate()}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatShortClock(hours: number, minutes: number): string {
  const suffix = hours < 12 ? 'AM' : 'PM';
  const h = hours % 12 === 0 ? 12 : hours % 12;
  return minutes === 0 ? `${h} ${suffix}` : `${h}:${`${minutes}`.padStart(2, '0')} ${suffix}`;
}

export interface WidgetTimelineEntry {
  date: Date;
  props: WidgetSnapshot;
}

/** Maximum timeline entries to schedule; WidgetKit budgets refreshes. */
export const MAX_TIMELINE_ENTRIES = 5;

/**
 * A timeline of snapshots for the moments a widget's content actually changes:
 *
 *   - now,
 *   - the next day boundary (labels flip from "Tomorrow" back to "today"),
 *   - and each upcoming due time, so a task due at 5pm stops saying "5 PM" and
 *     starts saying "Now" without the app needing to be opened.
 *
 * Each future entry is computed against a *rolled-over* copy of the task list,
 * because the store only applies rollover when the app is foregrounded. Without
 * that, the 00:05 widget refresh would still show yesterday's buckets.
 */
export function buildWidgetTimeline(
  tasks: Task[],
  now: number,
  rolloverHour: number,
  limit = MAX_TIMELINE_ENTRIES
): WidgetTimelineEntry[] {
  const moments = new Set<number>();

  const todayBoundary = logicalDayStart(now, rolloverHour);
  const nextBoundary = todayBoundary <= now ? addDays(todayBoundary, 1) : todayBoundary;
  moments.add(now);
  moments.add(nextBoundary);
  moments.add(addDays(nextBoundary, 1)); // covers a 48h window

  // The moment each upcoming task falls due.
  for (const task of tasks) {
    if (task.status !== 'open' || task.dueAt === null) continue;
    if (task.dueAt <= now) continue;
    moments.add(task.dueAt);
  }

  return [...moments]
    .filter((moment) => moment >= now)
    .sort((a, b) => a - b)
    .slice(0, limit)
    .map((moment) => {
      const rolled = rolloverTasks(tasks, moment, rolloverHour).tasks;
      return { date: new Date(moment), props: buildWidgetSnapshot(rolled, moment) };
    });
}

/** Sanity check used by tests and by the sync layer before pushing to native. */
export function isSerializableSnapshot(snapshot: WidgetSnapshot): boolean {
  try {
    const roundTripped = JSON.parse(JSON.stringify(snapshot)) as WidgetSnapshot;
    return (
      typeof roundTripped.title === 'string' &&
      Array.isArray(roundTripped.upNext) &&
      typeof roundTripped.openCount === 'number'
    );
  } catch {
    return false;
  }
}

export { atClock };
