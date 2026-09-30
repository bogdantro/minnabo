import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Mulish_400Regular,
  Mulish_500Medium,
  Mulish_700Bold,
  Mulish_800ExtraBold,
} from '@expo-google-fonts/mulish';
import {
  BricolageGrotesque_500Medium,
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque';
import {
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
  Figtree_800ExtraBold,
} from '@expo-google-fonts/figtree';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { tokens } from '@/theme';
import { InboxRealtime } from '@/api/realtime';
import { OfflineBanner } from '@/components/OfflineBanner';
import { SafeTripBanner } from '@/components/SafeTripBanner';
import { ToastHost } from '@/components/ToastHost';
import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { OfflineOutbox } from '@/lib/outbox';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

// Web only: strip the browser focus ring / outline from inputs and buttons
// so the web preview matches the native look.
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent =
    '*{outline:none!important;-webkit-tap-highlight-color:transparent}' +
    'input,textarea,select,button,[role="button"],[contenteditable]{outline:none!important}';
  document.head.appendChild(style);
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 0,
      staleTime: 30_000,
      gcTime: 1000 * 60 * 60 * 24, // keep for a day so the app opens with cached data
      networkMode: 'offlineFirst',
    },
  },
});

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'minnabo.queryCache.v3',
});

// Bump when the cached shape changes; drops any older persisted cache on start.
const CACHE_BUSTER = '3';
const CACHE_MAX_AGE = 1000 * 60 * 60 * 12; // 12h

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Mulish_400Regular,
    Mulish_500Medium,
    Mulish_700Bold,
    Mulish_800ExtraBold,
    // Redesign fonts (see theme.fonts in src/theme/theme.ts).
    BricolageGrotesque_500Medium,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
    Figtree_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: tokens.color.bg }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{ persister, buster: CACHE_BUSTER, maxAge: CACHE_MAX_AGE }}
        >
          <BottomSheetModalProvider>
            <AppErrorBoundary>
              <StatusBar style="dark" />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: tokens.color.bg },
                }}
              />
              <InboxRealtime />
              <OfflineOutbox />
              <OfflineBanner />
              <SafeTripBanner />
              <ToastHost />
            </AppErrorBoundary>
          </BottomSheetModalProvider>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
