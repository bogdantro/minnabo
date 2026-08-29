import { View } from 'react-native';
import { Tabs, Redirect } from 'expo-router';
import { TabBar, type TabBarProps } from '@/components/TabBar';
import { useSession } from '@/auth/session';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { ENV } from '@/lib/env';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';

export default function TabsLayout() {
  const { status } = useSession();
  const me = useCurrentUser();

  // Mock mode: always "signed in", never gate — see BACKEND.md §0.
  if (!ENV.useMocks) {
    if (status === 'loading') {
      return <View style={{ flex: 1, backgroundColor: tokens.color.bg }} />;
    }
    if (status === 'anon') {
      return <Redirect href="/velkommen" />;
    }
    // Signed in but onboarding not finished yet.
    if (!me.isLoading && me.id && !me.onboardedAt) {
      return <Redirect href="/oppsett" />;
    }
  }

  return (
    <Tabs
      tabBar={(props) => <TabBar {...(props as unknown as TabBarProps)} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: nb.tabs.oppdrag }} />
      <Tabs.Screen name="fellesskap" options={{ title: nb.tabs.fellesskap }} />
      <Tabs.Screen name="innboks" options={{ title: nb.tabs.innboks }} />
    </Tabs>
  );
}
