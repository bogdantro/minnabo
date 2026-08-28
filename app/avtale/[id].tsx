import { useLocalSearchParams } from 'expo-router';
import { AvtaleSammendragScreen } from '@/screens/AvtaleSammendragScreen';
export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AvtaleSammendragScreen proposalId={id ?? ''} />;
}
