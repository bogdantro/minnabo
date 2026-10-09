import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import type { AgreementSnapshot, Conversation, Listing } from '@/domain/types';
import { categoryArtId } from '@/domain/categories';
import { formatPrice } from '@/domain/price';
import nb from '@/i18n/nb';
import { useKeyboardVisible } from '@/hooks/useKeyboardVisible';
import { colors, fonts, motion, radius, shadow, text } from '@/theme/theme';
import { listingPrice } from '@/components/OppdragCard';
import { Avatar, Button, CategoryArt, Chip, FadeUp, Icon, IconButton, Pill, ScaleIn, VerifiedIcon } from '@/components/ui';

/* ---------- header ---------- */

export function ChatTopBar({
  c,
  verified,
  online,
  typing,
  blocked,
  muted,
  onBack,
  onMore,
}: {
  c: Conversation;
  verified: boolean;
  online: boolean;
  typing: boolean;
  blocked: boolean;
  muted: boolean;
  onBack: () => void;
  onMore: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.chead, { paddingTop: insets.top + 10 }]}>
      <BlurView intensity={30} tint="light" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.cheadBg]} />
      <IconButton icon="back" variant="ghost" accessibilityLabel={nb.chat.back} onPress={onBack} />
      <View style={styles.who}>
        <Avatar initials={c.counterpart.initials} uri={c.counterpart.avatarUrl} seed={c.counterpart.id} size={48} ring={false} online={online && !blocked} />
        <View style={styles.whoText}>
          <View style={styles.nmRow}>
            <Text style={styles.nm} numberOfLines={1}>
              {c.counterpart.displayName}
            </Text>
            {verified ? <VerifiedIcon size={16} /> : null}
            {muted ? (
              <ScaleIn>
                <View style={styles.muteChip}>
                  <Text style={styles.muteText}>{nb.chat.mutedChip}</Text>
                </View>
              </ScaleIn>
            ) : null}
          </View>
          {blocked ? (
            <Text style={[styles.st, { color: colors.danger }]}>{nb.chat.blockedStatus}</Text>
          ) : typing ? (
            <Text style={[styles.st, { color: colors.cyanDeep }]}>{nb.chat.typing}</Text>
          ) : online ? (
            <View style={styles.stRow}>
              <View style={styles.stDot} />
              <Text style={styles.st}>{nb.chat.activeNow}</Text>
            </View>
          ) : null}
        </View>
      </View>
      <IconButton icon="more" accessibilityLabel={nb.chat.more} onPress={onMore} />
    </View>
  );
}

/* ---------- agreement banner ---------- */

