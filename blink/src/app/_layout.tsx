import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useBlinkStore, useHydrated, useSettings, useTasks } from '@/features/tasks/store';
import { setHapticsEnabled } from '@/lib/haptics';
import {
  configureNotificationHandler,
  ensureAndroidChannel,
  syncReminders,
} from '@/lib/notifications';
import { THEMES } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

/** How long to wait for storage before giving up and showing the app anyway. */
const HYDRATION_TIMEOUT_MS = 2500;

/** Quiet period before re-arming notifications, so rapid edits cost one pass. */
const REMINDER_SYNC_DEBOUNCE_MS = 1200;

export default function RootLayout() {
  const hydrated = useHydrated();
  const settings = useSettings();
  const tasks = useTasks();
  const applyRollover = useBlinkStore((s) => s.applyRollover);
  const markHydrated = useBlinkStore((s) => s.markHydrated);

  const theme = THEMES[settings.theme] ?? THEMES.midnight;

  // A rehydration failure must not strand the user on a splash screen forever.
  useEffect(() => {
    const timer = setTimeout(markHydrated, HYDRATION_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [markHydrated]);

  useEffect(() => {
    configureNotificationHandler();
    void ensureAndroidChannel();
  }, []);

  // Rollover runs on launch and whenever the app returns to the foreground —
  // cheap, idempotent, and it means a task set aside last night is already
  // waiting the next time the user looks.
  useEffect(() => {
    applyRollover();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') applyRollover();
    });
    return () => subscription.remove();
  }, [applyRollover]);

  useEffect(() => {
    setHapticsEnabled(settings.haptics);
  }, [settings.haptics]);

  // Re-arm the OS reminder window (capped, soonest-first) after edits settle.
  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(() => {
      void syncReminders({
        tasks,
        now: Date.now(),
        dailyReview: settings.dailyReview,
        dailyReviewTime: settings.dailyReviewTime,
      });
    }, REMINDER_SYNC_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [tasks, hydrated, settings.dailyReview, settings.dailyReviewTime]);

  useEffect(() => {
    if (hydrated) SplashScreen.hideAsync().catch(() => undefined);
  }, [hydrated]);

  if (!hydrated) return null;

  const base = theme.isDark ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...base,
    dark: theme.isDark,
    colors: {
      ...base.colors,
      background: theme.bg,
      card: theme.surface,
      text: theme.text,
      border: theme.border,
      primary: theme.accent,
      notification: theme.accent,
    },
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={navigationTheme}>
        <StatusBar style={theme.isDark ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.bg },
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="capture"
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          />
          <Stack.Screen name="now" options={{ animation: 'fade' }} />
          <Stack.Screen name="task/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
        </Stack>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
