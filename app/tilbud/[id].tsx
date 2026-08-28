import { useLocalSearchParams } from 'expo-router';
import { TilbudDetaljScreen } from '@/screens/TilbudDetaljScreen';
export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TilbudDetaljScreen proposalId={id ?? ''} />;
}
