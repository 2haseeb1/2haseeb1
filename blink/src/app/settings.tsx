import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Switch, View } from 'react-native';

import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { ChevronIcon, CloseIcon } from '@/components/icons';
import { useBlinkStore, useSettings, useTasks } from '@/features/tasks/store';
import { exportToJson } from '@/lib/export';
import { haptics } from '@/lib/haptics';
import {
  getPermissionState,
  requestPermission,
  type PermissionState,
} from '@/lib/notifications';
import { unavailableReason } from '@/lib/runtime';
import { THEME_LIST, HIT, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const REVIEW_TIMES = ['07:00', '08:00', '09:00', '18:00', '20:00'];
const ROLLOVER_HOURS = [0, 2, 4, 6];

export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const settings = useSettings();
  const tasks = useTasks();
  const setSettings = useBlinkStore((s) => s.setSettings);
  const resetAll = useBlinkStore((s) => s.resetAll);

  const [permission, setPermission] = useState<PermissionState>('undetermined');
  // Null when reminders can work here; a human explanation when they cannot.
  const notificationsReason = unavailableReason('notifications');

  useEffect(() => {
    void getPermissionState().then(setPermission);
  }, []);

  const askForPermission = async () => {
    const granted = await requestPermission();
    setPermission(granted ? 'granted' : await getPermissionState());
  };

  const shareExport = async () => {
    try {
      const json = exportToJson(tasks, settings);
      await Share.share({
        title: 'Blink backup',
        message: json,
      });
    } catch {
      Alert.alert('Could not export', 'Sharing is unavailable on this device.');
    }
  };

  const confirmReset = () => {
    haptics.warn();
    Alert.alert(
      'Delete everything?',
      'Every task and setting will be removed from this device. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete all',
          style: 'destructive',
          onPress: () => {
            resetAll();
            router.back();
          },
        },
      ]
    );
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text variant="caption" faint>
          SETTINGS
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close settings"
          hitSlop={12}
          onPress={() => router.back()}
          style={styles.closeButton}
        >
          <CloseIcon color={theme.textDim} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Section title="THEME">
          <Card padded={false} style={styles.groupCard}>
            {THEME_LIST.map((option, index) => {
              const selected = option.name === settings.theme;
              return (
                <Pressable
                  key={option.name}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${option.label} theme`}
                  onPress={() => {
                    haptics.tap();
                    setSettings({ theme: option.name });
                  }}
                  style={[
                    styles.row,
                    index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
                  ]}
                >
                  <View style={styles.rowLabel}>
                    <View
                      style={[
                        styles.swatch,
                        { backgroundColor: option.accent, borderColor: option.bg, borderWidth: 2 },
                      ]}
                    />
                    <Text variant="body">{option.label}</Text>
                  </View>
                  {selected ? (
                    <Text variant="caption" color={theme.accent}>
                      ACTIVE
                    </Text>
                  ) : (
                    <ChevronIcon color={theme.textFaint} />
                  )}
                </Pressable>
              );
            })}
          </Card>
        </Section>

        <Section title="FEEDBACK">
          <Card padded={false} style={styles.groupCard}>
            <View style={styles.row}>
              <View style={styles.rowLabel}>
                <Text variant="body">Haptics</Text>
                <Text variant="caption" faint>
                  A small tap when you finish something
                </Text>
              </View>
              <Switch
                value={settings.haptics}
                onValueChange={(value) => setSettings({ haptics: value })}
                trackColor={{ true: theme.accent, false: theme.border }}
                thumbColor={theme.text}
                accessibilityLabel="Haptics"
              />
            </View>
          </Card>
        </Section>

        <Section title="REMINDERS">
          <Card padded={false} style={styles.groupCard}>
            <View style={styles.row}>
              <View style={styles.rowLabel}>
                <Text variant="body">Daily review</Text>
                <Text variant="caption" faint>
                  One nudge a day to pick your one thing
                </Text>
              </View>
              <Switch
                value={settings.dailyReview}
                onValueChange={(value) => setSettings({ dailyReview: value })}
                trackColor={{ true: theme.accent, false: theme.border }}
                thumbColor={theme.text}
                accessibilityLabel="Daily review notification"
              />
            </View>

            {settings.dailyReview ? (
              <View style={[styles.row, styles.wrapRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
                <Text variant="small" dim>
                  Nudge at
                </Text>
                <View style={styles.chipWrap}>
                  {REVIEW_TIMES.map((time) => (
                    <Pressable
                      key={time}
                      accessibilityRole="button"
                      accessibilityLabel={`Nudge at ${time}`}
                      accessibilityState={{ selected: settings.dailyReviewTime === time }}
                      onPress={() => setSettings({ dailyReviewTime: time })}
                      style={[
                        styles.smallChip,
                        {
                          borderColor: settings.dailyReviewTime === time ? theme.accent : theme.border,
                          backgroundColor:
                            settings.dailyReviewTime === time ? theme.accentSoft : 'transparent',
                        },
                      ]}
                    >
                      <Text
                        variant="caption"
                        color={settings.dailyReviewTime === time ? theme.accent : theme.textDim}
                      >
                        {time}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            <View style={[styles.row, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
              <View style={styles.rowLabel}>
                <Text variant="body">Notification access</Text>
                <Text variant="caption" faint>
                  {notificationsReason ??
                    (permission === 'granted'
                      ? 'Allowed'
                      : permission === 'denied'
                        ? 'Blocked — enable in system settings'
                        : 'Not requested yet')}
                </Text>
              </View>
              {/* Offering a permission button that cannot work is worse than
                  saying why it is unavailable — Android in Expo Go throws on
                  import, so reminders are off there entirely. */}
              {notificationsReason ? null : permission === 'granted' ? (
                <Text variant="caption" color={theme.success}>
                  ON
                </Text>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  onPress={askForPermission}
                  style={[styles.smallChip, { borderColor: theme.accent, backgroundColor: theme.accentSoft }]}
                >
                  <Text variant="caption" color={theme.accent}>
                    ENABLE
                  </Text>
                </Pressable>
              )}
            </View>
          </Card>
        </Section>

        <Section title="DAY BOUNDARY">
          <Card style={styles.groupCard}>
            <Text variant="small" dim>
              Blink rolls unfinished work forward at the day boundary. Push it later if you work past
              midnight.
            </Text>
            <View style={styles.chipWrap}>
              {ROLLOVER_HOURS.map((hour) => (
                <Pressable
                  key={hour}
                  accessibilityRole="button"
                  accessibilityLabel={`Day boundary at ${hour === 0 ? 'midnight' : `${hour} AM`}`}
                  accessibilityState={{ selected: settings.rolloverHour === hour }}
                  onPress={() => setSettings({ rolloverHour: hour })}
                  style={[
                    styles.smallChip,
                    {
                      borderColor: settings.rolloverHour === hour ? theme.accent : theme.border,
                      backgroundColor: settings.rolloverHour === hour ? theme.accentSoft : 'transparent',
                    },
                  ]}
                >
                  <Text
                    variant="caption"
                    color={settings.rolloverHour === hour ? theme.accent : theme.textDim}
                  >
                    {hour === 0 ? '12 AM' : `${hour} AM`}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Card>
        </Section>

        <Section title="YOUR DATA">
          <Card padded={false} style={styles.groupCard}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Export tasks as JSON"
              onPress={shareExport}
              style={styles.row}
            >
              <View style={styles.rowLabel}>
                <Text variant="body">Export backup</Text>
                <Text variant="caption" faint>
                  Share every task as JSON — this is your backup
                </Text>
              </View>
              <ChevronIcon color={theme.textFaint} />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Delete all tasks"
              onPress={confirmReset}
              style={[styles.row, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}
            >
              <View style={styles.rowLabel}>
                <Text variant="body" color={theme.danger}>
                  Delete everything
                </Text>
                <Text variant="caption" faint>
                  {tasks.length} task{tasks.length === 1 ? '' : 's'} on this device
                </Text>
              </View>
            </Pressable>
          </Card>
        </Section>

        <View style={styles.about}>
          <Text variant="caption" faint>
            BLINK 1.0.0
          </Text>
          <Text variant="small" dim style={styles.aboutText}>
            No account, no server, no sync. Everything lives on this device, which is why capture is
            instant and nothing ever leaves without your say-so.
          </Text>
        </View>
      </ScrollView>
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

const styles = StyleSheet.create({
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
  section: {
    gap: spacing.sm,
  },
  groupCard: {
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: HIT + 8,
  },
  wrapRow: {
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  rowLabel: {
    flexShrink: 1,
    gap: 2,
  },
  swatch: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  smallChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 32,
    justifyContent: 'center',
  },
  about: {
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  aboutText: {
    lineHeight: 20,
  },
});
