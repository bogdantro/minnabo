import { useMemo, useState } from 'react';
import { serverMessage } from '@/lib/errors';
import { useActiveCategories } from '@/hooks/useCategories';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from '@/components/ui/Image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HelperArt, YouthArt } from '@/components/art/Scenes';
import { GuardianSheet } from '@/components/GuardianSheet';
import { LocationSheet } from '@/components/LocationSheet';
import { AttestCard } from '@/components/profile/AttestCard';
import { townLabel } from '@/lib/places';
import nb from '@/i18n/nb';
import type { Listing } from '@/domain/types';
import { categoryArtId, categoryLabel } from '@/domain/categories';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { useConversations, useListings, useListingsByIds, useProfile, useSentProposals } from '@/api/queries';
import { formatPrice } from '@/domain/price';
import { haptics } from '@/lib/haptics';
import { postedAgo } from '@/lib/datetime';
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
import { ConversationRow, ThreadRow } from '@/components/inbox/ConversationRow';
import { YouthPhoto } from './YouthPhoto';
import { listingPlace, listingPrice, listingSchedule } from '@/components/OppdragCard';
import {
  Avatar,
  Button,
  Chip,
  ChipRow,
  ErrorState,
  FadeUp,
  Icon,
  ListGroup,
  ListingCard,
  ListingListSkeleton,
  ListRow,
  PaymentNote,
  PressableScale,
  ScaleIn,
  Screen,
  SectionHeader,
  Sheet,
  type IconKey,
} from '@/components/ui';
import { EmptyScene } from '@/components/ui/EmptyScene';

const logo = require('../../../assets/logo-icon.png');

