import { View } from 'react-native';
import { Tabs, Redirect } from 'expo-router';
import { TabBar, type TabBarProps } from '@/components/TabBar';
import { useSession } from '@/auth/session';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useMyAccount } from '@/auth/identity';
import { useConsentRecords } from '@/api/queries';
import { ErrorState } from '@/components/ui';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';

export default function TabsLayout() {
  const { status } = useSession();
  const me = useCurrentUser();
  const account = useMyAccount();
  const consents = useConsentRecords(status === 'authed' && !!me.id && !me.onboardedAt);

  if (status === 'loading') {
    return <View style={{ flex: 1, backgroundColor: tokens.color.bg }} />;
  }
  if (status === 'anon') {
    return <Redirect href="/velkommen" />;
  }
  // Wait until we know whether this is a youth account, so a youth never sees the adult tabs.
  if (!me.accountReady) {
    return <View style={{ flex: 1, backgroundColor: tokens.color.bg }} />;
  }
  // Youth accounts (under 18) only get the youth app – never the adult tabs.
  if (me.isYouth) {
    return <Redirect href="/ung" />;
  }
  // We could not find out whether this is a youth account: don't guess, let the person retry.
  if (account.isError && !account.data) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        <ErrorState onRetry={() => void account.refetch()} retrying={account.isFetching} />
      </View>
    );
  }
  // Signed in but onboarding not finished yet: Samtykke first (it can't be skipped by
  // closing the app there), then Oppsett.
  if (!me.isLoading && me.id && !me.onboardedAt) {
    if (consents.isLoading) return <View style={{ flex: 1, backgroundColor: tokens.color.bg }} />;
    const consented = (consents.data ?? []).some((c) => c.terms && c.privacy && c.age);
    return <Redirect href={consented || consents.isError ? '/oppsett' : '/samtykker'} />;
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
