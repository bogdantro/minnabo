import { useLocalSearchParams } from 'expo-router';
import { SammenlignTilbudScreen } from '@/screens/SammenlignTilbudScreen';
export default function Route() {
  const { listingId } = useLocalSearchParams<{ listingId: string }>();
  return <SammenlignTilbudScreen listingId={listingId ?? ''} />;
}
