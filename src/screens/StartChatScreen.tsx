import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useQueryClient } from '@tanstack/react-query';
import nb from '@/i18n/nb';
import { categoryArtId } from '@/domain/categories';
import { apiClient } from '@/api/client';
import { chatKeys, useConversations, useListing, useReplyMinutes, useStartConversation } from '@/api/queries';
import { useSession } from '@/auth/session';
import { formatTime, replyTime } from '@/lib/datetime';
import { safePush } from '@/lib/nav';
import { colors, fonts, radius, screenPadding, shadow, text } from '@/theme/theme';
import { listingPrice } from '@/components/OppdragCard';
import {
  Avatar,
  Bubble,
  Button,
  CategoryArt,
  ErrorState,
  FadeUp,
  Icon,
  IconButton,
  Pill,
  RowSkeleton,
  ScaleIn,
  SubHeader,
  SystemMessage,
  VerifiedBadge,
} from '@/components/ui';

type Sent = { id: number; text: string; time: string; status: 'sending' | 'sent' | 'failed' };

/**
 * Ny samtale (design/screens/StartSamtale.dc.html). The conversation is created
 * on the first message, so just opening the screen leaves nothing behind.
 */
export function StartChatScreen({ listingId }: { listingId: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const { userId } = useSession();
  const { data: listing, isLoading, isError, refetch } = useListing(listingId);
  const conversations = useConversations();
  const startConversation = useStartConversation();
  const replyMinutes = useReplyMinutes(listing?.owner.id).data;

  const [draft, setDraft] = useState('');
  const [focused, setFocused] = useState(false);
  const [msgs, setMsgs] = useState<Sent[]>([]);
  const [convId, setConvId] = useState<string | null>(null);
  const scroll = useRef<ScrollView>(null);

  // Already talking about this oppdrag → go straight to that conversation.
  const existing = (conversations.data ?? []).find((c) => c.listing.id === listingId && c.lastMessagePreview);
  useEffect(() => {
    if (existing && msgs.length === 0) router.replace(`/chat/${existing.id}`);
  }, [existing, msgs.length, router]);

  const back = () => (router.canGoBack() ? router.back() : router.replace(`/oppdrag/${listingId}`));
  const header = (
    <SubHeader
      title={nb.startChat.title}
      onBack={back}
      right={<IconButton icon="shield" iconSize={18} accessibilityLabel={nb.startChat.safety} onPress={() => safePush('/sikkerhet')} />}
    />
  );

  if (!listing) {
    return (
      <View style={styles.wrap}>
        {header}
        {isError || !isLoading ? (
          <ErrorState title={isError ? undefined : nb.startChat.notFound} onRetry={() => void refetch()} />
        ) : (
          <View style={styles.skel}>
            <RowSkeleton />
            <RowSkeleton />
          </View>
        )}
      </View>
    );
  }

  const owner = listing.owner;
  const first = owner.displayName.split(' ')[0];
  const cat = categoryArtId(listing.category.slug);
  const price = listingPrice(listing);
  const place = listing.location.place || listing.location.municipality;
  const meta = [owner.displayName, [price.label, price.value].filter(Boolean).join(' '), place].join(' · ');
  const openers = nb.startChat.openers(listing.task?.scheduledText ?? null);
  const canSend = draft.trim().length > 0;
  const started = msgs.length > 0;
  const done = msgs.some((m) => m.status === 'sent');

  const deliver = async (m: Sent) => {
    try {
      let id = convId;
      if (!userId) throw new Error('not signed in');
      if (!id) {
        const conv = await startConversation.mutateAsync(listing.id);
        id = conv.id;
        setConvId(id);
      }
      await apiClient.sendMessage(id, m.text);
      qc.invalidateQueries({ queryKey: chatKeys.messages(id) });
      qc.invalidateQueries({ queryKey: ['conversations'] });
      setMsgs((all) => all.map((x) => (x.id === m.id ? { ...x, status: 'sent' } : x)));
    } catch {
      setMsgs((all) => all.map((x) => (x.id === m.id ? { ...x, status: 'failed' } : x)));
    }
  };

  const send = () => {
    const t = draft.trim();
    if (!t) return;
    const m: Sent = { id: Date.now(), text: t.slice(0, 1000), time: formatTime(new Date().toISOString()), status: 'sending' };
    setDraft('');
    setMsgs((all) => [...all, m]);
    void deliver(m);
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
  };

  const retry = (m: Sent) => {
    setMsgs((all) => all.map((x) => (x.id === m.id ? { ...x, status: 'sending' } : x)));
    void deliver(m);
  };

  return (
    <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* header + pinned oppdrag */}
      <View style={styles.chead}>
        <BlurView intensity={30} tint="light" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, styles.cheadBg]} />
        {header}
        <View style={styles.px}>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={nb.startChat.seeTask(listing.title)}
            onPress={() => safePush(`/oppdrag/${listing.id}`)}
            style={[styles.pinned, shadow.card]}
          >
            <CategoryArt category={cat} uri={listing.images[0]?.url} width={52} height={52} radius={15} iconSize={24} />
            <View style={styles.pinnedText}>
              <Pill label={nb.startChat.open} tone="need" dot size="sm" style={styles.selfStart} />
              <Text style={[text.label, styles.f15]} numberOfLines={1}>
                {listing.title}
              </Text>
              <Text style={[text.meta, styles.f125]} numberOfLines={1}>
                {meta}
              </Text>
            </View>
            <Icon name="pinned" size={18} color={colors.faint} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        ref={scroll}
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {!started ? (
          <View>
            <View style={styles.hello}>
              <ScaleIn style={styles.avwrap}>
                <View style={styles.halo} />
                <PulseRing />
                <Avatar initials={owner.initials} uri={owner.avatarUrl} seed={owner.id} size={88} online />
              </ScaleIn>
              <FadeUp delay={100}>
                <Text style={[text.h2, styles.center]} accessibilityRole="header">
                  {nb.startChat.sayHi(first)}
                </Text>
              </FadeUp>
              {replyMinutes != null ? (
                <FadeUp delay={150} style={styles.replyRow}>
                  <Icon name="zap" size={14} color={colors.cyan2} />
                  <Text style={[text.meta, styles.f14]}>{nb.detail.replyWithin(replyTime(replyMinutes, true))}</Text>
                </FadeUp>
              ) : null}
              <FadeUp delay={150} style={styles.badges}>
                <VerifiedBadge label={nb.startChat.vipps} />
                {owner.rating?.count ? (
                  <View style={styles.stars}>
                    <Icon name="star" size={14} color={colors.star} filled />
                    <Text style={styles.starsVal}>{owner.rating.average.toFixed(1).replace('.', ',')}</Text>
                    <Text style={styles.starsMeta}>{`(${owner.rating.count})`}</Text>
                  </View>
                ) : null}
              </FadeUp>
            </View>

            <FadeUp delay={200} style={styles.tipc}>
              <View style={styles.ti2}>
                <Icon name="shield" size={18} color={colors.ok} />
              </View>
              <View style={styles.tipText}>
                <Text style={[text.label, styles.f145]}>{nb.startChat.tipTitle}</Text>
                <Text style={[text.meta, styles.tipBody]}>{nb.startChat.tipBody}</Text>
              </View>
            </FadeUp>

            <FadeUp delay={250}>
              <Text style={[text.eyebrow, styles.eyebrow]}>{nb.startChat.openersTitle}</Text>
            </FadeUp>
            <FadeUp delay={300} style={styles.openers}>
              {openers.map((o) => (
                <Pressable
                  key={o}
                  accessibilityRole="button"
                  onPress={() => setDraft(o)}
                  style={({ pressed }) => [styles.opener, pressed && styles.openerPressed]}
                >
                  <Text style={styles.openerText}>{o}</Text>
                </Pressable>
              ))}
            </FadeUp>
          </View>
        ) : (
          <View style={styles.thread}>
            <View style={styles.sysWrap}>
              <SystemMessage>{nb.startChat.today}</SystemMessage>
              <View style={styles.keepRow}>
                <Icon name="shield" size={14} color={colors.ok} />
                <Text style={[text.meta, styles.f125]}>{nb.startChat.keepHere}</Text>
              </View>
            </View>
            {msgs.map((m) => (
              <FadeUp key={m.id}>
                <Bubble outgoing showMeta={false}>
                  {m.text}
                </Bubble>
                <View style={styles.meta}>
                  <Text style={text.time}>{`${m.time} · `}</Text>
                  <Icon
                    name={m.status === 'sending' ? 'clock' : m.status === 'sent' ? 'check' : 'alert'}
                    size={14}
                    color={m.status === 'failed' ? colors.danger : colors.faint}
                  />
                  <Text style={[text.time, m.status === 'failed' && { color: colors.danger }]}>
                    {m.status === 'sending' ? nb.startChat.sending : m.status === 'sent' ? nb.startChat.sent : nb.startChat.failed}
                  </Text>
                  {m.status === 'failed' ? (
                    <Pressable accessibilityRole="button" onPress={() => retry(m)} hitSlop={10}>
                      <Text style={[text.time, styles.retry]}>{nb.startChat.retry}</Text>
                    </Pressable>
                  ) : null}
                </View>
              </FadeUp>
            ))}
            {done ? (
              <ScaleIn style={styles.bannerWrap}>
                <View style={styles.banner}>
                  <View style={styles.glow} />
                  <View style={styles.bannerRow}>
                    <View style={styles.icirc}>
                      <Icon name="msg" size={18} color={colors.ink} />
                    </View>
                    <View style={styles.tipText}>
                      <Text style={styles.bannerTitle}>{nb.startChat.bannerTitle}</Text>
                      <Text style={styles.bannerSub}>{nb.startChat.bannerSub(first)}</Text>
                    </View>
                  </View>
                  <Button
                    label={nb.startChat.continue}
                    variant="cyan"
                    iconRight="arrow"
                    onPress={() => router.replace(convId ? `/chat/${convId}` : '/innboks')}
                  />
                </View>
              </ScaleIn>
            ) : null}
          </View>
        )}
      </ScrollView>

      {/* composer */}
      <View style={[styles.composer, { paddingBottom: Math.max(28, insets.bottom + 12) }]}>
        <BlurView intensity={30} tint="light" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, styles.composerBg]} />
        <View style={[styles.cin, focused && styles.cinFocus]}>
          <TextInput
            value={draft}
            onChangeText={(v) => setDraft(v.slice(0, 1000))}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onSubmitEditing={send}
            returnKeyType="send"
            placeholder={nb.startChat.placeholder(first)}
            placeholderTextColor={colors.placeholder}
            accessibilityLabel={nb.startChat.inputLabel}
            style={styles.input}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={nb.startChat.send}
          accessibilityState={{ disabled: !canSend }}
          disabled={!canSend}
          onPress={send}
          style={[styles.sendb, canSend && [styles.sendOn, shadow.sendOn]]}
        >
          <Icon name="send" size={18} color={canSend ? colors.white : colors.faint} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

