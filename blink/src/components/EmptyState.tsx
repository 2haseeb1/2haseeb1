import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { Text } from './Text';
import { RingIcon } from './icons';

export interface EmptyStateProps {
  title: string;
  message: string;
  /** Rendered under the message, e.g. a primary call to action. */
  action?: React.ReactNode;
}

/**
 * Empty states are written to be calm rather than congratulatory — an empty
 * todo list is a nice place to be, not an achievement to celebrate.
 */
export function EmptyState({ title, message, action }: EmptyStateProps) {
  const theme = useTheme();
  return (
    <View style={styles.container}>
      <RingIcon size={44} color={theme.border} />
      <Text variant="h2" style={styles.title}>
        {title}
      </Text>
      <Text variant="small" dim style={styles.message}>
        {message}
      </Text>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl * 1.5,
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  title: {
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  message: {
    textAlign: 'center',
    maxWidth: 300,
    lineHeight: 21,
  },
  action: {
    marginTop: spacing.sm,
  },
});
