import { useLocalSearchParams } from 'expo-router';
import { StartChatScreen } from '@/screens/StartChatScreen';

export default function StartChatRoute() {
  const { listing } = useLocalSearchParams<{ listing?: string }>();
  return <StartChatScreen listingId={typeof listing === 'string' ? listing : ''} />;
}
