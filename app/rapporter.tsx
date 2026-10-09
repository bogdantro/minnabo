import { useLocalSearchParams } from 'expo-router';
import { RapporterScreen } from '@/screens/RapporterScreen';

export default function Route() {
  const { profil, listing, melding, kommentar } = useLocalSearchParams<{ profil?: string; listing?: string; melding?: string; kommentar?: string }>();
  return (
    <RapporterScreen
      profileId={typeof profil === 'string' ? profil : undefined}
      listingId={typeof listing === 'string' ? listing : undefined}
      messageId={typeof melding === 'string' ? melding : undefined}
      commentId={typeof kommentar === 'string' ? kommentar : undefined}
    />
  );
}
