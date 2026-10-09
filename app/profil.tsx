import { useLocalSearchParams } from 'expo-router';
import { ProfileScreen } from '@/screens/ProfileScreen';

export default function Route() {
  // `?fane=vurderinger` – where the "Ny vurdering" notification points
  const { fane } = useLocalSearchParams<{ fane?: string }>();
  return <ProfileScreen initialTab={fane === 'vurderinger' ? 'rev' : undefined} />;
}
