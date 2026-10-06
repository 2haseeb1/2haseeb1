/**
 * Jest module resolver.
 *
 * Reanimated 4 depends on `react-native-worklets`, whose `.native.ts` entry
 * reaches for a native module that does not exist under Jest. Worklets ships a
 * resolver that strips `.native` extensions for its own files, but jest-expo
 * already installs React Native's resolver — and Jest only accepts one.
 *
 * This composes them: the worklets rule is applied first, then everything is
 * handed to React Native's resolver so platform/asset resolution keeps working.
 */

const reactNativeResolver = require('@react-native/jest-preset/jest/resolver.js');

module.exports = (request, options) => {
  const isWorklets =
    options.basedir.includes('react-native-worklets') || request.includes('react-native-worklets');

  if (!isWorklets) return reactNativeResolver(request, options);

  return reactNativeResolver(request, {
    ...options,
    extensions: options.extensions?.filter((ext) => !ext.includes('native')),
  });
};
