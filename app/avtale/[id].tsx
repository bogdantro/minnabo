import { useLocalSearchParams } from 'expo-router';
import { AvtaleSammendragScreen } from '@/screens/AvtaleSammendragScreen';
export default function Route() {
  // `svar=ja`: the «Jeg kommer» button on the job-day push (PushBridge)
  const { id, svar } = useLocalSearchParams<{ id: string; svar?: string }>();
  return <AvtaleSammendragScreen proposalId={id ?? ''} answerYes={svar === 'ja'} />;
}
