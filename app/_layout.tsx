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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { tokens } from '@/theme';
import { savedStore } from '@/data/savedStore';
import { savedSearchStore } from '@/data/savedSearchStore';
import { OfflineBanner } from '@/components/OfflineBanner';

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
  defaultOptions: { queries: { retry: 0, staleTime: 30_000 } },
});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Mulish_400Regular,
    Mulish_500Medium,
    Mulish_700Bold,
    Mulish_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontsLoaded]);

  useEffect(() => {
    void savedStore.hydrate();
    void savedSearchStore.hydrate();
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: tokens.color.bg }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: tokens.color.bg },
            }}
          />
          <OfflineBanner />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
