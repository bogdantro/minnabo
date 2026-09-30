import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { avatarColors, colors, shadow, text } from '@/theme/theme';

export type AvatarColorKey = keyof typeof avatarColors;

export type AvatarProps = {
  initials: string;
  uri?: string | null;
  size?: number;
  /** Cyan ring (2px white + 2px cyan). Off = `.av.plain`. */
  ring?: boolean;
  online?: boolean;
  /** Fallback colour. Use `seed` (user id) to pick one, or `me` for the current user. */
  colorKey?: AvatarColorKey;
  seed?: string;
  me?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

const KEYS: AvatarColorKey[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

/** Stable a–g colour for a user id / name. */
export function avatarColorFor(seed: string): AvatarColorKey {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return KEYS[Math.abs(h) % KEYS.length];
}

/** Font size per the design: 28→11, 32→12, 40→14, 48→16, 56→19, 64→21, 88→28 (≈ size × .35). */
function fontFor(size: number): number {
  const table: Record<number, number> = { 28: 11, 32: 12, 40: 14, 48: 16, 56: 19, 64: 21, 88: 28 };
  return table[size] ?? Math.round(size * 0.35);
}

function ringFor(size: number): ViewStyle {
  if (size <= 28) return shadow.avatarRingSm;
  if (size >= 88) return shadow.avatarRingLg;
  return shadow.avatarRing;
}

/** `.av` – initials circle with optional photo, cyan ring and online dot. */
export function Avatar({
  initials,
  uri,
  size = 40,
  ring = true,
  online = false,
  colorKey,
  seed,
  me = false,
  accessibilityLabel,
  testID,
  style,
}: AvatarProps) {
  const key: AvatarColorKey = me ? 'me' : colorKey ?? avatarColorFor(seed ?? initials);
  const c = avatarColors[key];
  return (
    <View
      testID={testID}
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.base,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: c.bg },
        ring ? ringFor(size) : null,
        style,
      ]}
    >
      {uri ? (
        <Image source={{ uri }} style={[StyleSheet.absoluteFill, { borderRadius: size / 2 }]} />
      ) : (
        <Text style={[text.avatar, { fontSize: fontFor(size), color: c.fg }]} maxFontSizeMultiplier={1}>
          {initials.slice(0, 2).toUpperCase()}
        </Text>
      )}
      {online ? <View style={styles.online} testID={testID ? `${testID}-online` : undefined} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  online: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.online,
    borderWidth: 2,
    borderColor: colors.white,
  },
});
