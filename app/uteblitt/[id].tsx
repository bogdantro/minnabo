import { useLocalSearchParams } from 'expo-router';
import { UteblittScreen } from '@/screens/UteblittScreen';
export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <UteblittScreen reportId={id ?? ''} />;
}
