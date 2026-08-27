import { useLocalSearchParams } from 'expo-router';
import { CompletionScreen } from '@/screens/CompletionScreen';
export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CompletionScreen proposalId={id ?? ''} />;
}
