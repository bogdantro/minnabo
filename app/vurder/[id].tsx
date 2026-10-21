import { Redirect, useLocalSearchParams } from 'expo-router';
import { ReviewScreen } from '@/screens/ReviewScreen';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export default function Route() {
  // `stjerner` – set when the person tapped a star button on the review reminder
  const { id, stjerner } = useLocalSearchParams<{ id: string; stjerner?: string }>();
  // youth accounts receive reviews but don't give them (rule 5, enforced in 0038)
  if (useCurrentUser().isYouth) return <Redirect href="/ung" />;
  return <ReviewScreen proposalId={id ?? ''} initialRating={Number(stjerner) || 0} />;
}
