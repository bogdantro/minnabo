import { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useNetworkState } from 'expo-network';
import type { Conversation, Message, Proposal } from '@/domain/types';
import { formatPrice } from '@/domain/price';
import nb from '@/i18n/nb';
import {
  useAgreement,
  useBlockedProfileIds,
  useListing,
  useMessages,
  useProfile,
  useProposal,
  useProposalsForListing,
  useRespondToProposal,
  useSendAttachment,
  useSendMessage,
  useSetPinnedMessage,
  useToggleBlock,
  useToggleReaction,
} from '@/api/queries';
import { useConversationChannel, usePresence, useTypingChannel } from '@/api/realtime';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { formatDayLabel, isSameDay } from '@/lib/calendar';
import { formatTime, shortDate } from '@/lib/datetime';
import { haptics } from '@/lib/haptics';
import { useMutedConversation } from '@/lib/mutedConversations';
import { safePush } from '@/lib/nav';
import { outbox } from '@/lib/outbox';
import { toast } from '@/lib/toast';
import { pickAndUpload } from '@/lib/uploads';
import { colors, motion, radius, shadow, text } from '@/theme/theme';
import { GiTilbudSheet } from '@/components/GiTilbudSheet';
import { AgreementBanner, BlockedBar, ChatTopBar, Composer, ListingStrip, PinBar } from '@/components/chat/ChatTop';
import { DateChip, MessageRow, parseTimeProposal, SysPill, TimeCard, timeAnswer } from '@/components/chat/ChatThread';
import { ChatMenuSheet, PinSheet, PlaceSheet, ShareSheet, TimeSheet, openMapLink } from '@/components/chat/ChatSheets';
import { Button, Dialog, ErrorState, Icon, KeyValueRow, OfferCard, RowSkeleton, TypingIndicator, Avatar } from '@/components/ui';

const STATUS = nb.chat.status;

