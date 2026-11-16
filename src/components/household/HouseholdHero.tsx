import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import nb from '@/i18n/nb';
import { useProfile } from '@/api/queries';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { colors, fonts, radius, shadow, text } from '@/theme/theme';
import { Avatar, Icon, type IconName } from '@/components/ui';

/**
 * The top of Husstand in the base design's art band: two faces joined by a dashed line round a lime house disc.
 * Before a household the second face is an empty dashed slot; together it is the partner.
 */
export function HouseholdHero({
  partnerId,
  eyebrow,
  title,
  lead,
  children,
}: {
  /** unset = not in a household yet: the second face is an empty slot */
  partnerId?: string;
  eyebrow: string;
  title: string;
  lead: string;
  /** under the lead: points, stat pills */
  children?: ReactNode;
}) {
  const t = nb.household;
  const me = useCurrentUser();
  return (
    <View style={[styles.card, shadow.card]}>
      <View style={[styles.band, partnerId ? styles.bandTogether : null]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={[styles.blob, styles.blobL, partnerId ? styles.blobTogether : null]} />
        <View style={[styles.blob, styles.blobR, partnerId ? styles.blobTogether : null]} />
        <View style={styles.link} />
        <View style={[styles.faceWrap, styles.faceL]}>
          <Avatar initials={me.initials} uri={me.avatarUrl} seed={me.id} size={58} ring={false} />
        </View>
        <View style={styles.ring} />
        <View style={[styles.disc, shadow.medium]}>
          <Icon name="home" size={26} color={colors.ink} />
        </View>
        {partnerId ? (
          <PartnerFace id={partnerId} />
        ) : (
          <View style={[styles.faceWrap, styles.faceR, styles.slot]}>
            <Icon name="plus" size={22} color={colors.cyanDeep} />
          </View>
        )}
        <Tag icon="clip" label={t.chipListings} style={styles.tag1} />
        <Tag icon="cal" label={t.chipAgreements} style={styles.tag2} />
        <View style={[styles.dot, styles.dot1]} />
        <View style={[styles.dot, styles.dot2]} />
      </View>
      <View style={styles.body}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        <Text style={styles.lead}>{lead}</Text>
        {children}
      </View>
    </View>
  );
}

function PartnerFace({ id }: { id: string }) {
  const p = useProfile(id).data;
  return (
    <View style={[styles.faceWrap, styles.faceR]}>
      <Avatar initials={p?.initials ?? '·'} uri={p?.avatarUrl} seed={id} size={58} ring={false} />
    </View>
  );
}

function Tag({ icon, label, style }: { icon: IconName; label: string; style: object }) {
  return (
    <View style={[styles.tag, shadow.card, style]}>
      <Icon name={icon} size={13} color={colors.cyanDeep} />
      <Text style={styles.tagText}>{label}</Text>
    </View>
  );
}

/** A small pill for the hero: «2 avtaler som kommer». */
export function HeroStat({ icon, value }: { icon: IconName; value: string }) {
  return (
    <View style={styles.stat}>
      <Icon name={icon} size={14} color={colors.cyanDeep} />
      <Text style={styles.statText}>{value}</Text>
    </View>
  );
}

const BAND = 156;
const FACE = 66;

const styles = StyleSheet.create({
  card: { borderRadius: radius.listingCard, backgroundColor: colors.white, overflow: 'hidden' },
  band: { height: BAND, backgroundColor: colors.cyanTint, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  bandTogether: { backgroundColor: colors.limeTint },
  blob: { position: 'absolute', borderRadius: 999, backgroundColor: colors.white, opacity: 0.55 },
  blobTogether: { backgroundColor: colors.limeSoft, opacity: 0.9 },
  blobL: { width: 190, height: 190, left: -80, bottom: -100 },
  blobR: { width: 220, height: 220, right: -90, top: -120 },
  link: { position: 'absolute', width: 190, height: 0, borderTopWidth: 2, borderStyle: 'dashed', borderColor: colors.cyan },
  ring: { position: 'absolute', width: 96, height: 96, borderRadius: 48, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.cyan },
  disc: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: colors.white },
  faceWrap: {
    position: 'absolute',
    width: FACE,
    height: FACE,
    borderRadius: FACE / 2,
    borderWidth: 4,
    borderColor: colors.white,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  faceL: { left: '50%', marginLeft: -FACE / 2 - 104 },
  faceR: { left: '50%', marginLeft: -FACE / 2 + 104 },
  slot: { borderStyle: 'dashed', borderWidth: 2, borderColor: colors.cyan2, backgroundColor: colors.surface },
  tag: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 5, height: 28, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: colors.white },
  tagText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.ink },
  tag1: { left: 14, top: 14, transform: [{ rotate: '-6deg' }] },
  tag2: { right: 14, bottom: 14, transform: [{ rotate: '5deg' }] },
  dot: { position: 'absolute', borderRadius: 99 },
  dot1: { width: 9, height: 9, right: '30%', top: 18, backgroundColor: colors.lime },
  dot2: { width: 7, height: 7, left: '28%', bottom: 22, backgroundColor: colors.cyan },
  body: { padding: 18, gap: 6 },
  eyebrow: { ...text.eyebrow, fontSize: 11, color: colors.cyanDeep },
  title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 30, letterSpacing: -0.5, color: colors.ink },
  lead: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 21, color: colors.ink2 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.cyanTint },
  statText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink },
});
