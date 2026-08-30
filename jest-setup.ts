/* eslint-disable @typescript-eslint/no-var-requires */
import { cleanup } from '@testing-library/react-native';

// The app must never hit the network in tests — it always uses MockApiClient.
// These mocks keep any accidental import of the supabase client harmless.
jest.mock('@/lib/env', () => ({
  ENV: { supabaseUrl: 'http://test.local', supabaseAnonKey: 'test-anon-key', useMocks: false },
}));

// The seeded "current user" — tests run as this profile (see src/data/seed.ts).
// Inlined (not a shared const) so jest's mock-factory hoisting can't see a TDZ.
jest.mock('@/lib/supabase', () => {
  const session = { user: { id: 'u-mb', email: 'me@minnabo.test' } };
  const channel = {
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }),
    track: jest.fn().mockResolvedValue(undefined),
    presenceState: jest.fn().mockReturnValue({}),
    unsubscribe: jest.fn(),
  };
  return {
    supabase: {
      auth: {
        getSession: jest.fn().mockResolvedValue({ data: { session }, error: null }),
        getUser: jest.fn().mockResolvedValue({ data: { user: session.user }, error: null }),
        onAuthStateChange: jest
          .fn()
          .mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } }),
        signInWithOtp: jest.fn().mockResolvedValue({ data: {}, error: null }),
        verifyOtp: jest.fn().mockResolvedValue({ data: { session }, error: null }),
        signInWithPassword: jest.fn().mockResolvedValue({ data: { session }, error: null }),
        signOut: jest.fn().mockResolvedValue({ error: null }),
        startAutoRefresh: jest.fn(),
        stopAutoRefresh: jest.fn(),
      },
      // Chainable query-builder stub: every method returns the builder, and it
      // resolves to an empty result when awaited. Screens that read data in
      // tests go through MockApiClient, not this — this only covers the few
      // screens that call supabase.from(...) directly (onboarding writes).
      from: jest.fn(() => {
        const builder: Record<string, jest.Mock> = {};
        const chain = () => builder;
        for (const m of [
          'select', 'insert', 'update', 'upsert', 'delete', 'eq', 'neq', 'in',
          'order', 'limit', 'maybeSingle', 'single', 'textSearch',
        ]) {
          builder[m] = jest.fn(chain);
        }
        // make the builder awaitable
        (builder as unknown as { then: unknown }).then = (resolve: (v: unknown) => void) =>
          resolve({ data: [], error: null });
        return builder;
      }),
      rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
      channel: jest.fn().mockReturnValue(channel),
      removeChannel: jest.fn(),
      storage: { from: jest.fn() },
      functions: { invoke: jest.fn().mockResolvedValue({ data: null, error: null }) },
    },
  };
});

// Unmount any tree the previous test left behind (async render skips
// RNTL's automatic afterEach cleanup in some cases).
afterEach(async () => {
  await cleanup();
});

// Re-assert the supabase auth mock implementations before every test so mock
// call-state clearing can't drop them. Tests run as the seeded "current user".
beforeEach(() => {
  const { supabase } = require('@/lib/supabase');
  const session = { user: { id: 'u-mb', email: 'me@minnabo.test' } };
  supabase.auth.getSession.mockClear().mockResolvedValue({ data: { session }, error: null });
  supabase.auth.getUser.mockClear().mockResolvedValue({ data: { user: session.user }, error: null });
  supabase.auth.signInWithOtp.mockClear().mockResolvedValue({ data: {}, error: null });
  supabase.auth.verifyOtp.mockClear().mockResolvedValue({ data: { session }, error: null });
  supabase.auth.signInWithPassword.mockClear().mockResolvedValue({ data: { session }, error: null });
  supabase.auth.signOut.mockClear().mockResolvedValue({ error: null });
  supabase.from.mockClear();
  supabase.rpc.mockClear().mockResolvedValue({ data: null, error: null });
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
    require('@/data/savedSearchStore').savedSearchStore._reset();
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
    require('@/lib/outbox').outbox._reset();
  } catch {
    /* not loaded */
  }
  try {
    require('@/lib/recentSearches').recentSearches._reset();
  } catch {
    /* not loaded */
  }
});

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

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

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  launchCameraAsync: jest
    .fn()
    .mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///cam.jpg', mimeType: 'image/jpeg', fileSize: 1000 }] }),
  launchImageLibraryAsync: jest
    .fn()
    .mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///lib.jpg', mimeType: 'image/jpeg', fileSize: 1000 }] }),
}));

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn().mockResolvedValue({ uri: 'file:///out.jpg' }),
  SaveFormat: { JPEG: 'jpeg' },
}));

jest.mock('expo-network', () => ({
  __esModule: true,
  useNetworkState: () => ({ isConnected: true, isInternetReachable: true, type: 'WIFI' }),
  getNetworkStateAsync: () =>
    Promise.resolve({ isConnected: true, isInternetReachable: true, type: 'WIFI' }),
  addNetworkStateListener: () => ({ remove: () => undefined }),
  NetworkStateType: { WIFI: 'WIFI', NONE: 'NONE', UNKNOWN: 'UNKNOWN' },
}));

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
