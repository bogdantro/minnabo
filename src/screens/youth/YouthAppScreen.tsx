import { useMemo, useState } from 'react';
import { serverMessage } from '@/lib/errors';
import { useActiveCategories } from '@/hooks/useCategories';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from '@/components/ui/Image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HelperArt, YouthArt } from '@/components/art/Scenes';
import { GuardianSheet } from '@/components/GuardianSheet';
import { ImageViewer } from '@/components/ImageViewer';
import { LocationSheet } from '@/components/LocationSheet';
import nb from '@/i18n/nb';
import type { Listing } from '@/domain/types';
import { categoryArtId, categoryLabel } from '@/domain/categories';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { useConversations, useListings, useListingsByIds, useProfile, useSentProposals, useStartConversation } from '@/api/queries';
import { formatPrice } from '@/domain/price';
import { formatFriendlyDate } from '@/lib/calendar';
import { haptics } from '@/lib/haptics';
import { safePush } from '@/lib/nav';
import { useLocationScope, type Reach } from '@/lib/locationScope';
import { useVippsIdentity } from '@/auth/identity';
import { signOut, useSession } from '@/auth/session';
import { toast } from '@/lib/toast';
import {
  colors,
  radius,
  safeTopExtra,
  screenPadding,
  shadow,
  sizes,
  text,
  type CategoryId,
} from '@/theme/theme';
import { NavFrame, NavItem, PostButton } from '@/components/BottomNav';
import { YouthOffers, type Offer, type OfferStatus } from './YouthOffers';
import { YouthPhoto } from './YouthPhoto';
import { listingPlace, listingPrice, listingSchedule } from '@/components/OppdragCard';
import {
  AmountInput,
  Avatar,
  Button,
  CategoryArt,
  Chip,
  ChipRow,
  DrawnCheck,
  ErrorState,
  FadeUp,
  Field,
  Icon,
  IconButton,
  Input,
  KeyValueRow,
  ListGroup,
  ListingCard,
  ListingListSkeleton,
  ListRow,
  Note,
  PaymentNote,
  Pill,
  PressableScale,
  ScaleIn,
  Screen,
  SectionHeader,
  Sheet,
  SlideIn,
  Spinner,
  StatTile,
  TextLink,
  type IconKey,
} from '@/components/ui';
import { DateField } from '@/components/ui/DateField';
import { EmptyScene } from '@/components/ui/EmptyScene';
import { TimeField } from '@/components/ui/TimeField';

const logo = require('../../../assets/logo-icon.png');

type View4 = 'oppdrag' | 'tilbud' | 'innboks' | 'profil';

/** Noon when only a day is chosen, so a chosen day never slips to the day before in another time zone. */
const atTime = (d: Date, hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const at = new Date(d);
  at.setHours(h || 0, m || 0, 0, 0);
  return at.toISOString();
};
type SheetStep = 'detail' | 'form' | 'busy' | 'done';

/** `.ubadge` – ink pill with lime shield. */
function YouthBadge() {
  return (
    <View style={styles.ubadge}>
      <Icon name="shield" size={14} color={colors.lime} />
      <Text style={[text.pill, styles.ubadgeText]}>{nb.youth.badge}</Text>
    </View>
  );
}

/**
 * Youth app shell (design/screens/OppdragUng.dc.html): 4 tabs and a blue «Tilby hjelp» in the middle.
 * Oppdrag, tilbud and conversations are real; what a youth account may do is
 * enforced on the backend (0038_vipps_youth.sql, 0094).
 */
