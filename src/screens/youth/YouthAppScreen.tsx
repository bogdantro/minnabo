import { useMemo, useState } from 'react';
import { serverMessage } from '@/lib/errors';
import { useActiveCategories } from '@/hooks/useCategories';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GuardianSheet } from '@/components/GuardianSheet';
import { LocationSheet } from '@/components/LocationSheet';
import nb from '@/i18n/nb';
import type { Listing } from '@/domain/types';
import { categoryArtId, categoryLabel } from '@/domain/categories';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { useConversations, useListings, useListingsByIds, useProfile, useSentProposals, useStartConversation } from '@/api/queries';
import { formatPrice } from '@/domain/price';
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
import { NavFrame, NavItem } from '@/components/BottomNav';
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
  ScaleIn,
  Screen,
  SectionHeader,
  Sheet,
  SlideIn,
  Spinner,
  StatTile,
  type IconKey,
} from '@/components/ui';

const logo = require('../../../assets/logo-icon.png');

type View4 = 'oppdrag' | 'tilbud' | 'innboks' | 'profil';
type OfferStatus = 'sendt' | 'venter' | 'godtatt' | 'trukket' | 'avslatt';
type Offer = {
  id: string;
  /** set for offers stored on the backend → the row opens the real chat */
  conversationId?: string;
  listingId: string;
  category: CategoryId;
  title: string;
  who: string;
  price: string;
  message: string;
  status: OfferStatus;
};
type SheetStep = 'detail' | 'form' | 'busy' | 'done';

const YOUTH_CATS: CategoryId[] = ['hage', 'dyrepass', 'data', 'snomaking'];
const STATUS_TONE: Record<OfferStatus, 'dark' | 'warn' | 'ok' | 'neutral'> = {
  sendt: 'dark',
  venter: 'warn',
  godtatt: 'ok',
  trukket: 'neutral',
  avslatt: 'neutral',
};

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
 * Youth app shell (design/screens/OppdragUng.dc.html): 4 tabs, no Legg ut.
 * Oppdrag, tilbud and conversations are real; what a youth account may do is
 * enforced on the backend (0038_vipps_youth.sql).
 */
export function YouthAppScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const active = useActiveCategories();
  const CATS: (CategoryId | null)[] = [null, ...YOUTH_CATS.filter((c) => active.includes(c))];
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
  const [day, setDay] = useState(0);
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
    setDay(0);
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
          scheduledText: nb.youth.days[day],
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
                <Avatar initials={id.initials} colorKey="b" size={40} />
              </Pressable>
            </View>
          </View>
        }
      >
        {view === 'oppdrag' ? (
          <>
            <FadeUp style={styles.heading}>
              <Text style={text.eyebrow}>{nb.oppdrag.hello(id.firstName)}</Text>
              <Text style={text.h1} accessibilityRole="header">
                {nb.youth.homeTitle}
              </Text>
            </FadeUp>
            <FadeUp delay={100} style={styles.px}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={nb.youth.pickKommuneA11y}
                onPress={() => setLocOpen(true)}
                style={styles.loc}
              >
                <Icon name="pin" size={18} color={colors.limeDeep} />
                <Text style={[text.label, styles.locK, styles.flex]}>
                  {municipality ? nb.oppdrag.kommune(municipality) : nb.youth.pickKommune}
                </Text>
                <Text style={[text.link, styles.locChange]}>{nb.oppdrag.change}</Text>
              </Pressable>
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
            <View style={[styles.px, styles.mt18]}>
              <PaymentNote style={styles.noteCenter} />
            </View>
          </>
        ) : null}

        {view === 'tilbud' ? (
          <View style={[styles.px, styles.stack]}>
            <FadeUp>
              <Text style={text.h1}>{nb.youth.myOffers}</Text>
            </FadeUp>
            <FadeUp delay={50}>
              <Text style={[text.meta, { fontSize: 14 }]}>{nb.youth.myOffersSub}</Text>
            </FadeUp>
            {offers.length === 0 ? (
              <Text style={[text.body, styles.empty]}>{nb.youth.noOffers}</Text>
            ) : (
              offers.map((o) => (
                <FadeUp key={o.id} style={styles.orow}>
                  <CategoryArt category={o.category} width={52} height={52} radius={15} iconSize={22} />
                  <View style={styles.orowBody}>
                    <Text style={[text.cardTitle, { fontSize: 15 }]} numberOfLines={1}>
                      {o.title}
                    </Text>
                    <Text style={text.meta}>
                      {o.who} · <Text style={[text.num, styles.orowPrice]}>{o.price}</Text>
                    </Text>
                    <Pill label={nb.youth.status[o.status]} tone={STATUS_TONE[o.status]} />
                  </View>
                  {o.status === 'sendt' || o.status === 'venter' ? (
                    <Button
                      label={nb.youth.withdraw}
                      variant="ghost"
                      size="sm"
                      block={false}
                      onPress={() => void withdraw(o)}
                    />
                  ) : null}
                </FadeUp>
              ))
            )}
            <Button label={nb.youth.findMore} icon="search" onPress={() => go('oppdrag')} style={styles.mt6} />
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
            {chats.length === 0 ? (
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
              <Avatar initials={id.initials} colorKey="b" size={88} />
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
            <FadeUp delay={150}>
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
            <FadeUp delay={200}>
              <ListGroup>
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
          </View>
        ) : null}
      </Screen>

      <NavFrame>
        <NavItem label={nb.youth.tabs.oppdrag} icon="clip" active={view === 'oppdrag'} onPress={() => go('oppdrag')} />
        <NavItem label={nb.youth.tabs.tilbud} icon="tag" active={view === 'tilbud'} badge={pending} onPress={() => go('tilbud')} />
        <NavItem label={nb.youth.tabs.innboks} icon="msg" active={view === 'innboks'} badge={chats.length ? 1 : 0} onPress={() => go('innboks')} />
        <NavItem label={nb.youth.tabs.profil} icon="user" active={view === 'profil'} onPress={() => go('profil')} />
      </NavFrame>

      <Sheet visible={!!cur} onClose={closeSheet} scroll>
        {cur && step === 'detail' ? (
          <View style={styles.gap14}>
            <CategoryArt
              category={categoryArtId(cur.category.slug)}
              uri={cur.images[0]?.url}
              height={130}
              radius={radius.card}
              iconSize={44}
            />
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
            <Field label={nb.youth.whenCan}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.days}>
                {nb.youth.days.map((d, i) => (
                  <Pressable
                    key={d}
                    accessibilityRole="button"
                    accessibilityState={{ selected: day === i }}
                    onPress={() => setDay(i)}
                    style={[styles.dchip, day === i && styles.dchipOn]}
                  >
                    <Text style={[text.day, { color: day === i ? colors.white : colors.ink2 }]}>{d}</Text>
                  </Pressable>
                ))}
              </ScrollView>
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
            <FadeUp delay={250} style={styles.stretch}>
              <Button label={nb.youth.seeOffers} variant="ink" onPress={() => go('tilbud')} />
            </FadeUp>
            <Button label={nb.youth.close} variant="text" block={false} onPress={closeSheet} />
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
  heading: { paddingHorizontal: screenPadding, paddingTop: 10, gap: 8 },
  loc: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    marginTop: 16,
  },
  locK: { fontSize: 14.5 },
  locChange: { fontSize: 13.5 },
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
  days: { gap: 8 },
  dchip: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: radius.day,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.white,
    justifyContent: 'center',
  },
  dchipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
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
