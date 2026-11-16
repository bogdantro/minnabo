import { useLocalSearchParams } from 'expo-router';
import { EventChatScreen } from '@/screens/EventChatScreen';

/** Gruppechat for an arrangement on Oppslagstavla (0101). */
export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EventChatScreen noticeId={id ?? ''} />;
}
