/**
 * Blink's iOS home-screen widget.
 *
 * ## How this file actually runs
 *
 * The `'widget'` directive below is not a comment. `babel-preset-expo` sees it
 * and replaces this entire function with a **string** containing its source. That
 * string is handed to `expo-widgets`, stored in the app group, and evaluated
 * inside the widget extension's own JS runtime — a process with no access to this
 * module, the store, or anything else in the app.
 *
 * Three rules follow, and all three are enforced by
 * `src/features/widget/__tests__/widget-layout.test.ts`:
 *
 *   1. **No module-scope references.** Colours and helpers are declared *inside*
 *      the function so they travel with the source. A module-level `const INK`
 *      would be `undefined` in the widget runtime and fail at render.
 *   2. **No `\n` escapes in strings.** The source is re-generated in compact mode
 *      by `@babel/generator`, which turns `'\n'` into a literal newline inside a
 *      string literal — invalid JavaScript. Render separate `<Text>` elements
 *      instead of joining a multi-line string.
 *   3. **Components are bare identifiers.** The declarations below are erased at
 *      compile time and exist only so this file type-checks; at runtime the
 *      widget bundle installs the same names on `globalThis`
 *      (`expo-widgets/bundle/index.ts` spreads `@expo/ui/swift-ui` and its
 *      modifiers into the global scope). They are declared at *module* scope
 *      rather than globally because `lib.dom`'s `Text` class would otherwise win
 *      the name.
 *
 * ## Layout by size
 *
 *   systemSmall / Medium / Large — the one thing, then what is queued behind it
 *   accessoryRectangular         — lock screen, text only
 *   accessoryCircular            — lock screen, counts only
 */

import type { WidgetEnvironment } from 'expo-widgets';

import type { WidgetSnapshot } from '@/features/widget/snapshot';

// Type-only stand-ins for the widget runtime's globals. `declare const` is
// erased by the compiler, so the emitted source stays bare.
declare const VStack: typeof import('@expo/ui/swift-ui').VStack;
declare const HStack: typeof import('@expo/ui/swift-ui').HStack;
declare const Text: typeof import('@expo/ui/swift-ui').Text;
declare const Spacer: typeof import('@expo/ui/swift-ui').Spacer;

declare const font: typeof import('@expo/ui/swift-ui/modifiers').font;
declare const lineLimit: typeof import('@expo/ui/swift-ui/modifiers').lineLimit;
declare const opacity: typeof import('@expo/ui/swift-ui/modifiers').opacity;
declare const foregroundColor: typeof import('@expo/ui/swift-ui/modifiers').foregroundColor;
declare const widgetURL: typeof import('@expo/ui/swift-ui/modifiers').widgetURL;
declare const containerBackground: typeof import('@expo/ui/swift-ui/modifiers').containerBackground;

export default function BlinkWidget(
  props: WidgetSnapshot,
  environment: WidgetEnvironment
): React.JSX.Element {
  'widget';

  /* Declared in-function on purpose: these must be baked into the extracted
     source string, because nothing outside the function exists in the runtime. */
  const INK = '#F2F5FA';
  const DIM = '#A7B1C6';
  const FAINT = '#5D6784';
  const ACCENT = '#7C8CFF';
  const BACKGROUND = '#0A0D14';

  const family = environment.widgetFamily;
  const isLockScreen =
    family === 'accessoryCircular' ||
    family === 'accessoryRectangular' ||
    family === 'accessoryInline';
  const isSmall = family === 'systemSmall';
  const isCircular = family === 'accessoryCircular';

  /* Lock-screen widgets are rendered by the system in a monochrome or accented
     style. Painting our own dark background there looks broken, so the
     background and explicit foreground colours are home-screen only. */
  const backgroundModifiers: ReturnType<typeof containerBackground>[] = isLockScreen
    ? []
    : [containerBackground(BACKGROUND, 'widget')];

  const queuedBehind = props.openCount > 1 ? props.openCount - 1 : 0;

  if (isCircular) {
    return (
      <VStack spacing={0} modifiers={backgroundModifiers}>
        <Text modifiers={[font({ size: 22, weight: 'bold' })]}>
          {props.clear ? '✓' : String(props.openCount)}
        </Text>
        <Text modifiers={[font({ size: 9 }), opacity(0.7)]}>
          {props.clear ? 'clear' : props.openCount === 1 ? 'task' : 'tasks'}
        </Text>
      </VStack>
    );
  }

  const headline = props.clear ? 'All clear' : props.title;
  const subtitle = props.clear
    ? props.doneToday > 0
      ? `${props.doneToday} done today`
      : 'Nothing queued'
    : props.due || 'No deadline';
  const footer =
    props.streak > 0
      ? `${props.streak} day${props.streak === 1 ? '' : 's'} · ${props.doneToday} today`
      : `${props.doneToday} done today`;

  return (
    <VStack spacing={isSmall ? 6 : 4} modifiers={[widgetURL('blink://now')]}>
      <HStack spacing={6} modifiers={backgroundModifiers}>
        <Text modifiers={[font({ size: 9, weight: 'semibold' }), foregroundColor(ACCENT)]}>
          {props.clear ? 'BLINK' : 'THE ONE THING'}
        </Text>
        {queuedBehind > 0 && !isLockScreen ? (
          <Text modifiers={[font({ size: 9 }), foregroundColor(FAINT)]}>
            {`+${queuedBehind}`}
          </Text>
        ) : null}
      </HStack>

      <Text
        modifiers={
          isLockScreen
            ? [font({ size: 15, weight: 'semibold' }), lineLimit(isSmall ? 3 : 2)]
            : [
                font({ size: isSmall ? 15 : 17, weight: 'semibold' }),
                foregroundColor(INK),
                lineLimit(isSmall ? 3 : 2),
              ]
        }
      >
        {headline}
      </Text>

      <Text
        modifiers={
          isLockScreen
            ? [font({ size: 11 }), lineLimit(1)]
            : [font({ size: 11 }), foregroundColor(ACCENT), lineLimit(1)]
        }
      >
        {subtitle}
      </Text>

      {/* Queued tasks render as one Text each rather than a single joined block,
          because a newline escape in a string is emitted as a real newline and
          breaks the extracted source. */}
      {!isSmall
        ? props.upNext.map((title, index) => (
            <Text
              key={String(index)}
              modifiers={
                isLockScreen
                  ? [font({ size: 10 }), lineLimit(1)]
                  : [font({ size: 10 }), foregroundColor(DIM), lineLimit(1)]
              }
            >
              {`• ${title}`}
            </Text>
          ))
        : null}

      <Spacer />

      <Text
        modifiers={
          isLockScreen ? [font({ size: 9 })] : [font({ size: 9 }), foregroundColor(FAINT)]
        }
      >
        {footer}
      </Text>
    </VStack>
  );
}