export function AgreementBanner({
  agreement,
  place,
  onAgreement,
  onJobDay,
}: {
  agreement: AgreementSnapshot;
  place?: string;
  onAgreement: () => void;
  onJobDay: () => void;
}) {
  return (
    <ScaleIn>
      <View style={[styles.banner, shadow.okBanner]} testID="chat-job-facts" accessibilityRole="summary" accessibilityLabel={nb.chat.jobFactsLabel}>
        <View style={styles.bRow}>
          <View style={styles.bIc}>
            <Icon name="check" size={18} color={colors.white} />
          </View>
          <View style={styles.flex}>
            <Text style={[text.label, styles.f15]}>{nb.chat.bannerTitle(agreement.scheduledText)}</Text>
            <Text style={styles.bSub}>
              {[formatPrice(agreement.price), place].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <Pill label={nb.chat.agreed} tone="ok" icon="lock" size="sm" />
        </View>
        <View style={styles.bLinks}>
          <Button label={nb.chat.seeAgreement} iconRight="arrow" variant="ink" size="sm" block={false} onPress={onAgreement} style={styles.grow} />
          <Button label={nb.chat.jobDay} icon="brief" variant="ghost" size="sm" block={false} onPress={onJobDay} style={styles.grow} />
        </View>
      </View>
    </ScaleIn>
  );
}

/* ---------- collapsible oppdrag card ---------- */

export function ListingStrip({
  c,
  listing,
  agreed,
  offerCount,
  onOpen,
}: {
  c: Conversation;
  listing?: Listing;
  agreed: boolean;
  offerCount?: number;
  onOpen: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rot = useSharedValue(0);
  useEffect(() => {
    rot.set(withSpring(open ? 180 : 0, motion.spring));
  }, [open, rot]);
  const chev = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value}deg` }] }));
  const cat = categoryArtId(listing?.category.slug ?? 'annet');
  const price = c.notice ? '' : listing ? listingPrice(listing).value : nb.chat.wantsOffers;
  return (
    <View style={[styles.lst, shadow.card]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={nb.chat.cardA11y(c.listing.title)}
        onPress={() => setOpen((o) => !o)}
        style={styles.lstRow}
      >
        <CategoryArt category={cat} uri={c.listing.imageUrl} width={42} height={42} radius={13} iconSize={20} />
        <View style={styles.lstT}>
          {c.notice ? (
            <Pill label={nb.chat.notice} tone="offer" icon="pinned" size="sm" style={styles.selfStart} />
          ) : (
            <Pill label={nb.chat.needHelp} tone="need" dot size="sm" style={styles.selfStart} />
          )}
          <Text style={[text.label, styles.f145]} numberOfLines={1}>
            {c.listing.title}
          </Text>
        </View>
        <Text style={[styles.lstP, agreed && { color: colors.okText }]}>{agreed ? nb.chat.agreed : price}</Text>
        <Animated.View style={[styles.chevw, chev]}>
          <Icon name="down" size={18} color={colors.ink} />
        </Animated.View>
      </Pressable>
      {open ? (
        <FadeUp style={styles.lstMore}>
          {listing ? (
            <View style={styles.meta}>
              <Icon name="pin" size={15} color={colors.faint} />
              <Text style={[text.meta, styles.f13]}>{listing.location.place || listing.location.municipality}</Text>
            </View>
          ) : null}
          {listing?.task?.scheduledText ? (
            <View style={styles.meta}>
              <Icon name="cal" size={15} color={colors.faint} />
              <Text style={[text.meta, styles.f13]}>{[listing.task.scheduledText, listing.task.durationText].filter(Boolean).join(' · ')}</Text>
            </View>
          ) : null}
          {offerCount ? (
            <View style={styles.meta}>
              <Icon name="tag" size={15} color={colors.faint} />
              <Text style={[text.meta, styles.f13]}>
                <Text style={styles.bold}>{nb.chat.offersReceived(offerCount)}</Text> {nb.chat.received}
              </Text>
            </View>
          ) : null}
          <Button label={nb.chat.seeListing} iconRight="arrow" variant="ghost" size="sm" block={false} onPress={onOpen} style={styles.selfStartMt} />
        </FadeUp>
      ) : null}
    </View>
  );
}

/* ---------- pinned message ---------- */

export function PinBar({ textValue, onUnpin }: { textValue: string; onUnpin: () => void }) {
  return (
    <FadeUp>
      <View style={styles.pinbar}>
        <View style={styles.pi}>
          <Icon name="pinned" size={16} color={colors.limeDeep} />
        </View>
        <Text style={styles.pt} numberOfLines={1}>
          <Text style={styles.ptB}>{nb.chat.pinnedPrefix}</Text> {textValue}
        </Text>
        <IconButton icon="x" iconSize={16} variant="ghost" accessibilityLabel={nb.chat.unpinA11y} onPress={onUnpin} />
      </View>
    </FadeUp>
  );
}

/* ---------- composer ---------- */

export function Composer({
  first,
  onSend,
  onAttach,
  onTyping,
}: {
  first: string;
  onSend: (t: string) => void;
  onAttach: () => void;
  onTyping?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const keyboardOpen = useKeyboardVisible();
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const lastPing = useRef(0);
  const can = value.trim().length > 0;

  const change = (v: string) => {
    setValue(v);
    if (v && onTyping && Date.now() - lastPing.current > 2000) {
      lastPing.current = Date.now();
      onTyping();
    }
  };
  const submit = () => {
    const t = value.trim();
    if (!t) return;
    onSend(t);
    setValue('');
  };

  return (
    <View style={[styles.composer, { paddingBottom: keyboardOpen ? 10 : Math.max(26, insets.bottom + 10) }]}>
      <BlurView intensity={30} tint="light" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.composerBg]} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.qr}
        accessibilityLabel={nb.chat.quickRepliesLabel}
      >
        {nb.chat.quickReplies.map((q) => (
          <Chip key={q} label={q} size="sm" onPress={() => onSend(q)} accessibilityLabel={q} style={styles.qrChip} />
        ))}
      </ScrollView>
      <View style={styles.crow}>
        <IconButton icon="plus" accessibilityLabel={nb.chat.attachA11y} onPress={onAttach} />
        <View style={[styles.cin, focused && [styles.cinFocus, shadow.focus]]}>
          <TextInput
            value={value}
            onChangeText={change}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onSubmitEditing={submit}
            returnKeyType="send"
            placeholder={nb.chat.inputPlaceholder}
            placeholderTextColor={colors.placeholder}
            accessibilityLabel={nb.chat.composerA11y(first)}
            style={styles.input}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={nb.chat.sendMessageA11y}
          accessibilityState={{ disabled: !can }}
          disabled={!can}
          onPress={submit}
          style={({ pressed }) => [styles.sendb, can ? [styles.sendOn, shadow.btnLime] : styles.sendOff, pressed && styles.pressed]}
        >
          <Icon name="send" size={18} color={can ? colors.ink : colors.typingDot} />
        </Pressable>
      </View>
    </View>
  );
}

export function BlockedBar({ first, onUnblock }: { first: string; onUnblock: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.composer, { paddingBottom: Math.max(26, insets.bottom + 10) }]}>
      <View style={[StyleSheet.absoluteFill, styles.composerBg]} />
      <FadeUp style={styles.blocked}>
        <Icon name="ban" size={22} color={colors.danger} />
        <Text style={styles.blockedText}>{nb.chat.blockedInfo(first)}</Text>
        <Button label={nb.chat.unblock} variant="dangerGhost" size="sm" block={false} onPress={onUnblock} />
      </FadeUp>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  grow: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto' },
  bold: { fontFamily: text.label.fontFamily, color: colors.ink },
  pressed: { transform: [{ scale: 0.9 }] },
  selfStart: { alignSelf: 'flex-start' },
  selfStartMt: { alignSelf: 'flex-start', marginTop: 4 },
  f13: { fontSize: 13 },
  f145: { fontSize: 14.5 },
  f15: { fontSize: 15 },
  chead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line2,
    overflow: 'hidden',
    zIndex: 6,
  },
  cheadBg: { backgroundColor: colors.navBg },
  who: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 11, paddingLeft: 2 },
  whoText: { flex: 1, minWidth: 0 },
  nmRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nm: { fontFamily: text.label.fontFamily, fontSize: 16.5, lineHeight: 19, color: colors.ink, flexShrink: 1 },
  muteChip: { height: 20, paddingHorizontal: 7, borderRadius: radius.pill, backgroundColor: colors.neutralPill, justifyContent: 'center' },
  muteText: { fontFamily: text.label.fontFamily, fontSize: 10.5, color: colors.ink2 },
  stRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  stDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.onlineDot },
  st: { fontFamily: text.bodySemi.fontFamily, fontSize: 12.5, lineHeight: 15, color: colors.okText, marginTop: 3 },
  banner: { borderRadius: 20, padding: 12, backgroundColor: colors.okTint, borderWidth: 1, borderColor: colors.okBannerBorder, gap: 10 },
  bRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  bIc: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.ok, alignItems: 'center', justifyContent: 'center' },
  bSub: { fontFamily: text.body.fontFamily, fontSize: 12.5, color: colors.okBannerText },
  bLinks: { flexDirection: 'row', gap: 8 },
  lst: { backgroundColor: colors.white, borderRadius: 20, borderWidth: 1, borderColor: colors.hairline, overflow: 'hidden' },
  lstRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 7, paddingLeft: 7, paddingRight: 8, minHeight: 56 },
  lstT: { flex: 1, minWidth: 0, gap: 4 },
  lstP: { fontFamily: text.label.fontFamily, fontSize: 13, color: colors.ink2 },
  chevw: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  lstMore: { paddingTop: 2, paddingRight: 14, paddingBottom: 14, paddingLeft: 60, gap: 8 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pinbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
    paddingRight: 4,
    paddingLeft: 12,
    borderRadius: 16,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    minHeight: 48,
  },
  pi: { width: 28, height: 28, borderRadius: 9, backgroundColor: colors.limeTint, alignItems: 'center', justifyContent: 'center' },
  pt: { flex: 1, minWidth: 0, fontFamily: text.body.fontFamily, fontSize: 13.5, lineHeight: 17.5, color: colors.ink2 },
  ptB: { fontFamily: text.label.fontFamily, color: colors.ink },
  composer: { borderTopWidth: 1, borderTopColor: colors.line2, paddingTop: 10, overflow: 'hidden', zIndex: 6 },
  composerBg: { backgroundColor: colors.footBg },
  qr: { gap: 8, paddingHorizontal: 12, paddingBottom: 10 },
  qrChip: { backgroundColor: colors.surface2 },
  crow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  cin: {
    flex: 1,
    minWidth: 0,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.surface2,
    borderWidth: 1.5,
    borderColor: colors.line,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  cinFocus: { borderColor: colors.cyan2, backgroundColor: colors.white },
  input: { height: '100%', fontFamily: fonts.bodyMedium, fontSize: 15.5, color: colors.ink },
  sendb: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  sendOn: { backgroundColor: colors.lime },
  sendOff: { backgroundColor: colors.track },
  blocked: { marginHorizontal: 12, padding: 14, borderRadius: 18, backgroundColor: colors.dangerTint, flexDirection: 'row', alignItems: 'center', gap: 12 },
  blockedText: { flex: 1, fontFamily: text.body.fontFamily, fontSize: 13.5, lineHeight: 19, color: colors.dangerDark },
});
