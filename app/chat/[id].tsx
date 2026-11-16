import { useLocalSearchParams, useRouter } from 'expo-router';
import { useConversation } from '@/api/queries';
import { FallbackScreen } from '@/components/FallbackScreen';
import type { ScreenStatus } from '@/components/ui/ScreenState';
import { ChatScreen } from '@/screens/ChatScreen';

export default function ChatRoute() {
  // `melding`: open at one message (a hit from Innboks search, 0109)
  const { id, melding } = useLocalSearchParams<{ id: string; melding?: string }>();
  const router = useRouter();
  const { data: conversation, isLoading, isError, refetch } = useConversation(id ?? '');

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/innboks'));

  if (conversation) {
    return <ChatScreen conversation={conversation} onBack={goBack} jumpTo={typeof melding === 'string' ? melding : undefined} />;
  }

  let status: ScreenStatus = 'loading';
  if (isError) status = 'error';
  else if (!isLoading) status = 'empty';

  return (
    <FallbackScreen
      status={status}
      onRetry={() => refetch()}
      emptyText="Fant ikke samtalen."
      title="Melding"
    />
  );
}
