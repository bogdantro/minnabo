import { useCallback, useRef, useState } from 'react';
import {
  View,
  ScrollView,
  Image,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { useNetworkState } from 'expo-network';
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
import { useConversationChannel, usePresence } from '@/api/realtime';
import { safePush } from '@/lib/nav';
import { toast } from '@/lib/toast';
import { haptics } from '@/lib/haptics';
import { confirm } from '@/lib/confirm';
import { outbox } from '@/lib/outbox';
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

  const canRespond = proposal.toProfileId === me.id && proposal.status === 'SENT';

  const accept = () => {
    haptics.success();
    respond.mutate({ proposalId, event: 'ACCEPT', actor: 'RECIPIENT' });
  };
  const decline = async () => {
    const ok = await confirm({
      title: nb.chat.declineConfirmTitle,
      message: nb.chat.declineConfirmBody,
      confirmLabel: nb.chat.declineOffer,
      destructive: true,
    });
    if (ok) respond.mutate({ proposalId, event: 'DECLINE', actor: 'RECIPIENT' });
  };

  return (
    <View style={styles.offerWrap}>
      <OfferCard
        proposal={proposal}
        listingTitle={listingTitle}
        listingImageUrl={listingImageUrl}
        canRespond={canRespond}
        pending={respond.isPending}
        onAccept={accept}
        onDecline={decline}
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
  const atBottom = useRef(true);
  const [showJump, setShowJump] = useState(false);

  const net = useNetworkState();
  const online = net.isConnected !== false && net.isInternetReachable !== false;

  useConversationChannel(conversation.id);
  const presence = usePresence();
  const { data: messages, isLoading, isError, refetch } = useMessages(conversation.id);
  const { data: agreement } = useAgreement(conversation.id);
  const sendMessage = useSendMessage(conversation.id, me.id);
  const sendProposal = useSendProposal(conversation.id);
  const sendAttachment = useSendAttachment(conversation.id, me.id);
  const [offerOpen, setOfferOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);

  const list = messages ?? [];

  const scrollToEnd = useCallback((animated = true) => {
    scrollRef.current?.scrollToEnd({ animated });
    setShowJump(false);
  }, []);

  const onContentSizeChange = () => {
    // Only follow new content if the user is already reading the latest.
    if (atBottom.current) scrollToEnd(false);
    else setShowJump(true);
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const distanceFromBottom =
      contentSize.height - (contentOffset.y + layoutMeasurement.height);
    atBottom.current = distanceFromBottom < 80;
    if (atBottom.current && showJump) setShowJump(false);
  };

  const send = (text: string) => {
    atBottom.current = true;
    if (!online) {
      outbox.enqueue({ kind: 'message', conversationId: conversation.id, text });
      return;
    }
    sendMessage.mutate(text, { onError: () => toast.error(nb.toast.genericError) });
  };

  const attach = (url: string) => {
    atBottom.current = true;
    if (!online) {
      outbox.enqueue({ kind: 'attachment', conversationId: conversation.id, url });
      return;
    }
    sendAttachment.mutate(url, { onError: () => toast.error(nb.toast.genericError) });
  };

  const retry = (m: Message) => {
    if (m.kind === 'IMAGE' && m.attachmentUrl) sendAttachment.mutate(m.attachmentUrl);
    else sendMessage.mutate(m.text);
  };

  const renderMessage = (message: Message, index: number) => {
    const prev = list[index - 1];
    const newDay =
      !prev || !isSameDay(new Date(prev.createdAt), new Date(message.createdAt));
    const divider = newDay ? (
      <View style={styles.dayRow}>
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
          onRetry={() => retry(message)}
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
        online={presence.has(conversation.counterpart.id)}
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
        <View style={styles.messagesWrap}>
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.messages}
            onContentSizeChange={onContentSizeChange}
            onScroll={onScroll}
            scrollEventThrottle={80}
            keyboardDismissMode="interactive"
          >
            {list.map(renderMessage)}
          </ScrollView>

          {showJump ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={nb.chat.newMessages}
              onPress={() => scrollToEnd(true)}
              style={styles.jump}
            >
              <Icon name="arrow-down" size={16} color="white" />
              <AppText variant="meta" weight="bold" color="white">
                {nb.chat.newMessages}
              </AppText>
            </Pressable>
          ) : null}
        </View>
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
        onSend={send}
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
            {
              onSuccess: () => {
                setOfferOpen(false);
                haptics.success();
                toast.success(nb.toast.offerSent);
              },
              onError: () => toast.error(nb.toast.genericError),
            },
          );
        }}
      />

      <AttachSheet
        visible={attachOpen}
        onClose={() => setAttachOpen(false)}
        folder={me.id}
        onPick={attach}
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
  messagesWrap: { flex: 1 },
  messages: { padding: tokens.space.lg, gap: 2 },
  jump: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: tokens.space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: tokens.color.navy,
    borderRadius: tokens.radius.pill,
    paddingVertical: tokens.space.sm,
    paddingHorizontal: tokens.space.lg,
    ...tokens.shadow.fab,
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
