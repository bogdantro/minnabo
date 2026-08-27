import { useLocalSearchParams } from 'expo-router';
import { PublishedScreen } from '@/screens/LeggUt/PublishedScreen';

export default function Route() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <PublishedScreen listingId={typeof id === 'string' ? id : undefined} />;
}
