import { bucketForDue, pruneCompleted, rolloverTasks } from '../rollover';
import { dayKey, formatTime } from '../day';
import type { Task } from '../types';

const WED = new Date(2026, 9, 7, 10, 0, 0).getTime(); // Wed 7 Oct 2026, 10:00
const ROLLOVER = 4;

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: overrides.id ?? 't1',
    title: overrides.title ?? 'Task',
    notes: undefined,
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

describe('bucketForDue', () => {
  it('puts a task due later today in the today bucket', () => {
    expect(bucketForDue(new Date(2026, 9, 7, 18, 0).getTime(), WED, ROLLOVER)).toBe('today');
  });

  it('puts an undated task in the today bucket', () => {
    expect(bucketForDue(null, WED, ROLLOVER)).toBe('today');
  });

  it('puts a task due tomorrow in the later bucket', () => {
    expect(bucketForDue(new Date(2026, 9, 8, 9, 0).getTime(), WED, ROLLOVER)).toBe('later');
  });

  it('treats an already-passed due date as today', () => {
    expect(bucketForDue(new Date(2026, 8, 1).getTime(), WED, ROLLOVER)).toBe('today');
  });
});

describe('rolloverTasks', () => {
  it('reports no change when nothing needs rolling', () => {
    const tasks = [makeTask({ dueAt: new Date(2026, 9, 7, 17, 0).getTime() })];
    const result = rolloverTasks(tasks, WED, ROLLOVER);
    expect(result.changed).toBe(false);
    expect(result.tasks).toBe(tasks); // identical reference: no needless re-render
  });

  it('rolls a stale task to today at the same clock time', () => {
    const stale = makeTask({ dueAt: new Date(2026, 9, 3, 14, 30).getTime(), bucket: 'today' });
    const { tasks, changed } = rolloverTasks([stale], WED, ROLLOVER);
    expect(changed).toBe(true);
    expect(dayKey(tasks[0].dueAt as number)).toBe('2026-10-07');
    expect(formatTime(tasks[0].dueAt as number)).toBe('2:30 PM');
  });

  it('brings a past-due "later" task back into today', () => {
    const task = makeTask({ dueAt: new Date(2026, 9, 1, 9, 0).getTime(), bucket: 'later' });
    const { tasks } = rolloverTasks([task], WED, ROLLOVER);
    expect(tasks[0].bucket).toBe('today');
  });

  it('skips a missed recurring task forward instead of stacking it up', () => {
    const task = makeTask({
      dueAt: new Date(2026, 8, 30, 7, 0).getTime(), // 30 Sep, a week stale
      bucket: 'today',
      recurrence: { kind: 'weekly', days: [3] }, // Wednesdays at 7am
    });
    const { tasks } = rolloverTasks([task], WED, ROLLOVER);
    expect(tasks).toHaveLength(1);
    expect(new Date(tasks[0].dueAt as number).getDay()).toBe(3);
    expect(tasks[0].dueAt as number).toBeGreaterThan(WED);
    expect(formatTime(tasks[0].dueAt as number)).toBe('7 AM');
  });

  it('never touches completed tasks', () => {
    const done = makeTask({
      status: 'done',
      completedAt: WED - 3_600_000,
      dueAt: new Date(2026, 8, 1).getTime(),
    });
    const { tasks, changed } = rolloverTasks([done], WED, ROLLOVER);
    expect(changed).toBe(false);
    expect(tasks[0].dueAt).toBe(done.dueAt);
  });

  it('expires a finished snooze', () => {
    const task = makeTask({ snoozedUntil: WED - 60_000, remindAt: WED + 600_000 });
    const { tasks, changed } = rolloverTasks([task], WED, ROLLOVER);
    expect(changed).toBe(true);
    expect(tasks[0].snoozedUntil).toBeNull();
  });

  it('keeps an active snooze', () => {
    const task = makeTask({ snoozedUntil: WED + 60_000 });
    const { tasks } = rolloverTasks([task], WED, ROLLOVER);
    expect(tasks[0].snoozedUntil).toBe(WED + 60_000);
  });

  it('leaves an undated task alone', () => {
    const task = makeTask({ dueAt: null, bucket: 'today' });
    const { changed } = rolloverTasks([task], WED, ROLLOVER);
    expect(changed).toBe(false);
  });

  it('respects the rollover hour: 2am is still the previous logical day', () => {
    const twoAm = new Date(2026, 9, 8, 2, 0, 0).getTime();
    const dueYesterday = new Date(2026, 9, 7, 20, 0).getTime();
    const { changed } = rolloverTasks([makeTask({ dueAt: dueYesterday })], twoAm, ROLLOVER);
    expect(changed).toBe(false);
  });

  it('handles an empty list', () => {
    expect(rolloverTasks([], WED, ROLLOVER).changed).toBe(false);
  });
});

describe('pruneCompleted', () => {
  it('drops completed tasks older than the retention window', () => {
    const old = makeTask({ id: 'old', status: 'done', completedAt: WED - 200 * 86_400_000 });
    const recent = makeTask({ id: 'recent', status: 'done', completedAt: WED - 3_600_000 });
    const pruned = pruneCompleted([old, recent], WED, 180);
    expect(pruned.map((t) => t.id)).toEqual(['recent']);
  });

  it('never drops open tasks, however old', () => {
    const ancient = makeTask({ id: 'a', createdAt: WED - 400 * 86_400_000 });
    expect(pruneCompleted([ancient], WED, 180)).toHaveLength(1);
  });

  it('returns the same array when nothing is pruned', () => {
    const tasks = [makeTask()];
    expect(pruneCompleted(tasks, WED, 180)).toBe(tasks);
  });
});
