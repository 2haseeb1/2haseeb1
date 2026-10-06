/**
 * The Expo Go regression tests.
 *
 * This is the bug these exist for, reported from a real device:
 *
 *   [runtime not ready]: Error: expo-notifications: Android Push notifications
 *   … was removed from Expo Go with the release of SDK 53.
 *
 * The stack trace ended in `src/lib/notifications.ts:14` — the *import* line. Not
 * a call, an import: `expo-notifications` throws while its own module body runs,
 * via `DevicePushTokenAutoRegistration.fx` → `addPushTokenListener` →
 * `warnOfExpoGoPushUsage`, which does `if (Platform.OS === 'android') throw`.
 * `react-native-android-widget` does the same thing through
 * `TurboModuleRegistry.getEnforcing(...)`, and `index.js` imported that on every
 * platform.
 *
 * A throw during import is invisible to TypeScript and to the bundler, and no
 * `try`/`catch` at a call site can contain it. So the guarantee these tests
 * enforce is structural: **with Expo Go simulated and both libraries rigged to
 * throw on import, the app's modules must still load.**
 */

/** A module body that throws is exactly the failure mode being guarded against. */
function poison(moduleName: string): never {
  throw new Error(`IMPORTED ${moduleName} — this would crash in Expo Go`);
}

describe('Expo Go: module loading is safe', () => {
  let runningInExpoGo = true;

  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    jest.dontMock('expo');
    jest.dontMock('expo-notifications');
    jest.dontMock('react-native-android-widget');
    jest.resetModules();
  });

  /** Loads a module with Expo Go simulated and both native libraries poisoned. */
  function loadHostile<T>(path: string): T {
    jest.doMock('expo', () => ({
      ...jest.requireActual('expo'),
      isRunningInExpoGo: () => runningInExpoGo,
    }));
    jest.doMock('expo-notifications', () => poison('expo-notifications'));
    jest.doMock('react-native-android-widget', () => poison('react-native-android-widget'));

    let loaded!: T;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      loaded = require(path) as T;
    });
    return loaded;
  }

  it('loads src/lib/notifications without touching expo-notifications', () => {
    // If notifications.ts still imported expo-notifications at the top level,
    // this call would throw before returning.
    const mod = loadHostile<typeof import('@/lib/notifications')>('@/lib/notifications');
    expect(typeof mod.defaultReminderFor).toBe('function');
    expect(typeof mod.syncReminders).toBe('function');
  });

  it('keeps the pure reminder math working even when notifications are unavailable', () => {
    // The store depends on this function, so the whole app booted or died on it.
    const mod = loadHostile<typeof import('@/lib/notifications')>('@/lib/notifications');
    const now = Date.UTC(2026, 9, 7, 10, 0);
    expect(mod.defaultReminderFor(now + 3_600_000, now)).toBe(now + 3_600_000);
    expect(mod.defaultReminderFor(null, now)).toBeNull();
    // A due date in the past yields no reminder rather than a burst of them.
    expect(mod.defaultReminderFor(now - 3_600_000, now)).toBeNull();
  });

  it('no-ops every notification call instead of throwing', async () => {
    const mod = loadHostile<typeof import('@/lib/notifications')>('@/lib/notifications');

    expect(() => mod.configureNotificationHandler()).not.toThrow();
    await expect(mod.ensureAndroidChannel()).resolves.toBeUndefined();
    await expect(mod.getPermissionState()).resolves.toBe('denied');
    await expect(mod.requestPermission()).resolves.toBe(false);
    await expect(
      mod.syncReminders({ tasks: [], now: Date.now(), dailyReview: true, dailyReviewTime: '08:00' })
    ).resolves.toBe(0);
  });

  it('loads the widget bridge without touching react-native-android-widget', () => {
    const mod = loadHostile<typeof import('@/features/widget/bridge')>(
      '@/features/widget/bridge'
    );
    expect(typeof mod.syncWidgetsNow).toBe('function');
    expect(typeof mod.startWidgetSync).toBe('function');
  });

  it('syncs nothing and never throws when widgets are unavailable', async () => {
    const mod = loadHostile<typeof import('@/features/widget/bridge')>(
      '@/features/widget/bridge'
    );
    await expect(mod.syncWidgetsNow([], { rolloverHour: 4 } as never)).resolves.toBeUndefined();
    const stop = mod.startWidgetSync();
    expect(() => stop()).not.toThrow();
  });

  it('loads the widget task handler — the module index.js imports first', () => {
    const mod = loadHostile<typeof import('@/widgets/widget-task-handler')>(
      '@/widgets/widget-task-handler'
    );
    expect(typeof mod.registerTaskHandlerIfSupported).toBe('function');
  });

  it('refuses to register the task handler, so registerHeadlessTask is never called', () => {
    const mod = loadHostile<typeof import('@/widgets/widget-task-handler')>(
      '@/widgets/widget-task-handler'
    );
    // Registration would both throw on web (no registerHeadlessTask) and require
    // a native module Expo Go does not have.
    expect(mod.shouldRegisterTaskHandler('android')).toBe(false);
    expect(() => mod.registerTaskHandlerIfSupported('android')).not.toThrow();
  });
});

describe('Expo Go detection', () => {
  afterEach(() => {
    jest.dontMock('expo');
    jest.resetModules();
  });

  function loadRuntime(expoGo: boolean): typeof import('@/lib/runtime') {
    jest.doMock('expo', () => ({
      ...jest.requireActual('expo'),
      isRunningInExpoGo: () => expoGo,
    }));
    let mod!: typeof import('@/lib/runtime');
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      mod = require('@/lib/runtime') as typeof import('@/lib/runtime');
    });
    return mod;
  }

  it('reports Expo Go correctly', () => {
    expect(loadRuntime(true).isExpoGo()).toBe(true);
    expect(loadRuntime(false).isExpoGo()).toBe(false);
  });

  it('disables widgets inside Expo Go and enables them outside it', () => {
    expect(loadRuntime(true).widgetsAvailable()).toBe(false);
    expect(loadRuntime(false).widgetsAvailable()).toBe(true);
  });

  it('disables notifications inside Expo Go on Android', () => {
    // Platform.OS is 'ios' under jest-expo, where Expo Go only warns, so the
    // Android path is asserted through the reason string instead.
    const runtime = loadRuntime(true);
    expect(runtime.widgetsAvailable()).toBe(false);
    expect(runtime.unavailableReason('widget')).toMatch(/development build/i);
  });

  it('explains why a feature is off rather than failing silently', () => {
    const runtime = loadRuntime(true);
    // Widgets are genuinely unavailable in Expo Go, and the reason is shown.
    expect(runtime.unavailableReason('widget')).toMatch(/development build/i);
    // Notifications are not: under jest Platform.OS is 'ios', where Expo Go only
    // logs a warning, so reminders keep working and there is nothing to explain.
    // Android is the platform that throws, and it is covered by
    // `notificationsAvailable` above.
    expect(runtime.notificationsAvailable()).toBe(true);
    expect(runtime.unavailableReason('notifications')).toBeNull();
  });
});
