import { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { useUnreadConversationCount } from '@/api/queries';
import { AppText } from './ui/Text';
import { Icon, type IconName } from './ui/Icon';
import { MenySheet } from './MenySheet';

export type NavTarget = 'oppdrag' | 'fellesskap' | 'innboks';

const LEFT: { target: NavTarget; label: string; icon: IconName }[] = [
  { target: 'oppdrag', label: nb.tabs.oppdrag, icon: 'clipboard' },
  { target: 'fellesskap', label: nb.tabs.fellesskap, icon: 'users' },
];
const RIGHT: { target: NavTarget; label: string; icon: IconName }[] = [
  { target: 'innboks', label: nb.tabs.innboks, icon: 'message-circle' },
];

/**
 * Presentational bottom nav. The router-driven `TabBar` and the static one on
 * the Legg ut choice screen both render this.
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
  const insets = useSafeAreaInsets();
  const [menuOpen, setMenuOpen] = useState(false);
  const unreadInbox = useUnreadConversationCount();

  const slot = (s: { target: NavTarget; label: string; icon: IconName }) => {
    const isActive = active === s.target;
    const badge = s.target === 'innboks' ? unreadInbox : 0;
    return (
      <Pressable
        key={s.target}
        accessibilityRole="button"
        accessibilityState={{ selected: isActive }}
        accessibilityLabel={badge > 0 ? `${s.label}, ${badge} ulest` : s.label}
        style={styles.slot}
        onPress={() => onNavigate(s.target)}
      >
        <View>
          <Icon name={s.icon} size={23} color={isActive ? 'lime' : 'navy'} />
          {badge > 0 ? <View style={styles.badge} /> : null}
        </View>
        <AppText variant="meta" weight={isActive ? 'bold' : 'regular'} color={isActive ? 'lime' : 'navy'}>
          {s.label}
        </AppText>
        {isActive ? <View style={styles.activeDot} /> : null}
      </Pressable>
    );
  };

  return (
    <>
      <View style={[styles.bar, { paddingBottom: insets.bottom + tokens.space.sm }]}>
        {LEFT.map(slot)}

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: active === 'leggUt' }}
          accessibilityLabel={nb.tabs.leggUt}
          style={styles.slot}
          onPress={onLeggUt}
        >
          <View style={styles.fab}>
            <Icon name="plus" size={27} color="white" />
          </View>
          <AppText
            variant="meta"
            weight={active === 'leggUt' ? 'bold' : 'regular'}
            color={active === 'leggUt' ? 'lime' : 'navy'}
          >
            {nb.tabs.leggUt}
          </AppText>
        </Pressable>

        {RIGHT.map(slot)}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={nb.tabs.meny}
          style={styles.slot}
          onPress={() => setMenuOpen(true)}
        >
          <Icon name="menu" size={22} color="navy" />
          <AppText variant="meta" color="navy">
            {nb.tabs.meny}
          </AppText>
        </Pressable>
      </View>

      <MenySheet visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-around',
    backgroundColor: tokens.color.surface,
    borderTopLeftRadius: tokens.radius.hero,
    borderTopRightRadius: tokens.radius.hero,
    paddingTop: tokens.space.md,
    ...tokens.shadow.fab,
  },
  slot: { flex: 1, alignItems: 'center', gap: 3 },
  badge: {
    position: 'absolute',
    top: -3,
    right: -6,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: tokens.color.alert,
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: tokens.color.lime,
    marginTop: 3,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginTop: -18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.color.lime,
    borderWidth: 4,
    borderColor: tokens.color.surface,
    ...tokens.shadow.fab,
  },
});
