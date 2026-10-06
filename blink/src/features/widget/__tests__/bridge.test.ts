/**
 * The bridge is where the app meets two native widget libraries that cannot be
 * exercised in this environment. These tests therefore target the property that
 * actually protects the user: **no widget failure may ever reach the app**.
 *
 * If a native call throws — module missing, widget not on the home screen,
 * permission denied, storage unreadable — the app must behave exactly as if
 * widgets did not exist.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { readPersistedState, startWidgetSync, syncWidgetsNow } from '../bridge';
import { STORAGE_KEY } from '@/features/tasks/store';
import { DEFAULT_SETTINGS, type Task } from '@/lib/types';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: 'Task',
    dueAt: null,
    remindAt: null,
    bucket: 'today',
    status: 'open',
    recurrence: null,
    sortKey: 1024,
    createdAt: Date.now(),
    completedAt: null,
    snoozedUntil: null,
    snoozeCount: 0,
    ...overrides,
  };
}

describe('readPersistedState', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('returns an empty object when nothing has been stored', async () => {
    expect(await readPersistedState()).toEqual({});
  });

  it('reads tasks back out of the persisted store envelope', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ state: { tasks: [makeTask({ title: 'Persisted' })], settings: DEFAULT_SETTINGS } })
    );
    const state = await readPersistedState();
    expect(state.tasks?.[0].title).toBe('Persisted');
    expect(state.settings?.rolloverHour).toBe(4);
  });

  it('survives corrupt JSON rather than throwing into a headless task', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, '{not json');
    expect(await readPersistedState()).toEqual({});
  });

  it('survives a store written in an unexpected shape', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([1, 2, 3]));
    expect(await readPersistedState()).toEqual({});
  });
});

describe('syncWidgetsNow', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('never rejects, even with nonsense input', async () => {
    await expect(syncWidgetsNow([], DEFAULT_SETTINGS)).resolves.toBeUndefined();
  });

  it('never rejects for a task that cannot be rendered', async () => {
    // A task with a missing title would throw inside the snapshot builder; the
    // bridge must absorb that instead of surfacing it to the store subscriber.
    const broken = [{ ...makeTask(), title: undefined as unknown as string }];
    await expect(syncWidgetsNow(broken, DEFAULT_SETTINGS)).resolves.toBeUndefined();
  });

  it('pushes a normal set of tasks without rejecting', async () => {
    const tasks = [
      makeTask({ title: 'Ship the widget', dueAt: Date.now() + 3_600_000 }),
      makeTask({ id: 't2', title: 'Done', status: 'done', completedAt: Date.now() }),
    ];
    await expect(syncWidgetsNow(tasks, DEFAULT_SETTINGS)).resolves.toBeUndefined();
  });
});

describe('startWidgetSync', () => {
  it('returns an unsubscribe function', () => {
    const stop = startWidgetSync();
    expect(typeof stop).toBe('function');
    expect(() => stop()).not.toThrow();
  });

  it('can be started and stopped repeatedly without throwing', () => {
    // Hot reload and remount both do this; a leaked listener would compound.
    for (let i = 0; i < 3; i += 1) {
      const stop = startWidgetSync();
      stop();
    }
  });
});
