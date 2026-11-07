import { Redirect } from 'expo-router';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { FellesskapScreen } from '@/screens/FellesskapScreen';

/** The tabs send a youth account to /ung, so Fellesskap has its own way in from there. */
export default function Route() {
  const me = useCurrentUser();
  if (me.accountReady && !me.isYouth) return <Redirect href="/fellesskap" />;
  return <FellesskapScreen />;
}
