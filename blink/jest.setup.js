/**
 * Jest environment shims.
 *
 * The store persists through AsyncStorage, so tests need its official mock
 * rather than a hand-rolled stub.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
