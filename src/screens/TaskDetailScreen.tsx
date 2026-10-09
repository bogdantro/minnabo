import { useRef, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Listing } from '@/domain/types';
import { categoryArtId } from '@/domain/categories';
import nb from '@/i18n/nb';
import { canEditListing, canEditProposal, editListingHref, isOpenListing, isTakenListing } from '@/domain/editing';
import {
  useIsSaved,
  useListingOfferCount,
  useProfile,
  useProposalsForListing,
  useReplyMinutes,
  useUnreadNotificationCount,
} from '@/api/queries';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { postedAgo, replyTime } from '@/lib/datetime';
import { safePush } from '@/lib/nav';
import { shareListing } from '@/lib/share';
import { toast } from '@/lib/toast';
import { categoryColors, categoryLabels, colors, fonts, radius, screenPadding, shadow, text } from '@/theme/theme';
import { listingPrice } from '@/components/OppdragCard';
import { GiTilbudSheet } from '@/components/GiTilbudSheet';
import {
  Avatar,
  Button,
  CategoryArt,
  FadeUp,
  FooterRow,
  Icon,
  IconButton,
  Note,
  Pill,
  StickyFooter,
  TextLink,
  VerifiedBadge,
  type IconKey,
} from '@/components/ui';

const logo = require('../../assets/logo-icon.png');
const GAL_H = 268;
const km = (d: number) => d.toLocaleString('nb-NO', { maximumFractionDigits: 1 });

