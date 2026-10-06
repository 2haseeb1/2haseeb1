import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { Text } from './Text';

export interface ActivityGridProps {
  /** Oldest first, one entry per day. */
  days: { key: string; count: number; isToday: boolean }[];
}

/**
 * Completions over the last few weeks.
 *
 * Intensity (not size) encodes volume, so the grid stays a stable shape and
 * patterns are readable at a glance — the same reason contribution graphs work.
 */
export function ActivityGrid({ days }: ActivityGridProps) {
  const theme = useTheme();

  const intensityFor = (count: number): string => {
    if (count === 0) return theme.bg;
    if (count === 1) return theme.accentSoft;
    if (count <= 3) return withAlpha(theme.accent, 0.55);
    return theme.accent;
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.grid}>
        {days.map((day) => (
          <View
            key={day.key}
            accessibilityLabel={`${day.key}: ${day.count} completed`}
            style={[
              styles.cell,
              {
                backgroundColor: intensityFor(day.count),
                borderColor: day.isToday ? theme.accent : theme.border,
                borderWidth: day.isToday ? 1.5 : StyleSheet.hairlineWidth,
              },
            ]}
          />
        ))}
      </View>
      <View style={styles.legend}>
        <Text variant="caption" faint>
          {`${days.length} days`}
        </Text>
        <Text variant="caption" faint>
          today
        </Text>
      </View>
    </View>
  );
}

/** Appends an alpha channel to a 6-digit hex colour. */
function withAlpha(hex: string, alpha: number): string {
  const clamped = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return hex.length === 7 ? `${hex}${clamped}` : hex;
}

export { withAlpha };

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  cell: {
    width: 22,
    height: 22,
    borderRadius: 6,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
