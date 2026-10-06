import {
  addDays,
  addDaysToKey,
  atClock,
  computeStreak,
  dayKey,
  daysBetween,
  formatDayLabel,
  formatDue,
  formatRelative,
  formatTime,
  lastDayKeys,
  logicalDayStart,
  startOfDay,
} from '../day';

const WED = new Date(2026, 9, 7, 10, 0, 0).getTime(); // Wed 7 Oct 2026, 10:00 local

describe('dayKey', () => {
  it('formats a sortable local date key', () => {
    expect(dayKey(WED)).toBe('2026-10-07');
  });

  it('uses local time, not UTC', () => {
    // 23:30 local on the 7th is still the 7th locally even though UTC may be the 8th.
    const late = new Date(2026, 9, 7, 23, 30, 0).getTime();
    expect(dayKey(late)).toBe('2026-10-07');
  });
});

describe('addDays / addDaysToKey', () => {
  it('crosses month boundaries', () => {
    expect(dayKey(addDays(new Date(2026, 9, 31).getTime(), 1))).toBe('2026-11-01');
  });

  it('crosses year boundaries backwards', () => {
    expect(addDaysToKey('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('handles a leap day', () => {
    expect(addDaysToKey('2028-02-28', 1)).toBe('2028-02-29');
  });
});

describe('daysBetween', () => {
  it('counts whole calendar days', () => {
    expect(daysBetween(WED, addDays(WED, 3))).toBe(3);
    expect(daysBetween(WED, addDays(WED, -2))).toBe(-2);
  });

  it('ignores time of day', () => {
    const lateToday = new Date(2026, 9, 7, 23, 59, 0).getTime();
    const earlyTomorrow = new Date(2026, 9, 8, 0, 1, 0).getTime();
    expect(daysBetween(lateToday, earlyTomorrow)).toBe(1);
  });
});

describe('logicalDayStart (rollover hour)', () => {
  it('treats 2am as still belonging to the previous day', () => {
    const twoAm = new Date(2026, 9, 8, 2, 0, 0).getTime();
    expect(dayKey(logicalDayStart(twoAm, 4))).toBe('2026-10-07');
  });

  it('starts a new day after the rollover hour', () => {
    const fiveAm = new Date(2026, 9, 8, 5, 0, 0).getTime();
    expect(dayKey(logicalDayStart(fiveAm, 4))).toBe('2026-10-08');
  });

  it('with rollover 0 behaves like plain midnight', () => {
    const twoAm = new Date(2026, 9, 8, 2, 0, 0).getTime();
    expect(logicalDayStart(twoAm, 0)).toBe(startOfDay(twoAm));
  });
});

describe('formatTime', () => {
  it('formats on the hour without minutes', () => {
    expect(formatTime(new Date(2026, 9, 7, 17, 0).getTime())).toBe('5 PM');
  });

  it('formats minutes with a leading zero', () => {
    expect(formatTime(new Date(2026, 9, 7, 6, 5).getTime())).toBe('6:05 AM');
  });

  it('formats noon and midnight as 12', () => {
    expect(formatTime(new Date(2026, 9, 7, 12, 0).getTime())).toBe('12 PM');
    expect(formatTime(new Date(2026, 9, 7, 0, 0).getTime())).toBe('12 AM');
  });
});

describe('formatDayLabel', () => {
  it('names today, tomorrow and yesterday', () => {
    expect(formatDayLabel(WED, WED)).toBe('Today');
    expect(formatDayLabel(addDays(WED, 1), WED)).toBe('Tomorrow');
    expect(formatDayLabel(addDays(WED, -1), WED)).toBe('Yesterday');
  });

  it('names the weekday within the next week', () => {
    expect(formatDayLabel(addDays(WED, 2), WED)).toBe('Fri, Oct 9');
  });
});

describe('formatDue', () => {
  it('describes a same-day future time', () => {
    expect(formatDue(new Date(2026, 9, 7, 15, 0).getTime(), WED)).toBe('Today 3 PM');
  });

  it('never says "overdue" — that is a product rule, not an accident', () => {
    const past = new Date(2026, 9, 6, 9, 0).getTime();
    expect(formatDue(past, WED)).not.toMatch(/overdue/i);
    expect(formatDue(past, WED)).toBe('Rolled over · 9 AM');
  });

  it('returns an empty string when there is no date', () => {
    expect(formatDue(null, WED)).toBe('');
  });

  it('omits the time when asked', () => {
    expect(formatDue(addDays(WED, 1), WED, { withTime: false })).toBe('Tomorrow');
  });
});

describe('formatRelative', () => {
  it('describes recent past times', () => {
    expect(formatRelative(WED - 30_000, WED)).toBe('just now');
    expect(formatRelative(WED - 5 * 60_000, WED)).toBe('5m ago');
    expect(formatRelative(WED - 3 * 3_600_000, WED)).toBe('3h ago');
  });
});

describe('computeStreak', () => {
  it('counts consecutive days ending today', () => {
    expect(computeStreak(['2026-10-07', '2026-10-06', '2026-10-05'], WED)).toBe(3);
  });

  it('stays alive when today has nothing yet but yesterday does', () => {
    expect(computeStreak(['2026-10-06', '2026-10-05'], WED)).toBe(2);
  });

  it('is zero after a full missed day', () => {
    expect(computeStreak(['2026-10-05', '2026-10-04'], WED)).toBe(0);
  });

  it('ignores duplicates and out-of-order keys', () => {
    expect(computeStreak(['2026-10-07', '2026-10-07', '2026-10-06'], WED)).toBe(2);
  });

  it('is zero with no history', () => {
    expect(computeStreak([], WED)).toBe(0);
  });

  it('handles a streak spanning a month boundary', () => {
    const firstNov = new Date(2026, 10, 1, 12, 0, 0).getTime();
    expect(computeStreak(['2026-11-01', '2026-10-31', '2026-10-30'], firstNov)).toBe(3);
  });
});

describe('lastDayKeys', () => {
  it('returns the requested window ending today, oldest first', () => {
    const keys = lastDayKeys(WED, 3);
    expect(keys).toEqual(['2026-10-05', '2026-10-06', '2026-10-07']);
  });
});

describe('atClock', () => {
  it('sets a precise local time on the given day', () => {
    const ts = atClock(WED, 18, 30);
    expect(new Date(ts).getHours()).toBe(18);
    expect(new Date(ts).getMinutes()).toBe(30);
    expect(dayKey(ts)).toBe('2026-10-07');
  });
});
