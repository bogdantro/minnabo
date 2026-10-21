module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest-setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@mocks/(.*)$': '<rootDir>/tests/mocks/$1',
    // lucide's package.json points RN/jest at .mjs, which jest does not transform.
    '^lucide-react-native$': '<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js',
    '\\.(png|jpg|jpeg|gif|webp|svg)$': '<rootDir>/tests/fileMock.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@tanstack/.*|expo-router|expo-modules-core|expo-image|@react-native-async-storage/.*|@gorhom/.*))',
  ],
  testMatch: ['<rootDir>/tests/**/*.test.{ts,tsx}'],
  testTimeout: 20000,
  // Fewer workers keeps RNTL waitFor() timers reliable on a loaded machine.
  maxWorkers: '50%',
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/tests/testUtils.tsx', '<rootDir>/tests/fileMock.js'],
};