/** Chat (design/screens/Chat.dc.html). */
export function ChatScreen({ conversation: c, onBack }: { conversation: Conversation; onBack: () => void }) {
  const me = useCurrentUser();
  const net = useNetworkState();
  const online = net.isConnected !== false && net.isInternetReachable !== false;

  useConversationChannel(c.id);
  const presence = usePresence();
  const { counterpartTyping, notifyTyping } = useTypingChannel(c.id);
  const { data: messages, isLoading, isError, refetch } = useMessages(c.id);
  const { data: agreement } = useAgreement(c.id);
  const { data: listing } = useListing(c.listing.id);
  const { data: counterpart } = useProfile(c.counterpart.id);
  const isOwner = !!listing && listing.owner.id === me.id;
  const proposals = useProposalsForListing(isOwner ? c.listing.id : '');
  const blockedIds = useBlockedProfileIds();
  const toggleBlock = useToggleBlock();
  const [muted, toggleMute] = useMutedConversation(c.id);
  const sendMessage = useSendMessage(c.id, me.id);
  const sendAttachment = useSendAttachment(c.id, me.id);
  const toggleReaction = useToggleReaction(c.id);
  const setPinned = useSetPinnedMessage(c.id);
  const respond = useRespondToProposal(c.id);

  const [selected, setSelected] = useState<string | null>(null);
  const [pinFor, setPinFor] = useState<Message | null>(null);
  const [sheet, setSheet] = useState<'share' | 'time' | 'place' | 'menu' | 'offer' | null>(null);
  const [acceptFor, setAcceptFor] = useState<Proposal | null>(null);
  // A sheet's close callback can fire after another sheet has taken over – only clear our own.
  const closeSheet = (kind: typeof sheet) => () => setSheet((s) => (s === kind ? null : s));
  const [blockDlg, setBlockDlg] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [declining, setDeclining] = useState<Set<string>>(() => new Set());
  const declineTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const scrollRef = useRef<ScrollView>(null);
  const atBottom = useRef(true);
  const [showJump, setShowJump] = useState(false);

  const list = messages ?? [];
  const pinnedMessage = list.find((m) => m.pinned);
  const blocked = (blockedIds.data ?? []).includes(c.counterpart.id);
  const activeAgreement = agreement && !agreement.cancelledAt ? agreement : null;
  const first = c.counterpart.displayName.split(' ')[0];
  const verified = !!counterpart?.verifications.some((v) => v.verified);
  const canOffer = !!listing && !isOwner && !activeAgreement;
  const offerCount = isOwner ? (proposals.data ?? []).filter((p) => p.status !== 'DRAFT').length : undefined;

  // Send pending declines when leaving the screen.
  useEffect(() => {
    const timers = declineTimers.current;
    return () => {
      timers.forEach((t, id) => {
        clearTimeout(t);
        respond.mutate({ proposalId: id, event: 'DECLINE', actor: 'RECIPIENT' });
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- flush once on unmount
  }, []);

  const scrollToEnd = useCallback((animated = true) => {
    scrollRef.current?.scrollToEnd({ animated });
    setShowJump(false);
  }, []);
  const onContentSizeChange = () => {
    if (atBottom.current) scrollToEnd(false);
    else setShowJump(true);
  };
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    atBottom.current = contentSize.height - (contentOffset.y + layoutMeasurement.height) < 80;
    if (atBottom.current && showJump) setShowJump(false);
  };

  const send = (t: string) => {
    atBottom.current = true;
    setSelected(null);
    if (!online) {
      outbox.enqueue({ kind: 'message', conversationId: c.id, text: t });
      return;
    }
    sendMessage.mutate(t, { onError: () => toast.error(nb.toast.genericError) });
  };
  const attach = (url: string) => {
    atBottom.current = true;
    if (!online) {
      outbox.enqueue({ kind: 'attachment', conversationId: c.id, url });
      return;
    }
    sendAttachment.mutate(url, { onError: () => toast.error(nb.toast.genericError) });
  };
  const pickImage = async (source: 'camera' | 'library') => {
    setUploading(true);
    try {
      const res = await pickAndUpload({ bucket: 'chat-attachments', folder: me.id, source });
      if (res) {
        setSheet(null);
        attach(res.publicUrl);
      }
    } catch (e) {
      toast.error((e as Error).message || nb.chat.uploadFailed);
    } finally {
      setUploading(false);
    }
  };
  const retry = (m: Message) => {
    if (m.kind === 'IMAGE' && m.attachmentUrl) sendAttachment.mutate(m.attachmentUrl);
    else sendMessage.mutate(m.text);
  };

  const confirmAccept = () => {
    if (!acceptFor) return;
    respond.mutate(
      { proposalId: acceptFor.id, event: 'ACCEPT', actor: 'RECIPIENT' },
      {
        onSuccess: () => {
          haptics.success();
          setAcceptFor(null);
        },
        onError: () => toast.error(nb.toast.genericError),
      },
    );
  };
  const decline = (p: Proposal) => {
    setDeclining((s) => new Set(s).add(p.id));
    const t = setTimeout(() => {
      declineTimers.current.delete(p.id);
      respond.mutate(
        { proposalId: p.id, event: 'DECLINE', actor: 'RECIPIENT' },
        { onSettled: () => setDeclining((s) => { const n = new Set(s); n.delete(p.id); return n; }) },
      );
    }, motion.durations.toastVisible + 400);
    declineTimers.current.set(p.id, t);
    toast.info(nb.chat.declinedToast, { icon: 'x', bottom: 150, action: { label: nb.chat.undo, onPress: () => undoDecline(p.id) } });
  };
  const undoDecline = (id: string) => {
    clearTimeout(declineTimers.current.get(id));
    declineTimers.current.delete(id);
    setDeclining((s) => {
      const n = new Set(s);
      n.delete(id);
      return n;
    });
  };

  const unpin = () => {
    const prev = pinnedMessage?.id ?? null;
    setPinned.mutate(null);
    toast.info(nb.chat.unpinnedToast, { icon: 'pinned', bottom: 150, action: prev ? { label: nb.chat.undo, onPress: () => setPinned.mutate(prev) } : undefined });
  };
  const doBlock = () => {
    toggleBlock.mutate(c.counterpart.id, {
      onSuccess: () => {
        setBlockDlg(false);
        toast.info(blocked ? nb.chat.unblockedToast : nb.chat.blockedToast(c.counterpart.displayName), { icon: blocked ? 'check' : 'ban', bottom: 150 });
      },
      onError: () => toast.error(nb.toast.genericError),
    });
  };

  // Last own message gets the Sendt / Levert / Lest line.
  let lastMine = -1;
  list.forEach((m, i) => {
    if (m.authorProfileId === me.id && (m.kind === 'TEXT' || m.kind === 'IMAGE')) lastMine = i;
  });

  const renderMessage = (m: Message, i: number) => {
    const prev = list[i - 1];
    const next = list[i + 1];
    const newDay = !prev || !isSameDay(new Date(prev.createdAt), new Date(m.createdAt));
    const chip = newDay ? <DateChip label={formatDayLabel(new Date(m.createdAt))} /> : null;
    if (m.kind === 'SYSTEM') {
      return (
        <View key={m.id}>
          {chip}
          <SysPill textValue={m.text} />
        </View>
      );
    }
    if (m.kind === 'PROPOSAL' && m.proposalId) {
      return (
        <View key={m.id}>
          {chip}
          <ProposalMessage
            proposalId={m.proposalId}
            meId={me.id}
            counterpartName={c.counterpart.displayName}
            avatar={c.counterpart}
            time={formatTime(m.createdAt)}
            acceptedAt={activeAgreement ? `${shortDate(activeAgreement.agreedAt).replace(/^\S+ /, '')} kl. ${formatTime(activeAgreement.agreedAt)}` : undefined}
            declining={declining.has(m.proposalId)}
            onAccept={setAcceptFor}
            onDecline={decline}
            onUndoDecline={undoDecline}
            onAgreement={(id) => safePush(`/avtale/${id}`)}
          />
        </View>
      );
    }
    const mine = m.authorProfileId === me.id;
    const when = parseTimeProposal(m);
    if (when) {
      return (
        <View key={m.id}>
          {chip}
          <TimeCard
            when={when}
            mine={mine}
            first={first}
            answer={timeAnswer(list, i)}
            time={formatTime(m.createdAt)}
            onYes={() => send(nb.chat.timeOkMsg(when))}
            onNo={() => {
              send(nb.chat.timeOtherMsg);
              setSheet('time');
            }}
          />
        </View>
      );
    }
    const groupBreak = (x?: Message) => !x || x.authorProfileId !== m.authorProfileId || x.kind === 'SYSTEM' || x.kind === 'PROPOSAL';
    return (
      <View key={m.id}>
        {chip}
        <MessageRow
          m={m}
          mine={mine}
          meId={me.id}
          firstOfGroup={newDay || groupBreak(prev)}
          showAvatar={groupBreak(next) || (!!next && !isSameDay(new Date(next.createdAt), new Date(m.createdAt)))}
          avatar={{ initials: c.counterpart.initials, uri: c.counterpart.avatarUrl, seed: c.counterpart.id }}
          pinned={!!m.pinned}
          selected={selected === m.id}
          statusText={i === lastMine ? (m.pending ? nb.chat.sending : STATUS[m.delivery]) : undefined}
          onSelect={() => {
            if (m.kind === 'TEXT' && m.text.startsWith('📍') && openMapLink(m.text)) return;
            setSelected(selected === m.id ? null : m.id);
          }}
          onReact={(emoji) => {
            toggleReaction.mutate({ messageId: m.id, emoji });
            setSelected(null);
          }}
          onLongPress={() => setPinFor(m)}
          onRetry={() => retry(m)}
        />
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ChatTopBar
        c={c}
        verified={verified}
        online={presence.has(c.counterpart.id) || !!c.counterpart.online}
        typing={counterpartTyping}
        blocked={blocked}
        muted={muted}
        onBack={onBack}
        onMore={() => {
          setSelected(null);
          setSheet('menu');
        }}
      />

      <View style={styles.topStack}>
        {activeAgreement ? (
          <AgreementBanner
            agreement={activeAgreement}
            place={listing?.location.place || c.listing.place}
            onAgreement={() => safePush(`/avtale/${activeAgreement.proposalId}`)}
            onJobDay={() => safePush(`/jobbdag/${activeAgreement.proposalId}`)}
          />
        ) : null}
        <ListingStrip c={c} listing={listing} agreed={!!activeAgreement} offerCount={offerCount} onOpen={() => safePush(`/oppdrag/${c.listing.id}`)} />
        {pinnedMessage ? <PinBar textValue={pinnedMessage.kind === 'IMAGE' ? `📷 ${nb.chat.image}` : pinnedMessage.text} onUnpin={unpin} /> : null}
      </View>

      <View style={styles.flex}>
        {isLoading ? (
          <View style={styles.pad}>
            <RowSkeleton />
            <RowSkeleton />
          </View>
        ) : isError ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : (
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.thread}
            onContentSizeChange={onContentSizeChange}
            onScroll={onScroll}
            scrollEventThrottle={80}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
          >
            {list.map(renderMessage)}
            {counterpartTyping && !blocked ? (
              <View style={styles.typingRow}>
                <Avatar initials={c.counterpart.initials} uri={c.counterpart.avatarUrl} seed={c.counterpart.id} size={28} ring={false} />
                <TypingIndicator name={first} />
              </View>
            ) : null}
          </ScrollView>
        )}
        {showJump ? (
          <Pressable accessibilityRole="button" accessibilityLabel={nb.chat.newMessages} onPress={() => scrollToEnd(true)} style={[styles.jump, shadow.medium]}>
            <Icon name="down" size={16} color={colors.white} />
            <Text style={styles.jumpText}>{nb.chat.newMessages}</Text>
          </Pressable>
        ) : null}
      </View>

      {blocked ? (
        <BlockedBar first={first} onUnblock={doBlock} />
      ) : (
        <Composer
          first={first}
          onSend={send}
          onAttach={() => {
            setSelected(null);
            setSheet('share');
          }}
          onTyping={notifyTyping}
        />
      )}

      <ShareSheet
        visible={sheet === 'share'}
        onClose={closeSheet('share')}
        busy={uploading}
        canOffer={canOffer}
        canPlace={!!activeAgreement}
        onImage={() => void pickImage('library')}
        onCamera={() => void pickImage('camera')}
        onTime={() => setSheet('time')}
        onPlace={() => setSheet('place')}
        onOffer={() => setSheet('offer')}
      />
      <TimeSheet
        visible={sheet === 'time'}
        onClose={closeSheet('time')}
        first={first}
        onSend={(when) => {
          setSheet(null);
          send(`${nb.chat.timePrefix}${when}`);
        }}
      />
      <PlaceSheet
        visible={sheet === 'place'}
        onClose={closeSheet('place')}
        defaultPlace={c.listing.place}
        onSend={(t) => {
          setSheet(null);
          send(t);
        }}
      />
      {listing && canOffer ? (
        <GiTilbudSheet
          listing={listing}
          visible={sheet === 'offer'}
          onClose={closeSheet('offer')}
          onSent={() => undefined}
          onOpenChat={() => setSheet(null)}
        />
      ) : null}
      <ChatMenuSheet
        visible={sheet === 'menu'}
        onClose={closeSheet('menu')}
        profile={counterpart ?? c.counterpart}
        listingTitle={c.listing.title}
        muted={muted}
        blocked={blocked}
        onProfile={() => {
          setSheet(null);
          safePush(`/profil/${c.counterpart.id}`);
        }}
        onListing={() => {
          setSheet(null);
          safePush(`/oppdrag/${c.listing.id}`);
        }}
        onToggleMute={() => {
          const on = toggleMute();
          toast.info(on ? nb.chat.mutedToast : nb.chat.unmutedToast, { icon: 'bell', bottom: 150 });
        }}
        onReport={() => {
          setSheet(null);
          safePush(`/rapporter?profil=${c.counterpart.id}`);
        }}
        onBlock={() => {
          setSheet(null);
          if (blocked) doBlock();
          else setBlockDlg(true);
        }}
      />
      <PinSheet
        visible={!!pinFor}
        pinned={!!pinFor?.pinned}
        onClose={() => setPinFor(null)}
        onToggle={() => {
          if (pinFor) setPinned.mutate(pinFor.pinned ? null : pinFor.id);
          setPinFor(null);
        }}
      />

      <Dialog
        visible={!!acceptFor}
        onClose={() => !respond.isPending && setAcceptFor(null)}
        icon="hand"
        tone="ok"
        title={nb.chat.acceptTitle(first)}
        actions={
          acceptFor ? (
            <View style={styles.dlg}>
              <View style={styles.dlgSum}>
                <KeyValueRow label={nb.chat.kvPrice} value={formatPrice(acceptFor.price)} last={!acceptFor.scheduledText && !acceptFor.caveats} />
                {acceptFor.scheduledText ? <KeyValueRow label={nb.chat.kvTime} value={acceptFor.scheduledText} last={!acceptFor.caveats} /> : null}
                {acceptFor.caveats ? <KeyValueRow label={nb.chat.kvCaveats} value={acceptFor.caveats} last /> : null}
              </View>
              <Text style={[text.meta, styles.center]}>{nb.chat.acceptBody}</Text>
              <View style={styles.dlgRow}>
                <Button label={nb.chat.cancel} variant="ghost" block={false} onPress={() => setAcceptFor(null)} style={styles.grow1} />
                <Button label={nb.chat.acceptOffer} block={false} loading={respond.isPending} onPress={confirmAccept} style={styles.grow14} />
              </View>
            </View>
          ) : undefined
        }
      />
      <Dialog
        visible={blockDlg}
        onClose={() => setBlockDlg(false)}
        icon="ban"
        tone="danger"
        title={nb.chat.blockTitle(c.counterpart.displayName)}
        body={nb.chat.blockBody(first)}
        cancelLabel={nb.chat.cancel}
        confirmLabel={nb.chat.block}
        confirmVariant="danger"
        onConfirm={doBlock}
        loading={toggleBlock.isPending}
      />
    </KeyboardAvoidingView>
  );
}

function ProposalMessage({
  proposalId,
  meId,
  counterpartName,
  avatar,
  time,
  acceptedAt,
  declining,
  onAccept,
  onDecline,
  onUndoDecline,
  onAgreement,
}: {
  proposalId: string;
  meId: string;
  counterpartName: string;
  avatar: { initials: string; avatarUrl?: string; id: string };
  time: string;
  acceptedAt?: string;
  declining: boolean;
  onAccept: (p: Proposal) => void;
  onDecline: (p: Proposal) => void;
  onUndoDecline: (id: string) => void;
  onAgreement: (id: string) => void;
}) {
  const { data: p } = useProposal(proposalId);
  if (!p) return null;
  const mineSent = p.fromProfileId === meId;
  const canRespond = p.toProfileId === meId && p.status === 'SENT' && !declining;
  const state = p.status === 'ACCEPTED' ? 'accepted' : p.status === 'DECLINED' || p.status === 'WITHDRAWN' || p.status === 'CANCELLED' || declining ? 'declined' : 'pending';
  const fromName = mineSent ? 'deg' : counterpartName;
  return (
    <View style={[styles.offerRow, mineSent ? styles.offerMe : null]}>
      {!mineSent ? <Avatar initials={avatar.initials} uri={avatar.avatarUrl} seed={avatar.id} size={28} ring={false} /> : null}
      <View style={styles.offerCol}>
        <OfferCard
          state={state}
          fromLine={nb.chat.offerFrom(fromName, time)}
          price={formatPrice(p.price)}
          when={p.scheduledText}
          message={p.message}
          caveat={p.caveats}
          acceptedAt={acceptedAt}
          canRespond={canRespond || (declining && p.toProfileId === meId)}
          pendingLabel={p.status === 'REVISION_PENDING' ? nb.mottatte.status.REVISION_PENDING : undefined}
          declinedTitle={p.status === 'WITHDRAWN' ? nb.chat.offerWithdrawn : p.status === 'CANCELLED' ? nb.mottatte.status.CANCELLED : undefined}
          declinedSub={p.status === 'WITHDRAWN' ? nb.tilbudDetalj.tlWithdrawnSub : mineSent ? nb.tilbudDetalj.closedDeclinedThem(counterpartName.split(' ')[0]) : undefined}
          onAccept={() => onAccept(p)}
          onDecline={() => onDecline(p)}
          onUndoDecline={declining ? () => onUndoDecline(p.id) : undefined}
          onOpenAgreement={p.status === 'ACCEPTED' ? () => onAgreement(p.id) : undefined}
        />
        <Text style={styles.mtime}>{time}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  pad: { paddingTop: 16 },
  grow1: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto' },
  grow14: { flexGrow: 1.4, flexShrink: 1, flexBasis: 'auto' },
  topStack: { gap: 8, paddingTop: 10, paddingHorizontal: 12, zIndex: 4 },
  thread: { paddingTop: 14, paddingBottom: 14, paddingHorizontal: 12 },
  typingRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 12 },
  jump: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.ink,
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  jumpText: { fontFamily: text.label.fontFamily, fontSize: 13, color: colors.white },
  offerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 12 },
  offerMe: { justifyContent: 'flex-end' },
  offerCol: { width: '88%' },
  mtime: { fontFamily: text.body.fontFamily, fontSize: 11.5, color: colors.faint, marginTop: 5, paddingHorizontal: 6 },
  dlg: { gap: 14, alignSelf: 'stretch' },
  dlgSum: { marginTop: 4, paddingVertical: 4, paddingHorizontal: 14, borderRadius: 16, backgroundColor: colors.surface2 },
  dlgRow: { flexDirection: 'row', gap: 10 },
});
