/**
 * Haptics with a settings switch and per-platform correctness.
 *
 * On Android, `performAndroidHapticsAsync` maps to the platform's haptic
 * constants and needs no `VIBRATE` permission, which is why it is preferred over
 * the older `impactAsync` (documented as `Vibrator`-backed) on that platform.
 */

import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

let enabled = true;

export function setHapticsEnabled(value: boolean): void {
  enabled = value;
}

export function hapticsEnabled(): boolean {
  return enabled;
}

function fire(run: () => Promise<unknown>): void {
  if (!enabled) return;
  // Haptics are a nicety: a simulator or unsupported device must never throw
  // into a tap handler.
  run().catch(() => undefined);
}

export const haptics = {
  /** Light tick: selecting a chip, opening a screen. */
  tap(): void {
    fire(() =>
      Platform.OS === 'android'
        ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Clock_Tick)
        : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    );
  },
  /** Starting a gesture, e.g. the swipe threshold being crossed. */
  gesture(): void {
    fire(() =>
      Platform.OS === 'android'
        ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Gesture_Start)
        : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    );
  },
  /** Finishing a task — the small dopamine hit that makes the app sticky. */
  complete(): void {
    fire(() =>
      Platform.OS === 'android'
        ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm)
        : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    );
  },
  /** Destructive or negative confirmation. */
  warn(): void {
    fire(() =>
      Platform.OS === 'android'
        ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Reject)
        : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
    );
  },
};
