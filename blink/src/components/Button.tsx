import { Pressable, StyleSheet, type ViewStyle } from 'react-native';

import { haptics } from '@/lib/haptics';
import { HIT, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { Text, type TextVariant } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'lg';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  /** Full-width block button. */
  block?: boolean;
  style?: ViewStyle;
  testID?: string;
  accessibilityHint?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  block,
  style,
  testID,
  accessibilityHint,
}: ButtonProps) {
  const theme = useTheme();

  const background =
    variant === 'primary'
      ? theme.accent
      : variant === 'secondary'
        ? theme.accentSoft
        : variant === 'danger'
          ? 'transparent'
          : 'transparent';

  const textColor =
    variant === 'primary'
      ? theme.onAccent
      : variant === 'danger'
        ? theme.danger
        : variant === 'secondary'
          ? theme.accent
          : theme.textDim;

  const textVariant: TextVariant = size === 'lg' ? 'h2' : 'body';

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: background,
          borderColor: variant === 'danger' ? theme.danger : 'transparent',
          borderWidth: variant === 'danger' ? StyleSheet.hairlineWidth : 0,
          minHeight: size === 'lg' ? 56 : HIT,
          paddingHorizontal: size === 'lg' ? spacing.xl : spacing.lg,
          opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
          alignSelf: block ? 'stretch' : 'flex-start',
        },
        style,
      ]}
    >
      <Text variant={textVariant} color={textColor} style={styles.label}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    textAlign: 'center',
  },
});