type View4 = 'oppdrag' | 'tilbud' | 'innboks' | 'profil';


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
  const { municipality, municipalities, ready, reach, setKommune, setReach, town } = useLocationScope();
  // youth accounts skip Oppsett, so the kommune is chosen here
  const [locOpen, setLocOpen] = useState(false);
  const applyLocation = (k: string, r: Reach, place?: string) => {
    setLocOpen(false);
    setKommune(k, place);
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
  const sent = useSentProposals(!!userId);
  const convs = useConversations();
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


  const go = (v: View4) => setView(v);
  // an oppdrag opens its own page, the same as for everyone else (asked 2026-11-10); the youth version of
  // the page hides «Send melding» and gives the tilbud from there
  const open = (l: Listing) => safePush(`/oppdrag/${l.id}`);
  const openJob = (listingId: string) => safePush(`/oppdrag/${listingId}`);

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
                  {municipality ? townLabel(town, municipality) : nb.youth.pickKommune}
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
                        photoTop
                        ownerName={l.owner.displayName}
                        ownerRating={l.owner.rating?.count ? l.owner.rating.average : null}
                        owner={{ id: l.owner.id, initials: l.owner.initials, avatarUrl: l.owner.avatarUrl }}
                        posted={postedAgo(l.createdAt).replace(/^for /, '')}
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
              <View style={styles.doors}>
                {[
                  { icon: 'users' as const, title: nb.youth.community, sub: nb.youth.communitySub, bg: colors.warnTint, fg: colors.warn, to: '/fellesskap-ung' as const },
                  { icon: 'pinned' as const, title: nb.youth.board, sub: nb.youth.boardSub, bg: colors.cyanTint, fg: colors.cyanDeep, to: '/oppslagstavle' as const },
                  { icon: 'bookmark' as const, title: nb.youth.savedSearches, sub: nb.youth.savedSearchesSub, bg: colors.limeTint, fg: colors.limeDeep, to: '/lagrede' as const },
                ].map((t, i, all) => (
                  <PressableScale
                    key={t.title}
                    accessibilityRole="link"
                    accessibilityLabel={t.title}
                    onPress={() => router.push(t.to)}
                    scaleTo={0.985}
                    style={[styles.door, i === 0 && styles.doorFirst, i === all.length - 1 && styles.doorLast]}
                  >
                    {/* the base design's ring-framed disc */}
                    <View style={[styles.doorRing, { borderColor: t.fg }]}>
                      <View style={[styles.doorDisc, { backgroundColor: t.bg }]}>
                        <Icon name={t.icon} size={20} color={t.fg} />
                      </View>
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.doorTitle}>{t.title}</Text>
                      <Text style={text.meta} numberOfLines={1}>
                        {t.sub}
                      </Text>
                    </View>
                    <View style={styles.doorGo}>
                      <Icon name="right" size={16} color={colors.ink} />
                    </View>
                    {i < all.length - 1 ? <View style={styles.doorSep} /> : null}
                  </PressableScale>
                ))}
              </View>
              <PressableScale accessibilityRole="link" onPress={() => router.push('/sikkerhet')} scaleTo={0.985} style={[styles.safe, shadow.medium]}>
                <View style={styles.safeBlob} />
                <View style={styles.safeRing}>
                  <View style={styles.safeIcon}>
                    <Icon name="shield" size={20} color={colors.ink} />
                  </View>
                </View>
                <View style={styles.flex}>
                  <Text style={styles.safeTitle}>{nb.youth.safetyCardTitle}</Text>
                  <Text style={styles.safeBody}>{nb.youth.safetyCardBody}</Text>
                  <View style={styles.safeGo}>
                    <Text style={styles.safeGoText}>{nb.youth.safetyCardCta}</Text>
                    <Icon name="arrow" size={14} color={colors.lime} />
                  </View>
                </View>
              </PressableScale>
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
          <View style={styles.stack}>
            <FadeUp style={styles.px}>
              <Text style={text.h1} accessibilityRole="header">
                {nb.youth.tabs.innboks}
              </Text>
              <Text style={[text.meta, styles.mt4]}>{nb.youth.inboxCount(offerChats.length + chats.length)}</Text>
            </FadeUp>
            {offerChats.length > 1 ? (
              <FadeUp delay={40}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.faces}>
                  {offerChats.map((c) => (
                    <Pressable key={c.id} accessibilityRole="link" accessibilityLabel={c.counterpart.displayName} onPress={() => safePush(`/chat/${c.id}`)} style={styles.face}>
                      <View style={[styles.faceRing, c.unread && styles.faceRingOn]}>
                        <Avatar initials={c.counterpart.initials} uri={c.counterpart.avatarUrl} seed={c.counterpart.id} size={54} online={c.counterpart.online} ring={false} />
                      </View>
                      <Text style={[styles.faceName, c.unread && styles.faceNameOn]} numberOfLines={1}>
                        {c.counterpart.displayName.split(' ')[0]}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </FadeUp>
            ) : null}
            {offerChats.length + chats.length === 0 ? (
              <FadeUp delay={80} style={[styles.px, styles.inboxEmpty]}>
                <View style={styles.inboxEmptyRing}>
                  <View style={styles.inboxEmptyDisc}>
                    <Icon name="msg" size={26} color={colors.cyanDeep} />
                  </View>
                </View>
                <Text style={[text.label, styles.centerText, styles.emptyText]}>{nb.youth.noChats}</Text>
                <Button label={nb.youth.findMore} icon="search" size="sm" block={false} align="center" onPress={() => go('oppdrag')} />
              </FadeUp>
            ) : (
              <FadeUp delay={80} style={styles.px}>
                <View style={styles.panel}>
                  {offerChats.map((c, n) => (
                    <View key={c.id}>
                      <ConversationRow c={c} unread={!!c.unread} onPress={() => safePush(`/chat/${c.id}`)} extraTag={c.unread ? { label: nb.youth.askedYou, tone: 'dark' } : undefined} />
                      {n < offerChats.length - 1 || chats.length ? <View style={styles.sep} /> : null}
                    </View>
                  ))}
                  {chats.map((c, n) => (
                    <View key={c.id}>
                      <ThreadRow
                        name={c.who}
                        initials={c.who.slice(0, 2).toUpperCase()}
                        seed={c.who}
                        title={c.title}
                        preview={`${nb.youth.you}${c.message}`}
                        tag={c.status === 'godtatt' ? { label: nb.youth.accepted, tone: 'ok' } : undefined}
                        onPress={c.conversationId ? () => safePush(`/chat/${c.conversationId}`) : undefined}
                      />
                      {n < chats.length - 1 ? <View style={styles.sep} /> : null}
                    </View>
                  ))}
                </View>
              </FadeUp>
            )}
            <FadeUp delay={120} style={[styles.lockNote, styles.mx]}>
              <View style={styles.inboxLockIcon}>
                <Icon name="lock" size={16} color={colors.cyanDeep} />
              </View>
              <Text style={[text.meta, styles.lockNoteText]}>{nb.youth.inboxNote}</Text>
            </FadeUp>
          </View>
        ) : null}

        {view === 'profil' ? (
          <View style={[styles.px, styles.stack16]}>
            <FadeUp style={styles.profileHead}>
              <View style={styles.pcover} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <View style={[styles.pblob, styles.pblobL]} />
                <View style={[styles.pblob, styles.pblobR]} />
                <View style={styles.pring} />
                <View style={[styles.pdot, styles.pdot1]} />
                <View style={[styles.pdot, styles.pdot2]} />
              </View>
              <View style={styles.pav}>
                <YouthPhoto userId={userId ?? ''} initials={id.initials} uri={profile?.avatarUrl} />
              </View>
              <Text style={styles.pname}>{id.name}</Text>
              <Text style={text.meta}>{nb.youth.ageLine(id.age, municipality ?? '')}</Text>
              <YouthBadge />
            </FadeUp>
            <FadeUp delay={100} style={[styles.pstats, shadow.card]}>
              <View style={styles.pstat} accessible accessibilityLabel={`${profile?.completedTasks ?? 0} ${nb.youth.doneJobs}`}>
                <Text style={styles.pstatNum}>{String(profile?.completedTasks ?? 0)}</Text>
                <Text style={styles.pstatLabel}>{nb.youth.doneJobs}</Text>
              </View>
              <View style={[styles.pstat, styles.pstatSep]} accessible accessibilityLabel={nb.youth.reviewsCount(profile?.rating?.count ?? 0)}>
                <View style={styles.row6c}>
                  {profile?.rating?.count ? <Icon name="star" size={17} color={colors.star} filled /> : null}
                  <Text style={styles.pstatNum}>{profile?.rating?.count ? profile.rating.average.toFixed(1).replace('.', ',') : '–'}</Text>
                </View>
                <Text style={styles.pstatLabel}>{nb.youth.reviewsCount(profile?.rating?.count ?? 0)}</Text>
              </View>
              <View style={[styles.pstat, styles.pstatSep]} accessible accessibilityLabel={`${offers.length} ${nb.youth.offersSent}`}>
                <Text style={styles.pstatNum}>{offers.length}</Text>
                <Text style={styles.pstatLabel}>{nb.youth.offersSent}</Text>
              </View>
            </FadeUp>
            {/* «Attest fra MinNabo» (0101) */}
            {profile ? (
              <FadeUp delay={115}>
                <AttestCard profile={profile} />
              </FadeUp>
            ) : null}
            <FadeUp delay={130}>
              <Text style={[text.eyebrow, styles.mb8]}>{nb.youth.exploreTitle}</Text>
              <ListGroup>
                <ListRow iconBg={colors.cyanTint} iconColor={colors.cyanDeep} icon="search" title={nb.youth.searchCta} onPress={() => router.push('/sok')} />
                <ListRow iconBg={colors.warnTint} iconColor={colors.warn} icon="users" title={nb.youth.community} subtitle={nb.youth.communitySub} onPress={() => router.push('/fellesskap-ung')} />
                <ListRow iconBg={colors.cyanTint} iconColor={colors.cyanDeep} icon="pinned" title={nb.youth.board} subtitle={nb.youth.boardSub} onPress={() => router.push('/oppslagstavle')} />
                <ListRow iconBg={colors.limeTint} iconColor={colors.limeDeep} icon="home" title={nb.youth.nabolag} subtitle={nb.youth.nabolagSub} onPress={() => router.push('/nabolag')} />
                <ListRow iconBg={colors.limeTint} iconColor={colors.limeDeep} icon="bookmark" title={nb.youth.savedSearches} subtitle={nb.youth.savedSearchesSub} onPress={() => router.push('/lagrede')} />
                <ListRow iconBg={colors.cyanTint} iconColor={colors.cyanDeep} icon="montering" title={nb.lend.title} subtitle={nb.lend.youthRow} onPress={() => router.push('/utlan')} />
              </ListGroup>
            </FadeUp>
            <FadeUp delay={200}>
              <Text style={[text.eyebrow, styles.mb8]}>{nb.youth.accountTitle}</Text>
              <ListGroup>
                <ListRow iconBg={colors.limeTint} iconColor={colors.limeDeep} icon="hand" title={nb.youth.myPosts} subtitle={nb.youth.myPostsSub} onPress={() => router.push('/mine')} />
                <ListRow iconBg={colors.okTint} iconColor={colors.ok} icon="shield" title={nb.youth.safety} subtitle={nb.youth.safetySub} onPress={() => router.push('/sikkerhet')} />
                <ListRow icon="lock" title={nb.youth.privacy} onPress={() => router.push('/personvern')} />
                <ListRow iconBg={colors.cyanTint} iconColor={colors.cyanDeep} icon="users" title={nb.guardian.rowYouth} subtitle={nb.guardian.rowYouthSub} onPress={() => setGuardian(true)} />
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
  offerCard: { minHeight: 138, borderRadius: radius.listingCard, backgroundColor: colors.cyan2, overflow: 'hidden' },
  offerBody: { paddingVertical: 18, paddingLeft: 18, paddingRight: 130, gap: 5 },
  offerTitle: { ...text.h2, fontSize: 24, lineHeight: 28, color: colors.white },
  offerSub: { fontFamily: text.body.fontFamily, fontSize: 14, lineHeight: 19, color: colors.white },
  offerGo: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  offerGoText: { fontFamily: text.label.fontFamily, fontSize: 14.5, color: colors.lime },
  noJobs: { alignItems: 'center', gap: 6, paddingVertical: 14 },
  moreTitle: { fontSize: 18, marginBottom: 10 },
  doors: { borderRadius: radius.listingCard, backgroundColor: colors.white, ...shadow.card },
  door: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 14 },
  doorFirst: { borderTopLeftRadius: radius.listingCard, borderTopRightRadius: radius.listingCard },
  doorLast: { borderBottomLeftRadius: radius.listingCard, borderBottomRightRadius: radius.listingCard },
  doorRing: { width: 54, height: 54, borderRadius: 27, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  doorDisc: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  doorTitle: { fontFamily: text.label.fontFamily, fontSize: 16, color: colors.ink, marginBottom: 2 },
  doorGo: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  doorSep: { position: 'absolute', left: 82, right: 0, bottom: 0, height: 1, backgroundColor: colors.line2 },
  safeTitle: { fontFamily: text.label.fontFamily, fontSize: 16, color: colors.white },
  safeBody: { fontFamily: text.body.fontFamily, fontSize: 13.5, lineHeight: 19, color: colors.onInk78, marginTop: 2 },
  safeGo: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  safeGoText: { fontFamily: text.label.fontFamily, fontSize: 13.5, color: colors.lime },
  safeBlob: { position: 'absolute', right: -50, top: -60, width: 160, height: 160, borderRadius: 80, backgroundColor: colors.onInk16b },
  safeRing: { width: 54, height: 54, borderRadius: 27, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  mt4: { marginTop: 4 },
  centerText: { textAlign: 'center' },
  mx: { marginHorizontal: screenPadding },
  facts: { flexDirection: 'row', gap: 8 },
  fact: { flex: 1, minWidth: 0, padding: 12, gap: 3, borderRadius: radius.card, backgroundColor: colors.bg },
  factIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  factLabel: { fontFamily: text.bodySemi.fontFamily, fontSize: 11.5, color: colors.mute },
  factValue: { fontFamily: text.label.fontFamily, fontSize: 13.5, lineHeight: 17, color: colors.ink },
  poster: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line2 },
  posterRating: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 30, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: colors.bg },
  emptyText: { fontSize: 16, lineHeight: 22, maxWidth: 300 },
  faces: { gap: 14, paddingHorizontal: screenPadding, paddingTop: 4 },
  face: { width: 62, alignItems: 'center', gap: 5 },
  faceRing: { padding: 2.5, borderRadius: 34, borderWidth: 2, borderColor: 'transparent' },
  faceRingOn: { borderColor: colors.lime },
  faceName: { fontFamily: text.bodySemi.fontFamily, fontSize: 12, color: colors.ink2, maxWidth: 62 },
  faceNameOn: { fontFamily: text.label.fontFamily, color: colors.ink },
  panel: { borderRadius: radius.listingCard, backgroundColor: colors.white, overflow: 'hidden' },
  sep: { height: 1, marginLeft: 82, backgroundColor: colors.line2 },
  inboxEmpty: { alignItems: 'center', gap: 10, paddingVertical: 24 },
  inboxEmptyRing: { width: 84, height: 84, borderRadius: 42, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.cyan, alignItems: 'center', justifyContent: 'center' },
  inboxEmptyDisc: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.cyanTint, alignItems: 'center', justifyContent: 'center' },
  inboxLockIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  pcover: { alignSelf: 'stretch', height: 112, borderRadius: radius.listingCard, backgroundColor: colors.cyanTint, overflow: 'hidden' },
  pblob: { position: 'absolute', borderRadius: 999 },
  pblobL: { width: 190, height: 190, left: -60, top: -50, backgroundColor: colors.limeTint },
  pblobR: { width: 210, height: 210, right: -80, top: -100, backgroundColor: colors.white, opacity: 0.6 },
  pring: { position: 'absolute', left: '50%', top: 16, marginLeft: -86, width: 172, height: 172, borderRadius: 86, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.cyan },
  pdot: { position: 'absolute', borderRadius: 99 },
  pdot1: { width: 10, height: 10, left: 30, top: 24, backgroundColor: colors.lime },
  pdot2: { width: 8, height: 8, right: 44, top: 32, backgroundColor: colors.cyan },
  pav: { marginTop: -56, padding: 4, borderRadius: 60, backgroundColor: colors.white, alignItems: 'center' },
  pname: { ...text.h2, fontSize: 26, lineHeight: 30, marginTop: 6, textAlign: 'center' },
  pstats: { flexDirection: 'row', borderRadius: radius.card, backgroundColor: colors.white, paddingVertical: 14 },
  pstat: { flex: 1, alignItems: 'center', gap: 4, paddingHorizontal: 6 },
  pstatSep: { borderLeftWidth: 1, borderLeftColor: colors.line2 },
  pstatNum: { fontFamily: text.h1.fontFamily, fontSize: 22, lineHeight: 26, color: colors.ink },
  pstatLabel: { fontFamily: text.body.fontFamily, fontSize: 12, lineHeight: 15, color: colors.mute, textAlign: 'center' },
  row6c: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { flexGrow: 1, flexBasis: '47%', padding: 14, gap: 3, borderRadius: radius.card, backgroundColor: colors.surface },
  tileIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  tileTitle: { ...text.label, fontSize: 15 },
  safe: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, marginTop: 12, marginBottom: 14, borderRadius: radius.listingCard, backgroundColor: colors.ink, overflow: 'hidden' },
  safeIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
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
    backgroundColor: colors.cyanTint,
  },
  lockNoteText: { flex: 1, color: colors.ink2 },
  profileHead: { alignItems: 'center', gap: 6 },
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
