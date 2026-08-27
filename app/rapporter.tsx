import { useLocalSearchParams } from 'expo-router';
import { SafetyScreen } from '@/screens/SafetyScreen';

export default function Route() {
  const { profil, listing, melding } = useLocalSearchParams<{
    profil?: string;
    listing?: string;
    melding?: string;
  }>();
  const targetType = listing ? 'LISTING' : melding ? 'MESSAGE' : 'USER';
  return (
    <SafetyScreen
      targetType={targetType}
      targetProfileId={typeof profil === 'string' ? profil : undefined}
      targetId={typeof listing === 'string' ? listing : typeof melding === 'string' ? melding : undefined}
    />
  );
}
