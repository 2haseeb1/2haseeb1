/**
 * Blink's Android home-screen widget.
 *
 * Unlike the iOS layout, this is an ordinary React component: it is rendered to
 * a widget tree by `react-native-android-widget` inside a headless JS task and
 * pushed to the launcher. So the normal rules apply rather than the string-
 * extraction rules — but it must not touch hooks, context or the store, because
 * on a headless update the app is not mounted. Everything it draws comes in
 * through props.
 *
 * The name must match `plugins.0.widgets[].name` in `app.json`.
 */

import { FlexWidget, TextWidget } from 'react-native-android-widget';

import type { WidgetSnapshot } from '@/features/widget/snapshot';

export const ANDROID_WIDGET_NAME = 'BlinkNow';

const INK = '#F2F5FA';
const DIM = '#A7B1C6';
const FAINT = '#5D6784';
const ACCENT = '#7C8CFF';
const BACKGROUND = '#0A0D14';

export interface BlinkAndroidWidgetProps {
  snapshot: WidgetSnapshot;
  /** Android 12+ tints widgets in some launcher configurations. */
  dark?: boolean;
}

export function BlinkAndroidWidget({ snapshot, dark = true }: BlinkAndroidWidgetProps) {
  const background = dark ? BACKGROUND : '#FFFFFF';
  const ink = dark ? INK : '#12151F';
  const dim = dark ? DIM : '#4A5568';
  const faint = dark ? FAINT : '#8A94A6';

  const headline = snapshot.clear ? 'All clear' : snapshot.title;
  const subtitle = snapshot.clear
    ? snapshot.doneToday > 0
      ? `${snapshot.doneToday} done today`
      : 'Nothing queued'
    : snapshot.due || 'No deadline';

  const queuedBehind = snapshot.openCount > 1 ? snapshot.openCount - 1 : 0;

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: background,
        borderRadius: 24,
        padding: 16,
      }}
    >
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flexGap: 8 }}>
        <TextWidget
          text={snapshot.clear ? 'BLINK' : 'THE ONE THING'}
          style={{ fontSize: 10, fontWeight: 'bold', color: ACCENT }}
        />
        {queuedBehind > 0 ? (
          <TextWidget text={`+${queuedBehind}`} style={{ fontSize: 10, color: faint }} />
        ) : null}
      </FlexWidget>

      <TextWidget
        text={headline}
        maxLines={3}
        truncate="END"
        style={{ fontSize: 16, fontWeight: 'bold', color: ink }}
      />

      <TextWidget
        text={subtitle}
        maxLines={1}
        truncate="END"
        style={{ fontSize: 12, color: ACCENT }}
      />

      {snapshot.upNext.length > 0 ? (
        <FlexWidget style={{ flexDirection: 'column' }}>
          {snapshot.upNext.slice(0, 2).map((title, index) => (
            <TextWidget
              key={String(index)}
              text={`• ${title}`}
              maxLines={1}
              truncate="END"
              style={{ fontSize: 11, color: dim }}
            />
          ))}
        </FlexWidget>
      ) : null}

      <TextWidget
        text={
          snapshot.streak > 0
            ? `${snapshot.streak} day${snapshot.streak === 1 ? '' : 's'} · ${snapshot.doneToday} today`
            : `${snapshot.doneToday} done today`
        }
        style={{ fontSize: 10, color: faint }}
      />
    </FlexWidget>
  );
}
