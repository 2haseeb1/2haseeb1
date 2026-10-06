import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { CloseIcon } from '@/components/icons';
import { useBlinkStore, useTaskById } from '@/features/tasks/store';
import { addDays, atClock, formatDue, formatRelative, startOfDay } from '@/lib/day';
import { haptics } from '@/lib/haptics';
import { describeRecurrence } from '@/lib/recurrence';
import type { Bucket, Recurrence } from '@/lib/types';
import { HIT, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export default function TaskDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const task = useTaskById(id);

  const updateTask = useBlinkStore((s) => s.updateTask);
  const completeTask = useBlinkStore((s) => s.completeTask);
  const reopenTask = useBlinkStore((s) => s.reopenTask);
  const deleteTask = useBlinkStore((s) => s.deleteTask);
  const moveTask = useBlinkStore((s) => s.moveTask);
  const setBucket = useBlinkStore((s) => s.setBucket);

  const [now] = useState(() => Date.now());

  if (!task) {
    return (
      <Screen edges={['top', 'bottom']} padded>
        <View style={styles.missing}>
          <Text variant="h2">Task not found</Text>
          <Text variant="small" dim>
            It may have been deleted.
          </Text>
          <Button label="Back" onPress={() => router.back()} variant="secondary" />
        </View>
      </Screen>
    );
  }

  const done = task.status === 'done';
  const today = startOfDay(now);

  const dueOptions: { label: string; value: number | null }[] = [
    { label: 'In an hour', value: now + 3_600_000 },
    { label: 'Today 5 PM', value: atClock(today, 17, 0) },
    { label: 'Tonight', value: atClock(today, 20, 0) },
    { label: 'Tomorrow', value: atClock(addDays(today, 1), 9, 0) },
    { label: 'Next week', value: atClock(addDays(today, 7), 9, 0) },
    { label: 'No date', value: null },
  ];

  const recurrenceOptions: { label: string; value: Recurrence | null }[] = [
    { label: 'Once', value: null },
    { label: 'Every day', value: { kind: 'daily' } },
    {
      label: 'Every week',
      value: { kind: 'weekly', days: [new Date(task.dueAt ?? now).getDay()] },
    },
  ];

  const confirmDelete = () => {
    haptics.warn();
    Alert.alert('Delete this task?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteTask(task.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text variant="caption" faint>
          {done ? 'COMPLETED' : 'TASK'}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={12}
          onPress={() => router.back()}
          style={styles.closeButton}
        >
          <CloseIcon color={theme.textDim} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <TextInput
            value={task.title}
            onChangeText={(title) => updateTask(task.id, { title })}
            multiline
            style={[
              styles.titleInput,
              { color: theme.text, borderBottomColor: theme.border },
              done && styles.doneTitle,
            ]}
            accessibilityLabel="Task title"
          />

          <TextInput
            value={task.notes ?? ''}
            onChangeText={(notes) => updateTask(task.id, { notes })}
            multiline
            placeholder="Notes (optional)"
            placeholderTextColor={theme.textFaint}
            style={[
              styles.notesInput,
              { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border },
            ]}
            accessibilityLabel="Task notes"
          />

          <Section title="WHEN">
            <View style={styles.chipWrap}>
              {dueOptions.map((option) => {
                const selected =
                  option.value === null
                    ? task.dueAt === null
                    : task.dueAt !== null &&
                      Math.abs(task.dueAt - option.value) < 60_000;
                return (
                  <Chip
                    key={option.label}
                    label={option.label}
                    selected={selected}
                    onPress={() =>
                      updateTask(task.id, {
                        dueAt: option.value,
                        // Keep the reminder glued to the due time it was set for.
                        remindAt: option.value === null ? null : option.value,
                      })
                    }
                  />
                );
              })}
            </View>
            <Text variant="caption" faint>
              {formatDue(task.dueAt, now) || 'No date set'}
            </Text>
          </Section>

          <Section title="REMINDER">
            <View style={styles.switchRow}>
              <Text variant="small" dim style={styles.switchLabel}>
                {task.remindAt
                  ? `Notifies at ${formatDue(task.remindAt, now)}`
                  : 'No notification for this task'}
              </Text>
              <Switch
                value={task.remindAt !== null}
                onValueChange={(on) =>
                  updateTask(task.id, { remindAt: on ? (task.dueAt ?? now + 3_600_000) : null })
                }
                trackColor={{ true: theme.accent, false: theme.border }}
                thumbColor={theme.text}
                accessibilityLabel="Reminder"
              />
            </View>
          </Section>

          <Section title="REPEAT">
            <View style={styles.chipWrap}>
              {recurrenceOptions.map((option) => (
                <Chip
                  key={option.label}
                  label={option.label}
                  selected={describeRecurrence(option.value) === describeRecurrence(task.recurrence)}
                  onPress={() => updateTask(task.id, { recurrence: option.value })}
                />
              ))}
            </View>
            <Text variant="caption" faint>
              Finishing a repeating task creates the next one automatically.
            </Text>
          </Section>

          <Section title="LIST">
            <View style={styles.chipWrap}>
              {(['today', 'later'] as Bucket[]).map((bucket) => (
                <Chip
                  key={bucket}
                  label={bucket === 'today' ? 'Today' : 'Later'}
                  selected={task.bucket === bucket}
                  onPress={() => setBucket(task.id, bucket)}
                />
              ))}
            </View>
          </Section>

          <Section title="ORDER">
            <View style={styles.chipWrap}>
              <Chip label="Move up" onPress={() => moveTask(task.id, 'up')} />
              <Chip label="Move down" onPress={() => moveTask(task.id, 'down')} />
            </View>
          </Section>

          <Card style={styles.metaCard}>
            <MetaRow label="Created" value={formatRelative(task.createdAt, now)} />
            {task.completedAt ? (
              <MetaRow label="Completed" value={formatRelative(task.completedAt, now)} />
            ) : null}
            {task.snoozeCount > 0 ? (
              <MetaRow label="Pushed away" value={`${task.snoozeCount} times`} />
            ) : null}
          </Card>

          <View style={styles.actions}>
            <Button
              label={done ? 'Reopen task' : 'Mark done'}
              onPress={() => {
                if (done) reopenTask(task.id);
                else completeTask(task.id);
                haptics.complete();
                router.back();
              }}
              size="lg"
              block
            />
            <Button label="Delete task" onPress={confirmDelete} variant="danger" block />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="caption" faint>
        {title}
      </Text>
      {children}
    </View>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Text variant="caption" faint>
        {label}
      </Text>
      <Text variant="caption" dim>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
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
  body: {
    padding: spacing.lg,
    gap: spacing.xl,
    paddingBottom: spacing.xxl * 2,
  },
  titleInput: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 31,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  doneTitle: {
    textDecorationLine: 'line-through',
  },
  notesInput: {
    minHeight: 88,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    fontSize: 15,
    lineHeight: 21,
    textAlignVertical: 'top',
  },
  section: {
    gap: spacing.md,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  switchLabel: {
    flexShrink: 1,
  },
  metaCard: {
    gap: spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actions: {
    gap: spacing.md,
  },
  missing: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
  },
});
