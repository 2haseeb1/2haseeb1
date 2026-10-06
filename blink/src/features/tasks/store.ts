/**
 * The single source of truth for Blink.
 *
 * Deliberately small: one store, plain arrays, no normalised tables. With a
 * local-only dataset in the hundreds of tasks, `Array.prototype.find` beats the
 * complexity of an indexed store — and every mutation is a pure `Task[] -> Task[]`
 * transformation that is easy to reason about.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

import { setHapticsEnabled } from '@/lib/haptics';
import { createId } from '@/lib/id';
import { defaultReminderFor } from '@/lib/notifications';
import { nextOccurrence } from '@/lib/recurrence';
import { bucketForDue, pruneCompleted, rolloverTasks } from '@/lib/rollover';
import { keyBetween, needsRenormalize, SORT_GAP } from '@/lib/sortKey';
import {
  DEFAULT_SETTINGS,
  type Bucket,
  type NewTaskInput,
  type Settings,
  type Task,
} from '@/lib/types';

import { bySortKey, sortedTasks } from './selectors';

export const STORAGE_KEY = 'blink-store';

/**
 * Storage that cannot take the app down with it.
 *
 * `localStorage` throws in a sandboxed iframe or private-mode web view, and a
 * write can fail when the device is full. Neither is a reason to lose the
 * ability to capture a task, so every failure degrades to an in-memory store and
 * the app keeps working for the session.
 */
const memoryFallback = new Map<string, string>();

const safeStorage: StateStorage = {
  getItem: async (name) => {
    try {
      return await AsyncStorage.getItem(name);
    } catch {
      return memoryFallback.get(name) ?? null;
    }
  },
  setItem: async (name, value) => {
    memoryFallback.set(name, value);
    try {
      await AsyncStorage.setItem(name, value);
    } catch {
      // Memory-only for this session.
    }
  },
  removeItem: async (name) => {
    memoryFallback.delete(name);
    try {
      await AsyncStorage.removeItem(name);
    } catch {
      // Nothing further to do.
    }
  },
};

export interface BlinkState {
  tasks: Task[];
  settings: Settings;
  /** False until AsyncStorage has been read; the UI waits for it. */
  hydrated: boolean;

  addTask: (input: NewTaskInput) => Task;
  updateTask: (id: string, patch: Partial<Omit<Task, 'id'>>) => void;
  completeTask: (id: string) => void;
  reopenTask: (id: string) => void;
  deleteTask: (id: string) => void;
  snoozeTask: (id: string, minutes: number) => void;
  /** "Not today": leaves today's queue but comes back after the rollover. */
  notToday: (id: string) => void;
  setBucket: (id: string, bucket: Bucket) => void;
  moveTask: (id: string, direction: 'up' | 'down') => void;
  applyRollover: (now?: number) => void;
  setSettings: (patch: Partial<Settings>) => void;
  resetAll: () => void;
  markHydrated: () => void;
}

/** Highest existing key in the bucket + gap, so new tasks land at the end. */
function nextSortKey(tasks: Task[], bucket: Bucket): number {
  const keys = tasks.filter((t) => t.bucket === bucket).map((t) => t.sortKey);
  if (keys.length === 0) return SORT_GAP;
  return Math.max(...keys) + SORT_GAP;
}

/** Evenly respace one bucket's tasks when fractional gaps get too small. */
function renormalizeBucket(tasks: Task[], bucket: Bucket): Task[] {
  const ordered = sortedTasks(tasks.filter((t) => t.bucket === bucket));
  const keys = new Map(ordered.map((task, index) => [task.id, (index + 1) * SORT_GAP]));
  return tasks.map((task) =>
    keys.has(task.id) ? { ...task, sortKey: keys.get(task.id) as number } : task
  );
}

function bucketKeys(tasks: Task[], bucket: Bucket): number[] {
  return sortedTasks(tasks.filter((t) => t.bucket === bucket)).map((t) => t.sortKey);
}

