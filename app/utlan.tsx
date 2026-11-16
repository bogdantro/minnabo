import { useLocalSearchParams } from 'expo-router';
import { LendScreen } from '@/screens/LendScreen';

/** Utlån (0101). `profil` = one person's things; `fane=foresporsler` opens the requests (from a push), `fane=mine` my own things. */
export default function Route() {
  const { profil, fane } = useLocalSearchParams<{ profil?: string; fane?: string }>();
  return <LendScreen ownerId={typeof profil === 'string' && profil ? profil : undefined} startTab={fane === 'foresporsler' ? 'asks' : fane === 'mine' ? 'mine' : undefined} />;
}
