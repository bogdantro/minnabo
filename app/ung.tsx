import { View } from 'react-native';
import { Redirect } from 'expo-router';
import { YouthAppScreen } from '@/screens/youth/YouthAppScreen';
import { useSession } from '@/auth/session';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useConsentRecords } from '@/api/queries';
import { tokens } from '@/theme';

/**
 * The youth app. Only for youth accounts, and only after the Ungdomskonto
 * consents are stored (the same rule as Samtykke for adults).
 */
export default function UngRoute() {
  const { status } = useSession();
  const me = useCurrentUser();
  const consents = useConsentRecords(status === 'authed' && me.accountReady && me.isYouth);
  const blank = <View style={{ flex: 1, backgroundColor: tokens.color.bg }} />;

  if (status === 'loading') return blank;
  if (status === 'anon') return <Redirect href="/velkommen" />;
  if (!me.accountReady) return blank;
  if (!me.isYouth) return <Redirect href="/" />;
  if (consents.isLoading) return blank;
  const consented = (consents.data ?? []).some((c) => c.terms && c.privacy && c.age);
  // a failed lookup must not lock the person out – the consent screen is only skipped on error
  if (!consented && !consents.isError) return <Redirect href="/ungdomskonto" />;
  return <YouthAppScreen />;
}
