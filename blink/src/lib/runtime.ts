/**
 * What can this build actually do at runtime?
 *
 * Blink ships three native integrations that Expo Go cannot provide: the
 * home-screen widget, the share-sheet target, and *remote* push notifications.
 * The first two are limited by missing native modules, but notifications are
 * worse than missing — `expo-notifications` **throws at import time** on Android
 * in Expo Go:
 *
 *     if (Platform.OS === 'android') throw new Error('…removed from Expo Go…')
 *     // node_modules/expo-notifications/src/warnOfExpoGoPushUsage.ts
 *
 * and `react-native-android-widget` throws during module evaluation too, because
 * `TurboModuleRegistry.getEnforcing('AndroidWidget')` runs at the top level.
 *
 * A throw during import takes the whole app down before the first render, so no
 * `try`/`catch` *around a call site* can save it. The only workable rule is:
 * **never import those modules until we know the platform supports them.** That
 * is what this module exists to answer.
 *
 * The app is fully usable without any of them — capture, lists, rollover,
 * recurrence and the streak are all pure JavaScript.
 */

import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';

/** True when running inside the Expo Go client rather than a dev/production build. */
export function isExpoGo(): boolean {
  try {
    return isRunningInExpoGo();
  } catch {
    // If the check itself fails, assume a real build — the safer default for
    // features, and the try/catch at each call site still protects the app.
    return false;
  }
}

/**
 * Local reminder scheduling.
 *
 * Web has no local notification API. On Android, Expo Go cannot even *import*
 * `expo-notifications` without throwing, so reminders are off there. iOS in Expo
 * Go only logs a warning, so its reminders keep working.
 */
export function notificationsAvailable(): boolean {
  if (Platform.OS === 'web') return false;
  if (Platform.OS === 'android' && isExpoGo()) return false;
  return true;
}

/** The home-screen widget needs native modules Expo Go does not ship. */
export function widgetsAvailable(): boolean {
  if (Platform.OS === 'web') return false;
  return !isExpoGo();
}

/**
 * The share-sheet target.
 *
 * `expo-share-intent` is the one integration that is safe to *import* anywhere —
 * it uses `requireOptionalNativeModule` and guards every native call with `?.`.
 * In Expo Go it therefore loads fine and simply never receives a share, which is
 * why this gates the provider rather than the import.
 */
export function shareIntentAvailable(): boolean {
  if (Platform.OS === 'web') return false;
  return !isExpoGo();
}

/** Why a feature is off, for display in Settings. Null when it is available. */
export function unavailableReason(feature: 'notifications' | 'widget'): string | null {
  if (feature === 'notifications' && notificationsAvailable()) return null;
  if (feature === 'widget' && widgetsAvailable()) return null;
  if (isExpoGo()) {
    return 'Needs a development build — Expo Go cannot run this.';
  }
  if (Platform.OS === 'web') {
    return 'Not available in the browser.';
  }
  return 'Not available on this device.';
}
