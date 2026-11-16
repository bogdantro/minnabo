import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useProfile } from '@/api/queries';
import { colors, fonts, radius, shadow, text } from '@/theme/theme';
import { Avatar, Icon, PressableScale, type IconName } from '@/components/ui';

const TONES = {
  lime: { band: colors.limeTint, blob: colors.limeSoft, fg: colors.limeDeep, ring: colors.lime, dot: colors.cyan, eyebrow: colors.limeDeep, blobOpacity: 0.8 },
  cyan: { band: colors.cyanTint, blob: colors.white, fg: colors.cyanDeep, ring: colors.cyan, dot: colors.lime, eyebrow: colors.cyanDeep, blobOpacity: 0.8 },
  // dark band: stands apart from the light lime hero above it (2026-11-11)
  ink: { band: colors.ink, blob: colors.onInk16b, fg: colors.ink, ring: colors.lime, dot: colors.cyan, eyebrow: colors.ink2, blobOpacity: 1 },
} as const;

/**
 * A big, easy-to-see door on Fellesskap (asked 2026-11-10): a coloured band with the base design's
 * ring-framed disc and neighbours' faces, a clear title, an optional preview and a button-like call to
 * action at the bottom. The whole card is one tap target.
 */
export function CommunityLinkCard({
  tone,
  icon,
  eyebrow,
  title,
  body,
  badge,
  faces = [],
  preview,
  cta,
  a11y,
  onPress,
  testID,
}: {
  tone: keyof typeof TONES;
  icon: IconName;
  eyebrow: string;
  title: string;
  body?: string;
  /** «2 nye» in the band's corner */
  badge?: string;
  /** profile ids shown as small discs around the icon */
  faces?: string[];
  preview?: ReactNode;
  cta: string;
  a11y: string;
  onPress: () => void;
  testID?: string;
}) {
  const t = TONES[tone];
  return (
    <PressableScale accessibilityRole="link" accessibilityLabel={a11y} onPress={onPress} scaleTo={0.985} style={[styles.card, shadow.card]} testID={testID}>
      <View style={[styles.band, { backgroundColor: t.band }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={[styles.blob, styles.blobL, { backgroundColor: t.blob, opacity: t.blobOpacity }]} />
        <View style={[styles.blob, styles.blobR, { backgroundColor: t.blob, opacity: t.blobOpacity }]} />
        <View style={[styles.ring, { borderColor: t.ring }]} />
        <View style={[styles.disc, shadow.medium, tone === 'ink' && styles.discLime]}>
          <Icon name={icon} size={26} color={t.fg} />
        </View>
        {faces[0] ? <Face id={faces[0]} style={styles.face1} /> : null}
        {faces[1] ? <Face id={faces[1]} style={styles.face2} /> : null}
        {faces[2] ? <Face id={faces[2]} style={styles.face3} /> : null}
        <View style={[styles.dot, styles.dot1, { backgroundColor: t.dot }]} />
        <View style={[styles.dot, styles.dot2, { backgroundColor: t.ring }]} />
        {badge ? (
          <View style={styles.badge}>
            <View style={styles.badgeDot} />
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        <Text style={[styles.eyebrow, { color: t.eyebrow }]}>{eyebrow}</Text>
        <Text style={styles.title}>{title}</Text>
        {body ? <Text style={styles.text}>{body}</Text> : null}
        {preview}
        <View style={styles.cta}>
          <Text style={styles.ctaText}>{cta}</Text>
          <View style={styles.ctaIcon}>
            <Icon name="arrow" size={16} color={colors.ink} />
          </View>
        </View>
      </View>
    </PressableScale>
  );
}

function Face({ id, style }: { id: string; style: object }) {
  const { data } = useProfile(id);
  return (
    <View style={[styles.face, style]}>
      <Avatar initials={data?.initials ?? '·'} uri={data?.avatarUrl} seed={id} size={34} ring={false} />
    </View>
  );
}

const BAND = 104;

const styles = StyleSheet.create({
  card: { borderRadius: radius.listingCard, backgroundColor: colors.white, overflow: 'hidden' },
  band: { height: BAND, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  blob: { position: 'absolute', borderRadius: 999 },
  blobL: { width: 170, height: 170, left: -60, top: -70 },
  blobR: { width: 200, height: 200, right: -80, bottom: -120 },
  ring: { position: 'absolute', width: 86, height: 86, borderRadius: 43, borderWidth: 1.5, borderStyle: 'dashed' },
  disc: { width: 62, height: 62, borderRadius: 31, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  discLime: { backgroundColor: colors.lime },
  face: { position: 'absolute', borderRadius: 19, borderWidth: 2, borderColor: colors.white, backgroundColor: colors.white },
  face1: { left: '20%', top: 16 },
  face2: { right: '21%', top: 54 },
  face3: { left: '30%', bottom: 10 },
  dot: { position: 'absolute', borderRadius: 99 },
  dot1: { width: 10, height: 10, right: '32%', top: 18 },
  dot2: { width: 7, height: 7, left: '14%', bottom: 22 },
  badge: { position: 'absolute', top: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 6, height: 28, paddingHorizontal: 11, borderRadius: radius.pill, backgroundColor: colors.ink },
  badgeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.lime },
  badgeText: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: colors.white },
  body: { padding: 16, paddingTop: 14, gap: 6 },
  eyebrow: { ...text.eyebrow, fontSize: 11 },
  title: { fontFamily: fonts.display, fontSize: 21, lineHeight: 25, letterSpacing: -0.4, color: colors.ink },
  text: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 20.5, color: colors.ink2 },
  cta: { marginTop: 8, height: 48, borderRadius: radius.pill, backgroundColor: colors.bg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 18, paddingRight: 6 },
  ctaText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  ctaIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
});
