/**
 * Render smoke tests.
 *
 * These do not try to be an exhaustive UI suite. Their job is to catch the class
 * of bug the type checker and pure unit tests cannot see: a screen that throws on
 * first render because of a bad hook, a missing provider, or a wrong prop, plus
 * the handful of interactions that define the product.
 *
 * Note that every helper in @testing-library/react-native v14 is async — `render`
 * and `fireEvent` both return promises and must be awaited.
 */

import { render, screen, fireEvent } from '@testing-library/react-native';

import TodayScreen from '@/app/(tabs)/index';
import LaterScreen from '@/app/(tabs)/later';
import DoneScreen from '@/app/(tabs)/done';
import CaptureScreen from '@/app/capture';
import SettingsScreen from '@/app/settings';
import FocusScreen from '@/app/now';
import TaskDetailScreen from '@/app/task/[id]';
import { nextSortKey, useBlinkStore } from '@/features/tasks/store';
import { createId } from '@/lib/id';
import { DEFAULT_SETTINGS, type Task } from '@/lib/types';

// --- navigation and native module doubles -----------------------------------

const mockBack = jest.fn();
const mockPush = jest.fn();
const currentRouteId = { value: '' };

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush, replace: jest.fn() }),
  useLocalSearchParams: () => ({ id: currentRouteId.value }),
  Stack: { Screen: () => null },
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
  DarkTheme: { colors: {} },
  DefaultTheme: { colors: {} },
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  performAndroidHapticsAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  AndroidHaptics: {
    Confirm: 'confirm',
    Reject: 'reject',
    Clock_Tick: 'clock-tick',
    Gesture_Start: 'gesture-start',
  },
}));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn().mockResolvedValue({ granted: true, canAskAgain: true }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(null),
  cancelAllScheduledNotificationsAsync: jest.fn().mockResolvedValue(undefined),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('id'),
  AndroidImportance: { HIGH: 6 },
  AndroidNotificationVisibility: { PUBLIC: 1 },
  IosAuthorizationStatus: { PROVISIONAL: 3 },
  SchedulableTriggerInputTypes: { DATE: 'date', DAILY: 'daily', TIME_INTERVAL: 'timeInterval' },
}));

// --- fixtures ---------------------------------------------------------------

function makeTask(overrides: Partial<Task> = {}): Task {
  const now = Date.now();
  return {
    id: createId(),
    title: 'Task',
    dueAt: null,
    remindAt: null,
    bucket: 'today',
    status: 'open',
    recurrence: null,
    sortKey: 1024,
    createdAt: now,
    completedAt: null,
    snoozedUntil: null,
    snoozeCount: 0,
    ...overrides,
  };
}

/** Seeds the store, assigning distinct order keys so ordering is deterministic. */
function seed(tasks: Task[]): void {
  const assigned: Task[] = [];
  for (const task of tasks) {
    assigned.push({
      ...task,
      sortKey: nextSortKey(
        assigned.filter((t) => t.bucket === task.bucket),
        task.bucket
      ),
    });
  }
  useBlinkStore.setState({ tasks: assigned, settings: DEFAULT_SETTINGS, hydrated: true });
}

beforeEach(() => {
  jest.clearAllMocks();
  currentRouteId.value = '';
  useBlinkStore.setState({ tasks: [], settings: DEFAULT_SETTINGS, hydrated: true });
});

describe('TodayScreen', () => {
  it('renders an encouragement empty state with nothing queued', async () => {
    await render(<TodayScreen />);
    expect(screen.getByText('Nothing queued')).toBeTruthy();
  });

  it('promotes the dated task into the Now Card', async () => {
    seed([
      makeTask({ title: 'Undated thing' }),
      makeTask({ title: 'Dated thing', dueAt: Date.now() + 3_600_000 }),
    ]);
    await render(<TodayScreen />);
    expect(screen.getByText('THE ONE THING')).toBeTruthy();
    expect(screen.getByText('Dated thing')).toBeTruthy();
  });

  it('completes the focused task from the Now Card', async () => {
    seed([makeTask({ title: 'Only task' })]);
    await render(<TodayScreen />);
    await fireEvent.press(screen.getByLabelText('Done'));
    expect(useBlinkStore.getState().tasks[0].status).toBe('done');
  });

  it('snoozes the focused task', async () => {
    seed([makeTask({ title: 'Only task' })]);
    await render(<TodayScreen />);
    await fireEvent.press(screen.getByLabelText('Snooze 10m'));
    expect(useBlinkStore.getState().tasks[0].snoozedUntil).toBeGreaterThan(Date.now());
  });

  it('moves the focused task out of today with Not today', async () => {
    seed([makeTask({ title: 'Only task' })]);
    await render(<TodayScreen />);
    await fireEvent.press(screen.getByLabelText('Not today'));
    expect(useBlinkStore.getState().tasks[0].bucket).toBe('later');
  });

  it('toggles a task from its own checkbox', async () => {
    // Two tasks so the second stays in the list: a lone task is promoted to the
    // Now Card and never renders a row.
    seed([
      makeTask({ title: 'Focused task', dueAt: Date.now() + 3_600_000 }),
      makeTask({ title: 'Toggle me' }),
    ]);
    await render(<TodayScreen />);
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Complete Toggle me' }));
    const toggled = useBlinkStore.getState().tasks.find((t) => t.title === 'Toggle me');
    expect(toggled?.status).toBe('done');
  });

  it('shows a progress line when there is work', async () => {
    seed([makeTask({ title: 'A' }), makeTask({ title: 'B' })]);
    await render(<TodayScreen />);
    expect(screen.getByText(/done ·/)).toBeTruthy();
  });

  it('opens quick capture from the add button', async () => {
    await render(<TodayScreen />);
    await fireEvent.press(screen.getByLabelText('Add a task'));
    expect(mockPush).toHaveBeenCalledWith('/capture');
  });

  it('renders a snoozed task in its own section', async () => {
    seed([makeTask({ title: 'Sleeping', snoozedUntil: Date.now() + 600_000 })]);
    await render(<TodayScreen />);
    expect(screen.getByText('SNOOZED')).toBeTruthy();
    expect(screen.getByText('Sleeping')).toBeTruthy();
  });
});

