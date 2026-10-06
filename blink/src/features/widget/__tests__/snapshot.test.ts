import {
  buildWidgetSnapshot,
  buildWidgetTimeline,
  formatWidgetDue,
  isSerializableSnapshot,
  MAX_TIMELINE_ENTRIES,
  EMPTY_SNAPSHOT,
  UP_NEXT_LIMIT,
} from '../snapshot';
import type { Task } from '@/lib/types';
import { dayKey } from '@/lib/day';

const WED = new Date(2026, 9, 7, 10, 0, 0).getTime(); // Wed 7 Oct 2026, 10:00
const ROLLOVER = 4;

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: overrides.id ?? `t${Math.random().toString(36).slice(2, 8)}`,
    title: overrides.title ?? 'Task',
    dueAt: overrides.dueAt ?? null,
    remindAt: overrides.remindAt ?? null,
    bucket: overrides.bucket ?? 'today',
    status: overrides.status ?? 'open',
    recurrence: overrides.recurrence ?? null,
    sortKey: overrides.sortKey ?? 1024,
    createdAt: overrides.createdAt ?? WED - 86_400_000,
    completedAt: overrides.completedAt ?? null,
    snoozedUntil: overrides.snoozedUntil ?? null,
    snoozeCount: overrides.snoozeCount ?? 0,
  };
}

describe('buildWidgetSnapshot', () => {
  it('is empty and clear when there is nothing to do', () => {
    const snapshot = buildWidgetSnapshot([], WED);
    expect(snapshot.clear).toBe(true);
    expect(snapshot.title).toBe('');
    expect(snapshot.openCount).toBe(0);
    expect(snapshot.updatedAt).toBe(WED);
  });

  it('promotes the soonest dated task into the headline', () => {
    const snapshot = buildWidgetSnapshot(
      [
        makeTask({ title: 'Undated' }),
        makeTask({ title: 'Due soon', dueAt: WED + 3_600_000, sortKey: 2048 }),
      ],
      WED
    );
    expect(snapshot.title).toBe('Due soon');
    expect(snapshot.clear).toBe(false);
  });

  it('lists what is queued behind the headline task', () => {
    const snapshot = buildWidgetSnapshot(
      [
        makeTask({ title: 'First', dueAt: WED + 3_600_000 }),
        makeTask({ title: 'Second', dueAt: WED + 7_200_000 }),
        makeTask({ title: 'Third', dueAt: WED + 10_800_000 }),
      ],
      WED
    );
    expect(snapshot.title).toBe('First');
    expect(snapshot.upNext).toEqual(['Second', 'Third']);
    expect(snapshot.openCount).toBe(3);
  });

  it(`caps the queue list at ${UP_NEXT_LIMIT} titles`, () => {
    const tasks = Array.from({ length: 8 }, (_, index) =>
      makeTask({ title: `Task ${index}`, dueAt: WED + (index + 1) * 3_600_000 })
    );
    expect(buildWidgetSnapshot(tasks, WED).upNext).toHaveLength(UP_NEXT_LIMIT);
  });

  it('never includes the headline task in the queue list', () => {
    const snapshot = buildWidgetSnapshot(
      [makeTask({ title: 'Only', dueAt: WED + 3_600_000 })],
      WED
    );
    expect(snapshot.upNext).toEqual([]);
  });

  it('excludes tasks parked in the later bucket', () => {
    const snapshot = buildWidgetSnapshot(
      [makeTask({ title: 'Someday', bucket: 'later' })],
      WED
    );
    expect(snapshot.clear).toBe(true);
  });

  it('excludes completed tasks', () => {
    const snapshot = buildWidgetSnapshot(
      [makeTask({ title: 'Done', status: 'done', completedAt: WED - 1000 })],
      WED
    );
    expect(snapshot.clear).toBe(true);
  });

  it('excludes snoozed tasks until the snooze expires', () => {
    const tasks = [makeTask({ title: 'Snoozed', snoozedUntil: WED + 600_000 })];
    expect(buildWidgetSnapshot(tasks, WED).clear).toBe(true);
    expect(buildWidgetSnapshot(tasks, WED + 700_000).title).toBe('Snoozed');
  });

  it('reports the streak and today’s completions', () => {
    const snapshot = buildWidgetSnapshot(
      [
        makeTask({ title: 'Open', dueAt: WED + 3_600_000 }),
        makeTask({ title: 'Done today', status: 'done', completedAt: WED - 3_600_000 }),
        makeTask({ title: 'Done yesterday', status: 'done', completedAt: WED - 86_400_000 }),
      ],
      WED
    );
    expect(snapshot.doneToday).toBe(1);
    expect(snapshot.streak).toBe(2);
  });

  it('keeps the streak visible even with an empty queue — that is the reward', () => {
    const snapshot = buildWidgetSnapshot(
      [makeTask({ title: 'Done', status: 'done', completedAt: WED - 3_600_000 })],
      WED
    );
    expect(snapshot.clear).toBe(true);
    expect(snapshot.doneToday).toBe(1);
    expect(snapshot.streak).toBe(1);
  });

  it('produces a snapshot that survives JSON round-tripping', () => {
    // The snapshot crosses a process boundary, so anything non-serialisable
    // (a Date, a class instance) would arrive broken in the widget runtime.
    const snapshot = buildWidgetSnapshot(
      [makeTask({ title: 'Ship it', dueAt: WED + 3_600_000 })],
      WED
    );
    expect(isSerializableSnapshot(snapshot)).toBe(true);
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });

  it('stores epoch numbers rather than Date objects', () => {
    const snapshot = buildWidgetSnapshot(
      [makeTask({ title: 'Dated', dueAt: WED + 3_600_000 })],
      WED
    );
    expect(typeof snapshot.dueAt).toBe('number');
    expect(snapshot.dueAt).toBe(WED + 3_600_000);
  });

  it('matches the empty snapshot shape when there is nothing to show', () => {
    expect(Object.keys(buildWidgetSnapshot([], WED)).sort()).toEqual(
      Object.keys(EMPTY_SNAPSHOT).sort()
    );
  });
});

