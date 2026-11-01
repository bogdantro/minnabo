import { useLocalSearchParams } from 'expo-router';
import { SeeAllScreen } from '@/screens/SeeAllScreen';

export default function Route() {
  // `type=tilbud`: naboer who offer help (0076)
  const { category, type } = useLocalSearchParams<{ category?: string; type?: string }>();
  return <SeeAllScreen initialCategory={category} kind={type === 'tilbud' ? 'offer' : 'need'} />;
}
