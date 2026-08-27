import { useLocalSearchParams } from 'expo-router';
import { ReviewScreen } from '@/screens/ReviewScreen';
export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ReviewScreen proposalId={id ?? ''} />;
}
