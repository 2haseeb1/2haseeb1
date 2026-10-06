/**
 * Store behaviour tests.
 *
 * These cover the rules most likely to break silently: fractional reordering,
 * recurrence spawning, and the guarantee that rollover never mutates state it
 * does not need to (which would cause needless re-renders and writes).
 */

import { useBlinkStore } from '@/features/tasks/store';
import { DEFAULT_SETTINGS, type NewTaskInput, type Task } from '@/lib/types';
import { dayKey, formatTime } from '@/lib/day';
import { nowCard, todayQueue, streakDays, doneToday } from '@/features/tasks/selectors';

const WED = new Date(2026, 9, 7, 10, 0, 0).getTime();

function reset(): void {
  useBlinkStore.setState({ tasks: [], settings: DEFAULT_SETTINGS, hydrated: true });
}

function addTask(input: NewTaskInput): Task {
  return useBlinkStore.getState().addTask(input);
}

beforeEach(reset);

describe('addTask', () => {
  it('creates an open task in the today bucket by default', () => {
    const task = addTask({ title: 'Buy milk' });
    expect(task.status).toBe('open');
    expect(task.bucket).toBe('today');
    expect(useBlinkStore.getState().tasks).toHaveLength(1);
  });

  it('trims the title', () => {
    expect(addTask({ title: '  Call mom  ' }).title).toBe('Call mom');
  });

  it('derives a reminder from a future due date', () => {
    const due = WED + 3_600_000;
    const task = addTask({ title: 'Standup', dueAt: due });
    expect(task.remindAt).toBe(due);
  });

  it('creates no reminder for an undated task', () => {
    expect(addTask({ title: 'Someday thing' }).remindAt).toBeNull();
  });

  it('does not create a reminder for a past due date', () => {
    expect(addTask({ title: 'Late', dueAt: Date.now() - 3_600_000 }).remindAt).toBeNull();
  });

  it('respects an explicitly null reminder', () => {
    const task = addTask({ title: 'Quiet', dueAt: WED + 3_600_000, remindAt: null });
    expect(task.remindAt).toBeNull();
  });

  it('files a future task in the later bucket', () => {
    const task = addTask({ title: 'Trip', dueAt: new Date(2026, 9, 20).getTime() });
    expect(task.bucket).toBe('later');
  });

  it('appends new tasks so they queue behind existing ones', () => {
    const first = addTask({ title: 'First' });
    const second = addTask({ title: 'Second' });
    expect(second.sortKey).toBeGreaterThan(first.sortKey);
  });

  it('gives every task a unique id', () => {
    const ids = new Set([addTask({ title: 'a' }).id, addTask({ title: 'b' }).id, addTask({ title: 'c' }).id]);
    expect(ids.size).toBe(3);
  });
});

describe('completeTask', () => {
  it('marks a task done and stamps the completion time', () => {
    const task = addTask({ title: 'Do it' });
    useBlinkStore.getState().completeTask(task.id);
    const stored = useBlinkStore.getState().tasks[0];
    expect(stored.status).toBe('done');
    expect(stored.completedAt).not.toBeNull();
  });

  it('is idempotent', () => {
    const task = addTask({ title: 'Do it' });
    useBlinkStore.getState().completeTask(task.id);
    const first = useBlinkStore.getState().tasks[0].completedAt;
    useBlinkStore.getState().completeTask(task.id);
    expect(useBlinkStore.getState().tasks).toHaveLength(1);
    expect(useBlinkStore.getState().tasks[0].completedAt).toBe(first);
  });

  it('spawns the next occurrence for a recurring task', () => {
    const task = addTask({
      title: 'Water plants',
      dueAt: WED + 3_600_000,
      recurrence: { kind: 'daily' },
    });
    useBlinkStore.getState().completeTask(task.id);

    const tasks = useBlinkStore.getState().tasks;
    expect(tasks).toHaveLength(2);

    const done = tasks.find((t) => t.status === 'done');
    const next = tasks.find((t) => t.status === 'open');
    expect(done?.id).toBe(task.id);
    expect(next?.title).toBe('Water plants');
    expect(next?.id).not.toBe(task.id);
    expect(next?.dueAt).toBeGreaterThan(task.dueAt as number);
  });

  it('keeps the next occurrence on the same clock time', () => {
    const due = new Date(2026, 9, 8, 7, 30).getTime();
    const task = addTask({ title: 'Gym', dueAt: due, recurrence: { kind: 'daily' } });
    useBlinkStore.getState().completeTask(task.id);
    const next = useBlinkStore.getState().tasks.find((t) => t.status === 'open');
    expect(formatTime(next?.dueAt as number)).toBe('7:30 AM');
  });

  it('does not spawn anything for a one-off task', () => {
    const task = addTask({ title: 'One off' });
    useBlinkStore.getState().completeTask(task.id);
    expect(useBlinkStore.getState().tasks).toHaveLength(1);
  });

  it('ignores an unknown id', () => {
    addTask({ title: 'Keep me' });
    useBlinkStore.getState().completeTask('nope');
    expect(useBlinkStore.getState().tasks[0].status).toBe('open');
  });
});

