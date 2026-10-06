import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  type SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import ReanimatedSwipeable, {
  SwipeDirection,
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';

import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { TaskRow, type TaskRowProps } from './TaskRow';
import { Text } from './Text';
import { CheckIcon, ClockIcon } from './icons';

export interface SwipeableTaskRowProps extends Omit<TaskRowProps, 'onToggle'> {
  onToggle: () => void;
  onSnooze: (minutes: number) => void;
  /** Minutes added by a left swipe. */
  snoozeMinutes?: number;
}

/**
 * Swipe right to complete, swipe left to snooze.
 *
 * Both gestures exist because they are the two things a person actually wants to
 * do with a task; everything rarer (edit, delete, reschedule) lives on the detail
 * screen. The same actions are also exposed via `accessibilityActions` on the row
 * so they are reachable without a gesture.
 */
export function SwipeableTaskRow({
  onToggle,
  onSnooze,
  snoozeMinutes = 10,
  ...rowProps
}: SwipeableTaskRowProps) {
  const theme = useTheme();
  const ref = useRef<SwipeableMethods | null>(null);

  return (
    <ReanimatedSwipeable
      ref={ref}
      friction={2}
      leftThreshold={72}
      rightThreshold={72}
      overshootLeft={false}
      overshootRight={false}
      dragOffsetFromLeftEdge={12}
      dragOffsetFromRightEdge={12}
      onSwipeableOpen={(direction) => {
        if (direction === SwipeDirection.LEFT) onToggle();
        else onSnooze(snoozeMinutes);
        ref.current?.close();
      }}
      renderLeftActions={(progress) => (
        <SwipeAction
          progress={progress}
          background={theme.success}
          align="flex-start"
          label="Done"
          icon={<CheckIcon size={20} color={theme.onAccent} thickness={2.4} />}
        />
      )}
      renderRightActions={(progress) => (
        <SwipeAction
          progress={progress}
          background={theme.warning}
          align="flex-end"
          label={`${snoozeMinutes}m`}
          icon={<ClockIcon size={20} color={theme.onAccent} />}
        />
      )}
    >
      <View
        style={[
          styles.content,
          // Opaque background so the action panels stay hidden until dragged.
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <TaskRow {...rowProps} onToggle={onToggle} />
      </View>
    </ReanimatedSwipeable>
  );
}

interface SwipeActionProps {
  progress: SharedValue<number>;
  background: string;
  align: 'flex-start' | 'flex-end';
  label: string;
  icon: React.ReactNode;
}

function SwipeAction({ progress, background, align, label, icon }: SwipeActionProps) {
  const theme = useTheme();
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, progress.value)),
    transform: [{ scale: 0.9 + 0.1 * Math.min(1, Math.max(0, progress.value)) }],
  }));

  return (
    <Animated.View
      style={[
        styles.action,
        {
          backgroundColor: background,
          justifyContent: 'center',
          alignItems: align,
        },
        animatedStyle,
      ]}
    >
      <View style={[styles.actionInner, { alignItems: align === 'flex-start' ? 'flex-start' : 'flex-end' }]}>
        {icon}
        <Text variant="caption" color={theme.onAccent}>
          {label}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  content: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  action: {
    flex: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
  },
  actionInner: {
    gap: spacing.xs,
  },
});
