import { Tabs, Redirect } from 'expo-router';
import { TabBar, type TabBarProps } from '@/components/TabBar';
import { useAuth } from '@/data/authStore';
import nb from '@/i18n/nb';

export default function TabsLayout() {
  const { isOnboarded } = useAuth();

  if (!isOnboarded) {
    return <Redirect href="/velkommen" />;
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
