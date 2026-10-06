import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';

import { haptics } from '@/lib/haptics';
import { HIT, radius } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { CheckCircle } from './icons';

export interface CheckboxProps {
  checked: boolean;
  onPress: () => void;
  /** Screen-reader label for the task this box belongs to. */
  label: string;
  size?: number;
}

/**
 * The completion tap target. Animates a small squash on press — short enough to
 * feel like feedback rather than decoration.
 */
export function Checkbox({ checked, onPress, label, size = 26 }: CheckboxProps) {
  const theme = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      accessibilityHint={checked ? 'Marks the task as not done' : 'Marks the task as done'}
      hitSlop={{ top: 10, bottom: 10, left: 6, right: 10 }}
      onPress={() => {
        // `.set()` instead of `.value =` — the assignment form is rejected by the
        // React Compiler rule that ships with eslint-config-expo.
        scale.set(
          withSequence(
            withSpring(0.82, { damping: 14, stiffness: 320 }),
            withSpring(1, { damping: 12, stiffness: 220 })
          )
        );
        haptics.complete();
        onPress();
      }}
      style={styles.pressable}
    >
      <Animated.View style={animatedStyle}>
        <CheckCircle
          size={size}
          checked={checked}
          color={checked ? theme.accent : theme.textFaint}
          checkColor={theme.onAccent}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    minWidth: HIT,
    minHeight: HIT,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingRight: radius.sm,
  },
});
