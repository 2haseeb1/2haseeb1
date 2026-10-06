import { StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';

import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export interface CardProps extends ViewProps {
  /** Slightly lighter surface, for the one card that should lead the screen. */
  raised?: boolean;
  padded?: boolean;
  style?: ViewStyle | ViewStyle[];
}

export function Card({ raised, padded = true, style, ...rest }: CardProps) {
  const theme = useTheme();
  return (
    <View
      {...rest}
      style={[
        styles.base,
        {
          backgroundColor: raised ? theme.surfaceRaised : theme.surface,
          borderColor: theme.border,
          padding: padded ? spacing.lg : 0,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
