import { useLocalSearchParams } from 'expo-router';
import { ReviewScreen } from '@/screens/ReviewScreen';

export default function Route() {
  // `stjerner` – set when the person tapped a star button on the review reminder
  const { id, stjerner } = useLocalSearchParams<{ id: string; stjerner?: string }>();
  return <ReviewScreen proposalId={id ?? ''} initialRating={Number(stjerner) || 0} />;
}
