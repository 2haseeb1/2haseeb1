/**
 * Local reminder scheduling.
 *
 * The important engineering constraint: iOS keeps only ~64 pending local
 * notifications, and Android alarm counts are limited too. Scheduling one
 * notification per task is the classic way todo apps silently stop reminding.
 *
 * Strategy: keep at most `MAX_SCHEDULED` future reminders armed (the soonest
 * ones), rebuild that window whenever the task list changes or the app comes to
 * the foreground, and back it with one repeating daily-review notification that
 * guarantees the app can pull the user back in even if every reminder was missed.
 */

import { Platform } from 'react-native';

import { hourFromClock, minuteFromClock } from './day';
import { notificationsAvailable } from './runtime';
import type { Task } from './types';

type NotificationsModule = typeof import('expo-notifications');

let cached: NotificationsModule | null | undefined;

/**
 * `expo-notifications` is loaded lazily, and that is load-bearing rather than
 * stylistic. Importing it throws on Android in Expo Go — not when you call a
 * function, but while the module itself is being evaluated — and a throw during
 * import is not catchable from a call site. Importing it lazily means the app
 * boots everywhere, and only asks for the module where it is known to exist.
 *
 * Once resolved the result is memoised, including the `null` case, so a failing
 * platform does not pay for a failing `require` on every call.
 */
function notifications(): NotificationsModule | null {
  if (cached !== undefined) return cached;

  if (!notificationsAvailable()) {
    cached = null;
    return cached;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('expo-notifications') as NotificationsModule;
  } catch {
    cached = null;
  }

  return cached;
}

/** Exposed for tests: forget the memoised module. */
export function resetNotificationsCache(): void {
  cached = undefined;
}

export const MAX_SCHEDULED = 10;
const REMINDER_CHANNEL = 'reminders';

export type PermissionState = 'granted' | 'denied' | 'undetermined';

/** Call once, at app start, before any notification can arrive. */
export function configureNotificationHandler(): void {
  const N = notifications();
  if (!N) return;
  try {
    N.setNotificationHandler({
      handleNotification: async () => ({
        // `shouldShowAlert` is deprecated; banner/list are the current fields.
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch {
    // A handler that cannot be installed only affects foreground presentation.
  }
}

export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const N = notifications();
  if (!N) return;
  try {
    await N.setNotificationChannelAsync(REMINDER_CHANNEL, {
      name: 'Reminders',
      importance: N.AndroidImportance.HIGH,
      vibrationPattern: [0, 120, 80, 120],
      lockscreenVisibility: N.AndroidNotificationVisibility.PUBLIC,
    });
  } catch {
    // Channel setup is best-effort; reminders still work with default settings.
  }
}

export async function getPermissionState(): Promise<PermissionState> {
  if (Platform.OS === 'web') return 'denied';
  const N = notifications();
  if (!N) return 'denied';
  try {
    const settings = await N.getPermissionsAsync();
    if (settings.granted) return 'granted';
    if (settings.ios?.status === N.IosAuthorizationStatus.PROVISIONAL) {
      return 'granted';
    }
    return settings.canAskAgain === false ? 'denied' : 'undetermined';
  } catch {
    return 'undetermined';
  }
}

/**
 * Ask for permission. Deliberately called from an explicit user action (turning
 * reminders on in Settings), never on first launch — a permission prompt the
 * user did not ask for is the fastest way to a permanent denial.
 */
export async function requestPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const N = notifications();
  if (!N) return false;
  try {
    const settings = await N.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: false,
        allowSound: true,
      },
    });
    return settings.granted || settings.ios?.status === N.IosAuthorizationStatus.PROVISIONAL;
  } catch {
    return false;
  }
}

export interface ReminderSyncInput {
  tasks: Task[];
  now: number;
  dailyReview: boolean;
  dailyReviewTime: string;
}

/**
 * Rebuilds the armed reminder window. Returns the number of task reminders armed.
 *
 * Cancelling and rescheduling is intentionally brute-force: it is idempotent,
 * cheap at this scale, and immune to drift between app state and OS state.
 */
export async function syncReminders(input: ReminderSyncInput): Promise<number> {
  if (Platform.OS === 'web') return 0;

  const N = notifications();
  if (!N) return 0;

  const permission = await getPermissionState();
  if (permission !== 'granted') return 0;

  try {
    await N.cancelAllScheduledNotificationsAsync();

    const upcoming = input.tasks
      .filter(
        (task) =>
          task.status === 'open' && task.remindAt !== null && task.remindAt > input.now
      )
      .sort((a, b) => (a.remindAt as number) - (b.remindAt as number))
      .slice(0, MAX_SCHEDULED);

    for (const task of upcoming) {
      await N.scheduleNotificationAsync({
        identifier: `task:${task.id}`,
        content: {
          title: task.title,
          body: task.dueAt ? 'Due now' : 'No time like now',
          sound: true,
          data: { taskId: task.id },
          // Tapping through lands on the task detail screen.
          categoryIdentifier: undefined,
        },
        trigger: {
          type: N.SchedulableTriggerInputTypes.DATE,
          date: new Date(task.remindAt as number),
          channelId: REMINDER_CHANNEL,
        },
      });
    }

    if (input.dailyReview) {
      await N.scheduleNotificationAsync({
        identifier: 'daily-review',
        content: {
          title: 'What is the one thing?',
          body: 'Pick a single task for today. The rest can wait.',
          sound: true,
          data: { route: '/capture' },
        },
        trigger: {
          type: N.SchedulableTriggerInputTypes.DAILY,
          hour: hourFromClock(input.dailyReviewTime),
          minute: minuteFromClock(input.dailyReviewTime),
          channelId: REMINDER_CHANNEL,
        },
      });
    }

    return upcoming.length;
  } catch {
    return 0;
  }
}

/** Reminder time implied by a due date, so a due time is actionable by default. */
export function defaultReminderFor(
  dueAt: number | null,
  now: number,
  leadMinutes = 0
): number | null {
  if (dueAt === null) return null;
  const at = dueAt - leadMinutes * 60_000;
  return at > now ? at : null;
}
