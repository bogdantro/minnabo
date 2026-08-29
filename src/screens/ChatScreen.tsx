import { useRef, useState } from 'react';
import {
  View,
  ScrollView,
  Image,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import type { Conversation, Message } from '@/domain/types';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import {
  useMessages,
  useProposal,
  useSendMessage,
  useSendProposal,
  useSendAttachment,
  useRespondToProposal,
  useAgreement,
} from '@/api/queries';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useConversationChannel } from '@/api/realtime';
import { usePresence } from '@/api/realtime';
import { safePush } from '@/lib/nav';
import { formatDayLabel, isSameDay } from '@/lib/calendar';
import { ChatHeader } from '@/components/ChatHeader';
import { ChatBubble } from '@/components/ChatBubble';
import { ChatComposer } from '@/components/ChatComposer';
import { OfferCard } from '@/components/OfferCard';
import { SendOfferSheet } from '@/components/SendOfferSheet';
import { AttachSheet } from '@/components/AttachSheet';
import { AppText } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { ScreenState } from '@/components/ui/ScreenState';

function ProposalMessage({
  proposalId,
  conversationId,
  listingTitle,
  listingImageUrl,
}: {
  proposalId: string;
  conversationId: string;
  listingTitle: string;
  listingImageUrl?: string;
}) {
  const me = useCurrentUser();
  const { data: proposal } = useProposal(proposalId);
  const respond = useRespondToProposal(conversationId);

  if (!proposal) return null;

  const canRespond = proposal.toProfileId === me.id;

  return (
    <View style={styles.offerWrap}>
      <OfferCard
        proposal={proposal}
        listingTitle={listingTitle}
        listingImageUrl={listingImageUrl}
        canRespond={canRespond}
        pending={respond.isPending}
        onAccept={() =>
          respond.mutate({ proposalId, event: 'ACCEPT', actor: 'RECIPIENT' })
        }
        onDecline={() =>
          respond.mutate({ proposalId, event: 'DECLINE', actor: 'RECIPIENT' })
        }
      />
    </View>
  );
}

export function ChatScreen({
  conversation,
  onBack,
}: {
  conversation: Conversation;
  onBack: () => void;
}) {
  const me = useCurrentUser();
  const scrollRef = useRef<ScrollView>(null);
  useConversationChannel(conversation.id);
  const online = usePresence();
  const { data: messages, isLoading, isError, refetch } = useMessages(conversation.id);
  const { data: agreement } = useAgreement(conversation.id);
  const sendMessage = useSendMessage(conversation.id);
  const sendProposal = useSendProposal(conversation.id);
  const sendAttachment = useSendAttachment(conversation.id);
  const [offerOpen, setOfferOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);

  const list = messages ?? [];

  const renderMessage = (message: Message, index: number) => {
    const prev = list[index - 1];
    const newDay =
      !prev || !isSameDay(new Date(prev.createdAt), new Date(message.createdAt));
    const divider = newDay ? (
      <View key={`day-${message.id}`} style={styles.dayRow}>
        <View style={styles.dayLine} />
        <AppText variant="meta" weight="bold" color="navyMuted">
          {formatDayLabel(new Date(message.createdAt))}
        </AppText>
        <View style={styles.dayLine} />
      </View>
    ) : null;

    if (message.kind === 'PROPOSAL' && message.proposalId) {
      return (
        <View key={message.id}>
          {divider}
          <ProposalMessage
            proposalId={message.proposalId}
            conversationId={conversation.id}
            listingTitle={conversation.listing.title}
            listingImageUrl={conversation.listing.imageUrl}
          />
        </View>
      );
    }
    const mine = message.authorProfileId === me.id;
    const showAvatar =
      newDay || !prev || prev.authorProfileId !== message.authorProfileId;
    return (
      <View key={message.id}>
        {divider}
        <ChatBubble
          message={message}
          mine={mine}
          avatarUri={conversation.counterpart.avatarUrl}
          avatarInitials={conversation.counterpart.initials}
          showAvatar={showAvatar}
        />
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.wrap}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ChatHeader
        name={conversation.counterpart.displayName}
        avatarUri={conversation.counterpart.avatarUrl}
        initials={conversation.counterpart.initials}
        online={online.has(conversation.counterpart.id)}
        onBack={onBack}
        onMenu={() => safePush(`/rapporter?profil=${conversation.counterpart.id}`)}
      />

      <Pressable
        style={styles.listingCard}
        accessibilityRole="button"
        onPress={() => safePush(`/oppdrag/${conversation.listing.id}`)}
      >
        {conversation.listing.imageUrl ? (
          <Image source={{ uri: conversation.listing.imageUrl }} style={styles.listingThumb} />
        ) : (
          <View style={[styles.listingThumb, styles.listingThumbFallback]}>
            <Icon name="clipboard" size={18} color="navyMuted" />
          </View>
        )}
        <View style={styles.listingBody}>
          <AppText variant="cardTitle" weight="bold" numberOfLines={1}>
            {conversation.listing.title}
          </AppText>
          <AppText variant="meta" color="navyMuted">
            {conversation.listing.place}
          </AppText>
        </View>
        <Icon name="chevron-right" size={20} color="navyMuted" />
      </Pressable>

      {isLoading || isError ? (
        <ScreenState status={isError ? 'error' : 'loading'} onRetry={() => refetch()} />
      ) : (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.messages}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {list.map(renderMessage)}
        </ScrollView>
      )}

      {agreement ? (
        <Pressable
          accessibilityRole="button"
          style={styles.agreementBar}
          onPress={() => safePush(`/avtale/${agreement.proposalId}`)}
        >
          <Icon name="file-text" size={16} color="lime" />
          <AppText variant="meta" weight="bold" style={styles.agreementText}>
            {nb.chat.offerAccepted} · {nb.avtale.title}
          </AppText>
          <Icon name="chevron-right" size={16} color="navyMuted" />
        </Pressable>
      ) : null}

      <ChatComposer
        canSendOffer
        sending={sendMessage.isPending}
        onSend={(text) => sendMessage.mutate(text)}
        onAttach={() => setAttachOpen(true)}
        onSendOffer={() => setOfferOpen(true)}
      />

      <SendOfferSheet
        visible={offerOpen}
        onClose={() => setOfferOpen(false)}
        listingTitle={conversation.listing.title}
        listingImageUrl={conversation.listing.imageUrl}
        pending={sendProposal.isPending}
        onSubmit={(draft) => {
          sendProposal.mutate(
            {
              conversationId: conversation.id,
              listingId: conversation.listing.id,
              ...draft,
            },
            { onSuccess: () => setOfferOpen(false) },
          );
        }}
      />

      <AttachSheet
        visible={attachOpen}
        onClose={() => setAttachOpen(false)}
        folder={me.id}
        onPick={(url) => sendAttachment.mutate(url)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  listingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.md,
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.line,
    backgroundColor: tokens.color.surface,
  },
  listingThumb: { width: 44, height: 44, borderRadius: tokens.radius.sm, backgroundColor: tokens.color.line },
  listingThumbFallback: { alignItems: 'center', justifyContent: 'center' },
  listingBody: { flex: 1, gap: 2 },
  messages: {
    padding: tokens.space.lg,
    gap: 2,
  },
  offerWrap: { marginVertical: tokens.space.sm },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    marginVertical: tokens.space.md,
  },
  dayLine: { flex: 1, height: 1, backgroundColor: tokens.color.line },
  agreementBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
    backgroundColor: tokens.color.limeTint,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.sm,
  },
  agreementText: { flex: 1 },
});

