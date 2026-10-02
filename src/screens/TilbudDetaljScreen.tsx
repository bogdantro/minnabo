import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import type { ProposalStatus } from '@/domain/types';
import { categoryArtId } from '@/domain/categories';
import { formatPrice } from '@/domain/price';
import nb from '@/i18n/nb';
import { apiClient } from '@/api/client';
import {
  useListing,
  useProfile,
  useProposal,
  useProposalsForListing,
  useRespondToProposal,
  useReviseProposal,
} from '@/api/queries';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { formatTime, shortDate } from '@/lib/datetime';
import { haptics } from '@/lib/haptics';
import { safePush } from '@/lib/nav';
import { toast } from '@/lib/toast';
import { colors, motion, radius, screenPadding, shadow, text } from '@/theme/theme';
import { FallbackScreen } from '@/components/FallbackScreen';
import { AcceptedOverlay, AvslaSheet, EndringSheet, GodtaSheet, type AgreementSummary } from '@/components/TilbudSheets';
import {
  Avatar,
  Button,
  CategoryArt,
  Dialog,
  FadeUp,
  FooterRow,
  Icon,
  IconButton,
  Note,
  PaymentNote,
  Pill,
  type PillTone,
  ScaleIn,
  Sheet,
  StickyFooter,
  TextLink,
  VerifiedBadge,
  type IconKey,
} from '@/components/ui';

const logo = require('../../assets/logo-icon.png');
const TONE: Record<ProposalStatus, PillTone> = {
  SENT: 'dark',
  REVISION_PENDING: 'warn',
  ACCEPTED: 'ok',
  DECLINED: 'danger',
  WITHDRAWN: 'neutral',
  DRAFT: 'neutral',
  CANCELLED: 'danger',
};
const kr = (n: number) => formatPrice({ amountMinor: n * 100, currency: 'NOK' });
const stamp = (iso: string) => `${shortDate(iso).replace(/^\S+ /, '')} kl. ${formatTime(iso)}`;

type SheetKind = 'godta' | 'avsla' | 'endring' | 'menu' | null;

