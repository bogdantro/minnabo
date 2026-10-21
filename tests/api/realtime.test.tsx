import { renderHook } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useConversationChannel } from '@/api/realtime';
import { supabase } from '@/lib/supabase';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  // gcTime: Infinity – the default 5-minute clean-up timers kept the Jest worker alive
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } })}>{children}</QueryClientProvider>
);

test('useConversationChannel subscribes to the conversation', async () => {
  const channel = supabase.channel('conv:c-emma') as unknown as { subscribe: jest.Mock };
  (supabase.channel as jest.Mock).mockClear();
  await renderHook(() => useConversationChannel('c-emma'), { wrapper });
  expect(supabase.channel).toHaveBeenCalledWith('conv:c-emma');
  expect(channel.subscribe).toHaveBeenCalled();
});

test('useConversationChannel does nothing without a conversation id', async () => {
  (supabase.channel as jest.Mock).mockClear();
  await renderHook(() => useConversationChannel(''), { wrapper });
  expect(supabase.channel).not.toHaveBeenCalled();
});
