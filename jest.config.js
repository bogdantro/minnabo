module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest-setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@mocks/(.*)$': '<rootDir>/tests/mocks/$1',
    '\\.(png|jpg|jpeg|gif|webp|svg)$': '<rootDir>/tests/fileMock.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@tanstack/.*|expo-router|expo-modules-core|expo-linear-gradient|expo-image|@react-native-async-storage/.*))',
  ],
  testMatch: ['<rootDir>/tests/**/*.test.{ts,tsx}'],
  testTimeout: 20000,
  // Fewer workers keeps RNTL waitFor() timers reliable on a loaded machine.
  maxWorkers: '50%',
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/tests/testUtils.tsx', '<rootDir>/tests/fileMock.js'],
  forceExit: true,
};
