import { useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { useConversations } from '@/api/queries';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { safePush } from '@/lib/nav';
import { HomeTopBar } from '@/components/TopBar';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { SearchField } from '@/components/ui/SearchField';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { ScreenState, type ScreenStatus } from '@/components/ui/ScreenState';
import { FilterTabs } from '@/components/FilterTabs';
import { ConversationRow } from '@/components/ConversationRow';

type Filter = 'all' | 'unread';

export function InnboksScreen() {
  const me = useCurrentUser();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const { data, isLoading, isError, refetch } = useConversations(filter === 'unread', query);

  const conversations = data ?? [];

  let status: ScreenStatus = 'ready';
  if (isLoading) status = 'loading';
  else if (isError) status = 'error';
  else if (conversations.length === 0) status = 'empty';

  return (
    <View style={styles.wrap}>
      <HomeTopBar
        avatar={{ uri: me.avatarUrl, initials: me.initials }}
        unreadNotifications
        onProfilePress={() => safePush('/profil')}
        onNotificationsPress={() => safePush('/varsler')}
      />

      <View style={styles.header}>
        <ScreenTitle>{nb.inbox.title}</ScreenTitle>
        <SearchField
          placeholder={nb.inbox.searchPlaceholder}
          value={query}
          onChangeText={setQuery}
        />
        <FilterTabs<Filter>
          options={[
            { value: 'all', label: nb.inbox.filterAll },
            { value: 'unread', label: nb.inbox.filterUnread },
          ]}
          value={filter}
          onChange={setFilter}
        />
        <SectionHeader title={nb.inbox.sectionTitle} />
      </View>

      {status === 'ready' ? (
        <FlatList
          data={conversations}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <ConversationRow
              conversation={item}
              onPress={() => safePush(`/chat/${item.id}`)}
            />
          )}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <ScreenState
          status={status}
          onRetry={() => refetch()}
          emptyText={filter === 'unread' ? nb.inbox.emptyUnread : nb.inbox.empty}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  header: {
    paddingHorizontal: tokens.space.xl,
    gap: tokens.space.md,
    paddingBottom: tokens.space.sm,
  },
  list: {
    paddingHorizontal: tokens.space.xl,
    paddingBottom: tokens.space.xxxl,
    gap: tokens.space.md,
  },
});
