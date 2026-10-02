import { useLocalSearchParams } from 'expo-router';
import { JobbdagScreen } from '@/screens/JobbdagScreen';

export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <JobbdagScreen proposalId={id ?? ''} />;
}
