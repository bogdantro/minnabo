import { useLocalSearchParams } from 'expo-router';
import { SearchScreen } from '@/screens/SearchScreen';

export default function SearchRoute() {
  const { q, category } = useLocalSearchParams<{ q?: string; category?: string }>();
  return (
    <SearchScreen
      initialQuery={typeof q === 'string' ? q : ''}
      initialCategory={typeof category === 'string' ? category : undefined}
    />
  );
}
