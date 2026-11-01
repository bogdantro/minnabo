import { useLocalSearchParams } from 'expo-router';
import { TilbudDetaljScreen } from '@/screens/TilbudDetaljScreen';
export default function Route() {
  // `svar=ja`: «Ja, jeg kan i dag» on the «Oppdraget er ledig igjen» push (PushBridge)
  const { id, svar } = useLocalSearchParams<{ id: string; svar?: string }>();
  return <TilbudDetaljScreen proposalId={id ?? ''} answerYes={svar === 'ja'} />;
}