describe('LaterScreen', () => {
  it('renders its empty state', async () => {
    await render(<LaterScreen />);
    expect(screen.getByText('Nothing here')).toBeTruthy();
  });

  it('groups undated work under SOMEDAY', async () => {
    seed([makeTask({ title: 'Someday thing', bucket: 'later' })]);
    await render(<LaterScreen />);
    expect(screen.getByText('SOMEDAY')).toBeTruthy();
    expect(screen.getByText('Someday thing')).toBeTruthy();
  });

  it('groups dated work by day rather than under SOMEDAY', async () => {
    seed([
      makeTask({ title: 'Next month thing', bucket: 'later', dueAt: Date.now() + 20 * 86_400_000 }),
    ]);
    await render(<LaterScreen />);
    expect(screen.queryByText('SOMEDAY')).toBeNull();
    expect(screen.getByText('Next month thing')).toBeTruthy();
  });

  it('completes a task straight from the Later list', async () => {
    seed([makeTask({ title: 'Later task', bucket: 'later' })]);
    await render(<LaterScreen />);
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Complete Later task' }));
    expect(useBlinkStore.getState().tasks[0].status).toBe('done');
  });
});

describe('DoneScreen', () => {
  it('invites the first completion when empty', async () => {
    await render(<DoneScreen />);
    expect(screen.getByText('Start a streak')).toBeTruthy();
  });

  it('shows a streak and today’s count once something is finished', async () => {
    seed([makeTask({ title: 'Finished', status: 'done', completedAt: Date.now() - 60_000 })]);
    await render(<DoneScreen />);
    expect(screen.getByText('1 day streak')).toBeTruthy();
    expect(screen.getByText('TODAY · 1')).toBeTruthy();
  });

  it('reopens a task when its checkbox is tapped', async () => {
    seed([makeTask({ title: 'Finished', status: 'done', completedAt: Date.now() - 60_000 })]);
    await render(<DoneScreen />);
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Reopen Finished' }));
    expect(useBlinkStore.getState().tasks[0].status).toBe('open');
  });
});

describe('CaptureScreen', () => {
  it('parses a date out of the sentence and shows what it understood', async () => {
    await render(<CaptureScreen />);
    await fireEvent.changeText(
      screen.getByLabelText('Task description'),
      'call mom tomorrow at 5pm'
    );
    expect(screen.getByText('UNDERSTOOD')).toBeTruthy();
    // "Tomorrow" also exists as a quick-date chip, so assert on presence rather
    // than uniqueness.
    expect(screen.getAllByText('Tomorrow').length).toBeGreaterThan(0);
    expect(screen.getAllByText('5 PM').length).toBeGreaterThan(0);
  });

  it('creates the task with the parsed due date and cleaned title', async () => {
    await render(<CaptureScreen />);
    await fireEvent.changeText(
      screen.getByLabelText('Task description'),
      'call mom tomorrow at 5pm'
    );
    await fireEvent.press(screen.getByTestId('capture-save'));

    const tasks = useBlinkStore.getState().tasks;
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe('Call mom');
    expect(new Date(tasks[0].dueAt as number).getHours()).toBe(17);
    expect(mockBack).toHaveBeenCalled();
  });

  it('lets the user override the parser with a quick date chip', async () => {
    await render(<CaptureScreen />);
    await fireEvent.changeText(screen.getByLabelText('Task description'), 'something today');
    await fireEvent.press(screen.getByLabelText('Next week'));
    await fireEvent.press(screen.getByTestId('capture-save'));

    const due = useBlinkStore.getState().tasks[0].dueAt as number;
    expect(due).toBeGreaterThan(Date.now() + 6 * 86_400_000);
  });

  it('saves nothing when the input is empty', async () => {
    await render(<CaptureScreen />);
    await fireEvent.press(screen.getByTestId('capture-save'));
    expect(useBlinkStore.getState().tasks).toHaveLength(0);
  });

  it('creates a recurring task from the repeat chips', async () => {
    await render(<CaptureScreen />);
    await fireEvent.changeText(screen.getByLabelText('Task description'), 'water plants');
    await fireEvent.press(screen.getByLabelText('Every day'));
    await fireEvent.press(screen.getByTestId('capture-save'));
    expect(useBlinkStore.getState().tasks[0].recurrence).toEqual({ kind: 'daily' });
  });

  it('offers tappable examples that fill the input', async () => {
    await render(<CaptureScreen />);
    await fireEvent.press(screen.getByText('pay rent on the 5th'));
    expect(screen.getByDisplayValue('pay rent on the 5th')).toBeTruthy();
  });
});

