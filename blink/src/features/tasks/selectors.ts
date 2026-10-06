/**
 * Derived views over the task list.
 *
 * Pure functions of `(tasks, now)` — no store access, no hooks. That keeps the
 * interesting product rules (what counts as "today", which task is The One
 * Thing, how a streak is computed) testable without rendering anything.
 */

import { addDaysToKey, computeStreak, dayKey, daysBetween, logicalDayStart } from '@/lib/day';
import type { Task } from '@/lib/types';

export function bySortKey(a: Task, b: Task): number {
  return a.sortKey - b.sortKey;
}

export function sortedTasks(tasks: Task[]): Task[] {
  return [...tasks].sort(bySortKey);
}

export function isSnoozed(task: Task, now: number): boolean {
  return task.snoozedUntil !== null && task.snoozedUntil > now;
}

/**
 * Focus order: dated work first (soonest first), then undated work in manual
 * order. Without this split an old undated task would outrank something due in
 * ten minutes, which is never what the user means.
 */
export function orderForFocus(tasks: Task[]): Task[] {
  const dated = tasks
    .filter((t) => t.dueAt !== null)
    .sort((a, b) => (a.dueAt as number) - (b.dueAt as number) || bySortKey(a, b));
  const undated = tasks.filter((t) => t.dueAt === null).sort(bySortKey);
  return [...dated, ...undated];
}

export function openTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => t.status === 'open');
}

/** Everything competing for attention right now, in focus order. */
export function todayQueue(tasks: Task[], now: number): Task[] {
  return orderForFocus(
    tasks.filter((t) => t.status === 'open' && t.bucket === 'today' && !isSnoozed(t, now))
  );
}

/** The single task shown on the Now Card — the top of the focus order. */
export function nowCard(tasks: Task[], now: number): Task | null {
  return todayQueue(tasks, now)[0] ?? null;
}

export function snoozedTasks(tasks: Task[], now: number): Task[] {
  return orderForFocus(tasks.filter((t) => t.status === 'open' && isSnoozed(t, now)));
}

export function laterQueue(tasks: Task[], now: number): Task[] {
  return orderForFocus(
    tasks.filter((t) => t.status === 'open' && t.bucket === 'later' && !isSnoozed(t, now))
  );
}

export function completedTasks(tasks: Task[]): Task[] {
  return tasks
    .filter((t) => t.status === 'done' && t.completedAt !== null)
    .sort((a, b) => (b.completedAt as number) - (a.completedAt as number));
}

export function doneToday(tasks: Task[], now: number): Task[] {
  return completedTasks(tasks).filter((t) => dayKey(t.completedAt as number) === dayKey(now));
}

/** Day keys (as plain calendar days) on which at least one task was finished. */
export function completionDayKeys(tasks: Task[]): string[] {
  return tasks
    .filter((t) => t.completedAt !== null)
    .map((t) => dayKey(t.completedAt as number));
}

export function streakDays(tasks: Task[], now: number): number {
  return computeStreak(completionDayKeys(tasks), now);
}

export function streakIsExtendedToday(tasks: Task[], now: number): boolean {
  return completionDayKeys(tasks).includes(dayKey(now));
}

export interface DoneGroup {
  key: string;
  label: string;
  count: number;
  tasks: Task[];
}

/** Completed tasks grouped by day, most recent first. */
export function doneByDay(tasks: Task[], limit = 14): DoneGroup[] {
  const groups = new Map<string, Task[]>();
  for (const task of completedTasks(tasks)) {
    const key = dayKey(task.completedAt as number);
    const bucket = groups.get(key);
    if (bucket) bucket.push(task);
    else groups.set(key, [task]);
  }
  return [...groups.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .slice(0, limit)
    .map(([key, items]) => ({
      key,
      label: relativeDayLabel(key),
      count: items.length,
      tasks: items,
    }));
}

function relativeDayLabel(key: string): string {
  const diff = daysBetween(Date.now(), new Date(`${key}T12:00:00`).getTime());
  if (diff === 0) return 'Today';
  if (diff === -1) return 'Yesterday';
  if (diff === 1) return 'Tomorrow';
  return key;
}

export interface TodayProgress {
  done: number;
  open: number;
  total: number;
}

export function todayProgress(tasks: Task[], now: number): TodayProgress {
  const done = doneToday(tasks, now).length;
  const open = tasks.filter(
    (t) => t.status === 'open' && t.bucket === 'today' && !isSnoozed(t, now)
  ).length;
  return { done, open, total: done + open };
}

/** Completed-per-day counts for the last `days` days, oldest first. */
export function activityByDay(tasks: Task[], now: number, days: number) {
  const counts = new Map<string, number>();
  for (const task of tasks) {
    if (task.completedAt === null) continue;
    const key = dayKey(task.completedAt);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const out: { key: string; count: number; isToday: boolean }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = addDaysToKey(dayKey(now), -i);
    out.push({ key, count: counts.get(key) ?? 0, isToday: i === 0 });
  }
  return out;
}

/** Everything due today or already rolled over, used by the day header. */
export function dueTodayCount(tasks: Task[], now: number, rolloverHour: number): number {
  const cutoff = logicalDayStart(now, rolloverHour) + 24 * 3_600_000;
  return tasks.filter(
    (t) => t.status === 'open' && t.dueAt !== null && t.dueAt < cutoff
  ).length;
}
