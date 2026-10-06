/**
 * Android widget task handler.
 *
 * Android can start this app's JS in a *headless* context — no activity, no root
 * layout, no mounted React tree — to draw or refresh a widget. The handler
 * registered here is what runs in that case, which is why it reads the persisted
 * store from storage instead of hooking into the live one.
 *
 * `registerWidgetTaskHandler` must be called during the very first evaluation of
 * the JS bundle for the headless case to find it. Importing this module from
 * `index.js` (the app entry, ahead of `expo-router/entry`) guarantees that.
 *
 * ## Nothing from the widget library is imported at the top level
 *
 * `react-native-android-widget` runs `TurboModuleRegistry.getEnforcing(...)` in
 * its module body on Android, so a `require` of it **throws outright** in any
 * build without the native module — Expo Go being the obvious case. A throw
 * during module evaluation cannot be caught at a call site, so the only defence
 * is to not import it until we know the runtime supports it.
 */

import { Platform } from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { buildWidgetSnapshot, EMPTY_SNAPSHOT } from '@/features/widget/snapshot';
import { STORAGE_KEY } from '@/features/tasks/store';
import { widgetsAvailable } from '@/lib/runtime';
import { DEFAULT_SETTINGS, type Settings, type Task } from '@/lib/types';

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

export interface WidgetTaskRequest {
  widgetAction: string;
  renderWidget: (element: React.JSX.Element) => void;
}

async function handleWidgetTask({ widgetAction, renderWidget }: WidgetTaskRequest): Promise<void> {
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

  // Required here rather than imported, because this module is evaluated by
  // `index.js` on every platform — including ones where it would throw.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { BlinkAndroidWidget } = require('./BlinkAndroidWidget') as typeof import('./BlinkAndroidWidget');

  renderWidget(<BlinkAndroidWidget snapshot={snapshot} />);
}

/**
 * Registration is Android-only, and that guard is load-bearing twice over.
 *
 * `registerWidgetTaskHandler` calls `AppRegistry.registerHeadlessTask`, which
 * does not exist on iOS or on `react-native-web`; and the library itself cannot
 * even be loaded in Expo Go. Neither failure is visible to the bundler — the file
 * compiles perfectly either way — so both are handled here and tested.
 */
export function shouldRegisterTaskHandler(
  os: string,
  widgetsOk: boolean = widgetsAvailable()
): boolean {
  return os === 'android' && widgetsOk;
}

/**
 * Registers the handler where the OS supports it, and nowhere else.
 *
 * Both inputs are parameters rather than ambient state so each combination can be
 * tested directly — including the Expo Go one, which cannot be reached by calling
 * a mock.
 */
export function registerTaskHandlerIfSupported(
  os: string = Platform.OS,
  widgetsOk: boolean = widgetsAvailable()
): void {
  if (!shouldRegisterTaskHandler(os, widgetsOk)) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { registerWidgetTaskHandler } = require('react-native-android-widget') as typeof import('react-native-android-widget');
    registerWidgetTaskHandler(handleWidgetTask);
  } catch {
    // A widget that cannot register must not stop the app from starting.
  }
}

registerTaskHandlerIfSupported();

export { handleWidgetTask };
