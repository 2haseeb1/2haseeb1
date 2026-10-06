/**
 * Hand-drawn icons.
 *
 * Blink deliberately ships no icon font: every glyph here is a handful of Views,
 * which keeps the bundle free of a font dependency, avoids the `@expo/vector-icons`
 * deprecation path, and means the icons inherit the active theme colour for free.
 */

import { View, type ColorValue } from 'react-native';

import { Text } from './Text';

export interface IconProps {
  size?: number;
  /** Accepts any RN colour so it can be fed straight from navigation options. */
  color: ColorValue;
}

/** Outline ring — the "today" tab and empty states. */
export function RingIcon({ size = 22, color, filled }: IconProps & { filled?: boolean }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 2,
        borderColor: color,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {filled ? (
        <View
          style={{
            width: size * 0.42,
            height: size * 0.42,
            borderRadius: size * 0.21,
            backgroundColor: color,
          }}
        />
      ) : null}
    </View>
  );
}

/** Three stacked bars — the "later" tab. */
export function StackIcon({ size = 22, color }: IconProps) {
  const thickness = 2.5;
  return (
    <View style={{ width: size, height: size, justifyContent: 'space-between', paddingVertical: size * 0.2 }}>
      {[1, 0.68, 0.86].map((widthFactor) => (
        <View
          key={widthFactor}
          style={{
            width: size * widthFactor,
            height: thickness,
            borderRadius: thickness / 2,
            backgroundColor: color,
          }}
        />
      ))}
    </View>
  );
}

/**
 * Checkmark built from an L-shaped border rotated -45°, which renders
 * identically on every platform (unlike a glyph from an unpredictable font).
 */
export function CheckIcon({ size = 22, color, thickness = 2.5 }: IconProps & { thickness?: number }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: size * 0.52,
          height: size * 0.26,
          borderLeftWidth: thickness,
          borderBottomWidth: thickness,
          borderColor: color,
          transform: [{ rotate: '-45deg' }],
          marginTop: -size * 0.1,
        }}
      />
    </View>
  );
}

/** Filled circle with a checkmark — the tap target on each task row. */
export function CheckCircle({
  size = 26,
  color,
  checked,
  checkColor,
}: IconProps & { checked?: boolean; checkColor: string }) {
  if (checked) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CheckIcon size={size * 0.8} color={checkColor} thickness={2.2} />
      </View>
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 2,
        borderColor: color,
      }}
    />
  );
}

/** Simple clock face: hands at 3 o'clock, enough to read as "time". */
export function ClockIcon({ size = 14, color }: IconProps) {
  const thickness = 1.6;
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: thickness,
          borderColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: thickness,
          height: size * 0.3,
          backgroundColor: color,
          top: size * 0.18,
          left: size / 2 - thickness / 2,
          borderRadius: thickness / 2,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: size * 0.28,
          height: thickness,
          backgroundColor: color,
          top: size / 2 - thickness / 2,
          left: size / 2,
          borderRadius: thickness / 2,
        }}
      />
    </View>
  );
}

/** Repeat indicator. Kept as a glyph because an arc cannot be drawn with Views. */
export function RepeatIcon({ size = 13, color }: IconProps) {
  return (
    <Text style={{ fontSize: size, lineHeight: size + 2 }} color={color}>
      ↻
    </Text>
  );
}

export function PlusIcon({ size = 26, color, thickness = 2.6 }: IconProps & { thickness?: number }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          position: 'absolute',
          width: size * 0.62,
          height: thickness,
          borderRadius: thickness / 2,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: thickness,
          height: size * 0.62,
          borderRadius: thickness / 2,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

export function CloseIcon({ size = 18, color, thickness = 2 }: IconProps & { thickness?: number }) {
  const length = size * 0.68;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          position: 'absolute',
          width: length,
          height: thickness,
          borderRadius: thickness / 2,
          backgroundColor: color,
          transform: [{ rotate: '45deg' }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: length,
          height: thickness,
          borderRadius: thickness / 2,
          backgroundColor: color,
          transform: [{ rotate: '-45deg' }],
        }}
      />
    </View>
  );
}

/** Chevron built from an L rotated 45° (right) or -135° (left). */
export function ChevronIcon({
  size = 18,
  color,
  direction = 'right',
  thickness = 2,
}: IconProps & { direction?: 'left' | 'right' | 'down'; thickness?: number }) {
  const angle = direction === 'right' ? '-45deg' : direction === 'left' ? '135deg' : '45deg';
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: size * 0.4,
          height: size * 0.4,
          borderRightWidth: thickness,
          borderBottomWidth: thickness,
          borderColor: color,
          transform: [{ rotate: angle }],
        }}
      />
    </View>
  );
}
