/**
 * Fractional indexing for manual task order.
 *
 * Moving a task rewrites exactly one row: the moved task's own `sortKey`. No
 * renumbering the list, no write amplification, and it stays correct if two
 * devices reorder at the same time.
 */

/** Distance between adjacent keys when a list is laid out fresh. */
export const SORT_GAP = 1024;

/** Below this gap we renormalise the whole list instead of subdividing forever. */
export const MIN_GAP = 0.0001;

/**
 * A key that sorts strictly between `after` and `before`.
 * Either bound may be null, meaning "head" or "tail".
 */
export function keyBetween(after: number | null, before: number | null): number {
  if (after === null && before === null) return SORT_GAP;
  if (after === null) return (before as number) - SORT_GAP;
  if (before === null) return after + SORT_GAP;
  return (after + before) / 2;
}

/** Keys for a list of `count` tasks, evenly spaced and ascending. */
export function evenlySpacedKeys(count: number, start = 0): number[] {
  return Array.from({ length: count }, (_, i) => (start + i + 1) * SORT_GAP);
}

/** True when any two neighbours are too close to subdivide again safely. */
export function needsRenormalize(sortedKeys: number[]): boolean {
  for (let i = 1; i < sortedKeys.length; i++) {
    if (sortedKeys[i] - sortedKeys[i - 1] < MIN_GAP) return true;
  }
  return false;
}

/** Ascending sort that is stable for equal keys (keeps insertion order). */
export function compareSortKeys(a: number, b: number): number {
  return a - b;
}
