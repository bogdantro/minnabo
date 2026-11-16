import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { serverMessage } from '@/lib/errors';
import {
  KeyboardAvoidingView,
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
import { isExpiredProposal, isTakenListing } from '@/domain/editing';
import { useIsFocused } from 'expo-router';
import { ChatSearchSheet } from '@/components/chat/ChatSearchSheet';
import nb from '@/i18n/nb';
import { quickReplies, replyStage, suggestedReplies } from '@/domain/quickReplies';
import {
  useAddressActions,
  useAddresses,
  useCancelScheduled,
  useChatSettings,
  useChatStatus,
  useEditMessage,
  useScheduleMessage,
  useScheduledMessages,
  useSendFile,
} from '@/api/inboxQueries';
import { useLocalSet } from '@/lib/localSet';
import { readAloud } from '@/lib/readAloud';
import { sharePdf } from '@/lib/pdf';
import { conversationPdfHtml } from '@/lib/chatPdf';
import {
  AboutChatSheet,
  AddressCards,
  AddressSheet,
  EditMessageSheet,
  ListingPickSheet,
  ScheduleSheet,
  ScheduledBar,
  TopNote,
  oppdragUrl,
} from '@/components/chat/ChatPlus';
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
  useSendVoice,
  useSendMessage,
  useAppSettings,
  useDeleteMessage,
  useTranscribeMessage,
  useTranslateMessage,
  useSetPinnedMessage,
  useToggleBlock,
  useToggleReaction,
  useRequestHelpAgain,
} from '@/api/queries';
import { useConversationChannel, usePresence, useTypingChannel } from '@/api/realtime';
import { ImageViewer } from '@/components/ImageViewer';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { formatDayLabel, isSameDay } from '@/lib/calendar';
import { formatTime, seenWhen, shortDate } from '@/lib/datetime';
import { haptics } from '@/lib/haptics';
import { useMutedConversation } from '@/lib/mutedConversations';
import { safePush, safeNavigate } from '@/lib/nav';
import { outbox } from '@/lib/outbox';
import { toast } from '@/lib/toast';
import { pickAndUpload, pickAndUploadMany, pickAndUploadPdf, pickAndUploadVideo, uploadVoice } from '@/lib/uploads';
import type { VoiceClip } from '@/components/chat/Voice';
import { colors, motion, radius, shadow, text } from '@/theme/theme';
import { confirm } from '@/lib/confirm';
import { PhotoBlurEditor, canBlurPhotos } from '@/components/PhotoBlurEditor';
import { GiTilbudSheet } from '@/components/GiTilbudSheet';
import { AgreementBanner, BlockedBar, ChatTopBar, Composer, ListingStrip, PinBar } from '@/components/chat/ChatTop';
import { DateChip, MessageRow, parseTimeProposal, SysPill, TimeCard, timeAnswer } from '@/components/chat/ChatThread';
import { ChatMenuSheet, PlaceSheet, ShareSheet, TimeSheet, openMapLink } from '@/components/chat/ChatSheets';
import { MessageActionsSheet, PhotosSheet, messagePreview } from '@/components/chat/MessageExtras';
import { Button, Dialog, ErrorState, Icon, KeyValueRow, OfferCard, RowSkeleton, TypingIndicator, Avatar, Toggle } from '@/components/ui';

const STATUS = nb.chat.status;