export function YouthAppScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const active = useActiveCategories();
  const CATS: (CategoryId | null)[] = [null, ...active];
  // empty for the moment it takes to load who is signed in
  const id = useVippsIdentity() ?? { name: '', firstName: '', initials: '·', birthYear: 0, age: 0, phoneMasked: '', youth: true };
  const { municipality, municipalities, ready, reach, setKommune, setReach } = useLocationScope();
  // youth accounts skip Oppsett, so the kommune is chosen here
  const [locOpen, setLocOpen] = useState(false);
  const applyLocation = (k: string, r: Reach) => {
    setLocOpen(false);
    setKommune(k);
    setReach(r);
    toast.success(nb.oppdrag.showing(nb.oppdrag.reach[r].name, k), { icon: 'pin' });
  };
  // Without a kommune there is no filter – that would list every oppdrag in the country.
  const jobs = useListings({ type: 'TASK_REQUEST', municipalities }, 'NEWEST', municipalities.length > 0);

  const [view, setView] = useState<View4>('oppdrag');
  const [guardian, setGuardian] = useState(false);
  const [cat, setCat] = useState<CategoryId | null>(null);
  const { userId } = useSession();
  const { data: profile } = useProfile(userId ?? '');
  // Youth accounts skip Oppsett: ask for the kommune the first time the app opens without
  // one – only once the profile has loaded, so a saved kommune never flashes the sheet.
  const [askedKommune, setAskedKommune] = useState(false);
  if (profile && !profile.location.municipality && !askedKommune) {
    setAskedKommune(true);
    setLocOpen(true);
  }
  const qc = useQueryClient();
  const startConversation = useStartConversation();
  const sent = useSentProposals(!!userId);
  const convs = useConversations();
  const [cur, setCur] = useState<Listing | null>(null);
  const [step, setStep] = useState<SheetStep>('detail');
  const [amount, setAmount] = useState('');
  const [whenDay, setWhenDay] = useState<Date | null>(null);
  const [whenTime, setWhenTime] = useState<string | null>(null);
  const [photo, setPhoto] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const [tried, setTried] = useState(false);
  const [lock, setLock] = useState<string | null>(null);

  const tasks = useMemo(
    () => (jobs.data ?? []).filter((l) => !cat || categoryArtId(l.category.slug) === cat),
    [jobs.data, cat],
  );
  const offerListings = useListingsByIds([...new Set((sent.data ?? []).map((pr) => pr.listingId))]);
  const offers = useMemo<Offer[]>(() => {
    return (sent.data ?? []).map((pr) => {
      const conv = (convs.data ?? []).find((c) => c.id === pr.conversationId);
      // a taken oppdrag is no longer in the open list, so it is fetched by id
      const l = (jobs.data ?? []).find((x) => x.id === pr.listingId) ?? offerListings[pr.listingId];
      const status: OfferStatus =
        pr.status === 'ACCEPTED'
          ? 'godtatt'
          : pr.status === 'WITHDRAWN'
            ? 'trukket'
            : pr.status === 'DECLINED' || pr.status === 'CANCELLED'
              ? 'avslatt'
              : pr.status === 'REVISION_PENDING' || pr.seenAt
                ? 'venter'
                : 'sendt';
      return {
        id: pr.id,
        conversationId: pr.conversationId,
        listingId: pr.listingId,
        category: l ? categoryArtId(l.category.slug) : 'annet',
        title: conv?.listing.title ?? l?.title ?? '',
        who: conv?.counterpart.displayName ?? l?.owner.displayName ?? '',
        price: formatPrice(pr.price),
        message: pr.message ?? '',
        status,
        sentAt: pr.createdAt,
        whenText: pr.scheduledText || undefined,
      };
    });
  }, [sent.data, convs.data, jobs.data, offerListings]);
  const refreshOffers = () => {
    void qc.invalidateQueries({ queryKey: ['proposals'] });
    void qc.invalidateQueries({ queryKey: ['conversations'] });
    void qc.invalidateQueries({ queryKey: ['offer-count'] });
  };
  const withdraw = async (o: Offer) => {
    try {
      await apiClient.respondToProposal(o.id, 'WITHDRAW', 'PROPOSER');
      refreshOffers();
      toast.success(nb.youth.withdrawn);
    } catch (e) {
      toast.error(serverMessage(e, nb.toast.genericError));
    }
  };
  const sentIds = new Set(offers.filter((o) => o.status !== 'trukket').map((o) => o.listingId));
  const pending = offers.filter((o) => o.status === 'sendt' || o.status === 'venter').length;
  const chats = offers.filter((o) => o.status !== 'trukket');
  // A youth only sees oppdrag, so every chat on a «Tilbyr hjelp» is one a nabo started on the youth's own post (0084)
  const offerChats = (convs.data ?? []).filter(
    (c) => c.listing.type === 'SERVICE_OFFER' && !chats.some((o) => o.conversationId === c.id),
  );
  const chatCount = chats.length + offerChats.length;

  const open = (l: Listing) => {
    setCur(l);
    setStep('detail');
  };
  const toForm = () => {
    if (!cur) return;
    const p = listingPrice(cur);
    setAmount(p.label && cur.price ? String(Math.round(cur.price.amountMinor / 100)) : '');
    setMsg('');
    setTried(false);
    setWhenDay(null);
    setWhenTime(null);
    setStep('form');
  };

  const amountOk = Number(amount) > 0;
  const msgOk = msg.trim().length >= 10;

  const send = () => {
    if (!cur) return;
    if (!amountOk || !msgOk) {
      setTried(true);
      return;
    }
    setStep('busy');
    const listing = cur;
    startConversation
      .mutateAsync(listing.id)
      .then((conv) =>
        apiClient.sendProposal({
          conversationId: conv.id,
          listingId: listing.id,
          priceAmountMinor: Number(amount) * 100,
          message: msg.trim(),
          // both are optional: a youth often just writes when in the message
          scheduledText: whenDay ? `${formatFriendlyDate(whenDay)}${whenTime ? ` kl. ${whenTime}` : ''}` : nb.youth.flexible,
          scheduledAt: whenDay && whenTime ? atTime(whenDay, whenTime) : null,
        }),
      )
      .then(() => {
        refreshOffers();
        setStep('done');
      })
      .catch((e: unknown) => {
        setStep('form');
        toast.error(serverMessage(e, nb.giTilbud.sendFailed));
      });
  };

  const closeSheet = () => {
    setCur(null);
  };
  const go = (v: View4) => {
    setCur(null);
    setView(v);
  };
  const openJob = (listingId: string) => {
    const l = (jobs.data ?? []).find((x) => x.id === listingId) ?? offerListings[listingId];
    if (l) open(l);
  };
  const first = cur?.owner.displayName.split(' ')[0] ?? '';

  return (
    <View style={styles.flex}>
      <Screen
        scroll
        spacer="nav"
        header={
          <View style={[styles.topbar, { paddingTop: insets.top + safeTopExtra }]}>
            <View style={styles.brand}>
              <Image source={logo} style={styles.logo} />
              <Text style={text.brand}>MinNabo</Text>
            </View>
            <View style={styles.tbr}>
              <YouthBadge />
              <Pressable accessibilityRole="button" accessibilityLabel="Åpne profil" onPress={() => go('profil')} style={styles.avbtn}>
                <Avatar initials={id.initials} uri={profile?.avatarUrl} colorKey="b" size={40} />
              </Pressable>
            </View>
          </View>
        }
      >
        {view === 'oppdrag' ? (
          <>
            <FadeUp style={styles.px}>
              <View style={[styles.hero, shadow.card]}>
                <View style={styles.heroText}>
                  <Text style={[text.eyebrow, styles.heroHello]}>{nb.oppdrag.hello(id.firstName)}</Text>
                  <Text style={text.h1} accessibilityRole="header">
                    {nb.youth.homeTitle}
                  </Text>
                </View>
                <View style={styles.heroArt}>
                  <YouthArt chips={nb.youth.artChips} />
                </View>
              </View>
            </FadeUp>
            <FadeUp delay={50} style={[styles.px, styles.tools]}>
              <Pressable accessibilityRole="button" accessibilityLabel={nb.youth.pickKommuneA11y} onPress={() => setLocOpen(true)} style={styles.loc}>
                <View style={styles.locIcon}>
                  <Icon name="pin" size={18} color={colors.limeDeep} />
                </View>
                <Text style={[text.label, styles.locK]} numberOfLines={1}>
                  {municipality ? nb.oppdrag.kommune(municipality) : nb.youth.pickKommune}
                </Text>
                <View style={styles.locChange}>
                  <Text style={styles.locChangeText}>{nb.oppdrag.change}</Text>
                </View>
              </Pressable>
              <Pressable accessibilityRole="search" accessibilityLabel={nb.youth.searchCta} onPress={() => router.push('/sok')} style={[styles.search, shadow.card]}>
                <Icon name="search" size={18} color={colors.mute} />
                <Text style={styles.searchText} numberOfLines={1}>
                  {nb.youth.searchCta}
                </Text>
              </Pressable>
            </FadeUp>
            <FadeUp delay={70} style={[styles.px, styles.statRow]}>
              {[
                { n: jobs.data?.length ?? 0, label: nb.youth.statJobs, on: () => undefined },
                { n: pending, label: nb.youth.statWaiting, on: () => go('tilbud') },
                { n: chatCount, label: nb.youth.statChats(chatCount), on: () => go('innboks') },
              ].map((s) => (
                <Pressable key={s.label} accessibilityRole="button" accessibilityLabel={`${s.n} ${s.label}`} onPress={s.on} style={[styles.statTile, shadow.card]}>
                  <Text style={styles.statNum}>{s.n}</Text>
                  <Text style={styles.statLabel} numberOfLines={2}>
                    {s.label}
                  </Text>
                </Pressable>
              ))}
            </FadeUp>
            <FadeUp delay={110} style={[styles.px, styles.mt14]}>
              <PressableScale accessibilityRole="button" accessibilityLabel={nb.youth.offerCta} onPress={() => router.push('/legg-ut/tilbyr')} style={[styles.offerCard, shadow.medium]}>
                <HelperArt />
                <View style={styles.offerBody}>
                  <Text style={styles.offerTitle}>{nb.youth.offerCta}</Text>
                  <Text style={styles.offerSub}>{nb.youth.offerCtaSub}</Text>
                  <View style={styles.offerGo}>
                    <Text style={styles.offerGoText}>{nb.youth.offerGo}</Text>
                    <Icon name="arrow" size={16} color={colors.lime} />
                  </View>
                </View>
              </PressableScale>
            </FadeUp>
            <FadeUp delay={150} style={styles.mt14}>
              <ChipRow>
                {CATS.map((c) => (
                  <Chip
                    key={c ?? 'alle'}
                    label={c ? categoryLabel(c) : nb.youth.all}
                    category={c ?? undefined}
                    icon={c ? undefined : 'annet'}
                    selected={cat === c}
                    onPress={() => setCat(c)}
                  />
                ))}
              </ChipRow>
            </FadeUp>
            <SectionHeader icon="clip" title={nb.oppdrag.needsTitle} subtitle={nb.youth.needsSub} style={styles.mt22} />
            <View style={styles.list}>
              {jobs.isLoading || !ready ? (
                <View style={styles.bleed}>
                  <ListingListSkeleton count={3} />
                </View>
              ) : jobs.isError ? (
                <View style={styles.errorBox}>
                  <ErrorState onRetry={() => void jobs.refetch()} retrying={jobs.isFetching} />
                </View>
              ) : tasks.length === 0 ? (
                <FadeUp style={styles.noJobs}>
                  <EmptyScene icon="clip" />
                  <Text style={[text.h3, styles.center]}>{nb.youth.noJobsTitle}</Text>
                  <Text style={[text.meta, styles.center]}>{nb.youth.noJobsBody}</Text>
                </FadeUp>
              ) : (
                tasks.map((l, i) => {
                  const p = listingPrice(l);
                  return (
                    <FadeUp key={l.id} delay={Math.min(i, 9) * 50}>
                      <ListingCard
                        title={l.title}
                        category={categoryArtId(l.category.slug)}
                        photoUri={l.images[0]?.url}
                        ownerName={l.owner.displayName}
                        ownerRating={l.owner.rating?.count ? l.owner.rating.average : null}
                        place={listingPlace(l)}
                        schedule={listingSchedule(l)}
                        priceLabel={p.label}
                        priceValue={p.value}
                        extraBadge={sentIds.has(l.id) ? { label: nb.youth.offerSent } : undefined}
                        onPress={() => open(l)}
                      />
                    </FadeUp>
                  );
                })
              )}
            </View>
            <View style={[styles.px, styles.mt22]}>
              <Text style={[text.sectionTitle, styles.moreTitle]}>{nb.youth.more}</Text>
              <View style={styles.tiles}>
                {[
                  { icon: 'users' as const, title: nb.youth.community, sub: nb.youth.communitySub, bg: colors.warnTint, fg: colors.warn, to: '/fellesskap-ung' as const },
                  { icon: 'pinned' as const, title: nb.youth.board, sub: nb.youth.boardSub, bg: colors.cyanTint, fg: colors.cyanDeep, to: '/oppslagstavle' as const },
                  { icon: 'bookmark' as const, title: nb.youth.savedSearches, sub: nb.youth.savedSearchesSub, bg: colors.limeTint, fg: colors.limeDeep, to: '/lagrede' as const },
                ].map((t) => (
                  <PressableScale key={t.title} accessibilityRole="link" accessibilityLabel={t.title} onPress={() => router.push(t.to)} style={[styles.tile, shadow.card]}>
                    <View style={[styles.tileIcon, { backgroundColor: t.bg }]}>
                      <Icon name={t.icon} size={20} color={t.fg} />
                    </View>
                    <Text style={styles.tileTitle}>{t.title}</Text>
                    <Text style={text.meta}>{t.sub}</Text>
                  </PressableScale>
                ))}
              </View>
              <Pressable accessibilityRole="link" onPress={() => router.push('/sikkerhet')} style={styles.safe}>
                <View style={styles.safeIcon}>
                  <Icon name="shield" size={18} color={colors.lime} />
                </View>
                <View style={styles.flex}>
                  <Text style={text.label}>{nb.youth.safetyCardTitle}</Text>
                  <Text style={text.meta}>{nb.youth.safetyCardBody}</Text>
                </View>
              </Pressable>
              <PaymentNote style={styles.noteCenter} />
            </View>
          </>
        ) : null}

        {view === 'tilbud' ? (
          <View style={styles.px}>
            <YouthOffers offers={offers} onFind={() => go('oppdrag')} onOpenJob={openJob} onWithdraw={withdraw} />
          </View>
        ) : null}

        {view === 'innboks' ? (
          <View style={[styles.px, styles.stack]}>
            <FadeUp>
              <Text style={text.h1}>{nb.youth.tabs.innboks}</Text>
            </FadeUp>
            <FadeUp delay={50} style={styles.lockNote}>
              <Icon name="lock" size={16} color={colors.mute} />
              <Text style={[text.meta, styles.lockNoteText]}>{nb.youth.inboxNote}</Text>
            </FadeUp>
            {offerChats.map((c, i) => (
              <FadeUp key={c.id} delay={100 + i * 50}>
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel={`${c.counterpart.displayName}, ${c.listing.title}`}
                  onPress={() => safePush(`/chat/${c.id}`)}
                  style={styles.orow}
                >
                  <Avatar initials={c.counterpart.initials} uri={c.counterpart.avatarUrl} seed={c.counterpart.id} size={48} ring={false} />
                  <View style={styles.orowBody}>
                    <Text style={text.cardTitle}>{c.counterpart.displayName}</Text>
                    <Text style={text.meta} numberOfLines={1}>
                      {c.listing.title}
                    </Text>
                    <Text style={text.meta} numberOfLines={1}>
                      {c.lastMessageMine ? nb.youth.you : ''}
                      {c.lastMessagePreview}
                    </Text>
                  </View>
                  {c.unread ? <Pill label={nb.youth.askedYou} tone="dark" /> : null}
                </Pressable>
              </FadeUp>
            ))}
            {chatCount === 0 ? (
              <Text style={[text.body, styles.empty]}>{nb.youth.noChats}</Text>
            ) : (
              chats.map((c, i) => (
                <FadeUp key={c.id} delay={100 + i * 50}>
                 <Pressable
                  accessibilityRole="link"
                  accessibilityLabel={`${c.who}, ${c.title}`}
                  disabled={!c.conversationId}
                  onPress={() => c.conversationId && safePush(`/chat/${c.conversationId}`)}
                  style={styles.orow}
                 >
                  <Avatar initials={c.who.slice(0, 2)} seed={c.who} size={48} ring={false} />
                  <View style={styles.orowBody}>
                    <Text style={text.cardTitle}>{c.who}</Text>
                    <Text style={text.meta} numberOfLines={1}>
                      {c.title}
                    </Text>
                    <Text style={text.meta} numberOfLines={1}>
                      {nb.youth.you}
                      {c.message}
                    </Text>
                  </View>
                  {c.status === 'godtatt' ? <Pill label={nb.youth.accepted} tone="ok" /> : null}
                 </Pressable>
                </FadeUp>
              ))
            )}
          </View>
        ) : null}

        {view === 'profil' ? (
          <View style={[styles.px, styles.stack16]}>
            <FadeUp style={styles.profileHead}>
              <YouthPhoto userId={userId ?? ''} initials={id.initials} uri={profile?.avatarUrl} />
              <Text style={text.h2}>{id.name}</Text>
              <Text style={text.meta}>{nb.youth.ageLine(id.age, municipality ?? '')}</Text>
              <YouthBadge />
            </FadeUp>
            <FadeUp delay={100} style={styles.stats}>
              <StatTile value={String(profile?.completedTasks ?? 0)} label={nb.youth.doneJobs} />
              <StatTile
                value={profile?.rating?.count ? profile.rating.average.toFixed(1).replace('.', ',') : '–'}
                label={nb.youth.fromReviews(profile?.rating?.count ?? 0)}
              />
            </FadeUp>
            <FadeUp delay={130}>
              <ListGroup>
                <ListRow icon="search" title={nb.youth.searchCta} onPress={() => router.push('/sok')} />
                <ListRow icon="users" title={nb.youth.community} subtitle={nb.youth.communitySub} onPress={() => router.push('/fellesskap-ung')} />
                <ListRow icon="pinned" title={nb.youth.board} subtitle={nb.youth.boardSub} onPress={() => router.push('/oppslagstavle')} />
                <ListRow icon="bookmark" title={nb.youth.savedSearches} subtitle={nb.youth.savedSearchesSub} onPress={() => router.push('/lagrede')} />
              </ListGroup>
            </FadeUp>
            <FadeUp delay={200}>
              <ListGroup>
                <ListRow icon="hand" title={nb.youth.myPosts} subtitle={nb.youth.myPostsSub} onPress={() => router.push('/mine')} />
                <ListRow icon="shield" title={nb.youth.safety} subtitle={nb.youth.safetySub} onPress={() => router.push('/sikkerhet')} />
                <ListRow icon="lock" title={nb.youth.privacy} onPress={() => router.push('/personvern')} />
                <ListRow icon="users" title={nb.guardian.rowYouth} subtitle={nb.guardian.rowYouthSub} onPress={() => setGuardian(true)} />
                <ListRow
                  icon="logout"
                  title={nb.youth.logout}
                  onPress={async () => {
                    await signOut();
                    router.replace('/velkommen');
                  }}
                />
              </ListGroup>
            </FadeUp>
            <FadeUp delay={240}>
              <Text style={[text.eyebrow, styles.mb8]}>{nb.youth.lockedTitle}</Text>
              <ListGroup>
                {nb.youth.lockedRows.map((r) => (
                  <ListRow
                    key={r.label}
                    icon={r.icon as IconKey}
                    iconBg={colors.neutralPill}
                    iconColor={colors.mute}
                    title={r.label}
                    right={<Icon name="lock" size={16} color={colors.mute} />}
                    chevron={false}
                    onPress={() => setLock(r.label)}
                  />
                ))}
              </ListGroup>
            </FadeUp>
          </View>
        ) : null}
      </Screen>

      <NavFrame>
        <NavItem label={nb.youth.tabs.oppdrag} icon="clip" active={view === 'oppdrag'} onPress={() => go('oppdrag')} />
        <NavItem label={nb.youth.tabs.tilbud} icon="tag" active={view === 'tilbud'} badge={pending} onPress={() => go('tilbud')} />
        <PostButton
          blue
          icon="hand"
          label={nb.youth.offerTab}
          onPress={() => {
            haptics.light();
            router.push('/legg-ut/tilbyr');
          }}
        />
        <NavItem label={nb.youth.tabs.innboks} icon="msg" active={view === 'innboks'} badge={chatCount ? 1 : 0} onPress={() => go('innboks')} />
        <NavItem label={nb.youth.tabs.profil} icon="user" active={view === 'profil'} onPress={() => go('profil')} />
      </NavFrame>

      <Sheet visible={!!cur} onClose={closeSheet} scroll>
        {cur && step === 'detail' ? (
          <View style={styles.gap14}>
            <Pressable
              accessibilityRole={cur.images.length ? 'imagebutton' : undefined}
              accessibilityLabel={cur.images.length ? nb.detail.openImage(1, cur.images.length) : undefined}
              disabled={!cur.images.length}
              onPress={() => setPhoto(0)}
            >
              <CategoryArt category={categoryArtId(cur.category.slug)} uri={cur.images[0]?.url} height={170} radius={radius.card} iconSize={44} />
            </Pressable>
            <Pill label={nb.youth.openTaskBadge} tone="need" dot />
            <Text style={text.h2}>{cur.title}</Text>
            <View style={styles.flatCard}>
              <KeyValueRow label={nb.youth.place} value={listingPlace(cur)} />
              <KeyValueRow label={nb.youth.when} value={listingSchedule(cur) ?? '–'} />
              <KeyValueRow label={listingPrice(cur).label || nb.youth.price} value={listingPrice(cur).value} />
              <KeyValueRow
                label={nb.youth.poster}
                value={`${cur.owner.displayName}${cur.owner.rating?.count ? ` · ★ ${cur.owner.rating.average.toFixed(1).replace('.', ',')}` : ''}`}
                last
              />
            </View>
            {cur.task?.description ? <Text style={[text.body, { color: colors.ink2 }]}>{cur.task.description}</Text> : null}
            <View style={styles.lockNote}>
              <Icon name="lock" size={16} color={colors.mute} />
              <Text style={[text.meta, styles.lockNoteText]}>{nb.youth.msgAfterOffer}</Text>
            </View>
            {sentIds.has(cur.id) ? (
              <Button label={nb.youth.sentSeeOffers} icon="check" variant="ink" size="lg" onPress={() => go('tilbud')} />
            ) : (
              <Button label={nb.youth.giveOffer} size="lg" onPress={toForm} />
            )}
          </View>
        ) : null}

        {cur && step === 'form' ? (
          <SlideIn style={styles.gap18}>
            <View style={styles.formHead}>
              <IconButton icon="back" iconSize={18} accessibilityLabel={nb.login.back} onPress={() => setStep('detail')} />
              <Text style={[text.h3, styles.flex]}>{nb.youth.giveOffer}</Text>
            </View>
            <Field
              label={nb.youth.priceLabel}
              hint={`${listingPrice(cur).label || nb.youth.price}: ${listingPrice(cur).value}`}
              error={tried && !amountOk ? nb.youth.errPrice : null}
            >
              <AmountInput value={amount} onChangeText={setAmount} error={tried && !amountOk} accessibilityLabel={nb.youth.priceLabel} />
            </Field>
            <Field label={nb.youth.whenCan} hint={nb.youth.whenHint}>
              <View style={styles.whenBox}>
                <DateField label={nb.youth.whenDate} value={whenDay} onChange={setWhenDay} placeholder={nb.youth.whenDatePh} showLabel={false} />
                {whenDay ? (
                  <FadeUp style={styles.whenMore}>
                    <TimeField label={nb.youth.whenTime} value={whenTime} onChange={setWhenTime} showLabel={false} />
                    <TextLink
                      label={nb.youth.whenClear}
                      icon={null}
                      onPress={() => {
                        setWhenDay(null);
                        setWhenTime(null);
                      }}
                      style={styles.whenClear}
                    />
                  </FadeUp>
                ) : null}
              </View>
            </Field>
            <Field label={nb.youth.message} hint={`${msg.length}/300`} error={tried && !msgOk ? nb.youth.errMsg : null}>
              <Input
                multiline
                value={msg}
                onChangeText={(v) => setMsg(v.slice(0, 300))}
                placeholder={nb.youth.messagePh}
                error={tried && !msgOk}
                accessibilityLabel={nb.youth.message}
              />
            </Field>
            <View style={styles.seesYouth}>
              <Icon name="eye" size={16} color={colors.cyanDeep} />
              <Text style={[text.infoBox, styles.flex]}>{nb.youth.seesYouth(first, id.age)}</Text>
            </View>
            <Note>{nb.oppdrag.paymentNote}</Note>
            <Button label={nb.youth.send} size="lg" onPress={send} />
          </SlideIn>
        ) : null}

        {step === 'busy' ? (
          <View style={styles.busy}>
            <Spinner size={36} thickness={3.5} color={colors.ink} trackColor={colors.track} />
            <Text style={text.label}>{nb.youth.sending}</Text>
          </View>
        ) : null}

        {cur && step === 'done' ? (
          <View style={styles.done}>
            <DrawnCheck size={104} ring={shadow.limeRing10} />
            <FadeUp delay={150}>
              <Text style={[text.h2, styles.center]}>{nb.youth.sentTo(first)}</Text>
            </FadeUp>
            <FadeUp delay={200}>
              <Text style={[text.stateBody, styles.center]}>{nb.youth.sentBody(first)}</Text>
            </FadeUp>
            <FadeUp delay={230} style={styles.nextBox}>
              <Text style={[text.eyebrow, styles.nextTitle]}>{nb.youth.nextTitle}</Text>
              {nb.youth.nextSteps(first).map((t, i) => (
                <View key={t} style={styles.nextRow}>
                  <View style={styles.nextNum}>
                    <Text style={styles.nextNumText}>{i + 1}</Text>
                  </View>
                  <Text style={[text.body, styles.flex, styles.nextText]}>{t}</Text>
                </View>
              ))}
            </FadeUp>
            <FadeUp delay={280} style={styles.doneBtns}>
              <Button label={nb.youth.seeOffers} variant="ink" size="lg" onPress={() => go('tilbud')} />
              <Button label={nb.youth.moreJobs} icon="search" variant="ghost" size="lg" onPress={() => go('oppdrag')} />
            </FadeUp>
          </View>
        ) : null}
      </Sheet>

      <Sheet visible={!!lock} onClose={() => setLock(null)}>
        <View style={styles.lockSheet}>
          <ScaleIn style={styles.lockIcon}>
            <Icon name="lock" size={32} color={colors.ink} />
          </ScaleIn>
          <Text style={[text.h3, styles.center]}>{lock ? nb.youth.lockedSheet(lock) : ''}</Text>
          <Text style={[text.stateBody, styles.center, styles.lockBody]}>{nb.youth.lockedBody}</Text>
          <Button label={nb.youth.understood} variant="ink" onPress={() => setLock(null)} />
        </View>
      </Sheet>
      <ImageViewer images={photo === null || !cur ? [] : cur.images.map((img) => img.url)} index={photo ?? 0} caption={cur?.title} onClose={() => setPhoto(null)} />
      <GuardianSheet visible={guardian} onClose={() => setGuardian(false)} />
      <LocationSheet visible={locOpen} onClose={() => setLocOpen(false)} kommune={municipality} reach={reach} onApply={applyLocation} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  px: { paddingHorizontal: screenPadding },
  center: { textAlign: 'center' },
  noteCenter: { justifyContent: 'center' },
  stretch: { alignSelf: 'stretch' },
  mt6: { marginTop: 6 },
  mt14: { marginTop: 14 },
  mt18: { marginTop: 18 },
  mt22: { marginTop: 22 },
  mb8: { marginBottom: 8 },
  gap14: { gap: 14 },
  gap18: { gap: 18 },
  stack: { gap: 12, paddingTop: 10 },
  stack16: { gap: 16, paddingTop: 10 },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: screenPadding,
    paddingBottom: 10,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  logo: { width: 34, height: 34 },
  tbr: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avbtn: { width: sizes.minTouch, height: sizes.minTouch, alignItems: 'center', justifyContent: 'center' },
  ubadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
  },
  ubadgeText: { color: colors.lime, fontSize: 11.5 },
  hero: { marginTop: 8, borderRadius: radius.nav, overflow: 'hidden', backgroundColor: colors.limeSoft },
  heroText: { paddingTop: 22, paddingHorizontal: 20, gap: 6 },
  heroHello: { color: colors.limeDeep },
  heroArt: { height: 170, marginTop: 6 },
  tools: { gap: 10, marginTop: 12 },
  loc: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 8, paddingRight: 10, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  locIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.limeTint, alignItems: 'center', justifyContent: 'center' },
  locK: { flex: 1, fontSize: 15 },
  locChange: { height: 32, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, justifyContent: 'center' },
  locChangeText: { fontFamily: text.label.fontFamily, fontSize: 13, color: colors.ink },
  search: { height: 52, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  searchText: { flex: 1, fontFamily: text.body.fontFamily, fontSize: 15, color: colors.mute },
  statRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  statTile: { flex: 1, minHeight: 74, padding: 11, borderRadius: radius.m, backgroundColor: colors.surface, gap: 1 },
  statNum: { fontFamily: text.h1.fontFamily, fontSize: 23, lineHeight: 27, color: colors.ink },
  statLabel: { fontFamily: text.body.fontFamily, fontSize: 12, lineHeight: 15, color: colors.mute },
  offerCard: { minHeight: 138, borderRadius: radius.listingCard, backgroundColor: colors.cyan2, overflow: 'hidden' },
  offerBody: { paddingVertical: 18, paddingLeft: 18, paddingRight: 130, gap: 5 },
  offerTitle: { ...text.h2, fontSize: 24, lineHeight: 28, color: colors.white },
  offerSub: { fontFamily: text.body.fontFamily, fontSize: 14, lineHeight: 19, color: colors.white },
  offerGo: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  offerGoText: { fontFamily: text.label.fontFamily, fontSize: 14.5, color: colors.lime },
  noJobs: { alignItems: 'center', gap: 6, paddingVertical: 14 },
  moreTitle: { fontSize: 18, marginBottom: 10 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { flexGrow: 1, flexBasis: '47%', padding: 14, gap: 3, borderRadius: radius.card, backgroundColor: colors.surface },
  tileIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  tileTitle: { ...text.label, fontSize: 15 },
  safe: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginTop: 10, marginBottom: 14, borderRadius: radius.card, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line },
  safeIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: screenPadding, gap: 12 },
  bleed: { marginHorizontal: -screenPadding },
  errorBox: { height: 360 },
  empty: { color: colors.mute, paddingVertical: 12 },
  orow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: colors.white,
    borderRadius: radius.option,
    ...shadow.card,
  },
  orowBody: { flex: 1, minWidth: 0, gap: 4 },
  orowPrice: { fontSize: 13, lineHeight: 16 },
  lockNote: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface2,
  },
  lockNoteText: { flex: 1, color: colors.ink2 },
  profileHead: { alignItems: 'center', gap: 8 },
  stats: { flexDirection: 'row', gap: 10 },
  flatCard: {
    paddingVertical: 4,
    paddingHorizontal: 14,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  formHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  whenBox: { gap: 8 },
  whenMore: { gap: 6 },
  whenClear: { alignSelf: 'flex-start' },
  seesYouth: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.infoBorder,
    backgroundColor: colors.cyanTint,
  },
  busy: { alignItems: 'center', gap: 14, paddingVertical: 60 },
  done: { alignItems: 'center', gap: 14, paddingTop: 20, paddingBottom: 6 },
  nextBox: { alignSelf: 'stretch', gap: 8, padding: 14, borderRadius: radius.card, backgroundColor: colors.surface2 },
  nextTitle: { marginBottom: 2 },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nextNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  nextNumText: { fontFamily: text.label.fontFamily, fontSize: 12.5, color: colors.ink },
  nextText: { fontSize: 14.5, lineHeight: 20 },
  doneBtns: { alignSelf: 'stretch', gap: 10 },
  lockSheet: { alignItems: 'center', gap: 12, paddingTop: 10, paddingBottom: 4 },
  lockIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.neutralPill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockBody: { maxWidth: 290 },
});
