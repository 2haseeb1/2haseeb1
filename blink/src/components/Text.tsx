import {
  Text as RNText,
  StyleSheet,
  type ColorValue,
  type TextProps as RNTextProps,
  type TextStyle,
} from 'react-native';

import { font } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export type TextVariant =
  | 'display'
  | 'title'
  | 'h2'
  | 'body'
  | 'small'
  | 'caption'
  | 'mono';

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  /** Secondary text colour. */
  dim?: boolean;
  /** Tertiary text colour, for timestamps and hints. */
  faint?: boolean;
  /** Explicit colour, overriding the theme defaults. */
  color?: ColorValue;
}

const VARIANTS: Record<TextVariant, TextStyle> = {
  display: { fontSize: font.display, fontWeight: '700', letterSpacing: -0.8 },
  title: { fontSize: font.title, fontWeight: '700', letterSpacing: -0.4 },
  h2: { fontSize: font.h2, fontWeight: '600', letterSpacing: -0.2 },
  body: { fontSize: font.body, fontWeight: '400' },
  small: { fontSize: font.small, fontWeight: '400' },
  caption: { fontSize: font.caption, fontWeight: '600', letterSpacing: 0.4 },
  mono: { fontSize: font.small, fontFamily: 'monospace' },
};

export function Text({
  variant = 'body',
  dim,
  faint,
  color,
  style,
  ...rest
}: TextProps) {
  const theme = useTheme();
  const resolved =
    color ?? (faint ? theme.textFaint : dim ? theme.textDim : theme.text);

  return (
    <RNText
      {...rest}
      style={[styles.base, VARIANTS[variant], { color: resolved }, style]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    // Keeps text readable on the tinted surfaces without per-screen tweaks.
    includeFontPadding: false,
  },
});
