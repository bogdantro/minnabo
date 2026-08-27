import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { tokens } from '@/theme';
import { useConversation } from '@/api/queries';
import { ScreenState, type ScreenStatus } from '@/components/ui/ScreenState';
import { ChatScreen } from '@/screens/ChatScreen';

export default function ChatRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: conversation, isLoading, isError, refetch } = useConversation(id ?? '');

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/innboks'));

  if (conversation) {
    return <ChatScreen conversation={conversation} onBack={goBack} />;
  }

  let status: ScreenStatus = 'loading';
  if (isError) status = 'error';
  else if (!isLoading) status = 'empty';

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
      <ScreenState status={status} onRetry={() => refetch()} emptyText="Fant ikke samtalen." />
    </View>
  );
}
