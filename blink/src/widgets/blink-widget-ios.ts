/**
 * The iOS widget instance.
 *
 * `createWidget` takes the layout component — which `babel-preset-expo` has
 * already replaced with the source *string* by the time this module runs — and
 * hands it to the native side, which stores it in the app group under
 * `__expo_widgets_<name>_layout`.
 *
 * The name here must match `plugins.expo-widgets.widgets[].name` in `app.json`.
 * If the two drift apart you get a red "No layout found" box on the home screen.
 *
 * This module is imported lazily and only on iOS (see `bridge.ts`), because
 * `expo-widgets` has no web or Android layout runtime — on Android, Blink uses
 * `react-native-android-widget` instead.
 */

import { createWidget } from 'expo-widgets';

import type { WidgetSnapshot } from '@/features/widget/snapshot';

import BlinkWidget from './BlinkWidget';

export const IOS_WIDGET_NAME = 'BlinkNow';

export const blinkNowWidget = createWidget<WidgetSnapshot>(IOS_WIDGET_NAME, BlinkWidget);
