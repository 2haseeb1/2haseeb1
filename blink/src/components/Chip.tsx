import { Pressable, StyleSheet, View } from 'react-native';

import { haptics } from '@/lib/haptics';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { Text } from './Text';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** Non-interactive chip used purely to show what was understood. */
  readOnly?: boolean;
  tone?: 'neutral' | 'accent' | 'success';
}

export function Chip({ label, selected, onPress, readOnly, tone = 'neutral' }: ChipProps) {
  const theme = useTheme();

  const accentTone = tone === 'accent' || selected;
  const color = tone === 'success' ? theme.success : accentTone ? theme.accent : theme.textDim;
  const background = accentTone && (selected || tone === 'accent') ? theme.accentSoft : 'transparent';

  const content = (
    <View
      style={[
        styles.chip,
        {
          borderColor: selected ? theme.accent : accentTone ? 'transparent' : theme.border,
          backgroundColor: background,
        },
      ]}
    >
      <Text variant="small" color={color}>
        {label}
      </Text>
    </View>
  );

  if (readOnly || !onPress) return content;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: Boolean(selected) }}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 34,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});
