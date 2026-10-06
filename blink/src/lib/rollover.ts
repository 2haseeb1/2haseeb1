/**
 * The end-of-day sweep — Blink's most opinionated behaviour.
 *
 * Unfinished work is never labelled "overdue": it rolls forward to today and is
 * presented as due now. The only thing that resets is the clock. Recurring tasks
 * skip ahead to their next scheduled occurrence instead of stacking up.
 */

import { atClock, logicalDayStart } from './day';
import { nextOccurrence } from './recurrence';
import type { Bucket, Task } from './types';

/**
 * Which bucket a task belongs in, given when it is due.
 * Anything landing today (or already past) is "today"; everything else waits.
 */
export function bucketForDue(
  dueAt: number | null,
  now: number,
  rolloverHour: number
): Bucket {
  if (dueAt === null) return 'today';
  return dueAt < logicalDayStart(now, rolloverHour) + 24 * 3_600_000 ? 'today' : 'later';
}

export interface RolloverResult {
  tasks: Task[];
  changed: boolean;
}

/**
 * Rolls unfinished work forward. Pure: returns a new array only when something
 * actually changed, so the store can skip pointless writes and re-renders.
 */
export function rolloverTasks(
  tasks: Task[],
  now: number,
  rolloverHour: number
): RolloverResult {
  const cutoff = logicalDayStart(now, rolloverHour);
  let changed = false;

  const next = tasks.map((task) => {
    // Expire finished snoozes.
    if (task.snoozedUntil !== null && task.snoozedUntil <= now) {
      changed = true;
      return { ...task, snoozedUntil: null };
    }

    if (task.status !== 'open' || task.dueAt === null) return task;
    if (task.dueAt >= cutoff) return task;

    changed = true;

    if (task.recurrence) {
      // Missed a recurring occurrence: skip forward to the next scheduled one
      // rather than creating a backlog of identical chores.
      return {
        ...task,
        dueAt: nextOccurrence(task.recurrence, now, task.dueAt),
        remindAt: null,
        bucket: 'today' as Bucket,
      };
    }

    const previous = new Date(task.dueAt);
    const rolled = atClock(now, previous.getHours(), previous.getMinutes());
    return {
      ...task,
      dueAt: rolled,
      remindAt: null,
      // A task whose day has arrived is no longer "later".
      bucket: 'today' as Bucket,
    };
  });

  return { tasks: changed ? next : tasks, changed };
}

/** Drops the tails of very old completed tasks so the local store stays small. */
export function pruneCompleted(tasks: Task[], now: number, keepDays = 180): Task[] {
  const cutoff = now - keepDays * 86_400_000;
  const pruned = tasks.filter((t) => t.completedAt === null || t.completedAt >= cutoff);
  return pruned.length === tasks.length ? tasks : pruned;
}
