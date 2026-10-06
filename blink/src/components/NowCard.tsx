import { StyleSheet, View } from 'react-native';

import { formatDue } from '@/lib/day';
import type { Task } from '@/lib/types';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { Button } from './Button';
import { Card } from './Card';
import { Text } from './Text';
import { ClockIcon, RepeatIcon } from './icons';

export interface NowCardProps {
  task: Task;
  now: number;
  onDone: () => void;
  onSnooze: () => void;
  onNotToday: () => void;
  onFocus: () => void;
}

/**
 * The Now Card: exactly one task, filling most of the screen.
 *
 * This is Blink's whole thesis. A list asks "what should I do?" every time you
 * open it; the Now Card has already answered, and offers only the four moves
 * that actually apply to a task in front of you.
 */
export function NowCard({
  task,
  now,
  onDone,
  onSnooze,
  onNotToday,
  onFocus,
}: NowCardProps) {
  const theme = useTheme();
  const dueLabel = formatDue(task.dueAt, now);

  return (
    <Card raised style={styles.card}>
      <View style={styles.headerRow}>
        <Text variant="caption" faint>
          THE ONE THING
        </Text>
        {task.snoozeCount > 0 ? (
          <Text variant="caption" faint>
            pushed {task.snoozeCount}×
          </Text>
        ) : null}
      </View>

      <Text variant="title" style={styles.title}>
        {task.title}
      </Text>

      <View style={styles.metaRow}>
        {dueLabel ? (
          <View style={styles.metaItem}>
            <ClockIcon size={14} color={theme.accent} />
            <Text variant="small" color={theme.accent}>
              {dueLabel}
            </Text>
          </View>
        ) : (
          <Text variant="small" faint>
            No deadline — whenever you are ready
          </Text>
        )}

        {task.recurrence ? (
          <View style={styles.metaItem}>
            <RepeatIcon size={14} color={theme.textDim} />
            <Text variant="small" dim>
              repeats
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.actions}>
        <Button label="Done" onPress={onDone} size="lg" style={styles.primaryAction} />
        <View style={styles.secondaryActions}>
          <Button label="Snooze 10m" onPress={onSnooze} variant="secondary" />
          <Button label="Not today" onPress={onNotToday} variant="ghost" />
          <Button label="Focus" onPress={onFocus} variant="ghost" />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    paddingVertical: spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    letterSpacing: -0.6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    flexWrap: 'wrap',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  actions: {
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  primaryAction: {
    alignSelf: 'stretch',
  },
  secondaryActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
