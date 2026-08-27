import { useLocalSearchParams } from 'expo-router';
import { SafetyScreen } from '@/screens/SafetyScreen';

export default function Route() {
  const { profil } = useLocalSearchParams<{ profil?: string }>();
  return <SafetyScreen targetProfileId={typeof profil === 'string' ? profil : undefined} />;
}
