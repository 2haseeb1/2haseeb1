import { parseTaskInput } from '../parse';
import { dayKey, formatTime } from '../day';

/**
 * Fixed clock for every case: Wednesday 7 October 2026, 10:00 local.
 * Using an explicit `now` is the whole reason `parseTaskInput` takes one.
 */
const NOW = new Date(2026, 9, 7, 10, 0, 0).getTime(); // month is 0-indexed

function due(input: string, now = NOW) {
  return parseTaskInput(input, now).dueAt;
}

function clock(input: string, now = NOW) {
  const ts = due(input, now);
  return ts === null ? null : formatTime(ts);
}

function key(input: string, now = NOW) {
  const ts = due(input, now);
  return ts === null ? null : dayKey(ts);
}

function hourOf(input: string, now = NOW) {
  const ts = due(input, now);
  return ts === null ? null : new Date(ts).getHours();
}

describe('parseTaskInput — titles', () => {
  it('leaves a plain task untouched and gives it no date', () => {
    const result = parseTaskInput('buy milk', NOW);
    expect(result.title).toBe('Buy milk');
    expect(result.dueAt).toBeNull();
    expect(result.matched).toEqual([]);
  });

  it('does not treat a bare number as a date', () => {
    const result = parseTaskInput('buy 2 apples and 3 bananas', NOW);
    expect(result.title).toBe('Buy 2 apples and 3 bananas');
    expect(result.dueAt).toBeNull();
  });

  it('does not match a weekday inside another word', () => {
    const result = parseTaskInput('money transfer', NOW);
    expect(result.dueAt).toBeNull();
    expect(result.title).toBe('Money transfer');
  });

  it('strips the matched date from the title', () => {
    expect(parseTaskInput('call mom tomorrow', NOW).title).toBe('Call mom');
  });

  it('strips a dangling preposition left behind', () => {
    expect(parseTaskInput('call mom tomorrow at 5pm', NOW).title).toBe('Call mom');
  });

  it('keeps an unrecognised token in the title', () => {
    const result = parseTaskInput('review the Q3 deck tomorrow', NOW);
    expect(result.title).toBe('Review the Q3 deck');
  });

  it('falls back to the raw input when everything matched', () => {
    expect(parseTaskInput('tomorrow', NOW).title).toBe('Tomorrow');
  });
});

describe('parseTaskInput — relative days', () => {
  it('parses tomorrow with a default 9am clock', () => {
    expect(key('call mom tomorrow')).toBe('2026-10-08');
    expect(clock('call mom tomorrow')).toBe('9 AM');
    expect(parseTaskInput('call mom tomorrow', NOW).timeAssumed).toBe(true);
  });

  it('parses today without assuming a time when one is given', () => {
    const result = parseTaskInput('stretch today at 4pm', NOW);
    expect(key('stretch today at 4pm')).toBe('2026-10-07');
    expect(clock('stretch today at 4pm')).toBe('4 PM');
    expect(result.timeAssumed).toBe(false);
  });

  it('parses tonight as 8pm today', () => {
    expect(key('take bins out tonight')).toBe('2026-10-07');
    expect(clock('take bins out tonight')).toBe('8 PM');
  });

  it('parses the day after tomorrow', () => {
    expect(key('dentist day after tomorrow')).toBe('2026-10-09');
  });

  it('parses next week as +7 days', () => {
    expect(key('book flights next week')).toBe('2026-10-14');
  });

  it('parses in 20 minutes exactly', () => {
    expect(due('take the call in 20 minutes')).toBe(NOW + 20 * 60_000);
  });

  it('parses in 2 hours exactly', () => {
    expect(due('check the oven in 2 hours')).toBe(NOW + 2 * 3_600_000);
  });

  it('parses in 3 days exactly', () => {
    expect(due('follow up in 3 days')).toBe(NOW + 3 * 86_400_000);
  });

  it('parses the shorthand in 30m', () => {
    expect(due('ping sam in 30m')).toBe(NOW + 30 * 60_000);
  });
});

describe('parseTaskInput — weekdays', () => {
  it('resolves the next Wednesday to a week away, not today', () => {
    expect(key('standup wednesday')).toBe('2026-10-14');
  });

  it('resolves friday to this coming Friday', () => {
    expect(key('call dad friday')).toBe('2026-10-09');
  });

  it('resolves saturday with a default 9am clock', () => {
    expect(clock('long run saturday')).toBe('9 AM');
  });

  it('treats next friday as the following week when it would be tomorrow', () => {
    // On Thursday, "next friday" must not mean tomorrow.
    const thursday = new Date(2026, 9, 8, 10, 0, 0).getTime();
    expect(key('review next friday', thursday)).toBe('2026-10-16');
  });

  it('accepts abbreviations', () => {
    expect(key('gym mon', NOW)).toBe('2026-10-12');
    expect(key('gym thurs', NOW)).toBe('2026-10-08');
  });
});