/** Chat (design/screens/Chat.dc.html). */
export function ChatScreen({ conversation: c, onBack, jumpTo }: { conversation: Conversation; onBack: () => void; jumpTo?: string }) {
  const me = useCurrentUser();
  const net = useNetworkState();
  const online = net.isConnected !== false && net.isInternetReachable !== false;

  const focused = useIsFocused();
  useConversationChannel(c.id, focused);
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
  const sendVoiceMessage = useSendVoice(c.id, me.id);
  const toggleReaction = useToggleReaction(c.id, me.id);
  const setPinned = useSetPinnedMessage(c.id);
  const respond = useRespondToProposal(c.id);
  const deleteMessage = useDeleteMessage(c.id);
  const transcribe = useTranscribeMessage(c.id);
  const { transcriptsEnabled, aiEnabled } = useAppSettings();
  const translate = useTranslateMessage(c.id);
  // «Søk i samtalen» (0101): where each message sits in the thread, to jump to a hit
  const [searchOpen, setSearchOpen] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const rowY = useRef(new Map<string, number>());
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [photosOpen, setPhotosOpen] = useState(false);
  // ---- 0109: editing, «Send senere», address, files, «Om samtalen», notes
  const editMessage = useEditMessage(c.id);
  const [editFor, setEditFor] = useState<Message | null>(null);
  const scheduled = useScheduledMessages(c.id).data ?? [];
  const schedule = useScheduleMessage(c.id);
  const cancelScheduled = useCancelScheduled(c.id);
  const addresses = useAddresses(c.id).data ?? [];
  const addressActions = useAddressActions(c.id);
  const sendFile = useSendFile(c.id);
  const mySettings = useChatSettings().data;
  const theirStatus = useChatStatus(c.counterpart.id).data;
  const [myReplies, , setMyReplies] = useLocalSet('minnabo.myReplies.v1', 12);
  const [safeOk, toggleSafeOk] = useLocalSet('minnabo.chatSafeOk.v1');
  const [youthOk, toggleYouthOk] = useLocalSet('minnabo.chatYouthOk.v1');
  const [translateAlways, toggleTranslateAlways] = useLocalSet('minnabo.translateAlways.v1');
  const [extraSheet, setExtraSheet] = useState<'schedule' | 'address' | 'listing' | 'about' | null>(null);
  // «Gjør uskarpt»: a photo picked here, covered in the editor, sent from the private chat bucket
  const [blurUri, setBlurUri] = useState<string | null>(null);

  const [selected, setSelected] = useState<string | null>(null);
  const [viewer, setViewer] = useState<string | null>(null);
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

  const list = useMemo(() => messages ?? [], [messages]);
  const pinnedMessage = list.find((m) => m.pinned);
  const photos = list.filter((m) => m.kind === 'IMAGE' && !!m.attachmentUrl && !m.deletedAt);
  const blocked = (blockedIds.data ?? []).includes(c.counterpart.id);
  const activeAgreement = agreement && !agreement.cancelledAt ? agreement : null;
  const first = c.counterpart.displayName.split(' ')[0];
  const verified = !!counterpart?.verifications.some((v) => v.verified);
  // On an oppdrag the visitor sends the tilbud; on a «Tilbyr hjelp» post the helper (its owner)
  // sends it to the nabo who asked (0076).
  const isOfferPost = listing?.type === 'SERVICE_OFFER';
  const canOffer = !!listing && (isOfferPost ? isOwner : !isOwner) && !activeAgreement;
  // Hurtigsvar follow the conversation: «Er på vei!» for the helper on the job day, «Takk for jobben!» after
  const iAmHelper = isOfferPost ? isOwner : !isOwner;
  const jobDone = !isOfferPost && !!activeAgreement && (listing?.status === 'COMPLETED' || listing?.status === 'REVIEWED');
  // none until the oppdrag has loaded: before that we can't tell who is the helper
  const replies = listing ? quickReplies(replyStage(activeAgreement, jobDone, new Date()), iAmHelper, activeAgreement?.scheduledAt) : [];
  const offerCount = isOwner && !isOfferPost ? (proposals.data ?? []).filter((p) => p.status !== 'DRAFT').length : undefined;
  const lastIncoming = [...list].reverse().find((m) => m.authorProfileId !== me.id && m.kind === 'TEXT' && !m.deletedAt);
  const suggested = lastIncoming && list[list.length - 1]?.id === lastIncoming.id ? suggestedReplies(lastIncoming.text) : [];
  // receipts off on either side: nobody sees «Lest»
  const receiptsOff = mySettings?.readReceipts === false || theirStatus?.readReceipts === false;
  const awayUntil = theirStatus?.awayUntil;
  // «Føles samtalen trygg?»: the first messages from someone I have never dealt with, before an avtale
  const iWrote = list.some((m) => m.authorProfileId === me.id && m.kind !== 'SYSTEM');
  const strangerFirst = !activeAgreement && !iWrote && list.some((m) => m.authorProfileId === c.counterpart.id && m.kind === 'TEXT');
  const showSafety = strangerFirst && !safeOk.includes(c.id);
  // a youth talking to an adult: a calm note, until «Skjønner»
  const showYouth = me.isYouth && !counterpart?.youthAge && !youthOk.includes(c.id);
  // «Spør … igjen»: my finished oppdrag, the same helper
  const helpAgain = useRequestHelpAgain(activeAgreement?.proposalId ?? '');
  const canAskAgain = jobDone && isOwner && !isOfferPost && !!activeAgreement;

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

  // the server says why when the other person has blocked you; otherwise a plain "try again"
  const sendFailed = (e: unknown) =>
    toast.error(e instanceof Error && /kan ikke sende meldinger/i.test(e.message) ? nb.chat.blockedByThem : serverMessage(e, nb.toast.genericError), {
      bottom: 150,
    });
  const sendNow = (t: string, reply?: string) => sendMessage.mutate({ text: t, replyToId: reply }, { onError: sendFailed });
  const send = (t: string) => {
    atBottom.current = true;
    setSelected(null);
    if (!online) {
      outbox.enqueue({ kind: 'message', conversationId: c.id, text: t });
      return;
    }
    const reply = replyTo && !replyTo.pending ? replyTo.id : undefined;
    setReplyTo(null);
    sendNow(t, reply);
  };

  // ---- video and PDF
  const sendMedia = async (kind: 'video' | 'videoCam' | 'pdf') => {
    setUploading(true);
    try {
      if (kind === 'pdf') {
        const r = await pickAndUploadPdf(me.id);
        if (r) await sendFile.mutateAsync({ path: r.path, kind: 'FILE', fileName: r.name });
      } else {
        const r = await pickAndUploadVideo(me.id, kind === 'videoCam' ? 'camera' : 'library');
        if (r) await sendFile.mutateAsync({ path: r.path, kind: 'VIDEO', fileName: 'video.mp4' });
      }
      setSheet(null);
    } catch (e) {
      toast.error(serverMessage(e, nb.chat.uploadFailed), { bottom: 150 });
    } finally {
      setUploading(false);
    }
  };
  const pickToBlur = async () => {
    try {
      const ImagePicker = await import('expo-image-picker');
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
      if (r.canceled) return;
      setSheet(null);
      setBlurUri(r.assets[0].uri);
    } catch {
      toast.error(nb.chat.uploadFailed);
    }
  };
  const pickCropped = async () => {
    setUploading(true);
    try {
      const r = await pickAndUpload({ bucket: 'chat-attachments', folder: me.id, source: 'library', edit: true });
      if (r) {
        setSheet(null);
        attach(r.path, r.localUri);
      }
    } catch (e) {
      toast.error((e as Error).message || nb.chat.uploadFailed);
    } finally {
      setUploading(false);
    }
  };

  // ---- jump to a message (from Innboks search), once it has loaded
  const jumped = useRef(false);
  useEffect(() => {
    if (!jumpTo || jumped.current || !list.some((m) => m.id === jumpTo)) return;
    const t = setTimeout(() => {
      const y = rowY.current.get(jumpTo);
      if (y == null) return;
      jumped.current = true;
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 80), animated: true });
      setFlash(jumpTo);
      setTimeout(() => setFlash((f) => (f === jumpTo ? null : f)), FLASH_MS);
    }, 400);
    return () => clearTimeout(t);
  }, [jumpTo, list]);

  // ---- «Oversett alltid til norsk» for this conversation: new foreign messages are translated as they come
  const translateOn = aiEnabled && translateAlways.includes(c.id);
  const asked = useRef(new Set<string>());
  useEffect(() => {
    if (!translateOn || translate.isPending) return;
    const next = list
      .slice(-6)
      .find((m) => m.authorProfileId !== me.id && m.kind === 'TEXT' && !m.translationNb && !m.deletedAt && !asked.current.has(m.id) && /[a-z]/i.test(m.text));
    if (!next) return;
    asked.current.add(next.id);
    translate.mutate(next.id);
  }, [translateOn, list, me.id, translate]);
  const attach = (path: string, preview?: string) => {
    atBottom.current = true;
    if (!online) {
      outbox.enqueue({ kind: 'attachment', conversationId: c.id, url: path });
      return;
    }
    sendAttachment.mutate({ path, preview }, { onError: () => toast.error(nb.toast.genericError) });
  };
  // a talemelding needs its file uploaded first, so it can't wait in the offline outbox
  const sendVoice = (clip: VoiceClip) => {
    atBottom.current = true;
    setSelected(null);
    if (!online) {
      toast.error(nb.chat.voiceOffline, { icon: 'mic', bottom: 150 });
      return;
    }
    sendVoiceMessage.mutate(
      { uri: clip.uri, durationMs: clip.durationMs, upload: (u) => uploadVoice(u, me.id) },
      { onError: (e) => toast.error(serverMessage(e, nb.chat.voiceSendFailed), { bottom: 150 }) },
    );
  };
  const pickImage = async (source: 'camera' | 'library') => {
    setUploading(true);
    try {
      // Library: pick several photos at once; each is sent as its own image message.
      const res =
        source === 'library'
          ? await pickAndUploadMany({ bucket: 'chat-attachments', folder: me.id, max: 10 })
          : [await pickAndUpload({ bucket: 'chat-attachments', folder: me.id, source })].filter((r): r is NonNullable<typeof r> => !!r);
      if (res.length) {
        setSheet(null);
        res.forEach((r) => attach(r.path, r.localUri));
      }
    } catch (e) {
      toast.error((e as Error).message || nb.chat.uploadFailed);
    } finally {
      setUploading(false);
    }
  };
  const retry = (m: Message) => {
    if (m.kind === 'AUDIO' && m.attachmentUrl) {
      sendVoice({ uri: m.attachmentUrl, durationMs: m.audioMs ?? 0 });
      return;
    }
    if (m.kind === 'IMAGE' && (m.attachmentPath || m.attachmentUrl)) {
      sendAttachment.mutate({ path: m.attachmentPath ?? m.attachmentUrl!, preview: m.attachmentUrl });
    }
    else sendMessage.mutate(m.text, { onError: sendFailed });
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

  const nameOf = (m: Message) => (m.authorProfileId === me.id ? nb.chat.you : first);
  const askDelete = async (m: Message) => {
    setPinFor(null);
    const ok = await confirm({
      title: nb.chat.deleteTitle,
      message: nb.chat.deleteBody,
      confirmLabel: nb.chat.deleteConfirm,
      destructive: true,
    });
    if (ok) deleteMessage.mutate(m.id, { onError: (e) => toast.error(serverMessage(e, nb.toast.genericError), { bottom: 150 }) });
  };

  // Last own message gets the Sendt / Levert / Lest line.
  let lastMine = -1;
  list.forEach((m, i) => {
    if (m.authorProfileId === me.id && (m.kind === 'TEXT' || m.kind === 'IMAGE' || m.kind === 'AUDIO')) lastMine = i;
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
    const quotedMsg = m.replyToId ? list.find((x) => x.id === m.replyToId) : undefined;
    const groupBreak = (x?: Message) => !x || x.authorProfileId !== m.authorProfileId || x.kind === 'SYSTEM' || x.kind === 'PROPOSAL';
    return (
      <View key={m.id} onLayout={(e) => rowY.current.set(m.id, e.nativeEvent.layout.y)} style={flash === m.id ? styles.flash : undefined}>
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
          statusText={
            i === lastMine
              ? m.pending
                ? nb.chat.sending
                : m.delivery === 'READ' && receiptsOff
                  ? STATUS.DELIVERED
                  : m.delivery === 'READ' && m.readAt
                    ? nb.chat.seenAt(seenWhen(m.readAt))
                    : STATUS[m.delivery]
              : undefined
          }
          onSelect={() => {
            // a photo opens in fullscreen (hold it to pin)
            if (m.kind === 'IMAGE' && m.attachmentUrl) {
              setSelected(null);
              setViewer(m.attachmentUrl);
              return;
            }
            if (m.deletedAt) return;
            if (m.kind === 'TEXT' && m.text.startsWith('📍') && openMapLink(m.text)) return;
            setSelected(selected === m.id ? null : m.id);
          }}
          onReact={(emoji) => {
            toggleReaction.mutate({ messageId: m.id, emoji });
            setSelected(null);
          }}
          onCloseReactions={() => setSelected(null)}
          onLongPress={() => {
            // a photo opens on tap, so holding it gives the reactions; hold once more to pin
            if (m.deletedAt) return;
            if (m.kind === 'IMAGE' && selected !== m.id) setSelected(m.id);
            else setPinFor(m);
          }}
          onRetry={() => retry(m)}
          quoted={quotedMsg ? { name: nameOf(quotedMsg), preview: messagePreview(quotedMsg) } : undefined}
          hasAgreement={!!activeAgreement}
          onReply={() => setReplyTo(m)}
          transcriptsEnabled={transcriptsEnabled}
          transcribing={transcribe.isPending && transcribe.variables === m.id}
          onTranscribe={() => transcribe.mutate(m.id, { onError: (e) => toast.error(serverMessage(e, nb.toast.genericError), { bottom: 150 }) })}
          translateEnabled={aiEnabled}
          translating={translate.isPending && translate.variables === m.id}
          onTranslate={() => translate.mutate(m.id, { onError: (e) => toast.error(serverMessage(e, nb.toast.genericError), { bottom: 150 }) })}
        />
      </View>
    );
  };

  return (
    // padding on Android too: it draws edge-to-edge, so the window no longer shrinks for the keyboard
    <KeyboardAvoidingView style={styles.wrap} behavior="padding">
      <ChatTopBar
        c={c}
        verified={verified}
        online={!theirStatus?.hideOnline && (presence.has(c.counterpart.id) || !!c.counterpart.online)}
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
            onJobDay={() => safeNavigate(`/jobbdag/${activeAgreement.proposalId}`)}
          />
        ) : null}
        <ListingStrip c={c} listing={listing} agreed={!!activeAgreement} offerCount={offerCount} onOpen={() => safePush(c.notice ? '/oppslagstavle' : `/oppdrag/${c.listing.id}`)} />
        {pinnedMessage ? <PinBar textValue={pinnedMessage.kind === 'IMAGE' ? `📷 ${nb.chat.image}` : pinnedMessage.kind === 'AUDIO' ? `🎤 ${nb.chat.voiceMessage}` : pinnedMessage.text} onUnpin={unpin} /> : null}
        {awayUntil ? (
          <TopNote tone="warn" icon="sun" title={nb.innboks.settings.awayBadge(new Date(awayUntil).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long' }))} testID="away-note" />
        ) : null}
        {showYouth ? (
          <TopNote
            tone="cyan"
            icon="shield"
            title={nb.innboks.chat.youthTitle}
            body={nb.innboks.chat.youthBody}
            actions={[{ label: nb.innboks.chat.youthOk, onPress: () => toggleYouthOk(c.id), primary: true }]}
            testID="youth-note"
          />
        ) : showSafety ? (
          <TopNote
            tone="warn"
            icon="shield"
            title={nb.innboks.chat.safetyTitle}
            body={nb.innboks.chat.safetyBody}
            actions={[
              { label: nb.innboks.chat.safetyYes, onPress: () => toggleSafeOk(c.id), primary: true },
              { label: nb.innboks.chat.safetyReport, onPress: () => safePush(`/rapporter?profil=${c.counterpart.id}`) },
            ]}
            testID="safety-note"
          />
        ) : null}
        {canAskAgain ? (
          <TopNote
            tone="ok"
            icon="repeat"
            title={nb.innboks.chat.askAgain(first)}
            body={nb.innboks.chat.askAgainSub}
            actions={[
              {
                label: nb.innboks.chat.askAgain(first),
                primary: true,
                onPress: () =>
                  helpAgain.mutate(undefined, {
                    onSuccess: () => toast.success(nb.innboks.chat.askAgainSent, { bottom: 150 }),
                    onError: (e) => toast.error(serverMessage(e, nb.toast.genericError), { bottom: 150 }),
                  }),
              },
            ]}
            testID="ask-again"
          />
        ) : null}
        <AddressCards
          list={addresses}
          meId={me.id}
          otherName={first}
          onRevoke={() => addressActions.revoke.mutate(undefined, { onError: (e) => toast.error(serverMessage(e, nb.toast.genericError), { bottom: 150 }) })}
        />
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

      {!blocked ? <ScheduledBar list={scheduled} onCancel={(id) => cancelScheduled.mutate(id)} /> : null}
      {blocked ? (
        <BlockedBar first={first} onUnblock={doBlock} />
      ) : (
        <Composer
          conversationId={c.id}
          myReplies={myReplies}
          suggested={suggested}
          onSaveReply={(t) => {
            setMyReplies([t, ...myReplies.filter((x) => x !== t)]);
            toast.success(nb.innboks.chat.savedReply, { icon: 'bookmark', bottom: 150 });
          }}
          onRemoveReply={(t) => setMyReplies(myReplies.filter((x) => x !== t))}
          first={first}
          onSend={send}
          onAttach={() => {
            setSelected(null);
            setSheet('share');
          }}
          onTyping={notifyTyping}
          replies={replies}
          onVoice={sendVoice}
          replyTo={replyTo ? { name: nameOf(replyTo), preview: messagePreview(replyTo) } : null}
          onCancelReply={() => setReplyTo(null)}
          hasAgreement={!!activeAgreement}
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
        extra={[
          { key: 'video', label: nb.innboks.chat.video, icon: 'play', bg: colors.lavenderTint, fg: colors.lavender, onPress: () => void sendMedia('video') },
          { key: 'pdf', label: nb.innboks.chat.file, icon: 'file', bg: colors.surface2, fg: colors.ink2, onPress: () => void sendMedia('pdf') },
          { key: 'crop', label: nb.innboks.chat.photoEdit, icon: 'image', bg: colors.okTint, fg: colors.okText, onPress: () => void pickCropped() },
          ...(canBlurPhotos
            ? [{ key: 'blur', label: nb.innboks.chat.photoBlur, icon: 'eyeoff' as const, bg: colors.surface2, fg: colors.ink2, onPress: () => void pickToBlur() }]
            : []),
          {
            key: 'later',
            label: nb.innboks.chat.schedule,
            icon: 'clock',
            bg: colors.cyanTint,
            fg: colors.cyanDeep,
            onPress: () => {
              setSheet(null);
              setExtraSheet('schedule');
            },
          },
          activeAgreement
            ? {
                key: 'address',
                label: nb.innboks.chat.address,
                icon: 'home',
                bg: colors.limeTint,
                fg: colors.limeDeep,
                onPress: () => {
                  setSheet(null);
                  setExtraSheet('address');
                },
              }
            : { key: 'address', label: nb.innboks.chat.address, icon: 'lock', bg: colors.neutralPill, fg: colors.mute, locked: true, onPress: () => toast.info(nb.innboks.chat.addressNeedsAgreement, { icon: 'lock', bottom: 150 }) },
          {
            key: 'listing',
            label: nb.innboks.chat.listing,
            icon: 'clip',
            bg: colors.warnTint,
            fg: colors.warn,
            onPress: () => {
              setSheet(null);
              setExtraSheet('listing');
            },
          },
        ]}
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
          recipient={isOfferPost ? (counterpart ?? c.counterpart) : undefined}
          conversationId={isOfferPost ? c.id : undefined}
          visible={sheet === 'offer'}
          onClose={closeSheet('offer')}
          onSent={() => undefined}
          onOpenChat={() => setSheet(null)}
        />
      ) : null}
      <ImageViewer uri={viewer} onClose={() => setViewer(null)} />
      <ChatSearchSheet
        visible={searchOpen}
        messages={list}
        nameOf={nameOf}
        onClose={() => setSearchOpen(false)}
        onPick={(m) => {
          setSearchOpen(false);
          const y = rowY.current.get(m.id);
          if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - 80), animated: true });
          setFlash(m.id);
          setTimeout(() => setFlash((f) => (f === m.id ? null : f)), FLASH_MS);
        }}
      />
      <ChatMenuSheet
        visible={sheet === 'menu'}
        onClose={closeSheet('menu')}
        profile={counterpart ?? c.counterpart}
        listingTitle={c.listing.title}
        muted={muted}
        blocked={blocked}
        photoCount={photos.length}
        onSearch={() => {
          setSheet(null);
          setSearchOpen(true);
        }}
        extraRows={[
          {
            key: 'about',
            icon: 'info',
            title: nb.innboks.chat.about,
            onPress: () => {
              setSheet(null);
              setExtraSheet('about');
            },
          },
          ...(activeAgreement
            ? [{ key: 'checklist', icon: 'list' as const, title: nb.innboks.chat.checklist, onPress: () => {
                setSheet(null);
                safeNavigate(`/jobbdag/${activeAgreement.proposalId}`);
              } }]
            : []),
          {
            key: 'pdf',
            icon: 'download',
            title: nb.innboks.chat.export,
            onPress: () => {
              setSheet(null);
              void sharePdf(conversationPdfHtml({ name: c.counterpart.displayName, title: c.listing.title, meId: me.id, messages: list }), nb.innboks.chat.exportTitle(c.counterpart.displayName, c.listing.title));
            },
          },
          ...(aiEnabled
            ? [
                {
                  key: 'translate',
                  icon: 'globe' as const,
                  title: nb.innboks.chat.alwaysTranslate,
                  subtitle: translateOn ? nb.innboks.chat.alwaysTranslateOn : undefined,
                  right: <Toggle size="sm" value={translateOn} onValueChange={() => toggleTranslateAlways(c.id)} accessibilityLabel={nb.innboks.chat.alwaysTranslate} />,
                },
              ]
            : []),
        ]}
        onPhotos={() => {
          setSheet(null);
          setPhotosOpen(true);
        }}
        onProfile={() => {
          setSheet(null);
          safePush(`/profil/${c.counterpart.id}`);
        }}
        onListing={() => {
          setSheet(null);
          safePush(c.notice ? '/oppslagstavle' : `/oppdrag/${c.listing.id}`);
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
      <MessageActionsSheet
        message={pinFor}
        mine={pinFor?.authorProfileId === me.id}
        onClose={() => setPinFor(null)}
        onReply={() => {
          setReplyTo(pinFor);
          setPinFor(null);
        }}
        onTogglePin={() => {
          if (pinFor) setPinned.mutate(pinFor.pinned ? null : pinFor.id);
          setPinFor(null);
        }}
        onDelete={() => {
          if (pinFor) void askDelete(pinFor);
        }}
        onEdit={() => {
          setEditFor(pinFor);
          setPinFor(null);
        }}
        onReadAloud={() => {
          if (pinFor) void readAloud(pinFor.kind === 'AUDIO' ? (pinFor.transcript ?? '') : pinFor.text);
          setPinFor(null);
        }}
      />
      <PhotoBlurEditor
        uri={blurUri}
        folder={me.id}
        bucket="chat-attachments"
        onClose={() => setBlurUri(null)}
        onSaved={(_url, path) => {
          setBlurUri(null);
          attach(path);
        }}
      />
      <EditMessageSheet
        message={editFor}
        busy={editMessage.isPending}
        onClose={() => setEditFor(null)}
        onSave={(t) =>
          editMessage.mutate(
            { id: editFor!.id, text: t },
            { onSuccess: () => setEditFor(null), onError: (e) => toast.error(serverMessage(e, nb.toast.genericError), { bottom: 150 }) },
          )
        }
      />
      <ScheduleSheet
        visible={extraSheet === 'schedule'}
        busy={schedule.isPending}
        onClose={() => setExtraSheet(null)}
        onSave={(t, at) =>
          schedule.mutate(
            { text: t, sendAt: at },
            {
              onSuccess: () => {
                setExtraSheet(null);
                toast.success(nb.innboks.chat.scheduledToast, { icon: 'clock', bottom: 150 });
              },
              onError: (e) => toast.error(serverMessage(e, nb.toast.genericError), { bottom: 150 }),
            },
          )
        }
      />
      <AddressSheet
        visible={extraSheet === 'address'}
        busy={addressActions.share.isPending}
        onClose={() => setExtraSheet(null)}
        onSave={(address, note) =>
          addressActions.share.mutate(
            { address, note },
            { onSuccess: () => setExtraSheet(null), onError: (e) => toast.error(serverMessage(e, nb.toast.genericError), { bottom: 150 }) },
          )
        }
      />
      <ListingPickSheet
        visible={extraSheet === 'listing'}
        kommune={me.municipality}
        exceptId={c.listing.id}
        onClose={() => setExtraSheet(null)}
        onPick={(l) => {
          setExtraSheet(null);
          send(nb.innboks.chat.listingMsg(l.title, oppdragUrl(l.id)));
        }}
      />
      <AboutChatSheet
        visible={extraSheet === 'about'}
        c={c}
        messages={list}
        agreementId={activeAgreement?.proposalId}
        onClose={() => setExtraSheet(null)}
        onPhotos={() => {
          setExtraSheet(null);
          setPhotosOpen(true);
        }}
        onJump={(m) => {
          setExtraSheet(null);
          const y = rowY.current.get(m.id);
          if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - 80), animated: true });
          setFlash(m.id);
          setTimeout(() => setFlash((f) => (f === m.id ? null : f)), FLASH_MS);
        }}
      />
      <PhotosSheet
        visible={photosOpen}
        photos={photos}
        onClose={() => setPhotosOpen(false)}
        onOpen={(uri) => {
          setPhotosOpen(false);
          setViewer(uri);
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
  const { data: offerListing } = useListing(p?.listingId ?? '');
  if (!p) return null;
  const mineSent = p.fromProfileId === meId;
  const expired = isExpiredProposal(p);
  // another tilbud on the oppdrag is accepted → this one waits
  const onHold = !!offerListing && isTakenListing(offerListing.status) && (p.status === 'SENT' || p.status === 'REVISION_PENDING');
  const canRespond = p.toProfileId === meId && p.status === 'SENT' && !declining && !expired && !onHold;
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
          duration={p.durationText}
          message={p.message}
          caveat={p.caveats}
          acceptedAt={acceptedAt}
          canRespond={canRespond || (declining && p.toProfileId === meId)}
          pendingLabel={onHold ? nb.mottatte.onHold : expired ? nb.mottatte.expired : p.status === 'REVISION_PENDING' ? nb.mottatte.status.REVISION_PENDING : undefined}
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

/** How long a message found by «Søk i samtalen» stays lit up. */
const FLASH_MS = 2200;

const styles = StyleSheet.create({
  flash: { backgroundColor: colors.limeTint, borderRadius: 18 },
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
