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
  useToggleReaction,
  useSetPinnedMessage,
} from '@/api/queries';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useConversationChannel, usePresence } from '@/api/realtime';
import { safePush } from '@/lib/nav';
import { toast } from '@/lib/toast';
import { haptics } from '@/lib/haptics';
import { confirm } from '@/lib/confirm';
import { outbox } from '@/lib/outbox';
import { formatDayLabel, isSameDay } from '@/lib/calendar';
import { formatPrice } from '@/domain/price';
import { ChatHeader } from '@/components/ChatHeader';
import { ChatBubble } from '@/components/ChatBubble';
import { ChatComposer } from '@/components/ChatComposer';
import { QuickReplies } from '@/components/QuickReplies';
import { MessageActionsSheet } from '@/components/MessageActionsSheet';
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
  const toggleReaction = useToggleReaction(conversation.id);
  const setPinned = useSetPinnedMessage(conversation.id);
  const [offerOpen, setOfferOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [actionMsg, setActionMsg] = useState<Message | null>(null);

  const list = messages ?? [];
  const pinnedMessage = list.find((m) => m.pinned);

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
          meId={me.id}
          avatarUri={conversation.counterpart.avatarUrl}
          avatarInitials={conversation.counterpart.initials}
          showAvatar={showAvatar}
          onRetry={() => retry(message)}
          onLongPress={
            message.kind === 'TEXT' || message.kind === 'IMAGE'
              ? () => setActionMsg(message)
              : undefined
          }
          onToggleReaction={(emoji) =>
            toggleReaction.mutate({ messageId: message.id, emoji })
          }
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

      {agreement ? (
        <Pressable
          testID="chat-job-facts"
          accessibilityRole="button"
          accessibilityLabel={nb.chat.jobFactsLabel}
          style={styles.jobFacts}
          onPress={() => safePush(`/avtale/${agreement.proposalId}`)}
        >
          {agreement.scheduledText ? (
            <View style={styles.fact}>
              <Icon name="calendar" size={13} color="navyMuted" />
              <AppText variant="meta" weight="bold">
                {agreement.scheduledText}
              </AppText>
            </View>
          ) : null}
          <View style={styles.fact}>
            <Icon name="tag" size={13} color="navyMuted" />
            <AppText variant="meta" weight="bold">
              {formatPrice(agreement.price)}
            </AppText>
          </View>
          <View style={styles.agreedPill}>
            <Icon name="check" size={11} color="white" />
            <AppText variant="meta" weight="bold" color="white">
              {nb.chat.agreed}
            </AppText>
          </View>
        </Pressable>
      ) : null}

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

      {pinnedMessage ? (
        <View style={styles.pinnedBar}>
          <Icon name="bookmark" size={14} color="cyan" />
          <View style={styles.pinnedBody}>
            <AppText variant="meta" weight="bold" color="cyan">
              {nb.chat.pinnedMessage}
            </AppText>
            <AppText variant="meta" color="navy" numberOfLines={1}>
              {pinnedMessage.kind === 'IMAGE' ? '📷 Bilde' : pinnedMessage.text}
            </AppText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={nb.chat.unpinMessage}
            hitSlop={8}
            onPress={() => setPinned.mutate(null)}
          >
            <Icon name="x" size={16} color="navyMuted" />
          </Pressable>
        </View>
      ) : null}

      {!isLoading && !isError ? <QuickReplies onPick={send} /> : null}

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

      <MessageActionsSheet
        message={actionMsg}
        meId={me.id}
        onClose={() => setActionMsg(null)}
        onReact={(messageId, emoji) => toggleReaction.mutate({ messageId, emoji })}
        onTogglePin={(messageId, pinned) => setPinned.mutate(pinned ? messageId : null)}
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
  jobFacts: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: tokens.space.md,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.sm,
    backgroundColor: tokens.color.limeTint,
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.line,
  },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  pinnedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.sm,
    backgroundColor: tokens.color.surface,
    borderTopWidth: 1,
    borderTopColor: tokens.color.line,
  },
  pinnedBody: { flex: 1, gap: 1 },
  agreedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginLeft: 'auto',
    backgroundColor: tokens.color.shieldGreen,
    borderRadius: tokens.radius.pill,
    paddingHorizontal: tokens.space.sm,
    paddingVertical: 2,
  },
  offerWrap: { marginVertical: tokens.space.sm },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    marginVertical: tokens.space.md,
  },
  dayLine: { flex: 1, height: 1, backgroundColor: tokens.color.line },
});
