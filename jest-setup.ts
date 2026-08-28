/* eslint-disable @typescript-eslint/no-var-requires */
import { cleanup } from '@testing-library/react-native';

// Unmount any tree the previous test left behind (async render skips
// RNTL's automatic afterEach cleanup in some cases).
afterEach(async () => {
  await cleanup();
});

// Reset in-memory mock stores between tests so state never leaks across suites.
afterEach(() => {
  try {
    require('@/data/repositories').repositories.listings._reset();
  } catch {
    /* module not loaded in this test */
  }
  try {
    require('@/data/chatRepository').chatRepository._reset();
  } catch {
    /* not loaded */
  }
  try {
    require('@/data/savedStore').savedStore._reset();
  } catch {
    /* not loaded */
  }
  try {
    require('@/data/draftStore').draftStore.clear();
  } catch {
    /* not loaded */
  }
  try {
    require('@/data/profileRepository').profileRepository._reset();
  } catch {
    /* not loaded */
  }
  try {
    require('@/data/safetyStore').safetyStore._reset();
  } catch {
    /* not loaded */
  }
  try {
    require('@/data/authStore').authStore._reset();
  } catch {
    /* not loaded */
  }
});

jest.mock('@react-native-async-storage/async-storage', () => {
  let store: Record<string, string> = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn((key: string) => Promise.resolve(store[key] ?? null)),
      setItem: jest.fn((key: string, value: string) => {
        store[key] = value;
        return Promise.resolve();
      }),
      removeItem: jest.fn((key: string) => {
        delete store[key];
        return Promise.resolve();
      }),
      clear: jest.fn(() => {
        store = {};
        return Promise.resolve();
      }),
      getAllKeys: jest.fn(() => Promise.resolve(Object.keys(store))),
    },
  };
});

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    LinearGradient: ({ children, ...props }: any) =>
      React.createElement(View, props, children),
  };
});

jest.mock('expo-image', () => {
  const React = require('react');
  const { Image } = require('react-native');
  return { Image: (props: any) => React.createElement(Image, props) };
});

jest.mock('@react-native-community/slider', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { __esModule: true, default: (props: any) => React.createElement(View, props) };
});

jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  const make = () => (props: any) => React.createElement(View, props, props.children);
  return {
    __esModule: true,
    default: make(),
    Svg: make(),
    Path: make(),
    Circle: make(),
    Rect: make(),
    Line: make(),
    G: make(),
    Polyline: make(),
    Polygon: make(),
  };
});

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const make = (name: string) => (props: any) =>
    React.createElement(Text, { ...props, accessibilityRole: 'image' }, name);
  return { Feather: make('Feather'), Ionicons: make('Ionicons') };
});

jest.mock('expo-font', () => ({
  useFonts: () => [true, null],
  loadAsync: jest.fn().mockResolvedValue(undefined),
  isLoaded: () => true,
}));

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn().mockResolvedValue(undefined),
  hideAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-router', () => {
  const React = require('react');
  const { View } = require('react-native');
  const passthrough = (props: any) => React.createElement(View, props, props.children);
  const router = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    navigate: jest.fn(),
    canGoBack: jest.fn(() => true),
    setParams: jest.fn(),
    dismiss: jest.fn(),
    dismissAll: jest.fn(),
  };
  const Stack: any = passthrough;
  Stack.Screen = () => null;
  const Tabs: any = passthrough;
  Tabs.Screen = () => null;
  return {
    router,
    useRouter: () => router,
    useLocalSearchParams: () => ({}),
    useSegments: () => [],
    usePathname: () => '/',
    Link: ({ children }: any) => children,
    Stack,
    Tabs,
    Slot: passthrough,
    Redirect: () => null,
  };
});
