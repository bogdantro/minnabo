import { useLocalSearchParams } from 'expo-router';
import { AvtaleSammendragScreen } from '@/screens/AvtaleSammendragScreen';
export default function Route() {
  // `svar=ja`: the «Jeg kommer» button on the job-day push (PushBridge)
  const { id, svar, etterkant } = useLocalSearchParams<{ id: string; svar?: string; etterkant?: string }>();
  return <AvtaleSammendragScreen proposalId={id ?? ''} answerYes={svar === 'ja'} afterJob={etterkant === '1'} />;
}
