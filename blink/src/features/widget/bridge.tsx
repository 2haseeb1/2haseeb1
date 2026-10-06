/**
 * The one module allowed to talk to the widgets.
 *
 * Everything else in the app stays unaware that widgets exist: this file owns
 * the platform split, the native imports and the failure handling. Two reasons
 * for that discipline:
 *
 *   - `expo-widgets` only exists on iOS and `react-native-android-widget` only
 *     on Android. Importing either at the top of a screen would crash the other
 *     platform and the web build.
 *   - Widgets are a *projection* of the store, never a second source of truth.
 *     If a widget fails to update, the app must carry on as if nothing happened,
 *     so every native call here is guarded.
 *
 * Updates are coalesced: completing five tasks in a row should not schedule five
 * widget refreshes, because iOS budgets how often a widget may reload.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform, type AppStateStatus } from 'react-native';

import { widgetsAvailable } from '@/lib/runtime';
import { DEFAULT_SETTINGS, type Settings, type Task } from '@/lib/types';
import { STORAGE_KEY, useBlinkStore } from '@/features/tasks/store';

import {
  buildWidgetSnapshot,
  buildWidgetTimeline,
  EMPTY_SNAPSHOT,
  type WidgetSnapshot,
} from './snapshot';

/** How long to wait for more changes before pushing to the widgets. */
export const SYNC_DEBOUNCE_MS = 400;

interface PersistedShape {
  tasks?: Task[];
  settings?: Settings;
}

/** Reads the persisted store without needing a mounted app (headless updates). */
export async function readPersistedState(): Promise<PersistedShape> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { state?: PersistedShape };
    return parsed.state ?? {};
  } catch {
    return {};
  }
}

function snapshotFor(tasks: Task[], settings: Settings, now: number): WidgetSnapshot {
  try {
    return buildWidgetSnapshot(tasks, now);
  } catch {
    // A malformed task must never take the widget (or the app) down.
    return { ...EMPTY_SNAPSHOT, updatedAt: now };
  }
}

function timelineFor(tasks: Task[], settings: Settings, now: number) {
  try {
    return buildWidgetTimeline(tasks, now, settings.rolloverHour);
  } catch {
    return [];
  }
}

async function pushToIos(tasks: Task[], settings: Settings): Promise<void> {
  const now = Date.now();
  const snapshot = snapshotFor(tasks, settings, now);

  // Imported lazily so the module is never evaluated on other platforms.
  const { blinkNowWidget } = await import('@/widgets/blink-widget-ios');

  const timeline = timelineFor(tasks, settings, now);
  if (timeline.length > 0) {
    blinkNowWidget.updateTimeline(timeline);
  } else {
    blinkNowWidget.updateSnapshot(snapshot);
  }
}

async function pushToAndroid(tasks: Task[], settings: Settings): Promise<void> {
  const now = Date.now();
  const snapshot = snapshotFor(tasks, settings, now);

  const { requestWidgetUpdate } = await import('react-native-android-widget');
  const { ANDROID_WIDGET_NAME, BlinkAndroidWidget } = await import(
    '@/widgets/BlinkAndroidWidget'
  );

  await requestWidgetUpdate({
    widgetName: ANDROID_WIDGET_NAME,
    renderWidget: () => <BlinkAndroidWidget snapshot={snapshot} />,
    // No widget on the home screen: nothing to clean up, but the call still
    // needs somewhere to resolve to.
    widgetNotFound: () => undefined,
  });
}

/**
 * Pushes the current tasks to whichever widget platform this is, if any.
 *
 * `widgetsAvailable()` is the first check because both widget libraries throw
 * during import in a build without their native modules — Expo Go again. The
 * `try`/`catch` below still stands, so an unforeseen launcher or OS failure can
 * only ever cost a stale widget, never a broken app.
 */
export async function syncWidgetsNow(tasks: Task[], settings: Settings): Promise<void> {
  if (!widgetsAvailable()) return;

  try {
    if (Platform.OS === 'ios') {
      await pushToIos(tasks, settings);
    } else if (Platform.OS === 'android') {
      await pushToAndroid(tasks, settings);
    }
    // Web has no home screen. Doing nothing is the correct behaviour.
  } catch {
    // Widgets are best-effort. A launcher that is not installed, a widget that
    // was removed, a denied permission — none of these are app errors.
  }
}

/**
 * Keeps the widgets in step with the store.
 *
 * Call once, from the root layout. Returns an unsubscribe function so tests and
 * hot reloads do not stack listeners.
 */
export function startWidgetSync(): () => void {
  if (!widgetsAvailable()) return () => undefined;

  let timer: ReturnType<typeof setTimeout> | null = null;

  const push = (tasks: Task[], settings: Settings) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void syncWidgetsNow(tasks, settings);
    }, SYNC_DEBOUNCE_MS);
  };

  // Initial paint, so a fresh install shows the widget immediately.
  const initial = useBlinkStore.getState();
  push(initial.tasks, initial.settings);

  const unsubscribe = useBlinkStore.subscribe((state, previous) => {
    if (state.tasks !== previous.tasks || state.settings !== previous.settings) {
      push(state.tasks, state.settings);
    }
  });

  // Coming back from the background is a common moment for a stale widget: the
  // app may have been killed and its widgets left showing yesterday's task.
  const onAppStateChange = (status: AppStateStatus) => {
    if (status === 'active') {
      const state = useBlinkStore.getState();
      push(state.tasks, state.settings);
    }
  };
  const appStateSub = AppState.addEventListener('change', onAppStateChange);

  return () => {
    if (timer) clearTimeout(timer);
    unsubscribe();
    appStateSub.remove();
  };
}

/** Settings used when the store has not hydrated yet but a widget asks. */
export const WIDGET_FALLBACK_SETTINGS = DEFAULT_SETTINGS;
