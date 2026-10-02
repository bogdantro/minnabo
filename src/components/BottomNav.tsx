import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import nb from '@/i18n/nb';
import { useUnreadConversationCount } from '@/api/queries';
import { colors, motion, radius, shadow, sizes, text } from '@/theme/theme';
import { CountBadge } from './ui/Badges';
import { Icon, type IconKey } from './ui/Icon';
import { MenySheet } from './MenySheet';

export type NavTarget = 'oppdrag' | 'fellesskap' | 'innboks';

type Slot = { target: NavTarget; label: string; icon: IconKey };

const LEFT: Slot[] = [
  { target: 'oppdrag', label: nb.tabs.oppdrag, icon: 'clip' },
  { target: 'fellesskap', label: nb.tabs.fellesskap, icon: 'users' },
];
const RIGHT: Slot[] = [{ target: 'innboks', label: nb.tabs.innboks, icon: 'msg' }];

/** Total height the floating bar covers, for screens that pad their scroll content. */
export const NAV_OCCUPIED = sizes.navHeight + sizes.navBottom;

/** One tab in the floating bar: icon in a 48×32 pill + label (). */
export function NavItem({
  label,
  icon,
  active,
  badge = 0,
  onPress,
}: {
  label: string;
  icon: IconKey;
  active: boolean;
  badge?: number;
  onPress: () => void;
}) {
  const fg = active ? colors.limeDeep : colors.mute;
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={badge > 0 ? `${label}, ${badge} ${badge === 1 ? 'ulest' : 'uleste'}` : label}
      style={styles.item}
      onPress={onPress}
    >
      <View style={[styles.ni, active && styles.niOn]}>
        <Icon name={icon} size={sizes.navIcon} color={fg} />
        {badge > 0 ? <CountBadge count={badge} style={styles.count} /> : null}
      </View>
      <Text style={[text.tabLabel, { color: fg }]} maxFontSizeMultiplier={1.2}>
        {label}
      </Text>
    </Pressable>
  );
}

/** `.fab` – raised 62 px lime button. Press: scale .9 + rotate 90°. Always opens the Legg ut wizard. */
function PostButton({ onPress }: { onPress: () => void }) {
  const p = useSharedValue(0);
  const anim = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - 0.1 * p.value }, { rotate: `${90 * p.value}deg` }],
  }));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={nb.tabs.leggUt}
      style={styles.fabw}
      onPressIn={() => p.set(withTiming(1, { duration: 200 }))}
      onPressOut={() => p.set(withSpring(0, motion.spring))}
      onPress={onPress}
    >
      <View style={[styles.fabShadow, shadow.fab]}>
        {/* rotation lives on an inner view (COMPONENTS.md: never on the animated host) */}
        <Animated.View style={[styles.fab, anim]}>
          <Icon name="plus" size={sizes.fabIcon} color={colors.ink} strokeWidth={2.4} />
        </Animated.View>
      </View>
      <Text style={[text.tabLabel, { color: colors.ink }]} maxFontSizeMultiplier={1.2}>
        {nb.tabs.leggUt}
      </Text>
    </Pressable>
  );
}

/** The floating, blurred `.nav` frame. Children are the tab items. */
export function NavFrame({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel="Hovedmeny"
      style={[styles.nav, shadow.nav, { bottom: sizes.navBottom + insets.bottom }]}
    >
      <View style={styles.bg} pointerEvents="none">
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, styles.bgTint]} />
      </View>
      {children}
    </View>
  );
}

/**
 * `.nav` – floating tab bar: Oppdrag · Fellesskap · (Legg ut) · Innboks · Meny.
 * Rendered by the router-driven `TabBar` and by `StaticBottomNav`.
 */
export function BottomNav({
  active,
  onNavigate,
  onLeggUt,
}: {
  active: NavTarget | 'leggUt' | null;
  onNavigate: (target: NavTarget) => void;
  onLeggUt: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const unreadInbox = useUnreadConversationCount();

  const slot = (s: Slot) => (
    <NavItem
      key={s.target}
      label={s.label}
      icon={s.icon}
      active={active === s.target}
      badge={s.target === 'innboks' ? unreadInbox : 0}
      onPress={() => onNavigate(s.target)}
    />
  );

  return (
    <>
      <NavFrame>
        {LEFT.map(slot)}
        <PostButton onPress={onLeggUt} />
        {RIGHT.map(slot)}
        <NavItem label={nb.tabs.meny} icon="menu" active={false} onPress={() => setMenuOpen(true)} />
      </NavFrame>

      <MenySheet visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  nav: {
    position: 'absolute',
    left: sizes.navSide,
    right: sizes.navSide,
    height: sizes.navHeight,
    borderRadius: radius.nav,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 6,
    zIndex: 30,
  },
  bg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: radius.nav, overflow: 'hidden' },
  bgTint: { backgroundColor: colors.navBg },
  item: { flex: 1, height: 66, alignItems: 'center', justifyContent: 'center', gap: 3 },
  ni: {
    width: sizes.navItemW,
    height: sizes.navItemH,
    borderRadius: sizes.navItemH / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  niOn: { backgroundColor: colors.limeTint },
  count: { position: 'absolute', top: -3, right: 2 },
  fabw: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: -30 },
  fabShadow: { width: sizes.fab, height: sizes.fab, borderRadius: sizes.fab / 2 },
  fab: {
    width: sizes.fab,
    height: sizes.fab,
    borderRadius: sizes.fab / 2,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
