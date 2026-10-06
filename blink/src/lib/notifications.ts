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

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { hourFromClock, minuteFromClock } from './day';
import type { Task } from './types';

export const MAX_SCHEDULED = 10;
const REMINDER_CHANNEL = 'reminders';

export type PermissionState = 'granted' | 'denied' | 'undetermined';

/** Call once, at app start, before any notification can arrive. */
export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      // `shouldShowAlert` is deprecated; banner/list are the current fields.
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL, {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 120, 80, 120],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  } catch {
    // Channel setup is best-effort; reminders still work with default settings.
  }
}

export async function getPermissionState(): Promise<PermissionState> {
  if (Platform.OS === 'web') return 'denied';
  try {
    const settings = await Notifications.getPermissionsAsync();
    if (settings.granted) return 'granted';
    if (settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
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
  try {
    const settings = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: false,
        allowSound: true,
      },
    });
    return settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
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

  const permission = await getPermissionState();
  if (permission !== 'granted') return 0;

  try {
    await Notifications.cancelAllScheduledNotificationsAsync();

    const upcoming = input.tasks
      .filter(
        (task) =>
          task.status === 'open' && task.remindAt !== null && task.remindAt > input.now
      )
      .sort((a, b) => (a.remindAt as number) - (b.remindAt as number))
      .slice(0, MAX_SCHEDULED);

    for (const task of upcoming) {
      await Notifications.scheduleNotificationAsync({
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
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(task.remindAt as number),
          channelId: REMINDER_CHANNEL,
        },
      });
    }

    if (input.dailyReview) {
      await Notifications.scheduleNotificationAsync({
        identifier: 'daily-review',
        content: {
          title: 'What is the one thing?',
          body: 'Pick a single task for today. The rest can wait.',
          sound: true,
          data: { route: '/capture' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
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
