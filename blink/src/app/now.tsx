import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { CloseIcon } from '@/components/icons';
import { nowCard } from '@/features/tasks/selectors';
import { useBlinkStore, useTasks } from '@/features/tasks/store';
import { formatDue } from '@/lib/day';
import { HIT, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * Focus mode: one task, no list, and a timer that is honest about how long it has
 * been on screen. The elapsed counter is deliberately visible — it is the only
 * pressure this screen applies.
 */
export default function FocusScreen() {
  const theme = useTheme();
  const router = useRouter();
  const tasks = useTasks();
  const completeTask = useBlinkStore((s) => s.completeTask);
  const snoozeTask = useBlinkStore((s) => s.snoozeTask);

  const [startedAt] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [startedAt]);

  const task = useMemo(() => nowCard(tasks, now), [tasks, now]);

  const finish = () => {
    if (task) completeTask(task.id);
    router.back();
  };

  if (!task) {
    return (
      <Screen edges={['top', 'bottom']} padded>
        <View style={styles.emptyWrapper}>
          <Text variant="h2">Nothing to focus on</Text>
          <Text variant="small" dim style={styles.emptyText}>
            Everything in today&apos;s queue is done or snoozed.
          </Text>
          <Button label="Back" onPress={() => router.back()} variant="secondary" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Text variant="mono" faint>
          {formatElapsed(elapsed)}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Exit focus mode"
          hitSlop={12}
          onPress={() => router.back()}
          style={styles.closeButton}
        >
          <CloseIcon color={theme.textDim} />
        </Pressable>
      </View>

      <View style={styles.center}>
        <Text variant="caption" faint>
          FOCUS
        </Text>
        <Text variant="display" style={styles.title}>
          {task.title}
        </Text>
        {task.dueAt !== null ? (
          <Text variant="small" color={theme.accent}>
            {formatDue(task.dueAt, now)}
          </Text>
        ) : (
          <Text variant="small" faint>
            No deadline
          </Text>
        )}
      </View>

      <View style={styles.actions}>
        <Button label="Done" onPress={finish} size="lg" block />
        <View style={styles.secondaryRow}>
          <Button
            label="Snooze 10m"
            onPress={() => {
              snoozeTask(task.id, 10);
              router.back();
            }}
            variant="secondary"
          />
          {task.recurrence ? (
            <Text variant="caption" faint style={styles.repeatNote}>
              Repeats — the next one appears when you finish this
            </Text>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}

function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${`${rest}`.padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  closeButton: {
    minWidth: HIT,
    minHeight: HIT,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  title: {
    lineHeight: 42,
  },
  actions: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  secondaryRow: {
    gap: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  repeatNote: {
    flexShrink: 1,
  },
  emptyWrapper: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
  },
  emptyText: {
    marginBottom: spacing.md,
  },
});
