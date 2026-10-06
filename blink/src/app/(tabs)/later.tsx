import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { SwipeableTaskRow } from '@/components/SwipeableTaskRow';
import { Text } from '@/components/Text';
import { laterQueue } from '@/features/tasks/selectors';
import { useBlinkStore, useTasks } from '@/features/tasks/store';
import { dayKey, formatDayLabel, isSameDay } from '@/lib/day';
import type { Task } from '@/lib/types';
import { spacing } from '@/theme/tokens';

const TICK_MS = 60_000;

/** "Later" is the parking lot: things with a date in the future, or no date at all. */
export default function LaterScreen() {
  const router = useRouter();
  const tasks = useTasks();
  const completeTask = useBlinkStore((s) => s.completeTask);
  const snoozeTask = useBlinkStore((s) => s.snoozeTask);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const later = useMemo(() => laterQueue(tasks, now), [tasks, now]);

  const sections = useMemo(() => {
    const undated = later.filter((task) => task.dueAt === null);
    const byDay = new Map<string, Task[]>();
    for (const task of later) {
      if (task.dueAt === null) continue;
      const key = dayKey(task.dueAt);
      const bucket = byDay.get(key);
      if (bucket) bucket.push(task);
      else byDay.set(key, [task]);
    }
    return {
      undated,
      days: [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)),
    };
  }, [later]);

  const rows = useMemo(() => {
    const items: ({ type: 'header'; key: string; label: string } | { type: 'task'; key: string; task: Task })[] = [];
    if (sections.undated.length > 0) {
      items.push({ type: 'header', key: 'header-undated', label: 'SOMEDAY' });
      for (const task of sections.undated) items.push({ type: 'task', key: task.id, task });
    }
    for (const [key, dayTasks] of sections.days) {
      items.push({
        type: 'header',
        key: `header-${key}`,
        label: formatDayLabel(dayTasks[0].dueAt as number, now).toUpperCase(),
      });
      for (const task of dayTasks) items.push({ type: 'task', key: task.id, task });
    }
    return items;
  }, [sections, now]);

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="caption" faint>
          PARKED
        </Text>
        <Text variant="h2">Later</Text>
        <Text variant="small" dim>
          {later.length === 0
            ? 'Nothing waiting in the wings.'
            : `${later.length} thing${later.length === 1 ? '' : 's'} out of the way of today.`}
        </Text>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(row) => row.key}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            title="Nothing here"
            message="Tap Snooze or Not today on a task and it will land here instead of nagging you."
          />
        }
        renderItem={({ item }) => {
          if (item.type === 'header') {
            return (
              <Text variant="caption" faint style={styles.sectionHeader}>
                {item.label}
              </Text>
            );
          }
          const task = item.task;
          const overdue = task.dueAt !== null && task.dueAt < now && !isSameDay(task.dueAt, now);
          return (
            <View style={styles.rowWrapper}>
              <SwipeableTaskRow
                task={task}
                now={now}
                onToggle={() => completeTask(task.id)}
                onSnooze={(minutes) => snoozeTask(task.id, minutes)}
                onPress={() => router.push(`/task/${task.id}`)}
              />
              {overdue ? (
                <Text variant="caption" faint style={styles.rolloverHint}>
                  returns tomorrow
                </Text>
              ) : null}
            </View>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    gap: 2,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl * 2,
    gap: spacing.xs,
  },
  sectionHeader: {
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  rowWrapper: {
    gap: 0,
  },
  rolloverHint: {
    paddingLeft: spacing.lg,
    paddingBottom: spacing.sm,
  },
});
