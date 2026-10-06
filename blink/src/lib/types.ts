/** Domain types for Blink. Kept separate from the store so `lib/` can import them without cycles. */

export type Bucket = 'today' | 'later';

export type TaskStatus = 'open' | 'done';

/**
 * Recurrence is intentionally tiny. Blink is not a calendar; three shapes cover
 * almost every real "repeat this" need and keep `nextOccurrence` a pure function
 * that is trivial to unit-test.
 */
export type Recurrence =
  | { kind: 'daily' }
  | { kind: 'weekly'; days: number[] } // 0 = Sunday … 6 = Saturday
  | { kind: 'every'; days: number };

export interface Task {
  id: string;
  title: string;
  notes?: string;
  /** Epoch ms of when this is due. Null means "no date, it lives in its bucket". */
  dueAt: number | null;
  /** Epoch ms for a reminder push. Null means "no reminder". */
  remindAt: number | null;
  bucket: Bucket;
  status: TaskStatus;
  recurrence: Recurrence | null;
  /** Fractional index controlling manual order. Never equal between live tasks. */
  sortKey: number;
  createdAt: number;
  completedAt: number | null;
  /** While now < snoozedUntil the task is hidden from the Now Card. */
  snoozedUntil: number | null;
  /** Total times this task was pushed away without being finished. */
  snoozeCount: number;
}

export interface Settings {
  theme: 'midnight' | 'forest' | 'ember' | 'paper';
  haptics: boolean;
  dailyReview: boolean;
  /** 'HH:mm' 24h local time for the daily review nudge. */
  dailyReviewTime: string;
  /** Hour (0-23) at which unfinished work rolls forward. 4 = night-owl friendly. */
  rolloverHour: number;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'midnight',
  haptics: true,
  dailyReview: true,
  dailyReviewTime: '08:00',
  rolloverHour: 4,
};

export interface NewTaskInput {
  title: string;
  dueAt?: number | null;
  remindAt?: number | null;
  bucket?: Bucket;
  recurrence?: Recurrence | null;
  notes?: string;
}
