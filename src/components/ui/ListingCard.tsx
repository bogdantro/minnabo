import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { colors, motion, radius, shadow, sizes, text, type CategoryId } from '@/theme/theme';
import { CategoryArt } from './CategoryArt';
import { Icon, type IconName } from './Icon';
import { Pill } from './Pill';
import { PressableScale } from './PressableScale';
import { Stars, VerifiedIcon } from './Badges';

export type ListingCardProps = {
  title: string;
  category: CategoryId;
  photoUri?: string | null;
  ownerName?: string;
  ownerRating?: number | null;
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
  /** Replaces the "Trenger hjelp" pill, e.g. "Tilbud sendt" (dark). */
  statusBadge?: { label: string; tone: 'dark' | 'ok' | 'warn' | 'neutral' };
  online?: boolean;
  saved?: boolean;
  /** Omit to hide the heart. */
  onToggleSave?: () => void;
  /** Heart label override, e.g. "Fjern Bære sofa fra lagrede" (Lagrede). */
  saveLabel?: string;
  onPress?: () => void;
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
      onPress={onPress}
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
  verified,
  place,
  schedule,
  scheduleIcon = 'clock',
  priceLabel,
  priceValue,
  extraBadge,
  statusBadge,
  online,
  saved = false,
  onToggleSave,
  saveLabel,
  onPress,
  testID,
  style,
}: ListingCardProps) {
  const a11y = [title, ownerName, place, schedule, [priceLabel, priceValue].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ');

  return (
    <View style={[styles.card, shadow.card, style]} testID={testID}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={a11y}
        onPress={onPress}
        scaleTo={0.985}
        style={styles.inner}
      >
        <View style={styles.thumb}>
          <CategoryArt category={category} uri={photoUri} radius={radius.thumb} style={StyleSheet.absoluteFill} />
          {online ? <View style={styles.online} /> : null}
        </View>
        <View style={styles.body}>
          <View style={styles.badges}>
            {statusBadge ? (
              <Pill label={statusBadge.label} tone={statusBadge.tone} />
            ) : (
              <Pill label="Trenger hjelp" tone="need" dot />
            )}
            {extraBadge ? <Pill label={extraBadge.label} icon={extraBadge.icon} tone="neutral" /> : null}
          </View>
          <Text style={[text.cardTitle, styles.title]} numberOfLines={1}>
            {title}
          </Text>
          {ownerName ? (
            <View style={styles.meta}>
              <Text style={text.metaBold} numberOfLines={1}>
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
          ) : null}
          {place ? <Meta icon="pin">{place}</Meta> : null}
          {schedule ? <Meta icon={scheduleIcon}>{schedule}</Meta> : null}
          <View style={styles.price}>
            {priceLabel ? <Text style={text.priceLabel}>{priceLabel}</Text> : null}
            <Text style={text.price} numberOfLines={1}>
              {priceValue}
            </Text>
          </View>
        </View>
      </PressableScale>
      {onToggleSave ? <SaveButton saved={saved} onPress={onToggleSave} label={saveLabel} style={styles.saveAbs} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.listingCard,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  inner: { flexDirection: 'row', gap: 14, padding: 12 },
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
  badges: { flexDirection: 'row', gap: 6, overflow: 'hidden' },
  title: { paddingRight: 40 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, overflow: 'hidden' },
  price: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 'auto' },
  save: {
    width: sizes.saveButton,
    height: sizes.saveButton,
    borderRadius: sizes.saveButton / 2,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveOn: { backgroundColor: colors.savedBg },
  saveAbs: { position: 'absolute', top: 10, right: 10 },
  vmini: { flexDirection: 'row', alignItems: 'center', gap: 3 },
});
