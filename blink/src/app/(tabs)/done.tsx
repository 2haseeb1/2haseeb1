import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { ActivityGrid } from '@/components/ActivityGrid';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { TaskRow } from '@/components/TaskRow';
import { Text } from '@/components/Text';
import {
  activityByDay,
  doneByDay,
  doneToday,
  streakDays,
  streakIsExtendedToday,
} from '@/features/tasks/selectors';
import { useBlinkStore, useTasks } from '@/features/tasks/store';
import { formatDayLabel, formatRelative } from '@/lib/day';
import type { Task } from '@/lib/types';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const HISTORY_DAYS = 14;
const ACTIVITY_DAYS = 28;

/**
 * The Done tab is the only place in Blink that looks backwards, and it exists to
 * make progress visible — an empty Today list should feel earned, not empty.
 */
export default function DoneScreen() {
  const theme = useTheme();
  const tasks = useTasks();
  const reopenTask = useBlinkStore((s) => s.reopenTask);
  const completeTask = useBlinkStore((s) => s.completeTask);

  const [now] = useState(() => Date.now());

  const streak = useMemo(() => streakDays(tasks, now), [tasks, now]);
  const extendedToday = useMemo(() => streakIsExtendedToday(tasks, now), [tasks, now]);
  const today = useMemo(() => doneToday(tasks, now), [tasks, now]);
  const activity = useMemo(() => activityByDay(tasks, now, ACTIVITY_DAYS), [tasks, now]);
  const history = useMemo(() => doneByDay(tasks, HISTORY_DAYS), [tasks]);

  const olderGroups = history.filter((group) => group.key !== history[0]?.key || today.length === 0);

  return (
    <Screen>
      <FlatList<Task>
        data={today}
        keyExtractor={(task) => task.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text variant="caption" faint>
                DONE
              </Text>
              <Text variant="h2">
                {streak > 0 ? `${streak} day streak` : 'Start a streak'}
              </Text>
              <Text variant="small" dim>
                {extendedToday
                  ? 'Today counts. Keep going.'
                  : streak > 0
                    ? 'Finish one thing today to keep it alive.'
                    : 'Finish one thing. Any size counts.'}
              </Text>
            </View>

            <Card style={styles.activityCard}>
              <Text variant="caption" faint style={styles.activityTitle}>
                LAST {ACTIVITY_DAYS} DAYS
              </Text>
              <ActivityGrid days={activity} />
            </Card>

            {today.length > 0 ? (
              <Text variant="caption" faint style={styles.sectionTitle}>
                TODAY · {today.length}
              </Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title="Nothing done yet today"
            message="Completed tasks land here. Tap the circle on any task to send one over."
          />
        }
        renderItem={({ item }) => (
          <TaskRow
            task={item}
            now={now}
            onToggle={() => reopenTask(item.id)}
            onPress={() => completeTask(item.id)}
          />
        )}
        ListFooterComponent={
          olderGroups.length > 0 ? (
            <View style={styles.history}>
              {olderGroups.map((group) => (
                <View key={group.key} style={styles.group}>
                  <View style={styles.groupHeader}>
                    <Text variant="caption" faint>
                      {formatDayLabel(new Date(`${group.key}T12:00:00`).getTime(), now).toUpperCase()}
                    </Text>
                    <Text variant="caption" faint>
                      {group.count}
                    </Text>
                  </View>
                  {group.tasks.map((task) => (
                    <View key={task.id} style={styles.historyRow}>
                      <Text variant="small" dim numberOfLines={1} style={styles.historyTitle}>
                        {task.title}
                      </Text>
                      <Text variant="caption" faint>
                        {task.completedAt ? formatRelative(task.completedAt, now) : ''}
                      </Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          ) : null
        }
      />

      <View style={[styles.footerNote, { borderTopColor: theme.border }]}>
        <Text variant="caption" faint>
          {tasks.filter((t) => t.status === 'done').length} completed all time
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.xs,
  },
  header: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.lg,
  },
  headerText: {
    gap: 2,
  },
  activityCard: {
    gap: spacing.md,
  },
  activityTitle: {
    letterSpacing: 0.6,
  },
  sectionTitle: {
    marginTop: spacing.sm,
  },
  history: {
    marginTop: spacing.xl,
    gap: spacing.xl,
  },
  group: {
    gap: spacing.sm,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  historyTitle: {
    flexShrink: 1,
    textDecorationLine: 'line-through',
  },
  footerNote: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
});