export const useBlinkStore = create<BlinkState>()(
  persist(
    (set, get) => ({
      tasks: [],
      settings: DEFAULT_SETTINGS,
      hydrated: false,

      addTask: (input) => {
        const now = Date.now();
        const dueAt = input.dueAt ?? null;
        const rolloverHour = get().settings.rolloverHour;
        const task: Task = {
          id: createId(),
          title: input.title.trim(),
          notes: input.notes,
          dueAt,
          // A due time is a promise to remind: default the reminder to the due
          // moment unless the caller explicitly passed null.
          remindAt:
            input.remindAt !== undefined
              ? input.remindAt
              : defaultReminderFor(dueAt, now),
          bucket: input.bucket ?? bucketForDue(dueAt, now, rolloverHour),
          status: 'open',
          recurrence: input.recurrence ?? null,
          sortKey: nextSortKey(get().tasks, input.bucket ?? bucketForDue(dueAt, now, rolloverHour)),
          createdAt: now,
          completedAt: null,
          snoozedUntil: null,
          snoozeCount: 0,
        };
        set((state) => ({ tasks: [...state.tasks, task] }));
        return task;
      },

      updateTask: (id, patch) =>
        set((state) => ({
          tasks: state.tasks.map((task) => (task.id === id ? { ...task, ...patch } : task)),
        })),

      completeTask: (id) => {
        const now = Date.now();
        set((state) => {
          const target = state.tasks.find((t) => t.id === id);
          if (!target || target.status === 'done') return state;

          const updated = state.tasks.map((task) =>
            task.id === id
              ? { ...task, status: 'done' as const, completedAt: now, snoozedUntil: null }
              : task
          );

          // Recurring tasks never stack up: finishing one mints the next
          // occurrence as a fresh open task, preserving history.
          if (!target.recurrence) return { ...state, tasks: updated };

          // Anchor on the later of "now" and the task's own due date: finishing
          // tomorrow's daily task early must not pull it back to today.
          const anchorFrom = Math.max(now, target.dueAt ?? now);
          const nextDue = nextOccurrence(target.recurrence, anchorFrom, target.dueAt);
          const next: Task = {
            ...target,
            id: createId(),
            status: 'open',
            dueAt: nextDue,
            remindAt: nextDue,
            completedAt: null,
            createdAt: now,
            snoozedUntil: null,
            snoozeCount: 0,
            sortKey: nextSortKey(updated, target.bucket),
          };
          return { ...state, tasks: [...updated, next] };
        });
      },

      reopenTask: (id) =>
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id
              ? { ...task, status: 'open' as const, completedAt: null }
              : task
          ),
        })),

      deleteTask: (id) =>
        set((state) => ({ tasks: state.tasks.filter((task) => task.id !== id) })),

      snoozeTask: (id, minutes) => {
        const until = Date.now() + minutes * 60_000;
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id
              ? {
                  ...task,
                  snoozedUntil: until,
                  // Nudging the reminder forward keeps the OS notification in
                  // sync with what the user just did in the app.
                  remindAt: task.remindAt !== null ? until : null,
                  snoozeCount: task.snoozeCount + 1,
                }
              : task
          ),
        }));
      },

      // Keeps its due date so it resurfaces after the next rollover.
      notToday: (id) =>
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id ? { ...task, bucket: 'later' as const, snoozedUntil: null } : task
          ),
        })),

      setBucket: (id, bucket) =>
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id
              ? { ...task, bucket, sortKey: nextSortKey(state.tasks, bucket) }
              : task
          ),
        })),

      moveTask: (id, direction) =>
        set((state) => {
          const target = state.tasks.find((t) => t.id === id);
          if (!target) return state;

          const list = sortedTasks(state.tasks.filter((t) => t.bucket === target.bucket));
          const index = list.findIndex((t) => t.id === id);
          const destination = direction === 'up' ? index - 1 : index + 1;
          if (index < 0 || destination < 0 || destination >= list.length) return state;

          // Compute the key from the destination's neighbours in the CURRENT
          // order, so the moved task lands strictly between them.
          //   up   -> between list[index-2] and list[index-1]
          //   down -> between list[index+1] and list[index+2]
          const upper = direction === 'up' ? list[index - 2] : list[index + 1];
          const lower = direction === 'up' ? list[index - 1] : (list[index + 2] ?? null);

          const newKey = keyBetween(
            upper ? upper.sortKey : null,
            lower ? lower.sortKey : null
          );

          const moved = state.tasks.map((task) =>
            task.id === id ? { ...task, sortKey: newKey } : task
          );

          return {
            tasks: needsRenormalize(
              moved.filter((t) => t.bucket === target.bucket).map((t) => t.sortKey).sort((a, b) => a - b)
            )
              ? renormalizeBucket(moved, target.bucket)
              : moved,
          };
        }),

      applyRollover: (now = Date.now()) => {
        const state = get();
        const rolled = rolloverTasks(state.tasks, now, state.settings.rolloverHour);
        const pruned = pruneCompleted(rolled.tasks, now);
        if (!rolled.changed && pruned === rolled.tasks) return;
        set({ tasks: pruned });
      },

      setSettings: (patch) => {
        if (patch.haptics !== undefined) setHapticsEnabled(patch.haptics);
        set((state) => ({ settings: { ...state.settings, ...patch } }));
      },

      resetAll: () => {
        setHapticsEnabled(DEFAULT_SETTINGS.haptics);
        set({ tasks: [], settings: DEFAULT_SETTINGS });
      },

      markHydrated: () => set({ hydrated: true }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => safeStorage),
      version: 1,
      partialize: (state) => ({ tasks: state.tasks, settings: state.settings }),
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      },
    }
  )
);

// ------------------------------------------------------------------- selectors
// Small typed hooks keep components free of `useBlinkStore(s => ...)` noise.
export const useTasks = (): Task[] => useBlinkStore((s) => s.tasks);
export const useSettings = (): Settings => useBlinkStore((s) => s.settings);
export const useHydrated = (): boolean => useBlinkStore((s) => s.hydrated);
export const useTaskById = (id: string): Task | undefined =>
  useBlinkStore((s) => s.tasks.find((t) => t.id === id));
export const useTaskCount = (): number => useBlinkStore((s) => s.tasks.length);
export const useBucketOrder = (bucket: Bucket): Task[] =>
  useBlinkStore((s) => sortedTasks(s.tasks.filter((t) => t.bucket === bucket && t.status === 'open')));

export { bySortKey, nextSortKey, renormalizeBucket, bucketKeys };
