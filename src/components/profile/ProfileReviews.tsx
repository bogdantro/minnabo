import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Listing, PublicProfile, Review } from '@/domain/types';
import { categoryArtId } from '@/domain/categories';
import nb from '@/i18n/nb';
import { useListingsByIds, useProfile } from '@/api/queries';
import { dayMonthYear } from '@/lib/datetime';
import { colors, fonts, radius, screenPadding, shadow, text } from '@/theme/theme';
import { Avatar, Chip, ChipRow, FadeUp, GrowBar, Icon, Pill } from '@/components/ui';

type Filter = 'alle' | 'five' | 'hjelper' | 'oppdragsgiver';
type Role = 'hjelper' | 'oppdragsgiver' | undefined;
const FILTERS: Filter[] = ['alle', 'five', 'hjelper', 'oppdragsgiver'];

export const firstName = (name: string) => name.split(' ')[0] || name;

/** Profil → Vurderinger tab. */
export function ProfileReviews({ profile, reviews }: { profile: PublicProfile; reviews: Review[] }) {
  const [filter, setFilter] = useState<Filter>('alle');
  const listings = useListingsByIds(Array.from(new Set(reviews.map((r) => r.listingId))));
  // The person reviewed was the oppdragsgiver when they own the oppdrag; otherwise they helped.
  const roleOf = (r: Review): Role => {
    const l = listings[r.listingId];
    if (!l) return undefined;
    return l.owner.id === profile.id ? 'oppdragsgiver' : 'hjelper';
  };
  const total = reviews.length;
  const avg = profile.rating?.average ?? (total ? reviews.reduce((s, r) => s + r.rating, 0) / total : 0);
  const dist = [5, 4, 3, 2, 1].map((s) => ({ s, n: reviews.filter((r) => Math.round(r.rating) === s).length }));
  const tags = Object.entries(
    reviews.flatMap((r) => r.tags ?? []).reduce<Record<string, number>>((acc, t) => {
      acc[t] = (acc[t] ?? 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);
  const shown = reviews.filter((r) =>
    filter === 'alle' ? true : filter === 'five' ? r.rating === 5 : roleOf(r) === filter,
  );
  const first = firstName(profile.displayName);

  return (
    <View style={styles.wrap}>
      <FadeUp style={styles.px}>
        <View style={[styles.card, styles.summary, shadow.card]}>
          <View style={styles.avgCol}>
            <Text style={styles.avg}>{avg.toFixed(1).replace('.', ',')}</Text>
            <StarRow value={Math.round(avg)} />
            <Text style={[text.meta, styles.f12]}>{nb.profile.statReviews(total)}</Text>
          </View>
          <View style={styles.distCol}>
            {dist.map((d) => (
              <View key={d.s} style={styles.distRow}>
                <Text style={[styles.distNum, styles.w10]}>{d.s}</Text>
                <GrowBar fill={total ? d.n / total : 0} color={colors.star} height={7} style={styles.flex} />
                <Text style={[styles.distNum, styles.w16]}>{d.n}</Text>
              </View>
            ))}
          </View>
        </View>
      </FadeUp>

      {tags.length ? (
        <FadeUp delay={60} style={styles.px}>
          <Text style={[text.eyebrow, styles.mb10]}>{nb.profile.tagsEyebrow}</Text>
          <View style={styles.wrapRow}>
            {tags.map(([label, n]) => (
              <View key={label} style={styles.tagc}>
                <Text style={styles.tagText}>{label}</Text>
                <View style={styles.tagN}>
                  <Text style={styles.tagNText}>{n}</Text>
                </View>
              </View>
            ))}
          </View>
        </FadeUp>
      ) : null}

      <FadeUp delay={120} style={styles.mt4}>
        <ChipRow>
          {FILTERS.map((f) => (
            <Chip key={f} size="sm" label={nb.profile.revFilters[f]} selected={filter === f} onPress={() => setFilter(f)} />
          ))}
        </ChipRow>
      </FadeUp>

      <View style={[styles.px, styles.gap12]}>
        {shown.map((r) => (
          <ReviewCard key={r.id} review={r} listing={listings[r.listingId]} role={roleOf(r)} first={first} />
        ))}
        {shown.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Icon name="star" size={22} color={colors.limeDeep} />
            </View>
            <Text style={styles.emptyText}>{total ? nb.profile.noFiltered : nb.profile.noReviews}</Text>
          </View>
        ) : null}
        {total ? <Text style={[text.meta, styles.foot]}>{nb.profile.revFoot(shown.length, total)}</Text> : null}
      </View>
    </View>
  );
}

function StarRow({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <View style={styles.stars}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Icon key={i} name="star" size={size} color={i <= value ? colors.star : colors.starOff} filled />
      ))}
    </View>
  );
}

