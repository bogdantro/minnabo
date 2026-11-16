import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { colors, motion, radius, shadow, sizes, text, type CategoryId } from '@/theme/theme';
import { heroTransition } from '@/lib/heroTransition';
import { haptics } from '@/lib/haptics';
import { categoryLabel } from '@/domain/categories';
import { Avatar } from './Avatar';
import { CategoryArt } from './CategoryArt';
import { Icon, type IconName } from './Icon';
import { Pill } from './Pill';
import { PressableScale } from './PressableScale';
import { ReliableLine, Stars, VerifiedIcon } from './Badges';

export type ListingCardProps = {
  title: string;
  category: CategoryId;
  photoUri?: string | null;
  ownerName?: string;
  ownerRating?: number | null;
  /** a small face before the name; initials when there is no photo */
  owner?: { id: string; initials: string; avatarUrl?: string };
  /** «3 t siden», right of the pills */
  posted?: string;
  /** Small green "Verifisert" mark after the owner (search results). */
  verified?: boolean;
  /** Approximate area only, e.g. "Nordre Ål · 1,2 km". Never an address. */
  place?: string;
  /** e.g. "Lør 3. okt · ca. 2 t" */
  schedule?: string;
  /** Icon for the schedule row (default clock; ForMeg uses sparkle for the "why" line). */
  scheduleIcon?: IconName;
  /** "Budsjett" or empty. */
  priceLabel?: string;
  /** "400 kr" or "Ønsker tilbud". */
  priceValue: string;
  /** Extra neutral pill next to "Trenger hjelp" (Dugnad, Gjentakende …). */
  extraBadge?: { label: string; icon?: IconName };
  /** need = an oppdrag («Trenger hjelp»), offer = a nabo offering help («Tilbyr hjelp», 0076). */
  kind?: 'need' | 'offer';
  /** the helper has turned up for all of 5+ jobs (offer cards) */
  reliable?: boolean;
  /** «Haster» pill after "Trenger hjelp" (an oppdrag shown first until its deadline). */
  urgent?: boolean;
  /** Replaces the "Trenger hjelp" pill, e.g. "Tilbud sendt" (dark). */
  statusBadge?: { label: string; tone: 'dark' | 'ok' | 'warn' | 'neutral' };
  online?: boolean;
  saved?: boolean;
  /**
   * Marketplace look: a real photo runs across the top of the card instead of sitting in the thumb.
   * Ignored without a photo (category art stays a thumb, so cards without photos stay compact).
   */
  photoTop?: boolean;
  /** Omit to hide the heart. */
  onToggleSave?: () => void;
  /** Heart label override, e.g. "Fjern Bære sofa fra lagrede" (Lagrede). */
  saveLabel?: string;
  /** The oppdrag id: tapping the card lets its photo grow into the detail gallery (lib/heroTransition). */
  heroId?: string;
  onPress?: () => void;
  /** the card's own menu (0110): Lagre, Del, Skjul, Rapporter */
  onLongPress?: () => void;
  /** small facts under the place (0110): «Ingen tilbud ennå – vær først», «Svarer raskt» … */
  tags?: { label: string; icon?: IconName; tone?: 'lime' | 'cyan' | 'warn' | 'neutral' }[];
  /** «Kompakt liste»: no photo across the top, two lines of facts */
  compact?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

const AnimatedView = Animated.View;

/** `.save` – 38 circle heart. Pops (1 → 1.4 → 1) when it becomes saved. */
export function SaveButton({ saved, onPress, label, style }: { saved: boolean; onPress: () => void; label?: string; style?: StyleProp<ViewStyle> }) {
  const scale = useSharedValue(1);
  const prev = useRef(saved);
  useEffect(() => {
    if (saved && !prev.current) {
      scale.value = withSequence(
        withTiming(1.4, { duration: 160 }),
        withSpring(1, motion.spring),
      );
    }
    prev.current = saved;
  }, [saved, scale]);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? (saved ? 'Fjern fra lagrede' : 'Lagre')}
      accessibilityState={{ selected: saved }}
      hitSlop={3}
      onPress={() => {
        haptics.light();
        onPress();
      }}
      style={[styles.save, saved && styles.saveOn, style]}
    >
      <AnimatedView style={anim}>
        <Icon name="heart" size={18} color={saved ? colors.heart : colors.ink2} filled={saved} />
      </AnimatedView>
    </Pressable>
  );
}

