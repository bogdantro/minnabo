import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import nb from '@/i18n/nb';
import { ImageViewer } from '@/components/ImageViewer';
import { ListingQuestions } from '@/components/ListingQuestions';
import { ReliableBadge } from '@/components/ReliableBadge';
import { useIsSaved, useStartConversation } from '@/api/queries';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useCategoryCatalog } from '@/hooks/useCategories';
import { categoryArtId, categoryLabel } from '@/domain/categories';
import { WEEKDAYS, experienceText, freeOn } from '@/domain/offer';
import type { Listing } from '@/domain/types';
import { postedAgo } from '@/lib/datetime';
import { serverMessage } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { safePush } from '@/lib/nav';
import { shareListing } from '@/lib/share';
import { toast } from '@/lib/toast';
import { colors, radius, screenPadding, shadow, text } from '@/theme/theme';
import { listingPrice } from '@/components/OppdragCard';
import {
  Avatar,
  Button,
  CategoryArt,
  FadeUp,
  Icon,
  IconButton,
  PaymentNote,
  Pill,
  Screen,
  Stars,
  StickyFooter,
  SubHeader,
  type IconKey,
} from '@/components/ui';

/**
 * A «Tilbyr hjelp» post (0076): what the nabo can do, when they are usually free, roughly where,
 * and «Spør om hjelp» – a chat where the helper sends the tilbud. The owner sees «Rediger».
 */
