import { describeRecurrence, nextOccurrence, nextOccurrenceAfter } from '../recurrence';
import { dayKey, formatTime } from '../day';

const WED = new Date(2026, 9, 7, 10, 0, 0).getTime(); // Wed 7 Oct 2026, 10:00

describe('nextOccurrenceAfter', () => {
  it('daily: keeps today when the time is still ahead', () => {
    const ts = nextOccurrenceAfter({ kind: 'daily' }, WED, 18, 0, 3);
    expect(dayKey(ts)).toBe('2026-10-07');
    expect(formatTime(ts)).toBe('6 PM');
  });

  it('daily: moves to tomorrow when the time has passed', () => {
    const ts = nextOccurrenceAfter({ kind: 'daily' }, WED, 7, 0, 3);
    expect(dayKey(ts)).toBe('2026-10-08');
  });

  it('weekly: finds the next matching weekday', () => {
    const ts = nextOccurrenceAfter({ kind: 'weekly', days: [5] }, WED, 9, 0, 3); // Fridays
    expect(dayKey(ts)).toBe('2026-10-09');
  });

  it('weekly: picks the soonest of several days', () => {
    const ts = nextOccurrenceAfter({ kind: 'weekly', days: [1, 4] }, WED, 9, 0, 3); // Mon, Thu
    expect(dayKey(ts)).toBe('2026-10-08'); // Thursday comes first
  });

  it('weekly: never returns today when the time has already passed', () => {
    const ts = nextOccurrenceAfter({ kind: 'weekly', days: [3] }, WED, 7, 0, 3); // Wednesdays, 7am
    expect(dayKey(ts)).toBe('2026-10-14');
  });

  it('weekly: falls back to the anchor weekday for an empty day list', () => {
    const ts = nextOccurrenceAfter({ kind: 'weekly', days: [] }, WED, 9, 0, 3);
    expect(dayKey(ts)).toBe('2026-10-14');
  });

  it('every N days: counts from today when the time is ahead', () => {
    const ts = nextOccurrenceAfter({ kind: 'every', days: 3 }, WED, 18, 0, 3);
    expect(dayKey(ts)).toBe('2026-10-07');
  });

  it('every N days: offsets by N when the time has passed', () => {
    const ts = nextOccurrenceAfter({ kind: 'every', days: 3 }, WED, 7, 0, 3);
    expect(dayKey(ts)).toBe('2026-10-10');
  });

  it('every 1 day behaves like daily', () => {
    const ts = nextOccurrenceAfter({ kind: 'every', days: 1 }, WED, 7, 0, 3);
    expect(dayKey(ts)).toBe('2026-10-08');
  });
});

describe('nextOccurrence', () => {
  it('preserves the wall-clock time of the anchor task', () => {
    const anchor = new Date(2026, 9, 7, 7, 15).getTime();
    const ts = nextOccurrence({ kind: 'daily' }, WED, anchor);
    expect(formatTime(ts)).toBe('7:15 AM');
  });

  it('advances at least one day for a daily anchor that already passed', () => {
    const anchor = new Date(2026, 9, 6, 7, 0).getTime();
    const ts = nextOccurrence({ kind: 'daily' }, WED, anchor);
    expect(ts).toBeGreaterThan(WED);
  });

  it('keeps a weekly rule on its weekday across a month boundary', () => {
    const anchor = new Date(2026, 9, 7, 9, 0).getTime();
    const ts = nextOccurrence({ kind: 'weekly', days: [3] }, WED, anchor);
    expect(dayKey(ts)).toBe('2026-10-14');
    expect(new Date(ts).getDay()).toBe(3);
  });

  it('survives a DST boundary without shifting the hour', () => {
    // US DST ends 1 Nov 2026; a 9am weekly task must stay at 9am.
    const beforeDst = new Date(2026, 9, 28, 9, 0).getTime();
    const ts = nextOccurrence({ kind: 'weekly', days: [3] }, beforeDst, beforeDst);
    expect(new Date(ts).getHours()).toBe(9);
  });
});

describe('describeRecurrence', () => {
  it('describes the empty case', () => {
    expect(describeRecurrence(null)).toBe('Does not repeat');
  });

  it('describes daily', () => {
    expect(describeRecurrence({ kind: 'daily' })).toBe('Every day');
  });

  it('describes weekly with named days', () => {
    expect(describeRecurrence({ kind: 'weekly', days: [1, 3] })).toBe('Every Mon, Wed');
  });

  it('collapses a full week to every day', () => {
    expect(describeRecurrence({ kind: 'weekly', days: [0, 1, 2, 3, 4, 5, 6] })).toBe('Every day');
  });

  it('describes an interval', () => {
    expect(describeRecurrence({ kind: 'every', days: 3 })).toBe('Every 3 days');
    expect(describeRecurrence({ kind: 'every', days: 1 })).toBe('Every day');
  });
});
