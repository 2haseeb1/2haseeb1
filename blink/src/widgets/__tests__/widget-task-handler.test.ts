/**
 * Guards the entry point against a platform crash.
 *
 * `index.js` imports the widget task handler on **every** platform, and
 * `registerWidgetTaskHandler` calls `AppRegistry.registerHeadlessTask` — which
 * exists on Android only. `react-native-web` does not implement it at all, so an
 * unguarded call throws during module evaluation and takes the whole app down
 * before it renders.
 *
 * Bundling cannot catch this: the file compiles either way. Hence a test.
 */

import {
  handleWidgetTask,
  registerTaskHandlerIfSupported,
  shouldRegisterTaskHandler,
} from '../widget-task-handler';

const mockRegisterWidgetTaskHandler = jest.fn();

// Hoisted above the import by babel-plugin-jest-hoist, so the module under test
// receives the spy rather than the real launcher-facing implementation.
jest.mock('react-native-android-widget', () => ({
  registerWidgetTaskHandler: (handler: unknown) => mockRegisterWidgetTaskHandler(handler),
}));

beforeEach(() => {
  mockRegisterWidgetTaskHandler.mockClear();
});

describe('shouldRegisterTaskHandler', () => {
  it('is true on Android only', () => {
    expect(shouldRegisterTaskHandler('android')).toBe(true);
    expect(shouldRegisterTaskHandler('ios')).toBe(false);
    // react-native-web has no AppRegistry.registerHeadlessTask.
    expect(shouldRegisterTaskHandler('web')).toBe(false);
  });
});

describe('registerTaskHandlerIfSupported', () => {
  it('does nothing on web', () => {
    expect(() => registerTaskHandlerIfSupported('web')).not.toThrow();
    expect(mockRegisterWidgetTaskHandler).not.toHaveBeenCalled();
  });

  it('does nothing on iOS', () => {
    expect(() => registerTaskHandlerIfSupported('ios')).not.toThrow();
    expect(mockRegisterWidgetTaskHandler).not.toHaveBeenCalled();
  });

  it('registers the handler on Android', () => {
    registerTaskHandlerIfSupported('android');
    expect(mockRegisterWidgetTaskHandler).toHaveBeenCalledTimes(1);
    expect(mockRegisterWidgetTaskHandler).toHaveBeenCalledWith(handleWidgetTask);
  });

  it('does not propagate a registration failure into app startup', () => {
    // An OS or launcher that rejects the headless task must not be fatal.
    mockRegisterWidgetTaskHandler.mockImplementationOnce(() => {
      throw new Error('AppRegistry.registerHeadlessTask is not a function');
    });
    expect(() => registerTaskHandlerIfSupported('android')).not.toThrow();
  });
});

describe('handleWidgetTask', () => {
  it('renders a widget for an added or updated widget', async () => {
    const renderWidget = jest.fn();
    await handleWidgetTask({ widgetAction: 'WIDGET_UPDATE', renderWidget });
    expect(renderWidget).toHaveBeenCalledTimes(1);
  });

  it('renders nothing for a deleted widget', async () => {
    const renderWidget = jest.fn();
    await handleWidgetTask({ widgetAction: 'WIDGET_DELETED', renderWidget });
    expect(renderWidget).not.toHaveBeenCalled();
  });
});
