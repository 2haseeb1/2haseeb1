import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { NowCard } from '@/components/NowCard';
import { Screen } from '@/components/Screen';
import { SwipeableTaskRow } from '@/components/SwipeableTaskRow';
import { Text } from '@/components/Text';
import { PlusIcon } from '@/components/icons';
import {
  nowCard,
  snoozedTasks,
  streakDays,
  todayProgress,
  todayQueue,
} from '@/features/tasks/selectors';
import { useBlinkStore, useTasks } from '@/features/tasks/store';
import { formatTime, titleCaseFirst } from '@/lib/day';
import { haptics } from '@/lib/haptics';
import type { Task } from '@/lib/types';
import { HIT, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const TICK_MS = 30_000;

export default function TodayScreen() {
  const theme = useTheme();
  const router = useRouter();
  const tasks = useTasks();

  const completeTask = useBlinkStore((s) => s.completeTask);
  const snoozeTask = useBlinkStore((s) => s.snoozeTask);
  const notToday = useBlinkStore((s) => s.notToday);

  /**
   * A slow tick keeps relative labels ("Today 5 PM", snooze expiries) honest
   * without re-rendering the list on every frame. The OS wakes the app on
   * foreground anyway, which is when a stale screen would be most obvious.
   */
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const focusTask = useMemo(() => nowCard(tasks, now), [tasks, now]);
  const queue = useMemo(() => todayQueue(tasks, now), [tasks, now]);
  const snoozed = useMemo(() => snoozedTasks(tasks, now), [tasks, now]);
  const progress = useMemo(() => todayProgress(tasks, now), [tasks, now]);
  const streak = useMemo(() => streakDays(tasks, now), [tasks, now]);

  const remaining = queue.filter((task) => task.id !== focusTask?.id);

  const openCapture = () => {
    haptics.tap();
    router.push('/capture');
  };

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text variant="caption" faint>
            {greeting(now).toUpperCase()}
          </Text>
          <Text variant="h2">{formatToday(now)}</Text>
        </View>

        <View style={styles.headerActions}>
          {streak > 0 ? (
            <View style={[styles.streakPill, { backgroundColor: theme.accentSoft }]}>
              <Text variant="caption" color={theme.accent}>
                {streak} day{streak === 1 ? '' : 's'}
              </Text>
            </View>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Settings"
            hitSlop={12}
            onPress={() => router.push('/settings')}
            style={styles.settingsButton}
          >
            <Text variant="small" dim>
              Settings
            </Text>
          </Pressable>
        </View>
      </View>

      <FlatList<Task>
        data={remaining}
        keyExtractor={(task) => task.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            {focusTask ? (
              <NowCard
                task={focusTask}
                now={now}
                onDone={() => completeTask(focusTask.id)}
                onSnooze={() => snoozeTask(focusTask.id, 10)}
                onNotToday={() => notToday(focusTask.id)}
                onFocus={() => router.push('/now')}
              />
            ) : (
              <EmptyState
                title={progress.done > 0 ? 'That is everything' : 'Nothing queued'}
                message={
                  progress.done > 0
                    ? `You finished ${progress.done} today. Add something only if it actually matters.`
                    : 'Add one thing. Just one. You can always add more later.'
                }
              />
            )}

            <ProgressLine done={progress.done} open={progress.open} />
          </View>
        }
        renderItem={({ item }) => (
          <SwipeableTaskRow
            task={item}
            now={now}
            onToggle={() => completeTask(item.id)}
            onSnooze={(minutes) => snoozeTask(item.id, minutes)}
            onPress={() => router.push(`/task/${item.id}`)}
          />
        )}
        ListFooterComponent={
          snoozed.length > 0 ? (
            <View style={styles.snoozedSection}>
              <Text variant="caption" faint>
                SNOOZED
              </Text>
              {snoozed.map((task) => (
                <Pressable
                  key={task.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${task.title}, snoozed until ${formatTime(
                    task.snoozedUntil as number
                  )}`}
                  onPress={() => router.push(`/task/${task.id}`)}
                  style={styles.snoozedRow}
                >
                  <Text variant="small" dim numberOfLines={1} style={styles.snoozedTitle}>
                    {task.title}
                  </Text>
                  <Text variant="caption" faint>
                    until {formatTime(task.snoozedUntil as number)}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null
        }
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add a task"
        accessibilityHint="Opens quick capture"
        onPress={openCapture}
        style={({ pressed }) => [
          styles.fab,
          {
            backgroundColor: theme.accent,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <PlusIcon color={theme.onAccent} />
      </Pressable>
    </Screen>
  );
}

function ProgressLine({ done, open }: { done: number; open: number }) {
  const theme = useTheme();
  const total = done + open;
  if (total === 0) return null;

  return (
    <View style={styles.progressWrapper}>
      <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
        <View
          style={[
            styles.progressFill,
            { backgroundColor: theme.accent, width: `${Math.round((done / total) * 100)}%` },
          ]}
        />
      </View>
      <Text variant="caption" faint>
        {done} done · {open} left
      </Text>
    </View>
  );
}

function greeting(now: number): string {
  const hour = new Date(now).getHours();
  if (hour < 5) return 'Still up';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatToday(now: number): string {
  const date = new Date(now);
  const weekday = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][
    date.getDay()
  ];
  const month = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ][date.getMonth()];
  return titleCaseFirst(`${weekday}, ${month} ${date.getDate()}`);
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  headerText: {
    gap: 2,
    flexShrink: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  streakPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  settingsButton: {
    minHeight: HIT,
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl * 3,
    gap: spacing.sm,
  },
  listHeader: {
    gap: spacing.lg,
    marginBottom: spacing.sm,
  },
  progressWrapper: {
    gap: spacing.sm,
  },
  progressTrack: {
    height: 5,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.pill,
  },
  snoozedSection: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  snoozedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: HIT,
  },
  snoozedTitle: {
    flexShrink: 1,
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.xl,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
});
