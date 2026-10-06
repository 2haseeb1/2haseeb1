/**
 * Android widget task handler.
 *
 * Android can start this app's JS in a *headless* context — no activity, no
 * root layout, no mounted React tree — to draw or refresh a widget. The handler
 * registered here is what runs in that case, which is why it reads the persisted
 * store from storage instead of hooking into the live one.
 *
 * `registerWidgetTaskHandler` must be called during the very first evaluation of
 * the JS bundle for the headless case to find it. Importing this module from
 * `index.js` (the app entry, ahead of `expo-router/entry`) guarantees that.
 */

import { Platform } from 'react-native';

import { registerWidgetTaskHandler } from 'react-native-android-widget';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { buildWidgetSnapshot, EMPTY_SNAPSHOT } from '@/features/widget/snapshot';
import { STORAGE_KEY } from '@/features/tasks/store';
import { DEFAULT_SETTINGS, type Settings, type Task } from '@/lib/types';

import { BlinkAndroidWidget } from './BlinkAndroidWidget';

/** Reads the persisted store directly — the app is not running in a headless task. */
async function loadState(): Promise<{ tasks: Task[]; settings: Settings }> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { tasks: [], settings: DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as {
      state?: { tasks?: Task[]; settings?: Settings };
    };
    return {
      tasks: parsed.state?.tasks ?? [],
      settings: parsed.state?.settings ?? DEFAULT_SETTINGS,
    };
  } catch {
    // Storage unreadable: draw an honest empty widget rather than crashing the
    // headless task, which Android surfaces as a broken widget.
    return { tasks: [], settings: DEFAULT_SETTINGS };
  }
}

async function handleWidgetTask({
  widgetAction,
  renderWidget,
}: {
  widgetAction: string;
  renderWidget: (element: React.JSX.Element) => void;
}) {
  if (widgetAction === 'WIDGET_DELETED') {
    // Nothing to draw and nothing to clean up — the widget is gone.
    return;
  }

  const { tasks } = await loadState();

  let snapshot;
  try {
    snapshot = buildWidgetSnapshot(tasks, Date.now());
  } catch {
    snapshot = { ...EMPTY_SNAPSHOT, updatedAt: Date.now() };
  }

  renderWidget(<BlinkAndroidWidget snapshot={snapshot} />);
}

/**
 * Registration is Android-only, and that guard is load-bearing.
 *
 * `registerWidgetTaskHandler` calls `AppRegistry.registerHeadlessTask`, which
 * does not exist on iOS or on `react-native-web`. This module is imported by
 * `index.js` on every platform, so calling it unconditionally would throw at
 * startup and take the whole app down on web — a failure that bundling cannot
 * catch, because the file still compiles perfectly.
 */
export function shouldRegisterTaskHandler(os: string): boolean {
  return os === 'android';
}

/** Registers the handler where the OS supports it, and nowhere else. */
export function registerTaskHandlerIfSupported(os: string = Platform.OS): void {
  if (!shouldRegisterTaskHandler(os)) return;
  try {
    registerWidgetTaskHandler(handleWidgetTask);
  } catch {
    // A widget that cannot register must not stop the app from starting.
  }
}

registerTaskHandlerIfSupported();

export { handleWidgetTask };