describe('FocusScreen', () => {
  it('shows the focused task', async () => {
    seed([makeTask({ title: 'Deep work' })]);
    await render(<FocusScreen />);
    expect(screen.getByText('Deep work')).toBeTruthy();
    expect(screen.getByText('FOCUS')).toBeTruthy();
  });

  it('handles having nothing left to focus on', async () => {
    await render(<FocusScreen />);
    expect(screen.getByText('Nothing to focus on')).toBeTruthy();
  });
});

describe('TaskDetailScreen', () => {
  it('handles a missing task without crashing', async () => {
    currentRouteId.value = 'does-not-exist';
    await render(<TaskDetailScreen />);
    expect(screen.getByText('Task not found')).toBeTruthy();
  });

  it('edits the title inline', async () => {
    const task = makeTask({ title: 'Old title' });
    seed([task]);
    currentRouteId.value = task.id;
    await render(<TaskDetailScreen />);

    await fireEvent.changeText(screen.getByLabelText('Task title'), 'New title');
    expect(useBlinkStore.getState().tasks[0].title).toBe('New title');
  });

  it('reschedules through the WHEN chips', async () => {
    const task = makeTask({ title: 'Reschedule me' });
    seed([task]);
    currentRouteId.value = task.id;
    await render(<TaskDetailScreen />);

    await fireEvent.press(screen.getByLabelText('Tomorrow'));
    const due = useBlinkStore.getState().tasks[0].dueAt as number;
    expect(due).toBeGreaterThan(Date.now() + 12 * 3_600_000);
  });

  it('switches the task to the Later list', async () => {
    const task = makeTask({ title: 'Move me' });
    seed([task]);
    currentRouteId.value = task.id;
    await render(<TaskDetailScreen />);

    await fireEvent.press(screen.getByLabelText('Later'));
    expect(useBlinkStore.getState().tasks[0].bucket).toBe('later');
  });

  it('marks a task done and navigates back', async () => {
    const task = makeTask({ title: 'Finish me' });
    seed([task]);
    currentRouteId.value = task.id;
    await render(<TaskDetailScreen />);

    await fireEvent.press(screen.getByLabelText('Mark done'));
    expect(useBlinkStore.getState().tasks[0].status).toBe('done');
    expect(mockBack).toHaveBeenCalled();
  });
});

describe('SettingsScreen', () => {
  it('renders every section', async () => {
    await render(<SettingsScreen />);
    for (const heading of ['THEME', 'FEEDBACK', 'REMINDERS', 'DAY BOUNDARY', 'YOUR DATA']) {
      expect(screen.getByText(heading)).toBeTruthy();
    }
  });

  it('switches the theme', async () => {
    await render(<SettingsScreen />);
    await fireEvent.press(screen.getByLabelText('Forest theme'));
    expect(useBlinkStore.getState().settings.theme).toBe('forest');
  });

  it('toggles haptics', async () => {
    await render(<SettingsScreen />);
    await fireEvent(screen.getByLabelText('Haptics'), 'valueChange', false);
    expect(useBlinkStore.getState().settings.haptics).toBe(false);
  });

  it('changes the daily review time', async () => {
    await render(<SettingsScreen />);
    await fireEvent.press(screen.getByLabelText('Nudge at 20:00'));
    expect(useBlinkStore.getState().settings.dailyReviewTime).toBe('20:00');
  });

  it('moves the day boundary', async () => {
    await render(<SettingsScreen />);
    await fireEvent.press(screen.getByLabelText('Day boundary at 6 AM'));
    expect(useBlinkStore.getState().settings.rolloverHour).toBe(6);
  });
});
