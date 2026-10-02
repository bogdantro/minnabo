import { useLocalSearchParams } from 'expo-router';
import { SeeAllScreen } from '@/screens/SeeAllScreen';

export default function Route() {
  const { category } = useLocalSearchParams<{ category?: string }>();
  return <SeeAllScreen initialCategory={category} />;
}