describe('formatWidgetDue', () => {
  it('returns an empty string when there is no date', () => {
    expect(formatWidgetDue(null, WED)).toBe('');
  });

  it('shows just the time for later today', () => {
    expect(formatWidgetDue(new Date(2026, 9, 7, 17, 0).getTime(), WED)).toBe('5 PM');
  });

  it('formats minutes when not on the hour', () => {
    expect(formatWidgetDue(new Date(2026, 9, 7, 17, 30).getTime(), WED)).toBe('5:30 PM');
  });

  it('says Now for a task that is already due', () => {
    expect(formatWidgetDue(new Date(2026, 9, 7, 9, 0).getTime(), WED)).toBe('Now');
  });

  it('names tomorrow and yesterday', () => {
    expect(formatWidgetDue(new Date(2026, 9, 8, 9, 0).getTime(), WED)).toBe('Tomorrow 9 AM');
    expect(formatWidgetDue(new Date(2026, 9, 6, 9, 0).getTime(), WED)).toBe('Yesterday');
  });

  it('names the weekday later in the week', () => {
    expect(formatWidgetDue(new Date(2026, 9, 9, 9, 0).getTime(), WED)).toBe('Friday');
  });

  it('uses a short date beyond a week out', () => {
    expect(formatWidgetDue(new Date(2026, 9, 25, 9, 0).getTime(), WED)).toBe('Oct 25');
  });

  it('never says "overdue" — consistent with the rest of the app', () => {
    expect(formatWidgetDue(new Date(2026, 8, 1).getTime(), WED)).not.toMatch(/overdue/i);
  });
});

describe('buildWidgetTimeline', () => {
  it('always starts with the present moment', () => {
    const timeline = buildWidgetTimeline([makeTask()], WED, ROLLOVER);
    expect(timeline[0].date.getTime()).toBe(WED);
    expect(timeline[0].props.updatedAt).toBe(WED);
  });

  it('returns entries in chronological order', () => {
    const timeline = buildWidgetTimeline([makeTask()], WED, ROLLOVER);
    const times = timeline.map((entry) => entry.date.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it('caps the number of entries to respect the platform refresh budget', () => {
    const tasks = Array.from({ length: 20 }, (_, index) =>
      makeTask({ title: `T${index}`, dueAt: WED + (index + 1) * 600_000 })
    );
    expect(buildWidgetTimeline(tasks, WED, ROLLOVER).length).toBeLessThanOrEqual(
      MAX_TIMELINE_ENTRIES
    );
  });

  it('includes a moment after the day boundary so labels refresh overnight', () => {
    const timeline = buildWidgetTimeline([makeTask()], WED, ROLLOVER);
    const boundary = new Date(2026, 9, 8, ROLLOVER, 0, 0).getTime();
    const hours = timeline.map((entry) => entry.date.getTime());
    expect(hours.some((time) => time >= boundary)).toBe(true);
  });

  it('rolls future entries forward rather than trusting stale buckets', () => {
    // A task due yesterday morning: at the next boundary it must belong to the
    // new day, not still be described as yesterday's work.
    const task = makeTask({ title: 'Stale', dueAt: new Date(2026, 9, 6, 9, 0).getTime() });
    const timeline = buildWidgetTimeline([task], WED, ROLLOVER);
    const tomorrowEntry = timeline[timeline.length - 1];
    if (tomorrowEntry.date.getTime() > WED + 20 * 3_600_000) {
      expect(dayKey(tomorrowEntry.props.dueAt)).toBe(dayKey(tomorrowEntry.date.getTime()));
    }
  });

  it('every entry is serialisable', () => {
    const timeline = buildWidgetTimeline(
      [makeTask({ title: 'A', dueAt: WED + 3_600_000 }), makeTask({ title: 'B' })],
      WED,
      ROLLOVER
    );
    for (const entry of timeline) {
      expect(isSerializableSnapshot(entry.props)).toBe(true);
    }
  });

  it('honours a custom limit', () => {
    const tasks = Array.from({ length: 10 }, (_, index) =>
      makeTask({ title: `T${index}`, dueAt: WED + (index + 1) * 600_000 })
    );
    expect(buildWidgetTimeline(tasks, WED, ROLLOVER, 2)).toHaveLength(2);
  });

  it('handles an empty task list without producing nothing', () => {
    const timeline = buildWidgetTimeline([], WED, ROLLOVER);
    expect(timeline.length).toBeGreaterThan(0);
    expect(timeline[0].props.clear).toBe(true);
  });
});