function ReviewCard({ review: r, listing, role, first }: { review: Review; listing?: Listing; role: Role; first: string }) {
  const { data: author } = useProfile(r.fromProfileId);
  const name = author?.displayName ?? 'Nabo';
  const meta = [role === 'hjelper' ? nb.profile.roleHelper(first) : role === 'oppdragsgiver' ? nb.profile.roleClient(first) : null, dayMonthYear(r.createdAt)]
    .filter(Boolean)
    .join(' · ');
  return (
    <FadeUp style={[styles.rev, shadow.card]}>
      <View style={styles.revHead}>
        <Avatar initials={author?.initials ?? 'N'} uri={author?.avatarUrl} seed={r.fromProfileId} size={40} ring={false} />
        <View style={styles.flex}>
          <Text style={styles.revName} numberOfLines={1}>{name}</Text>
          <Text style={[text.meta, styles.f12]}>{meta}</Text>
        </View>
        <View accessible accessibilityLabel={nb.profile.starsAria(r.rating)}>
          <StarRow value={r.rating} />
        </View>
      </View>
      {listing ? (
        <View style={styles.job}>
          <Icon name={categoryArtId(listing.category.slug)} size={14} color={colors.ink2} />
          <Text style={styles.jobText} numberOfLines={1}>{listing.title}</Text>
        </View>
      ) : null}
      {r.comment ? <Text style={styles.revText}>{r.comment}</Text> : null}
      {r.tags?.length ? (
        <View style={styles.wrapRow6}>
          {r.tags.map((t) => (
            <Pill key={t} label={t} tone="need" icon="check" size="sm" />
          ))}
        </View>
      ) : null}
    </FadeUp>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14, paddingTop: 18 },
  px: { paddingHorizontal: screenPadding },
  flex: { flex: 1, minWidth: 0 },
  f12: { fontSize: 12 },
  mb10: { marginBottom: 10 },
  mt4: { marginTop: 4 },
  gap12: { gap: 12 },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 18 },
  summary: { flexDirection: 'row', gap: 18, alignItems: 'center' },
  avgCol: { width: 96, alignItems: 'center', gap: 6 },
  avg: { fontFamily: fonts.display, fontSize: 48, lineHeight: 48, letterSpacing: -0.96, color: colors.ink },
  distCol: { flex: 1, gap: 7 },
  distRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  distNum: { fontFamily: fonts.bodySemi, fontSize: 12.5, lineHeight: 13, color: colors.mute },
  w10: { width: 10 },
  w16: { width: 16, textAlign: 'right' },
  stars: { flexDirection: 'row', gap: 1 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  wrapRow6: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tagc: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  tagText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.ink },
  tagN: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: colors.limeTint, alignItems: 'center', justifyContent: 'center' },
  tagNText: { fontFamily: fonts.bodyHeavy, fontSize: 11.5, color: colors.limeDeep },
  rev: { padding: 16, borderRadius: radius.card, backgroundColor: colors.surface, gap: 10 },
  revHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  revName: { fontFamily: fonts.bodyBold, fontSize: 15, lineHeight: 18, color: colors.ink },
  job: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: radius.s,
    backgroundColor: colors.surface2,
    maxWidth: '100%',
  },
  jobText: { fontFamily: fonts.bodySemi, fontSize: 12.5, color: colors.ink2, flexShrink: 1 },
  revText: { ...text.body, fontSize: 14.5, lineHeight: 21.75 },
  empty: {
    padding: 22,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.dashed,
    borderRadius: 20,
  },
  emptyIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.limeTint, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink, textAlign: 'center' },
  foot: { textAlign: 'center', fontSize: 12, marginTop: 4 },
});
