/**
 * Blink's app entry point.
 *
 * This replaces `expo-router/entry` as `main` in package.json for one reason:
 * Android can launch this JS bundle *headlessly*, with no activity and no
 * mounted React tree, purely to draw a home-screen widget. The widget task
 * handler has to be registered during the first evaluation of the bundle for
 * that to work, so it is imported before the router boots.
 *
 * Everything else runs exactly as `expo-router/entry` would.
 */

import './src/widgets/widget-task-handler';
import 'expo-router/entry';
