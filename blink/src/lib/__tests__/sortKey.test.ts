import {
  evenlySpacedKeys,
  keyBetween,
  MIN_GAP,
  needsRenormalize,
  SORT_GAP,
} from '../sortKey';

describe('keyBetween', () => {
  it('returns a default gap for an empty list', () => {
    expect(keyBetween(null, null)).toBe(SORT_GAP);
  });

  it('appends after the last key', () => {
    expect(keyBetween(1024, null)).toBe(2048);
  });

  it('prepends before the first key', () => {
    expect(keyBetween(null, 1024)).toBe(0);
  });

  it('takes the midpoint between two keys', () => {
    expect(keyBetween(1024, 2048)).toBe(1536);
  });

  it('always lands strictly between its bounds', () => {
    const key = keyBetween(1000, 1001);
    expect(key).toBeGreaterThan(1000);
    expect(key).toBeLessThan(1001);
  });

  it('subdivides repeatedly without collision', () => {
    let lower = 1024;
    const upper = 2048;
    const keys: number[] = [];
    for (let i = 0; i < 10; i++) {
      const key = keyBetween(lower, upper);
      keys.push(key);
      lower = key;
    }
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toEqual([...keys].sort((a, b) => a - b));
  });
});

describe('evenlySpacedKeys', () => {
  it('produces ascending, evenly spaced keys', () => {
    expect(evenlySpacedKeys(3)).toEqual([1024, 2048, 3072]);
  });

  it('handles zero tasks', () => {
    expect(evenlySpacedKeys(0)).toEqual([]);
  });
});

describe('needsRenormalize', () => {
  it('is false for comfortably spaced keys', () => {
    expect(needsRenormalize([1024, 2048, 3072])).toBe(false);
  });

  it('is false for a single key or none', () => {
    expect(needsRenormalize([1024])).toBe(false);
    expect(needsRenormalize([])).toBe(false);
  });

  it('is true when neighbours get too close to subdivide', () => {
    expect(needsRenormalize([1024, 1024 + MIN_GAP / 2])).toBe(true);
  });

  it('detects the collision that would follow endless subdivision', () => {
    let lower = 1024;
    const upper = 2048;
    // 60 halvings is well past float precision for this range.
    for (let i = 0; i < 60; i++) lower = keyBetween(lower, upper);
    expect(needsRenormalize([lower, upper])).toBe(true);
  });
});