/** Oppdragsdetaljer (design/screens/Oppdragsdetaljer.dc.html). */
export function TaskDetailScreen({ listing, onBack }: { listing: Listing; onBack: () => void }) {
  const me = useCurrentUser();
  const insets = useSafeAreaInsets();
  const unread = useUnreadNotificationCount();
  const [saved, toggleSaved] = useIsSaved(listing.id);
  const proposals = useProposalsForListing(listing.id);
  const offerCount = useListingOfferCount(listing.id).data;
  const replyMinutes = useReplyMinutes(listing.owner.id).data;
  const invitedFirst = (useProfile(listing.invitedProfileId ?? '').data?.displayName ?? '').split(' ')[0] || nb.detail.aNeighbour;
  const [sheet, setSheet] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [sentConv, setSentConv] = useState<string | null | undefined>(undefined);

  const task = listing.task;
  const owner = listing.owner;
  const first = owner.displayName.split(' ')[0];
  const isOwner = !!me.id && owner.id === me.id;
  const cat = categoryArtId(listing.category.slug);
  const price = listingPrice(listing);
  const place = listing.location.place || listing.location.municipality;

  // My own (non-withdrawn) offer on this oppdrag → footer shows "Tilbud sendt".
  const mine = (proposals.data ?? []).find((p) => p.fromProfileId === me.id && p.status !== 'WITHDRAWN');
  const sent = sentConv !== undefined || !!mine;
  const chatId = sentConv ?? mine?.conversationId ?? null;

  const onSave = () => {
    toggleSaved();
    if (saved) toast.info(nb.detail.unsavedToast, { icon: 'x', bottom: 170 });
    else toast.success(nb.detail.savedToast, { icon: 'heart', bottom: 170 });
  };
  const openChat = (id: string | null) => {
    setSheet(false);
    safePush(id ? `/chat/${id}` : '/innboks');
  };

  const placeLine = [
    [listing.location.place, listing.location.municipality].filter((x, i, a) => x && a.indexOf(x) === i).join(', '),
    typeof listing.location.distanceKm === 'number' ? `ca. ${km(listing.location.distanceKm)} km` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const cells: { icon: IconKey; label: string; value: string }[] = [
    { icon: 'pin', label: nb.detail.place, value: placeLine },
    ...(task?.scheduledText ? [{ icon: 'cal' as const, label: nb.detail.date, value: task.scheduledText }] : []),
    ...(task?.durationText ? [{ icon: 'hourglass' as const, label: nb.detail.duration, value: task.durationText }] : []),
    { icon: 'clock', label: nb.detail.posted, value: postedAgo(listing.createdAt, new Date(), true) },
  ];

  const practical: { icon: IconKey; title: string; sub?: string }[] = [
    ...(task?.intake ?? []).map((a) => ({ icon: 'info' as const, title: a.label, sub: a.value })),
    ...(task?.meetingNote ? [{ icon: 'users' as const, title: nb.detail.meeting, sub: task.meetingNote }] : []),
    ...(owner.homeNotes ? [{ icon: 'home' as const, title: nb.detail.home, sub: owner.homeNotes }] : []),
  ];
  const equipment = (task?.equipment ?? '')
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const paragraphs = (task?.description ?? '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

  const badges = [
    { key: 'vipps', label: nb.detail.vipps, icon: null as IconKey | null },
    ...owner.verifications
      .filter((v) => v.verified)
      .map((v) => ({
        key: v.kind,
        label: v.kind === 'PHONE' ? nb.detail.phone : v.kind === 'EMAIL' ? nb.detail.email : nb.detail.business,
        icon: (v.kind === 'PHONE' ? 'phone' : v.kind === 'EMAIL' ? 'mail' : 'building') as IconKey,
      })),
  ];

  return (
    <View style={styles.wrap}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 170 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {/* detail bar */}
        <View style={[styles.dbar, { paddingTop: insets.top + 12 }]}>
          <IconButton icon="back" accessibilityLabel="Tilbake" onPress={onBack} />
          <View style={styles.mid}>
            <Image source={logo} style={styles.logo} />
            <Text style={styles.midText} accessibilityRole="header">
              {nb.detail.header}
            </Text>
          </View>
          <IconButton
            icon="bell"
            iconSize={18}
            dot={unread > 0}
            accessibilityLabel={unread > 0 ? `Varsler, ${unread} uleste` : 'Varsler'}
            onPress={() => safePush('/varsler')}
          />
          <Pressable accessibilityRole="link" accessibilityLabel="Åpne profil" onPress={() => safePush('/profil')} style={styles.avbtn}>
            <Avatar initials={me.initials} uri={me.avatarUrl} me size={32} />
          </Pressable>
        </View>

        {/* gallery */}
        <FadeUp style={styles.px}>
          <Gallery listing={listing} saved={saved} onSave={onSave} />
        </FadeUp>

        {/* title */}
        <FadeUp delay={100} style={[styles.px, styles.titleBlock]}>
          <View style={styles.row8}>
            <Pill label={nb.detail.open} tone="need" dot size="lg" />
            <Pill label={categoryLabels[cat]} tone="neutral" icon={cat} size="lg" />
            {task?.isDugnad ? <Pill label={nb.card.dugnad} tone="neutral" icon="users" size="lg" /> : null}
            {task?.recurrence ? <Pill label={nb.detail.repeats[task.recurrence]} tone="neutral" icon="repeat" size="lg" /> : null}
          </View>
          <Text style={text.h1} accessibilityRole="header">
            {listing.title}
          </Text>
          {/* "Be om hjelp igjen": only the invited helper and the owner get here */}
          {listing.invitedProfileId ? (
            <View style={styles.invited}>
              <Icon name="repeat" size={18} color={colors.cyanDeep} />
              <View style={styles.flex1}>
                <Text style={styles.invitedTitle}>
                  {isOwner ? nb.detail.invitedOwner(invitedFirst) : nb.detail.invitedYou(first)}
                </Text>
                <Text style={text.meta}>{isOwner ? nb.detail.invitedOwnerSub(invitedFirst) : nb.detail.invitedYouSub}</Text>
              </View>
            </View>
          ) : null}
        </FadeUp>

        {/* budget */}
        <FadeUp delay={150} style={[styles.px, styles.mt14]}>
          <View style={[styles.budget, shadow.card]}>
            <Text style={[text.eyebrow, styles.budgetEyebrow]}>{price.label || nb.forMeg.price}</Text>
            <Text style={[text.num, styles.budgetNum]}>{price.value}</Text>
            {price.label ? <Text style={text.meta}>{nb.detail.budgetSub(first)}</Text> : null}
          </View>
        </FadeUp>

        {/* info grid */}
        <FadeUp delay={200} style={[styles.px, styles.mt12]}>
          <View style={styles.igrid}>
            {cells.map((c) => (
              <View key={c.label} style={[styles.icell, shadow.card]}>
                <View style={styles.ic}>
                  <Icon name={c.icon} size={18} color={colors.limeDeep} />
                </View>
                <Text style={styles.icellLabel}>{c.label}</Text>
                <Text style={styles.icellValue}>{c.value}</Text>
              </View>
            ))}
          </View>
        </FadeUp>

        {/* approximate area */}
        <View style={[styles.px, styles.mt26]}>
          <Text style={styles.sec}>{nb.detail.area}</Text>
          <View style={[styles.card, styles.mapCard, shadow.card]}>
            <AreaMap place={place} />
            <Note icon="lock" style={styles.mapNote}>
              {nb.detail.areaNote}
            </Note>
          </View>
        </View>

        {paragraphs.length ? (
          <View style={[styles.px, styles.mt26]}>
            <Text style={styles.sec}>{nb.detail.description}</Text>
            {paragraphs.map((p, i) => (
              <Text key={i} style={[styles.para, i > 0 && styles.mt10]}>
                {p}
              </Text>
            ))}
          </View>
        ) : null}

        {practical.length ? (
          <View style={[styles.px, styles.mt24]}>
            <Text style={styles.sec}>{nb.detail.practical}</Text>
            <View style={[styles.card, styles.pcard, shadow.card]}>
              {practical.map((r, i) => (
                <View key={`${r.title}-${i}`} style={[styles.prow, i > 0 && styles.prowLine]}>
                  <View style={styles.pi}>
                    <Icon name={r.icon} size={16} color={colors.ink2} />
                  </View>
                  <View style={styles.gap2}>
                    <Text style={[text.label, styles.f145]}>{r.title}</Text>
                    {r.sub ? <Text style={text.meta}>{r.sub}</Text> : null}
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {equipment.length ? (
          <View style={[styles.px, styles.mt24]}>
            <Text style={styles.sec}>{nb.detail.equipment}</Text>
            <View style={styles.eqRow}>
              {equipment.map((e) => (
                <View key={e} style={styles.eq}>
                  <Icon name="check" size={16} color={colors.limeDeep} />
                  <Text style={styles.eqText}>{e}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* owner */}
        <View style={[styles.px, styles.mt26]}>
          <Text style={styles.sec}>{nb.detail.postedBy}</Text>
          <View style={[styles.card, styles.ownerCard, shadow.card]}>
            <View style={styles.row14}>
              <Avatar initials={owner.initials} uri={owner.avatarUrl} seed={owner.id} size={56} />
              <View style={styles.ownerText}>
                <Text style={[text.label, styles.f17]} numberOfLines={1}>
                  {owner.displayName}
                </Text>
                {owner.rating?.count ? (
                  <View style={styles.starsRow}>
                    <Icon name="star" size={14} color={colors.star} filled />
                    <Text style={styles.starsVal}>{km(owner.rating.average)}</Text>
                    <Text style={styles.starsMeta}>{nb.detail.ratings(owner.rating.count)}</Text>
                  </View>
                ) : null}
                {owner.memberSince ? <Text style={text.meta}>{nb.detail.memberSince(owner.memberSince)}</Text> : null}
              </View>
              <TextLink label={nb.detail.profile} icon="right" onPress={() => safePush(`/profil/${owner.id}`)} />
            </View>
            <View style={styles.gap8}>
              {badges.map((b) =>
                b.icon ? (
                  <View key={b.key} style={styles.row6}>
                    <Icon name={b.icon} size={16} color={colors.verified} />
                    <Text style={[text.verified, { color: colors.verified }]}>{b.label}</Text>
                    <Icon name="check" size={14} color={colors.verified} />
                  </View>
                ) : (
                  <VerifiedBadge key={b.key} label={b.label} />
                ),
              )}
            </View>
            {replyMinutes != null ? (
              <View style={styles.reply}>
                <Icon name="zap" size={18} color={colors.limeDeep} />
                <Text style={styles.replyText}>{nb.detail.replyWithin(replyTime(replyMinutes))}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* offers count – a number only, never who */}
        {offerCount && offerCount.count > 0 ? (
          <View style={[styles.px, styles.mt14]}>
            <View style={[styles.card, styles.offers, shadow.card]}>
              <View style={styles.avst} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                {Array.from({ length: Math.min(offerCount.count, 3) }, (_, i) => (
                  <View key={i} style={[styles.anon, i > 0 && styles.anonNext]}>
                    <Icon name="user" size={16} color={colors.mute} />
                  </View>
                ))}
              </View>
              <View style={styles.offersText}>
                <Text style={styles.offersTitle}>{nb.detail.offerCount(offerCount.count, offerCount.mine || sent)}</Text>
                <Text style={text.meta}>{nb.detail.offerCountSub}</Text>
              </View>
            </View>
          </View>
        ) : null}

        <View style={[styles.px, styles.reportRow]}>
          <Pressable
            accessibilityRole="link"
            onPress={() => safePush(`/rapporter?listing=${listing.id}`)}
            style={styles.report}
          >
            <Icon name="flag" size={16} color={colors.mute} />
            <Text style={[text.link, { color: colors.mute }]}>{nb.detail.report}</Text>
          </Pressable>
        </View>
      </ScrollView>

      <StickyFooter>
        <Note style={styles.footNote}>{nb.detail.payNote}</Note>
        {isOwner ? (
          <FooterRow>
            {canEditListing(listing.status) ? (
              <Button
                label={nb.detail.edit}
                icon="edit"
                variant="ghost"
                onPress={() => safePush(editListingHref(listing.id))}
                block={false}
                style={styles.flex1}
              />
            ) : null}
            <Button label={nb.detail.receivedOffers} iconRight="arrow" onPress={() => safePush('/tilbud')} block={false} style={styles.flex115} />
          </FooterRow>
        ) : sent ? (
          <FadeUp>
            <FooterRow>
              <Button label={nb.detail.seeChat} icon="msg" variant="ghost" onPress={() => openChat(chatId)} block={false} style={styles.flex1} />
              {mine && canEditProposal(mine.status) ? (
                <Button label={nb.giTilbud.editOffer} icon="edit" onPress={() => setEditOpen(true)} block={false} style={styles.flex115} />
              ) : (
                <View style={styles.sentbtn} accessibilityRole="text" accessibilityState={{ disabled: true }}>
                  <Icon name="checks" size={18} color={colors.mute} />
                  <Text style={styles.sentText}>{nb.detail.offerSent}</Text>
                </View>
              )}
            </FooterRow>
          </FadeUp>
        ) : !isOpenListing(listing.status) ? (
          <View style={styles.taken} accessibilityRole="text">
            <Icon name="hand" size={18} color={colors.mute} />
            <View style={styles.flex1}>
              <Text style={styles.sentText}>{isTakenListing(listing.status) ? nb.detail.taken : nb.detail.unavailable}</Text>
              <Text style={text.meta}>{isTakenListing(listing.status) ? nb.detail.takenSub : nb.detail.unavailableSub}</Text>
            </View>
          </View>
        ) : (
          <FooterRow>
            <Button
              label={nb.detail.sendMessage}
              icon="msg"
              variant="ghost"
              onPress={() => safePush(`/chat/start?listing=${listing.id}`)}
              block={false}
              style={styles.flex1}
            />
            <Button label={nb.detail.giveOffer} iconRight="arrow" onPress={() => setSheet(true)} block={false} style={styles.flex115} />
          </FooterRow>
        )}
      </StickyFooter>

      {!isOwner ? (
        <GiTilbudSheet
          listing={listing}
          visible={sheet}
          onClose={() => setSheet(false)}
          onSent={(id) => setSentConv(id)}
          onOpenChat={openChat}
        />
      ) : null}
      {!isOwner && mine && editOpen ? (
        <GiTilbudSheet
          key={`edit-${mine.id}`}
          listing={listing}
          editing={mine}
          visible={editOpen}
          onClose={() => setEditOpen(false)}
          onSent={() => undefined}
          onOpenChat={openChat}
        />
      ) : null}
    </View>
  );
}

/* ---------- gallery ---------- */

function Gallery({ listing, saved, onSave }: { listing: Listing; saved: boolean; onSave: () => void }) {
  const { width } = useWindowDimensions();
  const w = width - screenPadding * 2;
  const ref = useRef<ScrollView>(null);
  const [i, setI] = useState(0);
  const imgs = listing.images;
  const n = imgs.length;
  const cat = categoryArtId(listing.category.slug);

  const go = (to: number) => {
    const next = (to + n) % n;
    ref.current?.scrollTo({ x: next * w, animated: true });
    setI(next);
  };
  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => setI(Math.round(e.nativeEvent.contentOffset.x / w));

  return (
    <View style={[styles.gal, shadow.medium, { backgroundColor: categoryColors[cat].bg }]} accessibilityLabel={nb.detail.galleryLabel}>
      {n ? (
        <ScrollView ref={ref} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onEnd}>
          {imgs.map((img) => (
            <CategoryArt key={img.id} category={cat} uri={img.url} width={w} height={GAL_H} />
          ))}
        </ScrollView>
      ) : (
        <CategoryArt category={cat} width={w} height={GAL_H} iconSize={64} />
      )}
      <View style={styles.gtop}>
        <IconButton
          icon="heart"
          iconSize={18}
          variant="glass"
          iconColor={saved ? colors.heart : colors.ink}
          iconFilled={saved}
          accessibilityLabel={saved ? nb.detail.unsave : nb.detail.save}
          onPress={onSave}
          style={saved ? styles.savedBtn : undefined}
        />
        <IconButton icon="share" iconSize={18} variant="glass" accessibilityLabel={nb.detail.share} onPress={() => void shareListing(listing.id, listing.title)} />
      </View>
      {n > 1 ? (
        <>
          <IconButton icon="left" variant="glass" accessibilityLabel={nb.detail.prevImage} onPress={() => go(i - 1)} style={[styles.gnav, styles.gnavL]} />
          <IconButton icon="right" variant="glass" accessibilityLabel={nb.detail.nextImage} onPress={() => go(i + 1)} style={[styles.gnav, styles.gnavR]} />
          <View style={styles.gdots} pointerEvents="none">
            {imgs.map((img, k) => (
              <View key={img.id} style={[styles.gdot, k === i && styles.gdotOn]} />
            ))}
          </View>
          <View style={styles.gnum}>
            <Text style={styles.gnumText}>{`${i + 1}/${n}`}</Text>
          </View>
        </>
      ) : null}
    </View>
  );
}

/* ---------- approximate area ---------- */

/** Stylised map with a dashed circle – approximate area only, never a pin (rule 6). */
function AreaMap({ place }: { place: string }) {
  return (
    <View style={styles.map} accessible accessibilityRole="image" accessibilityLabel={nb.detail.areaLabel(place)}>
      <View style={[styles.water, { left: -40, top: -20, width: 110, height: 240, transform: [{ rotate: '8deg' }] }]} />
      <View style={[styles.park, { right: 30, top: 18, width: 70, height: 46 }]} />
      <View style={[styles.park, { left: 110, bottom: 10, width: 60, height: 38 }]} />
      <View style={[styles.road, { left: 60, right: -20, top: 62, height: 9, transform: [{ rotate: '-8deg' }] }]} />
      <View style={[styles.road, { left: 40, right: 0, top: 128, height: 7, transform: [{ rotate: '5deg' }] }]} />
      <View style={[styles.road, { left: 190, top: -20, width: 8, height: 230, transform: [{ rotate: '14deg' }] }]} />
      <View style={[styles.road, { left: 120, top: 20, width: 6, height: 170, transform: [{ rotate: '-22deg' }] }]} />
      <View style={styles.area} />
      <View style={[styles.alabel, shadow.card]}>
        <Text style={styles.alabelText}>{place}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  px: { paddingHorizontal: screenPadding },
  // CSS `flex: 1` never shrinks below the label; grow from the content width instead.
  flex1: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto' },
  flex115: { flexGrow: 1.15, flexShrink: 1, flexBasis: 'auto' },
  f145: { fontSize: 14.5 },
  f17: { fontSize: 17 },
  gap2: { gap: 2, flex: 1 },
  gap8: { gap: 8 },
  mt10: { marginTop: 10 },
  mt12: { marginTop: 12 },
  mt14: { marginTop: 14 },
  mt24: { marginTop: 24 },
  mt26: { marginTop: 26 },
  row6: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  row8: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  row14: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  dbar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 10 },
  mid: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  logo: { width: 26, height: 26 },
  midText: { fontFamily: text.label.fontFamily, fontSize: 17, color: colors.ink },
  avbtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  gal: { height: GAL_H, borderRadius: 30, overflow: 'hidden', marginTop: 4 },
  gtop: { position: 'absolute', top: 12, right: 12, flexDirection: 'row', gap: 8 },
  savedBtn: { backgroundColor: colors.savedBg },
  gnav: { position: 'absolute', top: GAL_H / 2 - 22 },
  gnavL: { left: 12 },
  gnavR: { right: 12 },
  gdots: { position: 'absolute', left: 0, right: 0, bottom: 22, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  gdot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.glassBorder },
  gdotOn: { width: 20, backgroundColor: colors.white },
  gnum: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    height: 30,
    paddingHorizontal: 11,
    borderRadius: radius.pill,
    backgroundColor: colors.glassLight,
    justifyContent: 'center',
  },
  gnumText: { fontFamily: fonts.bodyHeavy, fontSize: 12.5, color: colors.ink },

  titleBlock: { marginTop: 18, gap: 10 },
  budget: { backgroundColor: colors.budgetBg, borderRadius: radius.card, paddingVertical: 16, paddingHorizontal: 18, gap: 4 },
  budgetEyebrow: { color: colors.limeDeep },
  budgetNum: { fontSize: 34, lineHeight: 36 },
  igrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  icell: {
    width: '48.5%',
    flexGrow: 1,
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 14,
    gap: 8,
  },
  ic: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.limeTint, alignItems: 'center', justifyContent: 'center' },
  icellLabel: { fontFamily: text.label.fontFamily, fontSize: 11.5, letterSpacing: 0.7, textTransform: 'uppercase', color: colors.mute },
  icellValue: { fontFamily: text.label.fontFamily, fontSize: 15, lineHeight: 20, color: colors.ink },

  sec: { fontFamily: text.h3.fontFamily, fontSize: 19, lineHeight: 22, letterSpacing: -0.38, color: colors.ink, marginBottom: 12 },
  card: { backgroundColor: colors.white, borderRadius: radius.card },
  mapCard: { padding: 8 },
  map: { height: 178, borderRadius: 22, overflow: 'hidden', backgroundColor: colors.mapBg },
  water: { position: 'absolute', backgroundColor: colors.mapWater, borderTopRightRadius: 66, borderBottomRightRadius: 66 },
  park: { position: 'absolute', borderRadius: 24, backgroundColor: colors.mapPark },
  road: { position: 'absolute', backgroundColor: colors.white, borderRadius: 6 },
  area: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 132,
    height: 132,
    marginLeft: -66,
    marginTop: -66,
    borderRadius: 66,
    backgroundColor: colors.areaFill,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.areaBorder,
  },
  alabel: {
    position: 'absolute',
    alignSelf: 'center',
    top: 89 - 15,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    justifyContent: 'center',
  },
  alabelText: { fontFamily: text.label.fontFamily, fontSize: 12.5, color: colors.ink },
  mapNote: { paddingTop: 10, paddingHorizontal: 8, paddingBottom: 6 },
  para: { ...text.body, color: colors.ink2 },
  pcard: { paddingVertical: 4, paddingHorizontal: 16 },
  prow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 11 },
  prowLine: { borderTopWidth: 1, borderTopColor: colors.line2 },
  pi: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  eqRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  eq: {
    height: 36,
    paddingHorizontal: 13,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  eqText: { fontFamily: text.bodySemi.fontFamily, fontSize: 13.5, color: colors.ink },
  ownerCard: { padding: 18, gap: 14 },
  reply: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.m,
    backgroundColor: colors.bg,
  },
  replyText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.ink },
  offers: { paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avst: { flexDirection: 'row' },
  anon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.track,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  anonNext: { marginLeft: -9 },
  offersText: { flex: 1, gap: 2 },
  offersTitle: { fontFamily: fonts.bodyBold, fontSize: 14.5, lineHeight: 19, color: colors.ink },
  ownerText: { flex: 1, minWidth: 0, gap: 4 },
  starsRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  starsVal: { fontFamily: text.label.fontFamily, fontSize: 13, color: colors.ink },
  starsMeta: { fontFamily: text.meta.fontFamily, fontSize: 13, color: colors.mute },
  reportRow: { marginTop: 18, alignItems: 'center' },
  report: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
  footNote: { marginBottom: 10 },
  invited: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 12, borderRadius: radius.m, backgroundColor: colors.cyanTint },
  invitedTitle: { fontFamily: text.label.fontFamily, fontSize: 14.5, color: colors.ink },
  taken: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.m,
    backgroundColor: colors.neutralPill,
  },
  sentbtn: {
    flex: 1,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.line2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  sentText: { fontFamily: text.label.fontFamily, fontSize: 16, color: colors.mute },
});
