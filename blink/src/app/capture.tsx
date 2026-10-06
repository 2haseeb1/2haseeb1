import { useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { CloseIcon } from '@/components/icons';
import { SharedDraftApplier } from '@/features/capture/SharedDraftApplier';
import type { SharedDraft } from '@/features/capture/useSharedDraft';
import { useBlinkStore } from '@/features/tasks/store';
import { addDays, atClock, startOfDay } from '@/lib/day';
import { haptics } from '@/lib/haptics';
import { parseTaskInput } from '@/lib/parse';
import { bucketForDue } from '@/lib/rollover';
import type { Bucket, Recurrence } from '@/lib/types';
import { HIT, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * Quick capture.
 *
 * The screen does one thing: turn a sentence into a task. The parser fills in the
 * date, and because a wrong guess is worse than no guess, every interpretation is
 * shown as an editable chip and any explicit tap overrides the parser entirely.
 */
export default function CaptureScreen() {
  const theme = useTheme();
  const router = useRouter();
  const addTask = useBlinkStore((s) => s.addTask);
  const rolloverHour = useBlinkStore((s) => s.settings.rolloverHour);

  const inputRef = useRef<TextInput>(null);
  const [text, setText] = useState('');
  const [now] = useState(() => Date.now());

  // `undefined` means "trust the parser"; a value means the user chose explicitly.
  const [dateOverride, setDateOverride] = useState<number | null | undefined>(undefined);
  const [repeatOverride, setRepeatOverride] = useState<Recurrence | null | undefined>(undefined);

  // Set when this capture started life as a share from another app.
  const [shared, setShared] = useState<SharedDraft | null>(null);

  /**
   * A share prefills the sheet rather than saving straight away: the parser is
   * good, not infallible, and Blink never records something the user has not
   * seen. It is still one tap to accept.
   */
  const applySharedDraft = useCallback((draft: SharedDraft) => {
    setShared(draft);
    setText(draft.input.title);
    setDateOverride(draft.input.dueAt ?? null);
    setRepeatOverride(draft.input.recurrence ?? null);
  }, []);

  const parsed = useMemo(() => parseTaskInput(text, now), [text, now]);

  const dueAt = dateOverride !== undefined ? dateOverride : parsed.dueAt;
  const recurrence = repeatOverride !== undefined ? repeatOverride : parsed.recurrence;
  const title = parsed.title;

  const quickDates = useMemo(() => {
    const today = startOfDay(now);
    return [
      { label: 'Today 5 PM', value: atClock(today, 17, 0) },
      { label: 'Tonight', value: atClock(today, 20, 0) },
      { label: 'Tomorrow', value: atClock(addDays(today, 1), 9, 0) },
      { label: 'Next week', value: atClock(addDays(today, 7), 9, 0) },
      { label: 'Someday', value: null as number | null },
    ];
  }, [now]);

  const chips = [...new Set(parsed.matched)];

  const save = () => {
    const finalTitle = title.trim() || text.trim();
    if (!finalTitle) return;

    const bucket: Bucket = parsed.bucket ?? bucketForDue(dueAt, now, rolloverHour);
    addTask({
      title: finalTitle,
      dueAt,
      recurrence: recurrence ?? null,
      bucket,
      // A share's body is worth keeping; a typed title's is not.
      notes: shared?.input.notes,
    });
    haptics.complete();
    router.back();
  };

  const canSave = (title.trim() || text.trim()).length > 0;

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        {Platform.OS === 'web' ? null : (
          <SharedDraftApplier now={now} onDraft={applySharedDraft} />
        )}

        <View style={styles.header}>
          <Text variant="caption" faint>
            {shared ? 'SHARED TO BLINK' : 'NEW TASK'}
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

        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TextInput
            ref={inputRef}
            autoFocus
            value={text}
            onChangeText={(next) => {
              setText(next);
              // Editing invalidates an explicit choice: the sentence is king.
              setDateOverride(undefined);
              setRepeatOverride(undefined);
            }}
            placeholder="What needs doing?"
            placeholderTextColor={theme.textFaint}
            style={[
              styles.input,
              { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border },
            ]}
            multiline
            returnKeyType="done"
            onSubmitEditing={save}
            blurOnSubmit={false}
            accessibilityLabel="Task description"
            accessibilityHint="Type a task. Dates like tomorrow or friday are understood."
          />

          {chips.length > 0 ? (
            <View style={styles.chipRow}>
              <Text variant="caption" faint>
                UNDERSTOOD
              </Text>
              <View style={styles.chipWrap}>
                {chips.map((chip) => (
                  <Chip key={chip} label={chip} readOnly tone="accent" />
                ))}
                {parsed.timeAssumed ? (
                  <Text variant="caption" faint>
                    (time assumed)
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text variant="caption" faint>
              WHEN
            </Text>
            <View style={styles.chipWrap}>
              {quickDates.map((option) => (
                <Chip
                  key={option.label}
                  label={option.label}
                  selected={dateOverride === option.value}
                  onPress={() => setDateOverride(option.value)}
                />
              ))}
              {dueAt !== null ? (
                <Chip label="Clear date" onPress={() => setDateOverride(null)} />
              ) : null}
            </View>
          </View>

          <View style={styles.section}>
            <Text variant="caption" faint>
              REPEAT
            </Text>
            <View style={styles.chipWrap}>
              <Chip
                label="Every day"
                selected={recurrence?.kind === 'daily'}
                onPress={() =>
                  setRepeatOverride(recurrence?.kind === 'daily' ? null : { kind: 'daily' })
                }
              />
              <Chip
                label="Every week"
                selected={recurrence?.kind === 'weekly'}
                onPress={() =>
                  setRepeatOverride(
                    recurrence?.kind === 'weekly'
                      ? null
                      : { kind: 'weekly', days: [new Date(now).getDay()] }
                  )
                }
              />
            </View>
          </View>

          {text.trim().length === 0 ? (
            <View style={styles.examples}>
              <Text variant="caption" faint>
                TRY
              </Text>
              {[
                'pay rent on the 5th',
                'gym every monday at 7am',
                'call mom tomorrow at 5pm',
                'stretch in 20 minutes',
              ].map((example) => (
                <Pressable
                  key={example}
                  accessibilityRole="button"
                  onPress={() => {
                    setText(example);
                    setDateOverride(undefined);
                    setRepeatOverride(undefined);
                  }}
                  style={styles.exampleRow}
                >
                  <Text variant="small" dim>
                    {example}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: theme.border }]}>
          <Button
            label="Add task"
            onPress={save}
            size="lg"
            block
            disabled={!canSave}
            testID="capture-save"
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
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
  },
  input: {
    minHeight: 96,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    fontSize: 20,
    lineHeight: 27,
    textAlignVertical: 'top',
  },
  chipRow: {
    gap: spacing.sm,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    alignItems: 'center',
  },
  section: {
    gap: spacing.sm,
  },
  examples: {
    gap: spacing.sm,
  },
  exampleRow: {
    minHeight: HIT,
    justifyContent: 'center',
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