export function OfferDetailScreen({ listing, onBack }: { listing: Listing; onBack: () => void }) {
  useCategoryCatalog();
  const me = useCurrentUser();
  const [saved, toggleSaved] = useIsSaved(listing.id);
  const start = useStartConversation();
  const [today] = useState(() => new Date());
  const [viewer, setViewer] = useState<number | null>(null);
  const photos = listing.images.map((img) => img.url);
  const o = listing.offer;
  const owner = listing.owner;
  const first = owner.displayName.split(' ')[0];
  const isOwner = !!me.id && owner.id === me.id;
  const cat = categoryArtId(listing.category.slug);
  const price = listingPrice(listing);
  const place = [listing.location.place, listing.location.municipality].filter((x, i, a) => x && a.indexOf(x) === i).join(', ');
  const paragraphs = (o?.about ?? '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const services = [categoryLabel(cat), ...(o?.services ?? [])].filter((s, i, a) => s && a.indexOf(s) === i);
  const facts: { icon: IconKey; label: string; value: string }[] = [
    ...(experienceText(o?.experienceMonths) ? [{ icon: 'award' as const, label: nb.offer.experience, value: experienceText(o?.experienceMonths)! }] : []),
    ...(o?.equipmentText ? [{ icon: 'brief' as const, label: nb.offer.equipment, value: o.equipmentText }] : []),
    ...(o?.maxDistanceKm ? [{ icon: 'nav' as const, label: nb.offer.approxArea, value: nb.offer.reach(o.maxDistanceKm) }] : []),
  ];

  const ask = async () => {
    try {
      const conv = await start.mutateAsync(listing.id);
      haptics.light();
      safePush(`/chat/${conv.id}`);
    } catch (e) {
      toast.error(serverMessage(e, nb.toast.genericError), { bottom: 150 });
    }
  };
  const onSave = () => {
    toggleSaved();
    if (saved) toast.info(nb.detail.unsavedToast, { icon: 'x', bottom: 150 });
    else toast.success(nb.detail.savedToast, { icon: 'heart', bottom: 150 });
  };

  return (
    <View style={styles.flex}>
      <Screen
        scroll
        spacer="foot"
        header={
          <SubHeader
            title={nb.offer.pill}
            onBack={onBack}
            sideWidth={98}
            right={
              <View style={styles.headBtns}>
                <IconButton
                  icon="heart"
                  iconSize={18}
                  iconFilled={saved}
                  iconColor={saved ? colors.heart : colors.ink}
                  accessibilityLabel={saved ? nb.detail.unsave : nb.detail.save}
                  onPress={onSave}
                />
                <IconButton icon="share" iconSize={18} accessibilityLabel={nb.detail.share} onPress={() => void shareListing(listing.id, listing.title)} />
              </View>
            }
          />
        }
        footer={
          <StickyFooter>
            {isOwner ? (
              <>
                <Text style={[text.meta, styles.center, styles.mb8]}>{nb.offer.yours}</Text>
                <Button label={nb.offer.edit} icon="edit" variant="ink" size="lg" onPress={() => safePush(`/legg-ut/tilbyr?rediger=${listing.id}`)} />
              </>
            ) : me.isYouth ? null : (
              <>
                <Button label={nb.offer.ask(first)} icon="msg" size="lg" loading={start.isPending} onPress={ask} />
              </>
            )}
          </StickyFooter>
        }
      >
        <FadeUp style={styles.px}>
          <Pressable
            accessibilityRole={photos.length ? 'imagebutton' : undefined}
            accessibilityLabel={photos.length ? nb.detail.openImage(1, photos.length) : undefined}
            disabled={!photos.length}
            onPress={() => setViewer(0)}
            style={[styles.hero, shadow.medium]}
          >
            <CategoryArt category={cat} uri={photos[0]} width="100%" height={210} radius={28} iconSize={56} />
            {photos.length > 1 ? (
              <View style={styles.more}>
                <Icon name="image" size={14} color={colors.white} />
                <Text style={styles.moreText}>{photos.length}</Text>
              </View>
            ) : null}
          </Pressable>
          {photos.length > 1 ? (
            <View style={styles.thumbs}>
              {photos.slice(1, 5).map((u, k) => (
                <Pressable key={u} accessibilityRole="imagebutton" accessibilityLabel={nb.detail.openImage(k + 2, photos.length)} onPress={() => setViewer(k + 1)} style={styles.thumb}>
                  <CategoryArt category={cat} uri={u} width="100%" height={72} radius={16} />
                </Pressable>
              ))}
            </View>
          ) : null}
        </FadeUp>

        <FadeUp delay={80} style={[styles.px, styles.titleBlock]}>
          <View style={styles.row6}>
            <Pill label={nb.offer.pill} tone="offer" dot size="lg" />
            <Pill label={categoryLabel(cat)} tone="neutral" icon={cat} size="lg" />
            {freeOn(listing, today) ? <Pill label={nb.offer.freeToday} tone="ok" icon="check" size="lg" /> : null}
          </View>
          <Text style={text.h1} accessibilityRole="header">
            {listing.title}
          </Text>
          <Text style={text.meta}>{postedAgo(listing.createdAt, today, true)}</Text>
        </FadeUp>

        {/* the helper and the price */}
        <FadeUp delay={120} style={[styles.px, styles.mt16]}>
          <View style={[styles.card, styles.who, shadow.card]}>
            <Avatar initials={owner.initials} uri={owner.avatarUrl} seed={owner.id} size={56} />
            <View style={styles.flex1}>
              <Text style={[text.label, styles.name]} numberOfLines={1}>
                {owner.displayName}
              </Text>
              {owner.rating?.count ? (
                <Stars rating={owner.rating.average} count={owner.rating.count} />
              ) : (
                <Text style={text.meta}>{nb.offer.by(first)}</Text>
              )}
              <ReliableBadge profileId={owner.id} style={styles.mt4} />
            </View>
            <View style={styles.priceCol}>
              {price.label ? <Text style={text.priceLabel}>{price.label}</Text> : null}
              <Text style={[text.num, styles.price]}>{price.value}</Text>
            </View>
          </View>
          <Button label={nb.offer.seeProfile(first)} variant="text" size="sm" block={false} iconRight="arrow" onPress={() => safePush(`/profil/${owner.id}`)} style={styles.profileLink} />
        </FadeUp>

        {/* what they can do */}
        <FadeUp delay={160} style={[styles.px, styles.mt16]}>
          <Text style={[text.eyebrow, styles.mb10]}>{nb.offer.services}</Text>
          <View style={styles.wrap}>
            {services.map((s) => (
              <View key={s} style={styles.svc}>
                <Icon name="check" size={14} color={colors.cyanDeep} />
                <Text style={styles.svcText}>{s}</Text>
              </View>
            ))}
          </View>
        </FadeUp>

        {/* when */}
        {o?.availableWeekdays?.length || o?.availabilityText ? (
          <FadeUp delay={200} style={[styles.px, styles.mt20]}>
            <View style={[styles.card, styles.pad16, shadow.card]}>
              <Text style={[text.eyebrow, styles.mb10]}>{nb.offer.days}</Text>
              <View style={styles.days} accessibilityLabel={`${nb.offer.days}: ${WEEKDAYS.filter((w) => o?.availableWeekdays?.includes(w.i)).map((w) => w.long).join(', ')}`}>
                {WEEKDAYS.map((w) => {
                  const on = !!o?.availableWeekdays?.includes(w.i);
                  const isToday = today.getDay() === w.i;
                  return (
                    <View key={w.i} style={[styles.day, on && styles.dayOn, isToday && styles.dayToday]}>
                      <Text style={[styles.dayText, on && styles.dayTextOn]}>{w.short}</Text>
                    </View>
                  );
                })}
              </View>
              {o?.availabilityText ? (
                <View style={[styles.row6, styles.mt12]}>
                  <Icon name="clock" size={16} color={colors.mute} />
                  <Text style={text.body}>{o.availabilityText}</Text>
                </View>
              ) : null}
            </View>
          </FadeUp>
        ) : null}

        {/* where + facts */}
        <FadeUp delay={240} style={[styles.px, styles.mt12]}>
          <View style={[styles.card, shadow.card]}>
            <Fact icon="pin" label={nb.offer.approxArea} value={place} first />
            {facts.map((f) => (
              <Fact key={f.label + f.value} icon={f.icon} label={f.label} value={f.value} />
            ))}
          </View>
        </FadeUp>

        {paragraphs.length ? (
          <FadeUp delay={280} style={[styles.px, styles.mt20]}>
            <Text style={[text.eyebrow, styles.mb10]}>{nb.offer.about}</Text>
            <View style={styles.gap10}>
              {paragraphs.map((p) => (
                <Text key={p.slice(0, 24)} style={[text.body, styles.para]}>
                  {p}
                </Text>
              ))}
            </View>
          </FadeUp>
        ) : null}

        <View style={[styles.px, styles.mt20]}>
          <ListingQuestions listing={listing} meId={me.id} isOwner={isOwner} youth={me.isYouth} onContact={ask} />
        </View>

        <FadeUp delay={320} style={[styles.px, styles.mt20, styles.noteGap]}>
          <PaymentNote />
        </FadeUp>
      </Screen>
      <ImageViewer images={viewer === null ? [] : photos} index={viewer ?? 0} caption={listing.title} onClose={() => setViewer(null)} />
    </View>
  );
}

function Fact({ icon, label, value, first }: { icon: IconKey; label: string; value: string; first?: boolean }) {
  return (
    <View style={[styles.fact, !first && styles.factLine]}>
      <View style={styles.factIc}>
        <Icon name={icon} size={16} color={colors.ink2} />
      </View>
      <View style={styles.flex1}>
        <Text style={text.meta}>{label}</Text>
        <Text style={[text.label, styles.factValue]}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mt4: { marginTop: 4 },
  // a little air between the payment note and the sticky button bar
  noteGap: { marginBottom: 14 },
  flex: { flex: 1 },
  flex1: { flex: 1, minWidth: 0, gap: 3 },
  px: { paddingHorizontal: screenPadding },
  center: { textAlign: 'center' },
  mt8: { marginTop: 8 },
  mb8: { marginBottom: 8 },
  mb10: { marginBottom: 10 },
  mt12: { marginTop: 12 },
  mt16: { marginTop: 16 },
  mt20: { marginTop: 20 },
  gap10: { gap: 10 },
  pad16: { padding: 16 },
  row6: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  headBtns: { flexDirection: 'row', gap: 6 },
  hero: { borderRadius: 28, overflow: 'hidden', marginTop: 4 },
  more: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    height: 32,
    paddingHorizontal: 11,
    borderRadius: radius.pill,
    backgroundColor: colors.scrim,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  moreText: { fontFamily: text.label.fontFamily, fontSize: 13, color: colors.white },
  thumbs: { flexDirection: 'row', gap: 8, marginTop: 8 },
  thumb: { flex: 1, minHeight: 44 },
  titleBlock: { gap: 8, marginTop: 18 },
  card: { borderRadius: radius.card, backgroundColor: colors.white },
  who: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  name: { fontSize: 16 },
  priceCol: { alignItems: 'flex-end', gap: 2 },
  price: { fontSize: 20 },
  profileLink: { alignSelf: 'flex-start', marginTop: 4 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  svc: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.cyanTint,
  },
  svcText: { ...text.chip, color: colors.cyanDeep },
  days: { flexDirection: 'row', gap: 6 },
  day: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.bg,
  },
  dayOn: { backgroundColor: colors.cyanTint, borderColor: colors.cyanTint },
  dayToday: { borderColor: colors.ink },
  dayText: { ...text.meta, fontSize: 12.5 },
  dayTextOn: { ...text.label, fontSize: 12.5, color: colors.cyanDeep },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  factLine: { borderTopWidth: 1, borderTopColor: colors.line2 },
  factIc: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  factValue: { fontSize: 14.5 },
  para: { fontSize: 15, lineHeight: 23, color: colors.ink2 },
});