function Meta({ icon, children }: { icon: IconName; children: string }) {
  return (
    <View style={styles.meta}>
      <Icon name={icon} size={14} color={colors.faint} />
      <Text style={text.meta} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
}

/** `.lcard` – oppdrag card: category art thumb + need pill, title, owner, area, time, price. */
export function ListingCard({
  title,
  category,
  photoUri,
  ownerName,
  ownerRating,
  owner,
  posted,
  verified,
  place,
  schedule,
  scheduleIcon = 'clock',
  priceLabel,
  priceValue,
  extraBadge,
  kind = 'need',
  reliable = false,
  urgent,
  statusBadge,
  online,
  saved = false,
  onToggleSave,
  saveLabel,
  photoTop = false,
  heroId,
  onPress,
  onLongPress,
  tags,
  compact = false,
  testID,
  style,
}: ListingCardProps) {
  const thumb = useRef<View>(null);
  // Navigate at once; meanwhile measure the photo and start its flight (the overlay lands it in the
  // gallery). The card stays mounted under the new screen, so measuring after the push is fine – and
  // navigation never waits on a measurement.
  const press = () => {
    onPress?.();
    if (!heroId || !photoUri) return;
    thumb.current?.measureInWindow?.((x, y, width, height) => {
      if (width > 0) heroTransition.start(heroId, photoUri, { x, y, width, height, radius: radius.thumb });
    });
  };
  const a11y = [title, urgent ? 'Haster' : null, ownerName, place, schedule, [priceLabel, priceValue].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ');

  const wide = photoTop && !!photoUri && !compact;

  const badges =
    statusBadge || kind || urgent || extraBadge ? (
      <View style={styles.badges}>
        {statusBadge ? (
          <Pill label={statusBadge.label} tone={statusBadge.tone} />
        ) : (
          <Pill label={kind === 'offer' ? 'Tilbyr hjelp' : 'Trenger hjelp'} tone={kind} dot />
        )}
        {urgent ? <Pill label="Haster" icon="zap" tone="warn" /> : null}
        {extraBadge ? <Pill label={extraBadge.label} icon={extraBadge.icon} tone="neutral" /> : null}
        {/* without a person on top, the age stays at the end of the pills */}
        {posted && !ownerName ? (
          <Text style={styles.posted} numberOfLines={1}>
            {posted}
          </Text>
        ) : null}
      </View>
    ) : null;

  // Who is asking comes first, like a post from a neighbour: the face, the name with stars, and when.
  const person = ownerName ? (
    <View style={styles.person}>
      {owner ? <Avatar initials={owner.initials} uri={owner.avatarUrl} seed={owner.id} size={sizes.listingOwnerFace} ring={false} /> : null}
      <View style={styles.personText}>
        <View style={styles.meta}>
          <Text style={[text.metaBold, styles.personName, styles.shrink]} numberOfLines={1}>
            {ownerName}
          </Text>
          {ownerRating != null ? <Stars rating={ownerRating} /> : null}
          {verified ? (
            <View style={styles.vmini}>
              <VerifiedIcon size={14} />
              <Text style={[text.verified, { fontSize: 12, color: colors.verified }]}>Verifisert</Text>
            </View>
          ) : null}
        </View>
        {posted ? (
          <Text style={text.small} numberOfLines={1}>
            {posted}
          </Text>
        ) : null}
      </View>
    </View>
  ) : null;

  return (
    <View style={[styles.card, shadow.card, style]} testID={testID}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={a11y + (tags?.length ? `, ${tags.map((t) => t.label).join(', ')}` : '')}
        onPress={press}
        onLongPress={onLongPress}
        delayLongPress={380}
        scaleTo={0.985}
        style={wide ? styles.innerWide : styles.inner}
      >
        <View ref={thumb} collapsable={false} style={wide ? styles.photo : styles.thumb}>
          <CategoryArt category={category} uri={photoUri} radius={radius.thumb} style={StyleSheet.absoluteFill} />
          {photoUri ? (
            <View style={[styles.catTag, shadow.card]} accessible accessibilityLabel={categoryLabel(category)}>
              <Icon name={category} size={15} color={colors.ink} />
            </View>
          ) : null}
          {wide && badges ? <View style={styles.photoBadges}>{badges}</View> : null}
          {online ? <View style={styles.online} /> : null}
        </View>
        <View style={[styles.body, wide && styles.bodyWide]}>
          {person}
          <Text style={[styles.title, wide && styles.titleWide]} numberOfLines={2}>
            {title}
          </Text>
          {wide ? null : badges}
          {reliable ? <ReliableLine /> : null}
          {place ? <Meta icon="pin">{place}</Meta> : null}
          {schedule && !compact ? <Meta icon={scheduleIcon}>{schedule}</Meta> : null}
          {tags?.length ? (
            <View style={styles.tags}>
              {tags.slice(0, compact ? 2 : 4).map((t) => (
                <View key={t.label} style={[styles.tag, t.tone && TAG_TONE[t.tone]]}>
                  {t.icon ? <Icon name={t.icon} size={12} color={t.tone === 'lime' ? colors.limeDeep : t.tone === 'cyan' ? colors.cyanDeep : t.tone === 'warn' ? colors.warn : colors.ink2} /> : null}
                  <Text style={styles.tagText} numberOfLines={1}>
                    {t.label}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
          <View style={styles.foot}>
            <View style={styles.price}>
              {priceLabel ? <Text style={text.priceLabel}>{priceLabel}</Text> : null}
              <Text style={[text.price, styles.shrink]} numberOfLines={1}>
                {priceValue}
              </Text>
            </View>
            <View style={styles.go}>
              <Icon name="arrow" size={15} color={colors.ink} />
            </View>
          </View>
        </View>
      </PressableScale>
      {/* on the photo's corner, so the title gets the whole width */}
      {onToggleSave ? (
        <SaveButton saved={saved} onPress={onToggleSave} label={saveLabel} style={[wide ? styles.saveWide : styles.saveAbs, !saved && styles.saveOnPhoto]} />
      ) : null}
    </View>
  );
}

const TAG_TONE = {
  lime: { backgroundColor: colors.limeTint },
  cyan: { backgroundColor: colors.cyanTint },
  warn: { backgroundColor: colors.warnTint },
  neutral: { backgroundColor: colors.surface2 },
} as const;

const styles = StyleSheet.create({
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 24, paddingHorizontal: 8, borderRadius: 12, backgroundColor: colors.surface2, maxWidth: '100%' },
  // flexShrink lets a long tag end in «…» instead of being cut off at the card's edge
  tagText: { fontFamily: text.metaBold.fontFamily, fontSize: 12, color: colors.ink2, flexShrink: 1 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.listingCard,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  inner: { flexDirection: 'row', gap: 14, padding: 12 },
  innerWide: { padding: 10, gap: 12 },
  photo: { width: '100%', aspectRatio: sizes.listingPhotoAspect, borderRadius: radius.thumb, overflow: 'hidden' },
  photoBadges: { position: 'absolute', left: 10, right: 56, top: 10 },
  thumb: {
    width: sizes.listingThumbW,
    minHeight: sizes.listingThumbMinH,
    alignSelf: 'stretch',
    borderRadius: radius.thumb,
    overflow: 'hidden',
  },
  online: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.online,
    borderWidth: 2,
    borderColor: colors.white,
  },
  body: { flex: 1, minWidth: 0, gap: 6, paddingVertical: 2 },
  bodyWide: { paddingHorizontal: 4, paddingBottom: 2 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 2 },
  personText: { flex: 1, minWidth: 0 },
  personName: { fontSize: 14 },
  badges: { flexDirection: 'row', alignItems: 'center', gap: 6, overflow: 'hidden' },
  posted: { ...text.small, flexShrink: 1, marginLeft: 'auto', color: colors.mute },
  title: { fontFamily: text.h3.fontFamily, fontSize: 17, lineHeight: 21, letterSpacing: -0.2, color: colors.ink },
  titleWide: { fontSize: 19, lineHeight: 23 },
  shrink: { flexShrink: 1 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, overflow: 'hidden' },
  catTag: { position: 'absolute', left: 6, bottom: 6, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 'auto', paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.line2 },
  price: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  go: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  save: {
    width: sizes.saveButton,
    height: sizes.saveButton,
    borderRadius: sizes.saveButton / 2,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveOn: { backgroundColor: colors.savedBg },
  saveAbs: { position: 'absolute', top: 18, left: 18, width: 34, height: 34, borderRadius: 17 },
  saveWide: { position: 'absolute', top: 20, right: 20 },
  saveOnPhoto: { backgroundColor: colors.white },
  vmini: { flexDirection: 'row', alignItems: 'center', gap: 3 },
});