/** `.pulse` – cyan ring that radiates out every 1.8 s. */
function PulseRing() {
  const reduced = useReducedMotion();
  const p = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    p.set(withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.ease) }), -1, false));
  }, [reduced, p]);
  const style = useAnimatedStyle(() => ({
    opacity: 1 - p.value,
    transform: [{ scale: 1 + p.value * 0.3 }],
  }));
  if (reduced) return null;
  return <Animated.View style={[styles.pring, style]} pointerEvents="none" />;
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  px: { paddingHorizontal: screenPadding },
  center: { textAlign: 'center' },
  selfStart: { alignSelf: 'flex-start' },
  f125: { fontSize: 12.5 },
  f145: { fontSize: 14.5 },
  f15: { fontSize: 15 },
  skel: { marginTop: 20 },
  chead: { paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.line2, zIndex: 10, overflow: 'hidden' },
  cheadBg: { backgroundColor: colors.headBg },
  pinned: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 12,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  pinnedText: { flex: 1, minWidth: 0, gap: 5 },
  content: { paddingHorizontal: screenPadding, paddingTop: 20, paddingBottom: 20 },
  hello: { alignItems: 'center', gap: 6 },
  replyRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  f14: { fontSize: 14 },
  avwrap: { width: 104, height: 104, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  halo: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 52, backgroundColor: colors.halo },
  pring: { position: 'absolute', top: 8, left: 8, right: 8, bottom: 8, borderRadius: 44, borderWidth: 3, borderColor: colors.pulseCyan },
  badges: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  stars: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  starsVal: { fontFamily: text.label.fontFamily, fontSize: 13, color: colors.ink },
  starsMeta: { fontFamily: text.meta.fontFamily, fontSize: 13, color: colors.mute },
  tipc: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'flex-start',
    marginTop: 20,
  },
  ti2: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.okTint, alignItems: 'center', justifyContent: 'center' },
  tipText: { flex: 1, gap: 3 },
  tipBody: { fontSize: 13.5, lineHeight: 19, color: colors.ink2 },
  eyebrow: { marginTop: 22, marginBottom: 10 },
  openers: { alignItems: 'flex-start', gap: 8 },
  opener: {
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderBottomRightRadius: 22,
    borderBottomLeftRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.openerBorder,
    backgroundColor: colors.white,
    justifyContent: 'center',
  },
  openerPressed: { transform: [{ scale: 0.96 }] },
  openerText: { fontFamily: text.bodySemi.fontFamily, fontSize: 14.5, lineHeight: 19, color: colors.cyanDeep },
  thread: { gap: 8 },
  sysWrap: { alignItems: 'center', gap: 10, marginBottom: 6 },
  keepRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 3, marginTop: 4 },
  retry: { color: colors.cyanDeep, marginLeft: 6, textDecorationLine: 'underline' },
  bannerWrap: { marginTop: 8 },
  banner: { borderRadius: radius.listingCard, padding: 18, backgroundColor: colors.ink, gap: 12, overflow: 'hidden' },
  glow: { position: 'absolute', right: -50, top: -70, width: 180, height: 180, borderRadius: 90, backgroundColor: colors.lime, opacity: 0.35 },
  bannerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icirc: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  bannerTitle: { fontFamily: text.h3.fontFamily, fontSize: 17, letterSpacing: -0.17, color: colors.white },
  bannerSub: { fontFamily: text.body.fontFamily, fontSize: 13, color: colors.onInk75 },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: colors.line2,
    overflow: 'hidden',
  },
  composerBg: { backgroundColor: colors.footBg },
  cin: {
    flex: 1,
    height: 50,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingLeft: 18,
    paddingRight: 6,
    justifyContent: 'center',
  },
  cinFocus: { borderColor: colors.cyan2, backgroundColor: colors.white },
  input: { fontFamily: fonts.bodyMedium, fontSize: 15.5, color: colors.ink, height: '100%' },
  sendb: { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.progressTrack, alignItems: 'center', justifyContent: 'center' },
  sendOn: { backgroundColor: colors.ink },
});