describe('parseTaskInput — clock times', () => {
  it('parses a bare pm time as today when still ahead', () => {
    expect(clock('call the bank 5pm')).toBe('5 PM');
    expect(key('call the bank 5pm')).toBe('2026-10-07');
  });

  it('rolls a past time to tomorrow', () => {
    expect(key('call the bank 8am')).toBe('2026-10-08');
  });

  it('parses 24-hour times', () => {
    expect(clock('deploy 17:30')).toBe('5:30 PM');
  });

  it('parses minutes with am/pm', () => {
    expect(clock('wake up 6:45am')).toBe('6:45 AM');
  });

  it('handles noon and midnight', () => {
    expect(hourOf('lunch noon')).toBe(12);
    expect(hourOf('swap at midnight')).toBe(0);
  });

  it('reports friendly chip labels for noon and midnight', () => {
    expect(parseTaskInput('lunch noon', NOW).matched).toContain('Noon');
    expect(parseTaskInput('swap at midnight', NOW).matched).toContain('Midnight');
  });

  it('handles parts of day', () => {
    expect(clock('review this evening')).toBe('7 PM');
    expect(clock('review this afternoon')).toBe('2 PM');
  });

  it('parses 12am as midnight, not noon', () => {
    expect(hourOf('flight 12am')).toBe(0);
  });

  it('parses 12pm as noon', () => {
    expect(hourOf('flight 12pm')).toBe(12);
  });
});

describe('parseTaskInput — recurrence', () => {
  it('parses every day', () => {
    const result = parseTaskInput('stretch every day', NOW);
    expect(result.recurrence).toEqual({ kind: 'daily' });
    expect(result.title).toBe('Stretch');
    expect(result.matched).toContain('Every day');
  });

  it('parses daily', () => {
    expect(parseTaskInput('review goals daily', NOW).recurrence).toEqual({ kind: 'daily' });
  });

  it('parses every <weekday> as a weekly rule and prefers it over a plain weekday', () => {
    const result = parseTaskInput('team sync every monday', NOW);
    expect(result.recurrence).toEqual({ kind: 'weekly', days: [1] });
    expect(result.title).toBe('Team sync');
  });

  it('parses multiple weekdays', () => {
    const result = parseTaskInput('gym every mon, wed and fri', NOW);
    expect(result.recurrence).toEqual({ kind: 'weekly', days: [1, 3, 5] });
  });

  it('parses every N days', () => {
    const result = parseTaskInput('water plants every 3 days', NOW);
    expect(result.recurrence).toEqual({ kind: 'every', days: 3 });
    expect(result.title).toBe('Water plants');
  });

  it('anchors a daily recurrence to its next occurrence', () => {
    // 10am start, 9am default clock -> first occurrence is tomorrow 9am.
    const result = parseTaskInput('journal every day', NOW);
    expect(dayKey(result.dueAt as number)).toBe('2026-10-08');
    expect(formatTime(result.dueAt as number)).toBe('9 AM');
  });

  it('anchors a weekly recurrence to the right weekday', () => {
    const result = parseTaskInput('team sync every monday', NOW);
    expect(dayKey(result.dueAt as number)).toBe('2026-10-12');
  });

  it('honours an explicit time inside a recurrence', () => {
    const result = parseTaskInput('gym every day at 7am', NOW);
    expect(result.recurrence).toEqual({ kind: 'daily' });
    expect(formatTime(result.dueAt as number)).toBe('7 AM');
    // 7am already passed today at 10am, so the first one is tomorrow.
    expect(dayKey(result.dueAt as number)).toBe('2026-10-08');
  });
});

describe('parseTaskInput — buckets and chips', () => {
  it('suggests the later bucket for someday', () => {
    const result = parseTaskInput('learn to sail someday', NOW);
    expect(result.bucket).toBe('later');
    expect(result.title).toBe('Learn to sail');
  });

  it('reports friendly labels for what it understood', () => {
    const result = parseTaskInput('call mom tomorrow at 5pm', NOW);
    expect(result.matched).toEqual(expect.arrayContaining(['Tomorrow', '5 PM']));
  });

  it('does not duplicate labels', () => {
    const result = parseTaskInput('standup tomorrow at 9am tomorrow', NOW);
    expect(result.matched.filter((l) => l === 'Tomorrow')).toHaveLength(1);
  });
});

describe('parseTaskInput — edge cases', () => {
  it('returns an empty result for blank input', () => {
    const result = parseTaskInput('   ', NOW);
    expect(result.title).toBe('');
    expect(result.dueAt).toBeNull();
  });

  it('is case insensitive', () => {
    expect(key('CALL MOM TOMORROW')).toBe('2026-10-08');
  });

  it('handles month and day', () => {
    expect(key('renew passport oct 12')).toBe('2026-10-12');
  });

  it('rolls a passed month/day to next year', () => {
    expect(key('renew passport oct 1')).toBe('2027-10-01');
  });

  it('handles on the 5th', () => {
    expect(key('pay rent on the 5th')).toBe('2026-11-05');
  });

  it('never returns a non-finite due date', () => {
    for (const input of ['a', 'x y z', '!!', 'tomorrow', 'in 0 minutes']) {
      const ts = parseTaskInput(input, NOW).dueAt;
      expect(ts === null || Number.isFinite(ts)).toBe(true);
    }
  });
});
