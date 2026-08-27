import { useLocalSearchParams } from 'expo-router';
import { ProfileScreen } from '@/screens/ProfileScreen';
export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ProfileScreen profileId={id} />;
}