describe('reopenTask / deleteTask', () => {
  it('reopens a completed task', () => {
    const task = addTask({ title: 'Undo me' });
    useBlinkStore.getState().completeTask(task.id);
    useBlinkStore.getState().reopenTask(task.id);
    expect(useBlinkStore.getState().tasks[0].status).toBe('open');
    expect(useBlinkStore.getState().tasks[0].completedAt).toBeNull();
  });

  it('deletes a task', () => {
    const task = addTask({ title: 'Delete me' });
    useBlinkStore.getState().deleteTask(task.id);
    expect(useBlinkStore.getState().tasks).toHaveLength(0);
  });
});

describe('snoozeTask', () => {
  it('hides the task from the Now Card until the snooze expires', () => {
    const task = addTask({ title: 'Snoozy' });
    useBlinkStore.getState().snoozeTask(task.id, 10);
    const now = Date.now();
    expect(nowCard(useBlinkStore.getState().tasks, now)).toBeNull();
    expect(todayQueue(useBlinkStore.getState().tasks, now)).toHaveLength(0);
  });

  it('brings the task back once the window passes', () => {
    const task = addTask({ title: 'Snoozy' });
    useBlinkStore.getState().snoozeTask(task.id, 10);
    const later = Date.now() + 11 * 60_000;
    expect(nowCard(useBlinkStore.getState().tasks, later)?.id).toBe(task.id);
  });

  it('counts how often a task was pushed away', () => {
    const task = addTask({ title: 'Repeatedly snoozed' });
    useBlinkStore.getState().snoozeTask(task.id, 5);
    useBlinkStore.getState().snoozeTask(task.id, 5);
    expect(useBlinkStore.getState().tasks[0].snoozeCount).toBe(2);
  });
});

describe('notToday', () => {
  it('moves the task to the later bucket and keeps its due date', () => {
    const due = WED + 3_600_000;
    const task = addTask({ title: 'Not now', dueAt: due });
    useBlinkStore.getState().notToday(task.id);
    const stored = useBlinkStore.getState().tasks[0];
    expect(stored.bucket).toBe('later');
    expect(stored.dueAt).toBe(due);
  });

  it('removes it from today’s queue but keeps it recoverable', () => {
    const task = addTask({ title: 'Not now' });
    useBlinkStore.getState().notToday(task.id);
    expect(todayQueue(useBlinkStore.getState().tasks, Date.now())).toHaveLength(0);
    expect(useBlinkStore.getState().tasks).toHaveLength(1);
  });
});

