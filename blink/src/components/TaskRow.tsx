import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { formatDue } from '@/lib/day';
import { describeRecurrence } from '@/lib/recurrence';
import type { Task } from '@/lib/types';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { Checkbox } from './Checkbox';
import { Text } from './Text';
import { ClockIcon, RepeatIcon } from './icons';

export interface TaskRowProps {
  task: Task;
  now: number;
  onToggle: () => void;
  onPress?: () => void;
  /** Shown on the Later tab so a task's home is obvious. */
  showBucket?: boolean;
}

/**
 * A single task.
 *
 * Swipe gestures live in `SwipeableTaskRow`; this component stays a plain row so
 * it can also be used in contexts where swiping makes no sense (the done log).
 */
export const TaskRow = memo(function TaskRow({
  task,
  now,
  onToggle,
  onPress,
  showBucket,
}: TaskRowProps) {
  const theme = useTheme();
  const done = task.status === 'done';
  const dueLabel = formatDue(task.dueAt, now);
  const snoozed = task.snoozedUntil !== null && task.snoozedUntil > now;

  const metaParts: string[] = [];
  if (task.snoozeCount >= 2 && !done) metaParts.push(`pushed ${task.snoozeCount}×`);
  if (showBucket && task.bucket === 'later') metaParts.push('Later');

  const dueIsSoon =
    !done && task.dueAt !== null && task.dueAt - now < 3 * 3_600_000;

  // Two labels are built on purpose: the row's own label describes the task,
  // while the checkbox carries the actionable name. Reusing one string for both
  // makes the task ambiguous to screen readers and to tests.
  const labelParts = [
    task.title,
    done ? 'completed' : null,
    dueLabel || null,
    task.recurrence ? describeRecurrence(task.recurrence) : null,
    snoozed ? 'snoozed' : null,
  ].filter(Boolean);

  const taskLabel = labelParts.join(', ');
  const checkboxLabel = `${done ? 'Reopen' : 'Complete'} ${task.title}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={taskLabel}
      accessibilityActions={[
        { name: 'complete', label: done ? 'Reopen task' : 'Complete task' },
        { name: 'snooze', label: 'Snooze for ten minutes' },
      ]}
      onAccessibilityAction={(event) => {
        // Swipe actions must have a non-gesture equivalent to be accessible.
        if (event.nativeEvent.actionName === 'complete') onToggle();
      }}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.row,
        { opacity: pressed && onPress ? 0.7 : 1 },
      ]}
    >
      <Checkbox checked={done} onPress={onToggle} label={checkboxLabel} />

      <View style={styles.body}>
        <Text
          variant="body"
          numberOfLines={2}
          style={done ? styles.doneText : undefined}
          dim={done}
        >
          {task.title}
        </Text>

        <View style={styles.metaRow}>
          {dueLabel ? (
            <View style={styles.metaItem}>
              <ClockIcon size={13} color={dueIsSoon ? theme.accent : theme.textFaint} />
              <Text variant="caption" color={dueIsSoon ? theme.accent : theme.textFaint}>
                {dueLabel}
              </Text>
            </View>
          ) : null}

          {task.recurrence ? (
            <View style={styles.metaItem}>
              <RepeatIcon size={13} color={theme.textFaint} />
              <Text variant="caption" faint>
                {describeRecurrence(task.recurrence)}
              </Text>
            </View>
          ) : null}

          {metaParts.length > 0 ? (
            <Text variant="caption" faint>
              {metaParts.join(' · ')}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.md,
    paddingRight: spacing.lg,
    gap: spacing.xs,
    borderRadius: radius.lg,
  },
  body: {
    flex: 1,
    gap: 3,
    paddingTop: 2,
  },
  doneText: {
    textDecorationLine: 'line-through',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