/** Tilbudsdetaljer (design/screens/TilbudDetaljer.dc.html) – recipient and sender views. */
export function TilbudDetaljScreen({ proposalId }: { proposalId: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const me = useCurrentUser();
  const { data: proposal, isLoading, isError, refetch } = useProposal(proposalId);
  const { data: listing } = useListing(proposal?.listingId ?? '');
  const siblings = useProposalsForListing(proposal?.listingId ?? '');
  const isSender = !!proposal && proposal.fromProfileId === me.id;
  const otherId = proposal ? (isSender ? proposal.toProfileId : proposal.fromProfileId) : '';
  const { data: other } = useProfile(otherId);
  const { data: helper } = useProfile(proposal?.fromProfileId ?? '');
  const respond = useRespondToProposal(proposal?.conversationId ?? '');
  const revise = useReviseProposal();

  const [sheet, setSheet] = useState<SheetKind>(null);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [success, setSuccess] = useState(false);
  // A decline is held for the toast's "Angre" window before it is sent (DECLINED is final).
  const [pendingDecline, setPendingDecline] = useState<string[] | null>(null);
  const declineTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const commitDecline = useRef<() => void>(() => undefined);

  useEffect(
    () => () => {
      if (declineTimer.current) {
        clearTimeout(declineTimer.current);
        commitDecline.current();
      }
    },
    [],
  );

  if (!proposal) {
    return (
      <FallbackScreen
        status={isError ? 'error' : isLoading ? 'loading' : 'empty'}
        onRetry={() => refetch()}
        emptyText={nb.tilbudDetalj.notFound}
        title={nb.tilbud.detailTitle}
      />
    );
  }

  const status: ProposalStatus = pendingDecline ? 'DECLINED' : proposal.status;
  const first = (other?.displayName ?? '').split(' ')[0];
  const helperName = helper?.displayName ?? '';
  const helperFirst = helperName.split(' ')[0];
  const priceKr = Math.round(proposal.price.amountMinor / 100);
  const budgetKr = listing?.price && listing.priceMode !== 'BY_AGREEMENT' ? Math.round(listing.price.amountMinor / 100) : null;
  const diff = budgetKr != null ? priceKr - budgetKr : null;
  const [whenMain, whenTime] = (proposal.scheduledText ?? '').split(/ (?=kl\. )/);
  const duration = listing?.task?.durationText;
  const place = listing?.location.place || listing?.location.municipality;
  const cat = categoryArtId(listing?.category.slug ?? 'annet');
  const openOthers = (siblings.data ?? []).filter(
    (p) => p.id !== proposal.id && (p.status === 'SENT' || p.status === 'REVISION_PENDING'),
  );
  const canRespond = !isSender && (status === 'SENT' || status === 'REVISION_PENDING');
  const caveats = (proposal.caveats ?? '')
    .split(/(?<=\.)\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const summary: AgreementSummary = {
    task: listing?.title ?? '',
    helper: helperName,
    price: formatPrice(proposal.price),
    when: proposal.scheduledText,
    duration,
    place,
    caveats: proposal.caveats,
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace('/tilbud'));
  const openChat = () => safePush(`/chat/${proposal.conversationId}`);

  const accept = async () => {
    try {
      await respond.mutateAsync({ proposalId, event: 'ACCEPT', actor: 'RECIPIENT' });
      haptics.success();
      setSheet(null);
      setSuccess(true);
      return true;
    } catch {
      toast.error(nb.toast.genericError);
      return false;
    }
  };

  const decline = (reasons: string[]) => {
    setSheet(null);
    setPendingDecline(reasons);
    commitDecline.current = () => {
      declineTimer.current = undefined;
      respond.mutate(
        { proposalId, event: 'DECLINE', actor: 'RECIPIENT' },
        {
          onSuccess: () => {
            setPendingDecline(null);
            if (reasons.length) void apiClient.sendMessage(proposal.conversationId, `${reasons.join('. ')}.`).catch(() => undefined);
          },
          onError: () => {
            setPendingDecline(null);
            toast.error(nb.toast.genericError);
          },
        },
      );
    };
    declineTimer.current = setTimeout(() => commitDecline.current(), motion.durations.toastVisible + 400);
    toast.info(nb.tilbudDetalj.declinedToast(first), {
      icon: 'x',
      bottom: 190,
      action: {
        label: nb.tilbudDetalj.undo,
        onPress: () => {
          clearTimeout(declineTimer.current);
          declineTimer.current = undefined;
          setPendingDecline(null);
        },
      },
    });
  };

  const requestChange = (concerns: string[], message: string) => {
    const text = [nb.tilbudDetalj.changeConcerns(concerns.join(', ').toLowerCase()), message].filter(Boolean).join(' ');
    revise.mutate(
      { proposalId, patch: { message: text } },
      {
        onSuccess: () => {
          setSheet(null);
          toast.success(nb.tilbudDetalj.changeSent(first), { icon: 'send', bottom: 190 });
        },
        onError: () => toast.error(nb.toast.genericError),
      },
    );
  };

  const withdraw = async () => {
    try {
      await respond.mutateAsync({ proposalId, event: 'WITHDRAW', actor: 'PROPOSER' });
      setWithdrawOpen(false);
      toast.info(nb.tilbudDetalj.withdrawnToast(first), { icon: 'undo', bottom: 190 });
    } catch {
      toast.error(nb.toast.genericError);
    }
  };

  // status banner
  const banner: { bg: string; fg: string; icon: IconKey; text: string; link?: boolean } | null =
    status === 'REVISION_PENDING'
      ? { bg: colors.warnTint, fg: colors.warn, icon: 'edit', text: isSender ? nb.tilbudDetalj.bannerChangeThem(first) : nb.tilbudDetalj.bannerChangeMe(first) }
      : status === 'ACCEPTED'
        ? { bg: colors.okTint, fg: colors.okText, icon: 'check', text: nb.tilbudDetalj.bannerAccepted, link: true }
        : status === 'DECLINED'
          ? { bg: colors.dangerTint, fg: colors.danger, icon: 'x', text: isSender ? nb.tilbudDetalj.bannerDeclinedThem(first) : nb.tilbudDetalj.bannerDeclinedMe(first) }
          : status === 'WITHDRAWN'
            ? { bg: colors.neutralPill, fg: colors.ink2, icon: 'undo', text: isSender ? nb.tilbudDetalj.bannerWithdrawnMe : nb.tilbudDetalj.bannerWithdrawnThem(first) }
            : null;

  // timeline
  const steps: { title: string; sub?: string; tone: 'done' | 'now' | 'warn' | 'next' | 'danger' | 'mute'; icon: IconKey }[] = [
    { title: nb.tilbudDetalj.tlSent, sub: stamp(proposal.createdAt), tone: 'done', icon: 'check' },
  ];
  if (status === 'SENT')
    steps.push({
      title: isSender ? nb.tilbudDetalj.tlWaitingThem(first) : nb.tilbudDetalj.tlWaitingMe,
      sub: isSender ? nb.tilbudDetalj.tlWaitingSubThem : nb.tilbudDetalj.tlWaitingSub,
      tone: 'now',
      icon: 'hourglass',
    });
  if (status === 'REVISION_PENDING')
    steps.push({ title: nb.tilbudDetalj.tlChange, sub: nb.tilbudDetalj.tlChangeSub(helperFirst), tone: 'warn', icon: 'edit' });
  if (status === 'ACCEPTED') {
    steps.push({ title: nb.tilbudDetalj.tlAccepted, tone: 'done', icon: 'check' });
    if (proposal.scheduledText) steps.push({ title: nb.tilbudDetalj.tlJobDay, sub: proposal.scheduledText, tone: 'next', icon: 'cal' });
  }
  if (status === 'DECLINED')
    steps.push({ title: nb.tilbudDetalj.tlDeclined, sub: isSender ? undefined : nb.tilbudDetalj.tlDeclinedSub(first), tone: 'danger', icon: 'x' });
  if (status === 'WITHDRAWN')
    steps.push({ title: nb.tilbudDetalj.tlWithdrawn, sub: nb.tilbudDetalj.tlWithdrawnSub, tone: 'mute', icon: 'undo' });

  const hasFoot = canRespond || (!isSender && status === 'ACCEPTED') || status === 'DECLINED' || status === 'WITHDRAWN' || isSender;

  return (
    <View style={styles.wrap}>
      <ScrollView contentContainerStyle={{ paddingBottom: (hasFoot ? 190 : 40) + insets.bottom }} showsVerticalScrollIndicator={false}>
        <View style={[styles.dbar, { paddingTop: insets.top + 12 }]}>
          <IconButton icon="back" accessibilityLabel="Tilbake" onPress={back} />
          <View style={styles.mid}>
            <Image source={logo} style={styles.logo} />
            <Text style={styles.midText} numberOfLines={1} accessibilityRole="header">
              {isSender ? nb.tilbudDetalj.titleMine : nb.tilbudDetalj.titleFrom(first)}
            </Text>
          </View>
          <IconButton icon="more" accessibilityLabel={nb.tilbudDetalj.more} onPress={() => setSheet('menu')} />
        </View>

        {/* listing context */}
        {listing ? (
          <FadeUp style={styles.px}>
            <Pressable accessibilityRole="link" onPress={() => safePush(`/oppdrag/${listing.id}`)} style={styles.ctx}>
              <CategoryArt category={cat} uri={listing.images[0]?.url} width={44} height={44} radius={14} iconSize={22} />
              <View style={styles.ctxText}>
                <Pill label={nb.tilbudDetalj.openTask} tone="need" dot size="sm" style={styles.selfStart} />
                <Text style={[text.label, styles.f145]} numberOfLines={1}>
                  {listing.title}
                </Text>
              </View>
              <Icon name="right" size={18} color={colors.faint} />
            </Pressable>
          </FadeUp>
        ) : null}

        {banner ? (
          <ScaleIn style={[styles.px, styles.mt12]}>
            <View style={[styles.banner, { backgroundColor: banner.bg }]}>
              <View style={styles.bannerIc}>
                <Icon name={banner.icon} size={16} color={banner.fg} />
              </View>
              <Text style={[styles.bannerText, { color: banner.fg }]}>{banner.text}</Text>
              {banner.link && !isSender ? (
                <TextLink label={nb.tilbudDetalj.seeAgreement} onPress={() => safePush(`/avtale/${proposalId}`)} style={styles.bannerLink} />
              ) : null}
            </View>
          </ScaleIn>
        ) : null}

        {/* helper / counterpart card */}
        <FadeUp delay={50} style={[styles.px, styles.mt14]}>
          <View style={[styles.card, styles.pad18, shadow.card]}>
            <View style={styles.row14}>
              <Avatar initials={other?.initials ?? '·'} uri={other?.avatarUrl} seed={otherId} size={64} />
              <View style={styles.helperText}>
                <Text style={text.eyebrow}>
                  {isSender ? nb.tilbudDetalj.eyebrowMine(other?.displayName ?? '') : nb.tilbudDetalj.eyebrowFrom}
                </Text>
                <Text style={text.h3} numberOfLines={1}>
                  {other?.displayName ?? ' '}
                </Text>
                <View style={styles.row8}>
                  {other?.rating?.count ? (
                    <View style={styles.stars}>
                      <Icon name="star" size={14} color={colors.star} filled />
                      <Text style={styles.starsVal}>{other.rating.average.toFixed(1).replace('.', ',')}</Text>
                      <Text style={styles.starsMeta}>{`(${other.rating.count})`}</Text>
                    </View>
                  ) : null}
                  {other?.location.place || other?.location.municipality ? (
                    <Text style={text.meta}>{`· ${other.location.place || other.location.municipality}`}</Text>
                  ) : null}
                </View>
              </View>
              <Pill label={nb.mottatte.status[status]} tone={TONE[status]} />
            </View>
            <View style={styles.vchips}>
              <View style={[styles.vchip, styles.vchipOk]}>
                <VerifiedBadge label={nb.tilbudDetalj.vipps} size={14} />
              </View>
              {other?.verifications.some((v) => v.kind === 'PHONE' && v.verified) ? (
                <View style={styles.vchip}>
                  <Icon name="phone" size={14} color={colors.ink2} />
                  <Text style={styles.vchipText}>{nb.tilbudDetalj.phone}</Text>
                </View>
              ) : null}
              {other?.completedTasks ? (
                <View style={styles.vchip}>
                  <Icon name="award" size={14} color={colors.ink2} />
                  <Text style={styles.vchipText}>{nb.tilbudDetalj.completed(other.completedTasks)}</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.divider} />
            <View style={styles.between}>
              <Text style={text.meta}>{other?.memberSince ? nb.tilbudDetalj.memberSince(other.memberSince) : ''}</Text>
              <TextLink label={nb.tilbudDetalj.profile} onPress={() => safePush(`/profil/${otherId}`)} />
            </View>
          </View>
        </FadeUp>

        {/* price */}
        <FadeUp delay={100} style={[styles.px, styles.mt12]}>
          <View style={[styles.card, styles.pad20, shadow.card]}>
            <View style={styles.priceBlob} />
            <View style={styles.between}>
              <Text style={text.eyebrow}>{nb.tilbudDetalj.priceTitle}</Text>
              {diff != null ? (
                <Pill
                  label={diff === 0 ? nb.tilbudDetalj.same : diff < 0 ? nb.tilbudDetalj.under(kr(-diff)) : nb.tilbudDetalj.over(kr(diff))}
                  tone={diff > 0 ? 'warn' : 'ok'}
                  icon={diff < 0 ? 'down' : diff > 0 ? 'up' : undefined}
                />
              ) : null}
            </View>
            <Text style={styles.display}>{formatPrice(proposal.price)}</Text>
            {budgetKr != null ? (
              <>
                <Text style={[text.meta, styles.mt6]}>
                  {isSender ? nb.tilbudDetalj.budgetTheirs(first, kr(budgetKr)) : nb.tilbudDetalj.budgetMine(kr(budgetKr))}
                </Text>
                <PriceBar price={priceKr} budget={budgetKr} />
              </>
            ) : null}
            <View style={styles.noteBox}>
              <PaymentNote />
            </View>
          </View>
        </FadeUp>

        {/* schedule */}
        {proposal.scheduledText || duration ? (
          <FadeUp delay={150} style={[styles.px, styles.mt12, styles.tiles]}>
            {proposal.scheduledText ? (
              <View style={[styles.tile, shadow.card]}>
                <View style={[styles.tileIc, { backgroundColor: colors.limeTint }]}>
                  <Icon name="cal" size={18} color={colors.limeDeep} />
                </View>
                <Text style={text.meta}>{nb.tilbudDetalj.when}</Text>
                <Text style={[text.num, styles.f18]}>{whenMain}</Text>
                {whenTime ? <Text style={text.meta}>{whenTime}</Text> : null}
              </View>
            ) : null}
            {duration ? (
              <View style={[styles.tile, shadow.card]}>
                <View style={[styles.tileIc, { backgroundColor: colors.cyanTint }]}>
                  <Icon name="clock" size={18} color={colors.cyanDeep} />
                </View>
                <Text style={text.meta}>{nb.tilbudDetalj.duration}</Text>
                <Text style={[text.num, styles.f18]}>{duration}</Text>
              </View>
            ) : null}
          </FadeUp>
        ) : null}

        {proposal.message ? (
          <FadeUp delay={200} style={[styles.px, styles.mt22]}>
            <Text style={[text.eyebrow, styles.mb10]}>{nb.tilbudDetalj.messageFrom(helperFirst)}</Text>
            <View style={styles.msgRow}>
              <Avatar initials={helper?.initials ?? '·'} uri={helper?.avatarUrl} seed={proposal.fromProfileId} size={32} ring={false} />
              <View style={styles.quote}>
                <Text style={styles.quoteText}>{proposal.message}</Text>
              </View>
            </View>
          </FadeUp>
        ) : null}

        {caveats.length ? (
          <FadeUp delay={250} style={[styles.px, styles.mt18]}>
            <View style={[styles.card, styles.cavCard, shadow.card]}>
              <View style={[styles.row10, styles.mb10]}>
                <View style={styles.cavIc}>
                  <Icon name="alert" size={16} color={colors.warn} />
                </View>
                <Text style={[text.label, styles.f155]}>{nb.tilbudDetalj.caveats}</Text>
              </View>
              <View style={styles.gap8}>
                {caveats.map((c) => (
                  <View key={c} style={styles.row10}>
                    <Icon name="check" size={16} color={colors.warn} />
                    <Text style={[text.body, styles.f145, styles.flexShrink]}>{c}</Text>
                  </View>
                ))}
              </View>
            </View>
          </FadeUp>
        ) : null}

        {/* timeline */}
        <FadeUp delay={300} style={[styles.px, styles.mt12]}>
          <View style={[styles.card, styles.pad18, shadow.card]}>
            <Text style={[text.eyebrow, styles.mb14]}>{nb.tilbudDetalj.statusTitle}</Text>
            {steps.map((s, i) => {
              const last = i === steps.length - 1;
              const dot = DOT[s.tone];
              return (
                <View key={`${s.title}-${i}`} style={[styles.tli, last && styles.tliLast]}>
                  {!last ? <View style={[styles.tline, s.tone === 'done' && styles.tlineDone]} /> : null}
                  <View style={[styles.tdot, { backgroundColor: dot.bg }]}>
                    <Icon name={s.icon} size={14} color={dot.fg} />
                  </View>
                  <View style={styles.tliText}>
                    <Text style={[text.label, styles.f15]}>{s.title}</Text>
                    {s.sub ? <Text style={text.meta}>{s.sub}</Text> : null}
                  </View>
                </View>
              );
            })}
          </View>
        </FadeUp>

        {!isSender && status !== 'ACCEPTED' && openOthers.length ? (
          <FadeUp delay={350} style={[styles.px, styles.mt12]}>
            <Pressable
              accessibilityRole="link"
              onPress={() => safePush(`/tilbud/sammenlign/${proposal.listingId}`)}
              style={[styles.ctx, styles.compare]}
            >
              <View style={styles.cmpIc}>
                <Icon name="chart" size={18} color={colors.cyanDeep} />
              </View>
              <View style={styles.ctxText}>
                <Text style={[text.label, styles.f15]}>{nb.tilbudDetalj.compare(openOthers.length)}</Text>
                <OtherNames ids={openOthers.map((p) => p.fromProfileId)} />
              </View>
              <Icon name="right" size={18} color={colors.faint} />
            </Pressable>
          </FadeUp>
        ) : null}

        <View style={[styles.px, styles.mt18]}>
          <Note icon="shield">{nb.tilbudDetalj.safety}</Note>
        </View>
      </ScrollView>

      {/* footer */}
      {canRespond ? (
        <StickyFooter>
          <FooterRow>
            <Button label={nb.tilbudDetalj.decline} icon="x" variant="dangerGhost" block={false} onPress={() => setSheet('avsla')} style={styles.grow1} />
            <Button label={nb.tilbudDetalj.requestChange} icon="edit" variant="ghost" block={false} onPress={() => setSheet('endring')} style={styles.grow13} />
          </FooterRow>
          <Button label={nb.tilbudDetalj.accept} icon="check" size="lg" onPress={() => setSheet('godta')} style={styles.mt10} />
        </StickyFooter>
      ) : !isSender && status === 'ACCEPTED' ? (
        <StickyFooter>
          <FooterRow>
            <Button label={nb.tilbudDetalj.openChat} icon="msg" variant="ghost" block={false} onPress={openChat} style={styles.grow1} />
            <Button label={nb.tilbudDetalj.seeAgreement} iconRight="arrow" block={false} onPress={() => safePush(`/avtale/${proposalId}`)} style={styles.grow13} />
          </FooterRow>
        </StickyFooter>
      ) : status === 'DECLINED' || status === 'WITHDRAWN' || (isSender && status === 'ACCEPTED') ? (
        <StickyFooter>
          <View style={styles.closedRow}>
            <Icon name={status === 'ACCEPTED' ? 'check' : status === 'DECLINED' ? 'x' : 'undo'} size={18} color={colors.ink} />
            <Text style={[text.label, styles.f145]}>
              {status === 'ACCEPTED'
                ? nb.tilbudDetalj.closedAcceptedThem(first)
                : status === 'DECLINED'
                  ? isSender
                    ? nb.tilbudDetalj.closedDeclinedThem(first)
                    : nb.tilbudDetalj.closedDeclinedMe
                  : isSender
                    ? nb.tilbudDetalj.closedWithdrawnMe
                    : nb.tilbudDetalj.closedWithdrawnThem(first)}
            </Text>
          </View>
          <Button label={nb.tilbudDetalj.backToOffers} variant="ghost" onPress={() => router.replace(isSender ? '/' : '/tilbud')} style={styles.mt10} />
        </StickyFooter>
      ) : isSender ? (
        <StickyFooter>
          <Text style={[text.meta, styles.center]}>{nb.tilbudDetalj.senderWaiting(first)}</Text>
          <Button label={nb.tilbudDetalj.withdraw} icon="undo" variant="dangerGhost" onPress={() => setWithdrawOpen(true)} style={styles.mt10} />
        </StickyFooter>
      ) : null}

      {!isSender ? (
        <>
          <GodtaSheet visible={sheet === 'godta'} onClose={() => setSheet(null)} first={helperFirst} summary={summary} onConfirm={accept} />
          <AvslaSheet visible={sheet === 'avsla'} onClose={() => setSheet(null)} first={helperFirst} onConfirm={decline} />
          <EndringSheet
            visible={sheet === 'endring'}
            onClose={() => setSheet(null)}
            first={helperFirst}
            onSend={requestChange}
            sending={revise.isPending}
          />
        </>
      ) : null}

      <Sheet visible={sheet === 'menu'} onClose={() => setSheet(null)}>
        <MenuRow icon="msg" label={nb.tilbudDetalj.menuChat(first)} onPress={() => { setSheet(null); openChat(); }} />
        <MenuRow icon="user" label={nb.tilbudDetalj.menuProfile(first)} onPress={() => { setSheet(null); safePush(`/profil/${otherId}`); }} />
        <MenuRow
          icon="flag"
          danger
          last
          label={nb.tilbudDetalj.menuReport}
          onPress={() => {
            setSheet(null);
            safePush(`/rapporter?profil=${otherId}`);
          }}
        />
      </Sheet>

      <Dialog
        visible={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        icon="undo"
        tone="danger"
        title={nb.tilbudDetalj.withdrawTitle}
        body={nb.tilbudDetalj.withdrawBody(first, formatPrice(proposal.price))}
        confirmLabel={nb.tilbudDetalj.withdraw}
        confirmVariant="danger"
        cancelLabel={nb.tilbudDetalj.cancel}
        onConfirm={withdraw}
        loading={respond.isPending}
      />

      {success ? (
        <AcceptedOverlay
          first={helperFirst}
          meInitials={me.initials}
          meAvatar={me.avatarUrl}
          them={{ initials: helper?.initials ?? '·', avatarUrl: helper?.avatarUrl, id: proposal.fromProfileId }}
          summary={summary}
          onClose={() => setSuccess(false)}
          onAgreement={() => router.replace(`/avtale/${proposalId}`)}
          onChat={openChat}
        />
      ) : null}
    </View>
  );
}

const DOT = {
  done: { bg: colors.ok, fg: colors.white },
  now: { bg: colors.ink, fg: colors.lime },
  warn: { bg: colors.warnTint, fg: colors.warn },
  next: { bg: colors.limeTint, fg: colors.limeDeep },
  danger: { bg: colors.dangerTint, fg: colors.danger },
  mute: { bg: colors.neutralPill, fg: colors.ink2 },
};

/** `.pricebar` – 0 → max scale with the price filled and a budget marker. */
function PriceBar({ price, budget }: { price: number; budget: number }) {
  const reduced = useReducedMotion();
  const max = Math.max(Math.round(budget / 0.75 / 100) * 100, Math.ceil((price * 1.1) / 100) * 100);
  const fill = Math.min(price / max, 1);
  const mark = budget / max;
  const p = useSharedValue(reduced ? fill : 0);
  useEffect(() => {
    if (!reduced) p.set(withDelay(300, withTiming(fill, { duration: 1100, easing: Easing.bezier(...motion.ease) })));
  }, [fill, reduced, p]);
  const bar = useAnimatedStyle(() => ({ width: `${p.value * 100}%` }));
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.pricebar}>
        <Animated.View style={[styles.priceFill, bar]} />
        <View style={[styles.mk, { left: `${mark * 100}%` }]} />
      </View>
      <View style={styles.scale}>
        <Text style={[styles.scaleText, styles.scaleStart]}>0 kr</Text>
        <Text
          style={[
            styles.scaleText,
            styles.scaleMid,
            // Near the right end, end the label at the marker so it never collides with the max label.
            mark > 0.6 ? { right: `${(1 - mark) * 100}%`, textAlign: 'right', marginRight: 4 } : { left: `${mark * 100}%`, marginLeft: -60, width: 120 },
          ]}
          numberOfLines={1}
        >
          {nb.tilbudDetalj.budgetMark(kr(budget).replace(/\s*kr$/, ''))}
        </Text>
        <Text style={[styles.scaleText, styles.scaleEnd]}>{kr(max)}</Text>
      </View>
    </View>
  );
}

function OtherNames({ ids }: { ids: string[] }) {
  return (
    <Text style={text.meta} numberOfLines={1}>
      {ids.slice(0, 3).map((id, i) => (
        <OtherName key={id} id={id} sep={i > 0} />
      ))}
    </Text>
  );
}

function OtherName({ id, sep }: { id: string; sep: boolean }) {
  const { data } = useProfile(id);
  return <Text>{`${sep ? ' · ' : ''}${data?.displayName ?? ''}`}</Text>;
}

function MenuRow({ icon, label, onPress, danger, last }: { icon: IconKey; label: string; onPress: () => void; danger?: boolean; last?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.menuRow, !last && styles.menuLine]}>
      <View style={[styles.menuIc, danger && { backgroundColor: colors.dangerTint }]}>
        <Icon name={icon} size={18} color={danger ? colors.danger : colors.ink} />
      </View>
      <Text style={[styles.menuText, danger && { color: colors.danger }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  px: { paddingHorizontal: screenPadding },
  center: { textAlign: 'center' },
  selfStart: { alignSelf: 'flex-start' },
  flexShrink: { flexShrink: 1 },
  f145: { fontSize: 14.5 },
  f15: { fontSize: 15 },
  f155: { fontSize: 15.5 },
  f18: { fontSize: 18, lineHeight: 21 },
  mt6: { marginTop: 6 },
  mt10: { marginTop: 10 },
  mt12: { marginTop: 12 },
  mt14: { marginTop: 14 },
  mt18: { marginTop: 18 },
  mt22: { marginTop: 22 },
  mb10: { marginBottom: 10 },
  mb14: { marginBottom: 14 },
  gap8: { gap: 8 },
  row8: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  row10: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  row14: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  grow1: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto' },
  grow13: { flexGrow: 1.3, flexShrink: 1, flexBasis: 'auto' },
  dbar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 10 },
  mid: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  logo: { width: 24, height: 24 },
  midText: { fontFamily: text.label.fontFamily, fontSize: 17, color: colors.ink, flexShrink: 1 },
  ctx: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: colors.glassBg,
    borderWidth: 1,
    borderColor: colors.line,
  },
  ctxText: { flex: 1, minWidth: 0, gap: 5 },
  compare: { backgroundColor: colors.white, padding: 14 },
  cmpIc: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.cyanTint, alignItems: 'center', justifyContent: 'center' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 18 },
  bannerIc: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  bannerText: { flex: 1, fontFamily: text.bodySemi.fontFamily, fontSize: 14, lineHeight: 19 },
  bannerLink: { marginLeft: 4 },
  card: { backgroundColor: colors.white, borderRadius: radius.card, overflow: 'hidden' },
  pad18: { padding: 18 },
  pad20: { padding: 20 },
  helperText: { flex: 1, minWidth: 0, gap: 6 },
  stars: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  starsVal: { fontFamily: text.label.fontFamily, fontSize: 13, color: colors.ink },
  starsMeta: { fontFamily: text.meta.fontFamily, fontSize: 13, color: colors.mute },
  vchips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  vchip: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 28, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: colors.bg },
  vchipOk: { backgroundColor: colors.okTint },
  vchipText: { fontFamily: text.label.fontFamily, fontSize: 12, color: colors.ink2 },
  divider: { height: 1, backgroundColor: colors.line2, marginTop: 14, marginBottom: 4 },
  priceBlob: { position: 'absolute', right: -60, top: -60, width: 170, height: 170, borderRadius: 85, backgroundColor: colors.limeSoft },
  display: { fontFamily: text.h1.fontFamily, fontSize: 48, lineHeight: 52, letterSpacing: -1.4, color: colors.ink, marginTop: 10 },
  pricebar: { height: 10, borderRadius: 5, backgroundColor: colors.track, marginTop: 16 },
  priceFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 5, backgroundColor: colors.areaBorder },
  mk: { position: 'absolute', top: -6, width: 3, height: 22, marginLeft: -1.5, borderRadius: 2, backgroundColor: colors.ink },
  scale: { height: 16, marginTop: 8 },
  scaleText: { position: 'absolute', top: 0, fontFamily: text.bodySemi.fontFamily, fontSize: 11.5, color: colors.faint },
  scaleStart: { left: 0 },
  scaleMid: { color: colors.ink, textAlign: 'center' },
  scaleEnd: { right: 0 },
  noteBox: { marginTop: 14, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, backgroundColor: colors.surface2 },
  tiles: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, padding: 14, borderRadius: 20, backgroundColor: colors.white, gap: 8 },
  tileIc: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  quote: {
    flex: 1,
    paddingVertical: 16,
    paddingRight: 16,
    paddingLeft: 18,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderBottomRightRadius: 22,
    borderBottomLeftRadius: 8,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  quoteText: { ...text.body, fontSize: 15, lineHeight: 22 },
  cavCard: { paddingVertical: 16, paddingHorizontal: 18 },
  cavIc: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.warnTint, alignItems: 'center', justifyContent: 'center' },
  tli: { flexDirection: 'row', gap: 14, paddingBottom: 18 },
  tliLast: { paddingBottom: 0 },
  tline: { position: 'absolute', left: 12, top: 28, bottom: 2, width: 2, borderRadius: 1, backgroundColor: colors.line },
  tlineDone: { backgroundColor: colors.limeDot },
  tdot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  tliText: { flex: 1, gap: 3, paddingTop: 3 },
  closedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 4, minHeight: 56 },
  menuLine: { borderBottomWidth: 1, borderBottomColor: colors.line2 },
  menuIc: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  menuText: { fontFamily: text.bodySemi.fontFamily, fontSize: 15.5, color: colors.ink },
});