describe('moveTask', () => {
  it('moves a task up in the manual order', () => {
    const a = addTask({ title: 'A' });
    const b = addTask({ title: 'B' });
    const c = addTask({ title: 'C' });

    useBlinkStore.getState().moveTask(c.id, 'up');
    const order = todayQueue(useBlinkStore.getState().tasks, Date.now()).map((t) => t.id);
    expect(order).toEqual([a.id, c.id, b.id]);
  });

  it('moves a task down in the manual order', () => {
    const a = addTask({ title: 'A' });
    const b = addTask({ title: 'B' });
    const c = addTask({ title: 'C' });

    useBlinkStore.getState().moveTask(a.id, 'down');
    const order = todayQueue(useBlinkStore.getState().tasks, Date.now()).map((t) => t.id);
    expect(order).toEqual([b.id, a.id, c.id]);
  });

  it('is a no-op at the top of the list', () => {
    const a = addTask({ title: 'A' });
    const b = addTask({ title: 'B' });
    useBlinkStore.getState().moveTask(a.id, 'up');
    expect(todayQueue(useBlinkStore.getState().tasks, Date.now()).map((t) => t.id)).toEqual([a.id, b.id]);
  });

  it('is a no-op at the bottom of the list', () => {
    const a = addTask({ title: 'A' });
    const b = addTask({ title: 'B' });
    useBlinkStore.getState().moveTask(b.id, 'down');
    expect(todayQueue(useBlinkStore.getState().tasks, Date.now()).map((t) => t.id)).toEqual([a.id, b.id]);
  });

  it('keeps every key distinct after many moves', () => {
    const ids = ['A', 'B', 'C', 'D', 'E'].map((title) => addTask({ title }).id);
    for (let i = 0; i < 40; i++) {
      useBlinkStore.getState().moveTask(ids[i % ids.length], i % 2 === 0 ? 'down' : 'up');
    }
    const keys = useBlinkStore.getState().tasks.map((t) => t.sortKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('survives enough up-moves to exhaust float precision', () => {
    const a = addTask({ title: 'A' });
    const b = addTask({ title: 'B' });
    // Repeatedly inserting between the same two keys is exactly what forces a
    // renormalisation.
    for (let i = 0; i < 60; i++) {
      useBlinkStore.getState().moveTask(b.id, 'up');
      useBlinkStore.getState().moveTask(b.id, 'down');
    }
    const order = todayQueue(useBlinkStore.getState().tasks, Date.now()).map((t) => t.id);
    expect(order).toEqual([a.id, b.id]);
    const keys = useBlinkStore.getState().tasks.map((t) => t.sortKey).sort((x, y) => x - y);
    expect(keys[1] - keys[0]).toBeGreaterThan(0);
  });
});

describe('applyRollover', () => {
  it('rolls a stale task forward to today', () => {
    const stale = addTask({ title: 'Old', dueAt: null });
    useBlinkStore.setState({
      tasks: useBlinkStore.getState().tasks.map((t) => ({
        ...t,
        id: stale.id,
        dueAt: new Date(2026, 8, 20, 15, 0).getTime(),
      })),
    });
    useBlinkStore.getState().applyRollover(WED);
    const rolled = useBlinkStore.getState().tasks[0];
    expect(dayKey(rolled.dueAt as number)).toBe('2026-10-07');
    expect(formatTime(rolled.dueAt as number)).toBe('3 PM');
  });

  it('leaves already-current tasks untouched', () => {
    addTask({ title: 'Fresh', dueAt: new Date(2026, 9, 7, 18, 0).getTime() });
    const before = useBlinkStore.getState().tasks;
    useBlinkStore.getState().applyRollover(WED);
    expect(useBlinkStore.getState().tasks).toBe(before);
  });
});

describe('streak and done log', () => {
  it('reports a streak of one after the first completion', () => {
    const task = addTask({ title: 'First win' });
    useBlinkStore.getState().completeTask(task.id);
    expect(streakDays(useBlinkStore.getState().tasks, Date.now())).toBe(1);
  });

  it('counts today’s finished tasks', () => {
    const a = addTask({ title: 'A' });
    const b = addTask({ title: 'B' });
    useBlinkStore.getState().completeTask(a.id);
    useBlinkStore.getState().completeTask(b.id);
    expect(doneToday(useBlinkStore.getState().tasks, Date.now())).toHaveLength(2);
  });

  it('does not count a reopened task', () => {
    const task = addTask({ title: 'Undone' });
    useBlinkStore.getState().completeTask(task.id);
    useBlinkStore.getState().reopenTask(task.id);
    expect(doneToday(useBlinkStore.getState().tasks, Date.now())).toHaveLength(0);
  });
});

describe('settings', () => {
  it('persists a theme change', () => {
    useBlinkStore.getState().setSettings({ theme: 'forest' });
    expect(useBlinkStore.getState().settings.theme).toBe('forest');
  });

  it('keeps unrelated settings', () => {
    useBlinkStore.getState().setSettings({ haptics: false });
    expect(useBlinkStore.getState().settings.dailyReviewTime).toBe(DEFAULT_SETTINGS.dailyReviewTime);
  });

  it('resetAll clears tasks and restores defaults', () => {
    addTask({ title: 'Something' });
    useBlinkStore.getState().setSettings({ theme: 'ember' });
    useBlinkStore.getState().resetAll();
    expect(useBlinkStore.getState().tasks).toHaveLength(0);
    expect(useBlinkStore.getState().settings).toEqual(DEFAULT_SETTINGS);
  });
});
